import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  get,
  limitToLast,
  onValue,
  orderByChild,
  query,
  ref,
  runTransaction,
  serverTimestamp,
  set,
} from "firebase/database";
import { firebaseConfig, getFirebaseClient } from "./firebase-client";

export type MatchOutcome = "win" | "loss" | "draw";
export type MatchEndReason = "completed" | "forfeit" | "void";

export type MatchDetails = {
  startedAt: number;
  durationSeconds: number;
  turns: number;
  endReason: MatchEndReason;
  opponentIds: string[];
};

type MatchRecord = MatchDetails & {
  outcome: MatchOutcome | "void";
  endedAt: number;
  suspicious?: boolean;
  suspiciousReasons?: string[];
};

export type RankedProfile = {
  uid: string;
  displayName: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  games: number;
  updatedAt?: number;
  suspiciousWinStreak: number;
  fairPlayWarnings: number;
  fairPlayMessage?: string;
  suspendedUntil?: number;
};

type PrivateRankedRecord = Omit<RankedProfile, "uid" | "fairPlayMessage" | "suspendedUntil"> & {
  fairPlayMessage?: string | null;
  suspendedUntil?: number | null;
  processedMatches?: Record<string, boolean>;
  matchHistory?: Record<string, MatchRecord>;
};

export const INITIAL_RATING = 1000;
export const FAIR_PLAY_WARNING_STREAK = 2;
export const FAIR_PLAY_SUSPENSION_STREAK = 4;
export const FAIR_PLAY_SUSPENSION_MS = 24 * 60 * 60 * 1000;
const MAX_MATCH_HISTORY = 50;

export function ratingTier(rating: number) {
  if (rating >= 1800) return "그랜드마스터";
  if (rating >= 1600) return "마스터";
  if (rating >= 1450) return "다이아몬드";
  if (rating >= 1300) return "플래티넘";
  if (rating >= 1150) return "골드";
  if (rating >= 950) return "실버";
  return "브론즈";
}

const RATING_TIER_BADGES: Record<ReturnType<typeof ratingTier>, string> = {
  브론즈: "/assets/badges/hall-level-10.webp",
  실버: "/assets/badges/hall-level-08.webp",
  골드: "/assets/badges/hall-level-07.webp",
  플래티넘: "/assets/badges/hall-level-05.webp",
  다이아몬드: "/assets/badges/hall-level-03.webp",
  마스터: "/assets/badges/hall-level-02.webp",
  그랜드마스터: "/assets/badges/hall-level-01.webp",
};

export function ratingTierBadge(rating: number) {
  return RATING_TIER_BADGES[ratingTier(rating)];
}

function cleanDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 16);
}

function emptyProfile(uid: string, displayName: string): RankedProfile {
  return {
    uid,
    displayName,
    rating: INITIAL_RATING,
    wins: 0,
    losses: 0,
    draws: 0,
    games: 0,
    suspiciousWinStreak: 0,
    fairPlayWarnings: 0,
  };
}

function normalizeProfile(uid: string, value: Partial<PrivateRankedRecord> | null, fallbackName: string): RankedProfile {
  return {
    uid,
    displayName: cleanDisplayName(value?.displayName ?? fallbackName) || "이름 없는 연구원",
    rating: Number.isFinite(value?.rating) ? Math.max(0, Math.round(value?.rating ?? INITIAL_RATING)) : INITIAL_RATING,
    wins: Math.max(0, Math.round(value?.wins ?? 0)),
    losses: Math.max(0, Math.round(value?.losses ?? 0)),
    draws: Math.max(0, Math.round(value?.draws ?? 0)),
    games: Math.max(0, Math.round(value?.games ?? 0)),
    updatedAt: value?.updatedAt,
    suspiciousWinStreak: Math.max(0, Math.round(value?.suspiciousWinStreak ?? 0)),
    fairPlayWarnings: Math.max(0, Math.round(value?.fairPlayWarnings ?? 0)),
    fairPlayMessage: value?.fairPlayMessage ?? undefined,
    suspendedUntil: value?.suspendedUntil ?? undefined,
  };
}

