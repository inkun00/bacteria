import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged, signInAnonymously, type Auth } from "firebase/auth";
import {
  equalTo,
  get,
  limitToLast,
  onChildAdded,
  onDisconnect,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  type Database,
  type Unsubscribe,
} from "firebase/database";
import type { BoardSize, Cell, Move, NumberCell, Player, RelationMode } from "./game";
import { firebaseConfig, getFirebaseClient } from "./firebase-client";

export type OnlinePlayer = {
  uid: string;
  name: string;
  slot: number;
  connected: boolean;
  rating: number;
};

export type OnlineMatchSize = 2 | 4;

export type OnlineRoomSummary = {
  code: string;
  title: string;
  hostName: string;
  hostRating: number;
  boardSize: BoardSize;
  matchSize: OnlineMatchSize;
  playerCount: number;
  createdAt: number;
  hasPassword: boolean;
};

export type OnlineMoveResult = {
  board: Cell[];
  numbers: NumberCell[];
  infected: number[];
  resisted: number[];
  attackerNumber: number;
  infectionNumber: number;
  parentNumber: number;
  spawnedNumber: number;
};

export type OnlineGameMessage =
  | {
      kind: "start";
      board: Cell[];
      numbers: NumberCell[];
      boardSize: BoardSize;
      activeSlot: number;
      matchId: string;
      startedAt: number;
    }
  | {
      kind: "move-request";
      requestId: string;
      move: Move;
      mode: RelationMode;
      useBomb: boolean;
    }
  | {
      kind: "move";
      requestId: string;
      actorSlot: number;
      player: Player;
      move: Move;
      mode: RelationMode;
      useBomb: boolean;
      nextSlot: number;
      result: OnlineMoveResult;
    }
  | {
      kind: "player-left";
      uid: string;
      slot: number;
    };

type RoomRecord = {
  hostId?: string;
  title?: string;
  passwordHash?: string;
  hostLastSeen?: number;
  boardSize?: BoardSize;
  matchSize?: OnlineMatchSize;
  status?: "waiting" | "playing";
  players?: Record<string, Omit<OnlinePlayer, "uid" | "connected"> & { joinedAt?: number }>;
  slotOwners?: Record<string, string>;
  createdAt?: number;
};

type SignalRecord = {
  from: string;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type OnlineRoomStatus = "idle" | "joining" | "waiting" | "connecting" | "ready" | "playing" | "disconnected" | "error";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_CODE_LENGTH = 6;
const DEFAULT_MATCH_SIZE: OnlineMatchSize = 4;
const ROOM_HEARTBEAT_INTERVAL_MS = 15_000;
const ROOM_STALE_AFTER_MS = 60_000;
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

function createRoomCode() {
  const random = new Uint32Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(random);
  return Array.from(random, (value) => ROOM_ALPHABET[value % ROOM_ALPHABET.length]).join("");
}

function cleanName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 16) || "익명 연구원";
}

function cleanCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, "").slice(0, ROOM_CODE_LENGTH);
}

function cleanRoomTitle(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 30);
}

