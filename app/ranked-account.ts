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

export type RankedProfile = {
  uid: string;
  displayName: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  games: number;
  updatedAt?: number;
};

type PrivateRankedRecord = Omit<RankedProfile, "uid"> & {
  processedMatches?: Record<string, boolean>;
};

export const INITIAL_RATING = 1000;

export function ratingTier(rating: number) {
  if (rating >= 1800) return "그랜드마스터";
  if (rating >= 1600) return "마스터";
  if (rating >= 1450) return "다이아몬드";
  if (rating >= 1300) return "플래티넘";
  if (rating >= 1150) return "골드";
  if (rating >= 950) return "실버";
  return "브론즈";
}

function cleanDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, 16);
}

function emptyProfile(uid: string, displayName: string): RankedProfile {
  return { uid, displayName, rating: INITIAL_RATING, wins: 0, losses: 0, draws: 0, games: 0 };
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

  const recordResult = useCallback(async (matchId: string, outcome: MatchOutcome, opponentRating: number) => {
    const currentUser = user;
    if (!currentUser || currentUser.isAnonymous || !profile) return null;
    const { database } = await getFirebaseClient();
    const privateReference = ref(database, `rankedUsers/${currentUser.uid}`);
    const result = await runTransaction(privateReference, (current) => {
      const previous = current as PrivateRankedRecord | null;
      if (previous?.processedMatches?.[matchId]) return undefined;
      const base = normalizeProfile(currentUser.uid, previous, currentUser.displayName ?? profile.displayName);
      const actual = outcome === "win" ? 1 : outcome === "draw" ? 0.5 : 0;
      const expected = 1 / (1 + 10 ** ((opponentRating - base.rating) / 400));
      const delta = Math.round(32 * (actual - expected));
      return {
        displayName: base.displayName,
        rating: Math.max(0, base.rating + delta),
        wins: base.wins + (outcome === "win" ? 1 : 0),
        losses: base.losses + (outcome === "loss" ? 1 : 0),
        draws: base.draws + (outcome === "draw" ? 1 : 0),
        games: base.games + 1,
        updatedAt: serverTimestamp(),
        processedMatches: { ...(previous?.processedMatches ?? {}), [matchId]: true },
      } satisfies PrivateRankedRecord;
    }, { applyLocally: false });
    if (!result.committed) return null;
    const updated = normalizeProfile(currentUser.uid, result.snapshot.val() as PrivateRankedRecord, profile.displayName);
    await set(ref(database, `rankings/${currentUser.uid}`), publicProfile(updated));
    return updated.rating - profile.rating;
  }, [profile, user]);

  return { configured, user, profile, leaderboard, ready, busy, error, createAccount, login, logout, recordResult };
}