function publicProfile(profile: RankedProfile) {
  return {
    displayName: profile.displayName,
    rating: profile.rating,
    wins: profile.wins,
    losses: profile.losses,
    draws: profile.draws,
    games: profile.games,
    updatedAt: serverTimestamp(),
  };
}

function sameOpponentSet(left: string[], right: string[]) {
  return [...left].sort().join("|") === [...right].sort().join("|");
}

export function analyzeSuspiciousWin(previous: MatchRecord[], record: MatchRecord) {
  if (record.outcome !== "win" || record.endReason !== "forfeit") return [] as string[];
  const recent = [...previous].sort((left, right) => right.endedAt - left.endedAt).slice(0, 8);
  const reasons: string[] = [];
  if (record.turns <= 8 && record.durationSeconds <= 90) reasons.push("지나치게 짧은 이탈 승리");
  const repeatedOpponents = recent.filter((item) =>
    item.outcome === "win"
    && item.endReason === "forfeit"
    && record.endedAt - item.endedAt <= 24 * 60 * 60 * 1000
    && sameOpponentSet(item.opponentIds, record.opponentIds),
  ).length;
  if (repeatedOpponents >= 2) reasons.push("같은 상대의 반복 이탈");
  const consecutiveFastForfeits = recent.slice(0, 2).every((item) =>
    item.outcome === "win" && item.endReason === "forfeit" && item.durationSeconds <= 120,
  );
  if (recent.length >= 2 && consecutiveFastForfeits) reasons.push("짧은 이탈 승리 연속 발생");
  return reasons.length >= 2 ? reasons : [];
}

function trimMatchRecords(records: Record<string, MatchRecord>) {
  return Object.fromEntries(
    Object.entries(records)
      .sort(([, left], [, right]) => right.endedAt - left.endedAt)
      .slice(0, MAX_MATCH_HISTORY),
  );
}

function authErrorMessage(reason: unknown) {
  const code = typeof reason === "object" && reason && "code" in reason ? String(reason.code) : "";
  if (code.includes("email-already-in-use")) return "이미 가입된 이메일입니다.";
  if (code.includes("invalid-email")) return "이메일 형식을 확인해주세요.";
  if (code.includes("weak-password")) return "비밀번호는 6자 이상 입력해주세요.";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) return "이메일 또는 비밀번호가 맞지 않습니다.";
  if (code.includes("too-many-requests")) return "로그인 시도가 많습니다. 잠시 후 다시 시도해주세요.";
  if (code.includes("operation-not-allowed")) return "Firebase에서 이메일/비밀번호 로그인을 먼저 활성화해주세요.";
  return reason instanceof Error ? reason.message : "계정 요청을 처리하지 못했습니다.";
}

async function ensureRankedProfile(user: User, requestedName?: string) {
  const { database } = await getFirebaseClient();
  const privateReference = ref(database, `rankedUsers/${user.uid}`);
  const existing = (await get(privateReference)).val() as PrivateRankedRecord | null;
  const name = cleanDisplayName(requestedName ?? user.displayName ?? "") || "이름 없는 연구원";
  const profile = existing ? normalizeProfile(user.uid, existing, name) : emptyProfile(user.uid, name);
  if (!existing) await set(privateReference, { ...publicProfile(profile), createdAt: serverTimestamp() });
  await set(ref(database, `rankings/${user.uid}`), publicProfile(profile));
  return profile;
}