async function hashRoomPassword(code: string, password: string) {
  if (!password) return "";
  const bytes = new TextEncoder().encode(`${code}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function waitForUser(auth: Auth) {
  if (auth.currentUser) return auth.currentUser;
  await signInAnonymously(auth);
  if (auth.currentUser) return auth.currentUser;
  return await new Promise<NonNullable<Auth["currentUser"]>>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      reject(new Error("로그인 시간이 초과되었습니다."));
    }, 10_000);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    }, reject);
  });
}

export function teamForSlot(slot: number): Player {
  return slot % 2 === 0 ? 1 : 2;
}

export function useOnlineRoom(onMessage: (message: OnlineGameMessage, senderUid: string) => void) {
  const config = useMemo(() => firebaseConfig(), []);
  const [status, setStatus] = useState<OnlineRoomStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [localUid, setLocalUid] = useState("");
  const [hostUid, setHostUid] = useState("");
  const [localSlot, setLocalSlot] = useState<number | null>(null);
  const [roomBoardSize, setRoomBoardSize] = useState<BoardSize>(7);
  const [matchSize, setMatchSize] = useState<OnlineMatchSize>(DEFAULT_MATCH_SIZE);
  const [availableRooms, setAvailableRooms] = useState<OnlineRoomSummary[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsRefreshedAt, setRoomsRefreshedAt] = useState<number | null>(null);
  const databaseRef = useRef<Database | null>(null);
  const roomCodeRef = useRef("");
  const localUidRef = useRef("");
  const hostUidRef = useRef("");
  const localSlotRef = useRef<number | null>(null);
  const isHostRef = useRef(false);
  const peerConnections = useRef(new Map<string, RTCPeerConnection>());
  const dataChannels = useRef(new Map<string, RTCDataChannel>());
  const pendingCandidates = useRef(new Map<string, RTCIceCandidateInit[]>());
  const offeredPeers = useRef(new Set<string>());
  const unsubscribes = useRef<Unsubscribe[]>([]);
  const roomsUnsubscribe = useRef<Unsubscribe | null>(null);
  const hostHeartbeatTimer = useRef<number | null>(null);
  const onMessageRef = useRef(onMessage);
  const leavingRef = useRef(false);
  const previousPlayersRef = useRef(new Map<string, number>());
  const roomPlayingRef = useRef(false);
  const departureReportedRef = useRef(false);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const stopHostHeartbeat = useCallback(() => {
    if (hostHeartbeatTimer.current !== null) window.clearInterval(hostHeartbeatTimer.current);
    hostHeartbeatTimer.current = null;
  }, []);

  const startHostHeartbeat = useCallback((database: Database, code: string) => {
    stopHostHeartbeat();
    const updateHeartbeat = () => void set(ref(database, `rooms/${code}/hostLastSeen`), serverTimestamp()).catch(() => undefined);
    updateHeartbeat();
    hostHeartbeatTimer.current = window.setInterval(updateHeartbeat, ROOM_HEARTBEAT_INTERVAL_MS);
  }, [stopHostHeartbeat]);

  const refreshPlayerConnections = useCallback(() => {
    setPlayers((current) => current.map((player) => ({
      ...player,
      connected: player.uid === localUidRef.current
        || dataChannels.current.get(player.uid)?.readyState === "open",
    })));
  }, []);

  const updateReadyStatus = useCallback(() => {
    const openChannels = [...dataChannels.current.values()].filter((channel) => channel.readyState === "open").length;
    if (isHostRef.current) {
      setStatus(players.length === matchSize && openChannels === matchSize - 1 ? "ready" : openChannels ? "connecting" : "waiting");
    } else {
      setStatus(openChannels === 1 ? "ready" : "connecting");
    }
  }, [matchSize, players.length]);

  const sendSignal = useCallback(async (recipientUid: string, signal: Omit<SignalRecord, "from">) => {
    const database = databaseRef.current;
    const code = roomCodeRef.current;
    const uid = localUidRef.current;
    if (!database || !code || !uid) return;
    await push(ref(database, `rooms/${code}/signals/${recipientUid}`), { from: uid, ...signal });
  }, []);

  const wireChannel = useCallback((peerUid: string, channel: RTCDataChannel) => {
    dataChannels.current.set(peerUid, channel);
    channel.onopen = () => {
      refreshPlayerConnections();
      updateReadyStatus();
    };
    channel.onclose = () => {
      refreshPlayerConnections();
      setStatus("disconnected");
      setError("플레이어와 직접 연결이 끊어졌습니다. TURN을 사용하지 않아 자동 우회 연결은 제공되지 않습니다.");
    };
    channel.onerror = () => {
      setStatus("error");
      setError("WebRTC 직접 연결 중 오류가 발생했습니다.");
    };
    channel.onmessage = (event) => {
      try {
        const message = JSON.parse(String(event.data)) as OnlineGameMessage;
        if (message.kind === "player-left") return;
        if (message.kind === "start" && peerUid === hostUidRef.current) {
          roomPlayingRef.current = true;
          departureReportedRef.current = false;
        }
        onMessageRef.current(message, peerUid);
      } catch {
        setError("받은 게임 데이터를 해석할 수 없습니다.");
      }
    };
  }, [refreshPlayerConnections, updateReadyStatus]);

  const createPeerConnection = useCallback((peerUid: string) => {
    const existing = peerConnections.current.get(peerUid);
    if (existing) return existing;
    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceTransportPolicy: "all" });
    peerConnections.current.set(peerUid, connection);
    connection.onicecandidate = (event) => {
      if (event.candidate) void sendSignal(peerUid, { candidate: event.candidate.toJSON() });
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === "failed") {
        setStatus("error");
        setError("이 네트워크에서는 직접 연결할 수 없습니다. 다른 Wi-Fi나 네트워크에서 다시 시도해주세요.");
      }
      if (connection.connectionState === "disconnected" || connection.connectionState === "closed") {
        refreshPlayerConnections();
      }
    };
    connection.ondatachannel = (event) => wireChannel(peerUid, event.channel);
    return connection;
  }, [refreshPlayerConnections, sendSignal, wireChannel]);

  const flushCandidates = useCallback(async (peerUid: string, connection: RTCPeerConnection) => {
    const candidates = pendingCandidates.current.get(peerUid) ?? [];
    pendingCandidates.current.delete(peerUid);
    for (const candidate of candidates) await connection.addIceCandidate(candidate);
  }, []);

  const handleSignal = useCallback(async (signalKey: string, signal: SignalRecord) => {
    const database = databaseRef.current;
    const code = roomCodeRef.current;
    const uid = localUidRef.current;
    if (!database || !code || !uid || signal.from === uid) return;
    try {
      const connection = createPeerConnection(signal.from);
      if (signal.description?.type === "offer") {
        await connection.setRemoteDescription(signal.description);
        await flushCandidates(signal.from, connection);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        await sendSignal(signal.from, { description: answer });
      } else if (signal.description?.type === "answer") {
        await connection.setRemoteDescription(signal.description);
        await flushCandidates(signal.from, connection);
      } else if (signal.candidate) {
        if (connection.remoteDescription) await connection.addIceCandidate(signal.candidate);
        else pendingCandidates.current.set(signal.from, [...(pendingCandidates.current.get(signal.from) ?? []), signal.candidate]);
      }
    } finally {
      await remove(ref(database, `rooms/${code}/signals/${uid}/${signalKey}`));
    }
  }, [createPeerConnection, flushCandidates, sendSignal]);

  const offerToPeer = useCallback(async (peerUid: string) => {
    if (offeredPeers.current.has(peerUid)) return;
    offeredPeers.current.add(peerUid);
    const connection = createPeerConnection(peerUid);
    const channel = connection.createDataChannel("factor-force", { ordered: true });
    wireChannel(peerUid, channel);
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    await sendSignal(peerUid, { description: offer });
  }, [createPeerConnection, sendSignal, wireChannel]);

  const getServices = useCallback(async () => {
    if (!config) throw new Error("Firebase 환경 설정이 없습니다. .env.local을 설정해주세요.");
    const { auth, database } = await getFirebaseClient();
    databaseRef.current = database;
    const user = await waitForUser(auth);
    localUidRef.current = user.uid;
    setLocalUid(user.uid);
    return { database, uid: user.uid };
  }, [config]);

  const subscribeToRoom = useCallback((database: Database, code: string, uid: string) => {
    unsubscribes.current.push(onValue(ref(database, `rooms/${code}`), (snapshot) => {
      const room = snapshot.val() as RoomRecord | null;
      if (!room) {
        if (!leavingRef.current) {
          if (roomPlayingRef.current && !departureReportedRef.current) {
            const host = [...previousPlayersRef.current.entries()].find(([, slot]) => slot === 0);
            if (host) {
              departureReportedRef.current = true;
              onMessageRef.current({ kind: "player-left", uid: host[0], slot: host[1] }, host[0]);
            }
          }
          setStatus("disconnected");
          setError("방이 종료되었거나 호스트 연결이 끊어졌습니다.");
        }
        return;
      }
      const nextPlayers = Object.entries(room.players ?? {})
        .map(([playerUid, player]) => ({
          uid: playerUid,
          name: player.name,
          slot: player.slot,
          rating: Number.isFinite(player.rating) ? Math.max(0, Math.round(player.rating)) : 1000,
          connected: playerUid === uid || dataChannels.current.get(playerUid)?.readyState === "open",
        }))
        .sort((left, right) => left.slot - right.slot);
      const nextPlayerSlots = new Map(nextPlayers.map((player) => [player.uid, player.slot]));
      if (roomPlayingRef.current && !departureReportedRef.current) {
        const departed = [...previousPlayersRef.current.entries()].find(([playerUid]) => !nextPlayerSlots.has(playerUid));
        if (departed) {
          departureReportedRef.current = true;
          onMessageRef.current({ kind: "player-left", uid: departed[0], slot: departed[1] }, departed[0]);
        }
      }
      previousPlayersRef.current = nextPlayerSlots;
      roomPlayingRef.current = room.status === "playing";
      setPlayers(nextPlayers);
      setRoomTitle(cleanRoomTitle(room.title ?? "") || `${cleanName(nextPlayers[0]?.name ?? "방장")}의 게임방`);
      setRoomBoardSize(room.boardSize ?? 7);
      setMatchSize(room.matchSize === 2 ? 2 : DEFAULT_MATCH_SIZE);
      hostUidRef.current = room.hostId ?? "";
      setHostUid(room.hostId ?? "");
      const mine = nextPlayers.find((player) => player.uid === uid);
      localSlotRef.current = mine?.slot ?? null;
      setLocalSlot(mine?.slot ?? null);
      isHostRef.current = room.hostId === uid;
      if (room.status === "playing") setStatus("playing");
      if (room.hostId === uid) {
        nextPlayers.filter((player) => player.uid !== uid).forEach((player) => void offerToPeer(player.uid));
      }
    }));
    unsubscribes.current.push(onChildAdded(ref(database, `rooms/${code}/signals/${uid}`), (snapshot) => {
      const signal = snapshot.val() as SignalRecord;
      if (signal) void handleSignal(snapshot.key ?? "", signal);
    }));
  }, [handleSignal, offerToPeer]);

  const leave = useCallback(async () => {
    leavingRef.current = true;
    stopHostHeartbeat();
    unsubscribes.current.forEach((unsubscribe) => unsubscribe());
    unsubscribes.current = [];
    dataChannels.current.forEach((channel) => channel.close());
    peerConnections.current.forEach((connection) => connection.close());
    dataChannels.current.clear();
    peerConnections.current.clear();
    pendingCandidates.current.clear();
    offeredPeers.current.clear();
    previousPlayersRef.current.clear();
    roomPlayingRef.current = false;
    departureReportedRef.current = false;
    const database = databaseRef.current;
    const code = roomCodeRef.current;
    const uid = localUidRef.current;
    const slot = localSlotRef.current;
    if (database && code && uid) {
      if (isHostRef.current) await remove(ref(database, `rooms/${code}`)).catch(() => undefined);
      else await Promise.all([
        remove(ref(database, `rooms/${code}/players/${uid}`)).catch(() => undefined),
        slot === null ? Promise.resolve() : remove(ref(database, `rooms/${code}/slotOwners/slot${slot}`)).catch(() => undefined),
      ]);
    }
    roomCodeRef.current = "";
    hostUidRef.current = "";
    localSlotRef.current = null;
    isHostRef.current = false;
    setRoomCode("");
    setRoomTitle("");
    setPlayers([]);
    setHostUid("");
    setLocalSlot(null);
    setStatus("idle");
    setError(null);
    leavingRef.current = false;
  }, [stopHostHeartbeat]);

  const createRoom = useCallback(async (name: string, boardSize: BoardSize, requestedMatchSize: OnlineMatchSize, rating = 1000, title = "", password = "") => {
    const cleanedTitle = cleanRoomTitle(title);
    if (!cleanedTitle) {
      setStatus("error");
      setError("방 제목을 입력해주세요.");
      return false;
    }
    await leave();
    setStatus("joining");
    setError(null);
    try {
      const { database, uid } = await getServices();
      let code = "";
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = createRoomCode();
        const passwordHash = await hashRoomPassword(candidate, password);
        const result = await runTransaction(ref(database, `rooms/${candidate}`), (current) => current === null ? {
          hostId: uid,
          title: cleanedTitle,
          ...(passwordHash ? { passwordHash } : {}),
          hostLastSeen: serverTimestamp(),
          boardSize,
          matchSize: requestedMatchSize,
          status: "waiting",
          createdAt: serverTimestamp(),
          players: { [uid]: { name: cleanName(name), slot: 0, rating: Math.max(0, Math.round(rating)), joinedAt: serverTimestamp() } },
          slotOwners: { slot0: uid },
        } : undefined, { applyLocally: false });
        if (result.committed) {
          code = candidate;
          break;
        }
      }
      if (!code) throw new Error("방 코드를 만들지 못했습니다. 다시 시도해주세요.");
      await onDisconnect(ref(database, `rooms/${code}`)).remove();
      roomCodeRef.current = code;
      hostUidRef.current = uid;
      localSlotRef.current = 0;
      isHostRef.current = true;
      setRoomCode(code);
      setRoomTitle(cleanedTitle);
      setHostUid(uid);
      setLocalSlot(0);
      setRoomBoardSize(boardSize);
      setMatchSize(requestedMatchSize);
      subscribeToRoom(database, code, uid);
      startHostHeartbeat(database, code);
      setStatus("waiting");
      return true;
    } catch (reason) {
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "방을 만들지 못했습니다.");
      return false;
    }
  }, [getServices, leave, startHostHeartbeat, subscribeToRoom]);

  const joinRoom = useCallback(async (rawCode: string, name: string, rating = 1000, password = "") => {
    await leave();
    setStatus("joining");
    setError(null);
    let reservation: { database: Database; code: string; uid: string; slot: number } | null = null;
    try {
      const code = cleanCode(rawCode);
      if (code.length !== ROOM_CODE_LENGTH) throw new Error("6자리 방 코드를 입력해주세요.");
      const { database, uid } = await getServices();
      const roomReference = ref(database, `rooms/${code}`);
      const initialRoom = (await get(roomReference)).val() as RoomRecord | null;
      if (!initialRoom || initialRoom.status !== "waiting") throw new Error("방을 찾을 수 없거나 이미 게임 중입니다.");
      if (initialRoom.passwordHash) {
        if (!password) {
          setStatus("idle");
          return "password-required" as const;
        }
        const passwordHash = await hashRoomPassword(code, password);
        if (passwordHash !== initialRoom.passwordHash) throw new Error("방 비밀번호가 올바르지 않습니다.");
      }
      const roomMatchSize = initialRoom.matchSize === 2 ? 2 : DEFAULT_MATCH_SIZE;
      let slot: number | undefined;
      for (let candidate = 1; candidate < roomMatchSize; candidate += 1) {
        const slotResult = await runTransaction(
          ref(database, `rooms/${code}/slotOwners/slot${candidate}`),
          (current) => current === null ? uid : undefined,
          { applyLocally: false },
        );
        if (slotResult.committed && slotResult.snapshot.val() === uid) {
          slot = candidate;
          break;
        }
      }
      if (slot === undefined) throw new Error("방을 찾을 수 없거나 이미 가득 찼습니다.");
      reservation = { database, code, uid, slot };
      const playerReference = ref(database, `rooms/${code}/players/${uid}`);
      const slotReference = ref(database, `rooms/${code}/slotOwners/slot${slot}`);
      await set(playerReference, { name: cleanName(name), slot, rating: Math.max(0, Math.round(rating)), joinedAt: serverTimestamp() });
      const room = (await get(roomReference)).val() as RoomRecord | null;
      if (!room?.players?.[uid]) throw new Error("방 참가 정보를 확인하지 못했습니다.");
      await Promise.all([onDisconnect(playerReference).remove(), onDisconnect(slotReference).remove()]);
      roomCodeRef.current = code;
      hostUidRef.current = room.hostId ?? "";
      localSlotRef.current = slot;
      isHostRef.current = false;
      setRoomCode(code);
      setRoomTitle(cleanRoomTitle(room.title ?? "") || `${cleanName(room.players?.[room.hostId ?? ""]?.name ?? "방장")}의 게임방`);
      setHostUid(room.hostId ?? "");
      setLocalSlot(slot);
      setRoomBoardSize(room.boardSize ?? 7);
      setMatchSize(room.matchSize === 2 ? 2 : DEFAULT_MATCH_SIZE);
      subscribeToRoom(database, code, uid);
      reservation = null;
      setStatus("connecting");
      return "joined" as const;
    } catch (reason) {
      if (reservation) {
        await Promise.all([
          remove(ref(reservation.database, `rooms/${reservation.code}/players/${reservation.uid}`)).catch(() => undefined),
          remove(ref(reservation.database, `rooms/${reservation.code}/slotOwners/slot${reservation.slot}`)).catch(() => undefined),
        ]);
      }
      setStatus("error");
      setError(reason instanceof Error ? reason.message : "방에 참가하지 못했습니다.");
      return "failed" as const;
    }
  }, [getServices, leave, subscribeToRoom]);

  const refreshRooms = useCallback(async () => {
    setRoomsLoading(true);
    setError(null);
    try {
      const { database } = await getServices();
      const roomsQuery = query(
        ref(database, "rooms"),
        orderByChild("status"),
        equalTo("waiting"),
        limitToLast(40),
      );
      roomsUnsubscribe.current?.();
      roomsUnsubscribe.current = onValue(roomsQuery, (snapshot) => {
        const value = snapshot.val() as Record<string, RoomRecord> | null;
        const staleRoomCodes: string[] = [];
        const rooms = Object.entries(value ?? {}).flatMap(([code, room]) => {
          const roomMatchSize: OnlineMatchSize = room.matchSize === 2 ? 2 : DEFAULT_MATCH_SIZE;
          const roomPlayers = Object.entries(room.players ?? {});
          const host = room.hostId ? room.players?.[room.hostId] : roomPlayers.find(([, player]) => player.slot === 0)?.[1];
          const lastSeen = Number(room.hostLastSeen ?? room.createdAt ?? 0);
          const isStale = !Number.isFinite(lastSeen) || lastSeen <= 0 || Date.now() - lastSeen > ROOM_STALE_AFTER_MS;
          if (isStale) staleRoomCodes.push(code);
          if (room.status !== "waiting" || roomPlayers.length >= roomMatchSize || !host || isStale) return [];
          return [{
            code,
            title: cleanRoomTitle(room.title ?? "") || `${cleanName(host.name)}의 게임방`,
            hostName: cleanName(host.name),
            hostRating: Number.isFinite(host.rating) ? Math.max(0, Math.round(host.rating ?? 1000)) : 1000,
            boardSize: room.boardSize === 9 || room.boardSize === 11 ? room.boardSize : 7,
            matchSize: roomMatchSize,
            playerCount: roomPlayers.length,
            createdAt: Number.isFinite(room.createdAt) ? room.createdAt ?? 0 : 0,
            hasPassword: Boolean(room.passwordHash),
          } satisfies OnlineRoomSummary];
        });
        staleRoomCodes.forEach((code) => void remove(ref(database, `rooms/${code}`)).catch(() => undefined));
        rooms.sort((left, right) => right.createdAt - left.createdAt || left.code.localeCompare(right.code));
        setAvailableRooms(rooms);
        setRoomsRefreshedAt(Date.now());
        setRoomsLoading(false);
      }, (reason) => {
        setError(reason instanceof Error ? reason.message : "방 목록을 불러오지 못했습니다.");
        setRoomsLoading(false);
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "방 목록을 불러오지 못했습니다.");
      setRoomsLoading(false);
    }
  }, [getServices]);

  const sendToHost = useCallback((message: OnlineGameMessage) => {
    const uid = localUidRef.current;
    if (isHostRef.current) {
      onMessageRef.current(message, uid);
      return true;
    }
    const channel = dataChannels.current.get(hostUidRef.current);
    if (!channel || channel.readyState !== "open") {
      setError("호스트와 직접 연결되어 있지 않습니다.");
      return false;
    }
    channel.send(JSON.stringify(message));
    return true;
  }, []);

  const broadcast = useCallback(async (message: OnlineGameMessage) => {
    if (!isHostRef.current) return false;
    const payload = JSON.stringify(message);
    dataChannels.current.forEach((channel) => {
      if (channel.readyState === "open") channel.send(payload);
    });
    onMessageRef.current(message, localUidRef.current);
    if (message.kind === "start") {
      const database = databaseRef.current;
      if (database && roomCodeRef.current) {
        await set(ref(database, `rooms/${roomCodeRef.current}/status`), "playing");
      }
      roomPlayingRef.current = true;
      departureReportedRef.current = false;
      setStatus("playing");
    }
    return true;
  }, []);

  useEffect(() => () => {
    stopHostHeartbeat();
    roomsUnsubscribe.current?.();
    unsubscribes.current.forEach((unsubscribe) => unsubscribe());
    dataChannels.current.forEach((channel) => channel.close());
    peerConnections.current.forEach((connection) => connection.close());
    const database = databaseRef.current;
    const code = roomCodeRef.current;
    const uid = localUidRef.current;
    const slot = localSlotRef.current;
    if (!database || !code || !uid) return;
    if (isHostRef.current) {
      void remove(ref(database, `rooms/${code}`));
      return;
    }
    void remove(ref(database, `rooms/${code}/players/${uid}`));
    if (slot !== null) void remove(ref(database, `rooms/${code}/slotOwners/slot${slot}`));
  }, [stopHostHeartbeat]);

  return {
    configured: Boolean(config) && typeof RTCPeerConnection !== "undefined",
    status,
    error,
    roomCode,
    roomTitle,
    roomBoardSize,
    matchSize,
    players,
    localUid,
    localSlot,
    isHost: Boolean(localUid && localUid === hostUid),
    allConnected: players.length === matchSize && players.every((player) => player.connected),
    availableRooms,
    roomsLoading,
    roomsRefreshedAt,
    refreshRooms,
    createRoom,
    joinRoom,
    leave,
    sendToHost,
    broadcast,
  };
}