export function useRankedAccount() {
  const configured = useMemo(() => Boolean(firebaseConfig()), []);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<RankedProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<RankedProfile[]>([]);
  const [ready, setReady] = useState(!configured);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configured) {
      return;
    }
    let unsubscribeAuth = () => undefined;
    let unsubscribeProfile = () => undefined;
    let unsubscribeLeaderboard = () => undefined;
    void getFirebaseClient().then(({ auth, database }) => {
      unsubscribeAuth = onAuthStateChanged(auth, (nextUser) => {
        unsubscribeProfile();
        setUser(nextUser?.isAnonymous ? null : nextUser);
        if (!nextUser || nextUser.isAnonymous) {
          setProfile(null);
          setReady(true);
          return;
        }
        const profileReference = ref(database, `rankedUsers/${nextUser.uid}`);
        void ensureRankedProfile(nextUser).catch((reason) => setError(authErrorMessage(reason)));
        unsubscribeProfile = onValue(profileReference, (snapshot) => {
          setProfile(normalizeProfile(nextUser.uid, snapshot.val() as PrivateRankedRecord | null, nextUser.displayName ?? ""));
          setReady(true);
        });
      });
      unsubscribeLeaderboard = onValue(
        query(ref(database, "rankings"), orderByChild("rating"), limitToLast(50)),
        (snapshot) => {
          const value = snapshot.val() as Record<string, Omit<RankedProfile, "uid">> | null;
          const rows = Object.entries(value ?? {}).map(([uid, row]) => normalizeProfile(uid, row, row.displayName));
          rows.sort((left, right) => right.rating - left.rating || right.wins - left.wins || left.games - right.games);
          setLeaderboard(rows);
        },
      );
    }).catch((reason) => {
      setError(authErrorMessage(reason));
      setReady(true);
    });
    return () => {
      unsubscribeAuth();
      unsubscribeProfile();
      unsubscribeLeaderboard();
    };
  }, [configured]);

  const createAccount = useCallback(async (email: string, password: string, displayName: string) => {
    const name = cleanDisplayName(displayName);
    if (!name) throw new Error("표시 이름을 입력해주세요.");
    if (password.length < 6) throw new Error("비밀번호는 6자 이상 입력해주세요.");
    setBusy(true);
    setError(null);
    try {
      const { auth } = await getFirebaseClient();
      if (auth.currentUser?.isAnonymous) await signOut(auth);
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: name });
      await ensureRankedProfile(credential.user, name);
      setUser(credential.user);
    } catch (reason) {
      const message = authErrorMessage(reason);
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setBusy(true);
    setError(null);
    try {
      const { auth } = await getFirebaseClient();
      if (auth.currentUser?.isAnonymous) await signOut(auth);
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await ensureRankedProfile(credential.user);
    } catch (reason) {
      const message = authErrorMessage(reason);
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, []);

  const logout = useCallback(async () => {
    const { auth } = await getFirebaseClient();
    await signOut(auth);
    setUser(null);
    setProfile(null);
  }, []);

  const updateDisplayName = useCallback(async (displayName: string) => {
    const currentUser = user;
    const currentProfile = profile;
    const name = cleanDisplayName(displayName);
    if (!currentUser || !currentProfile) throw new Error("로그인 후 닉네임을 수정할 수 있습니다.");
    if (!name) throw new Error("닉네임을 입력해주세요.");
    setBusy(true);
    setError(null);
    try {
      const { database } = await getFirebaseClient();
      await updateProfile(currentUser, { displayName: name });
      const privateReference = ref(database, `rankedUsers/${currentUser.uid}`);
      const result = await runTransaction(privateReference, (current) => {
        const previous = current as PrivateRankedRecord | null;
        const base = normalizeProfile(currentUser.uid, previous, currentProfile.displayName);
        return {
          ...(previous ?? {}),
          displayName: name,
          rating: base.rating,
          wins: base.wins,
          losses: base.losses,
          draws: base.draws,
          games: base.games,
          updatedAt: Date.now(),
        } satisfies PrivateRankedRecord;
      }, { applyLocally: false });
      const updated = normalizeProfile(currentUser.uid, result.snapshot.val() as PrivateRankedRecord, name);
      await set(ref(database, `rankings/${currentUser.uid}`), publicProfile(updated));
      return name;
    } catch (reason) {
      const message = authErrorMessage(reason);
      setError(message);
      throw new Error(message);
    } finally {
      setBusy(false);
    }
  }, [profile, user]);

  const recordMatch = useCallback(async (
    matchId: string,
    outcome: MatchOutcome | null,
    opponentRating: number,
    details: MatchDetails,
  ) => {
    const currentUser = user;
    if (!currentUser || currentUser.isAnonymous || !profile) return null;
    const { database } = await getFirebaseClient();
    const privateReference = ref(database, `rankedUsers/${currentUser.uid}`);
    const result = await runTransaction(privateReference, (current) => {
      const previous = current as PrivateRankedRecord | null;
      if (previous?.processedMatches?.[matchId]) return undefined;
      const base = normalizeProfile(currentUser.uid, previous, currentUser.displayName ?? profile.displayName);
      const endedAt = Date.now();
      const matchRecord: MatchRecord = {
        ...details,
        durationSeconds: Math.max(0, Math.round(details.durationSeconds)),
        turns: Math.max(0, Math.round(details.turns)),
        opponentIds: [...new Set(details.opponentIds)].slice(0, 2),
        outcome: outcome ?? "void",
        endedAt,
      };
      const previousHistory = previous?.matchHistory ?? {};
      const suspiciousReasons = analyzeSuspiciousWin(Object.values(previousHistory), matchRecord);
      if (suspiciousReasons.length) {
        matchRecord.suspicious = true;
        matchRecord.suspiciousReasons = suspiciousReasons;
      }
      const suspiciousWinStreak = suspiciousReasons.length
        ? base.suspiciousWinStreak + 1
        : outcome && details.endReason === "completed" ? 0 : base.suspiciousWinStreak;
      const shouldWarn = suspiciousWinStreak >= FAIR_PLAY_WARNING_STREAK;
      const shouldSuspend = suspiciousWinStreak >= FAIR_PLAY_SUSPENSION_STREAK;
      const fairPlayWarnings = base.fairPlayWarnings + (shouldWarn ? 1 : 0);
      const fairPlayMessage = shouldSuspend
        ? "비정상적인 이탈 승리가 반복되어 온라인 대전 계정이 24시간 정지되었습니다."
        : shouldWarn
          ? `비정상적인 이탈 승리가 ${suspiciousWinStreak}회 연속 감지되었습니다. 반복되면 계정이 정지됩니다.`
          : undefined;
      const actual = outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;
      const expected = 1 / (1 + 10 ** ((opponentRating - base.rating) / 400));
      const delta = outcome ? Math.round(32 * (actual - expected)) : 0;
      const matchHistory = trimMatchRecords({ ...previousHistory, [matchId]: matchRecord });
      const processedMatches = Object.fromEntries(Object.keys(matchHistory).map((id) => [id, true]));
      return {
        ...(previous ?? {}),
        displayName: base.displayName,
        rating: Math.max(0, base.rating + delta),
        wins: base.wins + (outcome === "win" ? 1 : 0),
        losses: base.losses + (outcome === "loss" ? 1 : 0),
        draws: base.draws + (outcome === "draw" ? 1 : 0),
        games: base.games + (outcome ? 1 : 0),
        updatedAt: serverTimestamp(),
        suspiciousWinStreak,
        fairPlayWarnings,
        fairPlayMessage: fairPlayMessage ?? null,
        suspendedUntil: shouldSuspend ? endedAt + FAIR_PLAY_SUSPENSION_MS : (base.suspendedUntil ?? null),
        processedMatches,
        matchHistory,
      } satisfies PrivateRankedRecord;
    }, { applyLocally: false });
    if (!result.committed) return null;
    const updated = normalizeProfile(currentUser.uid, result.snapshot.val() as PrivateRankedRecord, profile.displayName);
    await set(ref(database, `rankings/${currentUser.uid}`), publicProfile(updated));
    return { ratingDelta: updated.rating - profile.rating, notice: updated.fairPlayMessage ?? null };
  }, [profile, user]);

  const suspended = Boolean(profile?.suspendedUntil && profile.suspendedUntil > Date.now());
  const suspensionMessage = suspended
    ? `${profile?.fairPlayMessage ?? "온라인 대전 계정이 일시 정지되었습니다."} 정지 해제: ${new Date(profile?.suspendedUntil ?? 0).toLocaleString("ko-KR")}`
    : profile?.fairPlayMessage;

  return { configured, user, profile, leaderboard, ready, busy, error, suspended, suspensionMessage, createAccount, login, logout, updateDisplayName, recordMatch };
}
