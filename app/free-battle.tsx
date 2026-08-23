import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { assetUrl } from "./assets";
import { GameExitPrompt, usePreventGameUnload } from "./game-navigation";
import {
  teamForSlot,
  useOnlineRoom,
  type OnlineGameMessage,
  type OnlineMatchSize,
  type OnlineMoveResult,
  type OnlineRoomSummary,
} from "./online-room";
import {
  applyMove,
  chooseAiAction,
  compositeNumberAt,
  createBoard,
  createNumbers,
  factorPairs,
  getBoardSize,
  isRelation,
  legalMoves,
  score,
  type Cell,
  type BoardSize,
  type Difficulty,
  type Move,
  type NumberCell,
  type Player,
  type RelationMode,
} from "./game";
import { ratingTier, ratingTierBadge, useRankedAccount } from "./ranked-account";

type Mode = "ai" | "local" | "online";
type Settings = { mode: Mode; difficulty: Difficulty; boardSize: BoardSize };
type Snapshot = {
  board: Cell[];
  numbers: NumberCell[];
  player: Player;
  move: number;
  captures: [number, number];
  bombs: [number, number];
  bombCharge: [number, number];
  relationMode: RelationMode;
};

type SavedGame = {
  version: 1;
  started?: boolean;
  board: Cell[];
  numbers: NumberCell[];
  currentPlayer: Player;
  selected: number | null;
  relationMode: RelationMode;
  settings: Settings;
  setupOpen: boolean;
  gameOver: boolean;
  winner: 0 | Player;
  moveNumber: number;
  elapsed: number;
  captures: [number, number];
  bombs: [number, number];
  bombCharge: [number, number];
  bombArmed: boolean;
  history: Snapshot[];
};

type InfectionProjectile = {
  id: number;
  from: number;
  to: number;
  player: Player;
  bomb: boolean;
};

const INFECTION_STAGGER_MS = 45;

const DIFFICULTY = {
  easy: { label: "쉬움", detail: "천천히 생각해요", bars: 1 },
  medium: { label: "보통", detail: "알맞게 생각해요", bars: 2 },
  hard: { label: "어려움", detail: "여러 수를 미리 봐요", bars: 3 },
} as const;
const BOARD_SIZES: BoardSize[] = [7, 9, 11];

const SAVED_GAME_KEY = "petri-math-lab-game-v1";

function formatTime(seconds: number) {
  const min = Math.floor(seconds / 60).toString().padStart(2, "0");
  const sec = (seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function modeLabel(mode: RelationMode) {
  if (mode === "divisor") return "약수";
  if (mode === "multiple") return "배수";
  return "분열";
}

function nextMode(mode: RelationMode): RelationMode {
  if (mode === "divisor") return "multiple";
  if (mode === "multiple") return "split";
  return "divisor";
}

function normalizeSettings(value: Partial<Settings> | undefined, fallbackSize: BoardSize = 7): Settings {
  const mode: Mode = value?.mode === "local" || value?.mode === "online" ? value.mode : "ai";
  const difficulty: Difficulty = value?.difficulty === "easy" || value?.difficulty === "hard" ? value.difficulty : "medium";
  const boardSize = BOARD_SIZES.includes(value?.boardSize as BoardSize) ? value?.boardSize as BoardSize : fallbackSize;
  return { mode, difficulty, boardSize };
}

function Germ({
  player,
  infection = false,
  number,
  mode,
}: {
  player: Player;
  infection?: boolean;
  number?: number;
  mode?: RelationMode;
}) {
  const sprite = infection ? "bacteria-infection.webp" : "bacteria-idle.webp";

  return (
    <span
      className={`germ-sprite p${player} ${infection ? "infection" : "idle"}`}
      aria-hidden="true"
      style={{ backgroundImage: `url("${assetUrl(`/assets/${sprite}`)}")` }}
    >
      {number !== undefined && <b className="germ-number">{number}</b>}
      {mode && <em className={`germ-mode ${mode}`}>{mode === "divisor" ? "약" : mode === "multiple" ? "배" : "분"}</em>}
    </span>
  );
}

function DifficultyBars({ count }: { count: number }) {
  return (
    <span className="difficulty-bars" aria-hidden="true">
      {[1, 2, 3].map((bar) => <i key={bar} className={bar <= count ? "on" : ""} />)}
    </span>
  );
}

export default function FreeBattle({ onExit }: { onExit: () => void }) {
  const [board, setBoard] = useState<Cell[]>(createBoard);
  const [numbers, setNumbers] = useState<NumberCell[]>(() =>
    createBoard().map((cell, index) => cell === 0 ? null : compositeNumberAt(index * 5)),
  );
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [relationMode, setRelationMode] = useState<RelationMode>("divisor");
  const [settings, setSettings] = useState<Settings>({ mode: "ai", difficulty: "medium", boardSize: 7 });
  const [draftSettings, setDraftSettings] = useState<Settings>({ mode: "ai", difficulty: "medium", boardSize: 7 });
  const [setupOpen, setSetupOpen] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<0 | Player>(0);
  const [moveNumber, setMoveNumber] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [captures, setCaptures] = useState<[number, number]>([0, 0]);
  const [bombs, setBombs] = useState<[number, number]>([2, 2]);
  const [bombCharge, setBombCharge] = useState<[number, number]>([0, 0]);
  const [chargeBurst, setChargeBurst] = useState<Player | null>(null);
  const [bombArmed, setBombArmed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [restartPromptOpen, setRestartPromptOpen] = useState(false);
  const [restartReason, setRestartReason] = useState<"escape" | "manual">("manual");
  const [exitPromptOpen, setExitPromptOpen] = useState(false);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [infection, setInfection] = useState<{ cells: number[]; player: Player } | null>(null);
  const [resisted, setResisted] = useState<number[]>([]);
  const [projectiles, setProjectiles] = useState<InfectionProjectile[]>([]);
  const [arrived, setArrived] = useState<number | null>(null);
  const [notice, setNotice] = useState("내 세균을 고른 뒤 약수·배수·분열 중 하나를 선택하세요");
  const [onlineJoinCode, setOnlineJoinCode] = useState("");
  const [onlineMatchSize, setOnlineMatchSize] = useState<OnlineMatchSize>(4);
  const [onlineHubOpen, setOnlineHubOpen] = useState(false);
  const [onlineSection, setOnlineSection] = useState<"lobby" | "ranking" | "profile">("lobby");
  const [roomCreateOpen, setRoomCreateOpen] = useState(false);
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [roomPasswordEnabled, setRoomPasswordEnabled] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState("");
  const [roomPasswordOpen, setRoomPasswordOpen] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState("");
  const [joinRoomPassword, setJoinRoomPassword] = useState("");
  const [activeSlot, setActiveSlot] = useState(0);
  const [onlineMatchId, setOnlineMatchId] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountMode, setAccountMode] = useState<"login" | "create">("login");
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountFeedback, setAccountFeedback] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileFeedback, setProfileFeedback] = useState("");
  const [ratingDelta, setRatingDelta] = useState<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const infectionSfxRef = useRef<HTMLAudioElement | null>(null);
  const sequenceTimers = useRef<number[]>([]);
  const animationWatchdog = useRef<number | null>(null);
  const handledOnlineRequests = useRef(new Set<string>());
  const onlineMessageHandlerRef = useRef<(message: OnlineGameMessage, senderUid: string) => void>(() => undefined);
  const online = useOnlineRoom(useCallback((message: OnlineGameMessage, senderUid: string) => {
    onlineMessageHandlerRef.current(message, senderUid);
  }, []));
  const ranked = useRankedAccount();
  const settledMatchRef = useRef("");
  const gameInProgress = hydrated && gameStarted && !gameOver;
  const refreshOnlineRooms = online.refreshRooms;
  const leaveOnlineRoom = online.leave;
  const openOnlineRoomCode = online.roomCode;

  usePreventGameUnload(gameInProgress);

  useEffect(() => {
    if (draftSettings.mode !== "online" || !ranked.profile || openOnlineRoomCode) return;
    void refreshOnlineRooms();
  }, [draftSettings.mode, openOnlineRoomCode, ranked.profile, refreshOnlineRooms]);

  useEffect(() => {
    if (draftSettings.mode === "online" || !openOnlineRoomCode) return;
    void leaveOnlineRoom();
  }, [draftSettings.mode, leaveOnlineRoom, openOnlineRoomCode]);

  useEffect(() => {
    if (!ranked.profile) return;
    setProfileName(ranked.profile.displayName);
  }, [ranked.profile]);

  useEffect(() => {
    const infectionSfx = new Audio(assetUrl("/assets/audio/infection-splat.ogg"));
    infectionSfx.preload = "auto";
    infectionSfx.volume = 0.56;
    infectionSfx.load();
    infectionSfxRef.current = infectionSfx;

    return () => {
      infectionSfx.pause();
      infectionSfxRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (soundOn) return;
    const infectionSfx = infectionSfxRef.current;
    if (!infectionSfx) return;
    infectionSfx.pause();
    infectionSfx.currentTime = 0;
  }, [soundOn]);

  useEffect(() => {
    const restoreFrame = window.requestAnimationFrame(() => {
      try {
      const raw = window.localStorage.getItem(SAVED_GAME_KEY)
        ?? window.sessionStorage.getItem(SAVED_GAME_KEY);
      const saved = raw ? JSON.parse(raw) as Partial<SavedGame> : null;
      const savedSize = Array.isArray(saved?.board) ? Math.sqrt(saved.board.length) : 0;
      const valid = saved?.version === 1
        && BOARD_SIZES.includes(savedSize as BoardSize)
        && Array.isArray(saved.board)
        && Array.isArray(saved.numbers) && saved.numbers.length === saved.board.length;
      if (valid) {
        setBoard(saved.board as Cell[]);
        setNumbers(saved.numbers as NumberCell[]);
        setCurrentPlayer(saved.currentPlayer === 2 ? 2 : 1);
        setSelected(typeof saved.selected === "number" ? saved.selected : null);
        setRelationMode(saved.relationMode === "multiple" || saved.relationMode === "split" ? saved.relationMode : "divisor");
        const restoredSettings = normalizeSettings(saved.settings, savedSize as BoardSize);
        setSettings(restoredSettings);
        setDraftSettings(restoredSettings);
        setSetupOpen(saved.setupOpen ?? true);
        setGameStarted(saved.started ?? saved.setupOpen === false);
        setGameOver(saved.gameOver ?? false);
        setWinner(saved.winner === 1 || saved.winner === 2 ? saved.winner : 0);
        setMoveNumber(saved.moveNumber ?? 1);
        setElapsed(saved.elapsed ?? 0);
        setCaptures(saved.captures ?? [0, 0]);
        setBombs(saved.bombs ?? [2, 2]);
        setBombCharge(saved.bombCharge ?? [0, 0]);
        setBombArmed(saved.bombArmed ?? false);
        setHistory(saved.history ?? []);

        window.sessionStorage.removeItem(SAVED_GAME_KEY);
      }
      } catch {
        window.localStorage.removeItem(SAVED_GAME_KEY);
        window.sessionStorage.removeItem(SAVED_GAME_KEY);
      } finally {
        setHydrated(true);
      }
    });
    return () => window.cancelAnimationFrame(restoreFrame);
  }, []);

  const clearSequenceTimers = useCallback(() => {
    sequenceTimers.current.forEach((timer) => window.clearTimeout(timer));
    sequenceTimers.current = [];
    if (animationWatchdog.current !== null) {
      window.clearTimeout(animationWatchdog.current);
      animationWatchdog.current = null;
    }
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    sequenceTimers.current.push(timer);
    return timer;
  }, []);

  const scores = useMemo(() => score(board), [board]);
  const boardSize = getBoardSize(board);
  const emptyCount = board.filter((cell) => cell === 0).length;
  const selectedMoves = useMemo(
    () => selected === null ? [] : legalMoves(board, currentPlayer).filter((move) =>
      move.from === selected
      && (relationMode !== "split" || (move.distance === 1 && factorPairs(numbers[selected] ?? 0).length > 0)),
    ),
    [board, currentPlayer, numbers, relationMode, selected],
  );
  const targetMap = useMemo(() => new Map(selectedMoves.map((move) => [move.to, move])), [selectedMoves]);

  const previewComparisons = useMemo(() => {
    const result = new Map<number, { passes: boolean; label: string }>();
    if (hovered === null || selected === null || !targetMap.has(hovered)) return result;
    const attackerNumber = numbers[selected];
    if (attackerNumber === null) return result;
    if (relationMode === "split" && !bombArmed) return result;
    const row = Math.floor(hovered / boardSize);
    const col = hovered % boardSize;
    for (let y = Math.max(0, row - 1); y <= Math.min(boardSize - 1, row + 1); y += 1) {
      for (let x = Math.max(0, col - 1); x <= Math.min(boardSize - 1, col + 1); x += 1) {
        const index = y * boardSize + x;
        const targetNumber = numbers[index];
        if (board[index] !== 0 && board[index] !== currentPlayer && targetNumber !== null) {
          const passes = bombArmed || isRelation(attackerNumber, targetNumber, relationMode);
          const label = bombArmed
            ? "세균탄"
            : relationMode === "divisor"
            ? `${attackerNumber} → ${targetNumber}`
            : `${attackerNumber} ← ${targetNumber}`;
          result.set(index, { passes, label });
        }
      }
    }
    return result;
  }, [board, boardSize, bombArmed, currentPlayer, hovered, numbers, relationMode, selected, targetMap]);

  const playTone = useCallback((kind: "move" | "infect" | "win" | "select") => {
    if (!soundOn || typeof window === "undefined") return;
    if (kind === "infect") {
      const infectionSfx = infectionSfxRef.current;
      if (!infectionSfx) return;
      infectionSfx.currentTime = 0;
      infectionSfx.play().catch(() => undefined);
      return;
    }
    try {
      const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return;
      const previous = audioRef.current;
      const context = previous && previous.state !== "closed" ? previous : new AudioCtor();
      audioRef.current = context;
      if (context.state === "suspended") void context.resume().catch(() => undefined);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const frequencies = { select: 420, move: 280, win: 620 };
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequencies[kind], context.currentTime);
      if (kind === "win") oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.22);
      gain.gain.setValueAtTime(0.0001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (kind === "win" ? 0.32 : 0.16));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (kind === "win" ? 0.34 : 0.18));
    } catch {
      audioRef.current = null;
    }
  }, [soundOn]);

  const resolveEnd = useCallback((nextBoard: Cell[], lastPlayer: Player, nextPlayer: Player) => {
    const nextScores = score(nextBoard);
    const nextMoves = legalMoves(nextBoard, nextPlayer);
    const lastMoves = legalMoves(nextBoard, lastPlayer);
    const isFull = !nextBoard.includes(0);
    if (nextScores.includes(0) || isFull || (!nextMoves.length && !lastMoves.length)) {
      const result = nextScores[0] === nextScores[1] ? 0 : nextScores[0] > nextScores[1] ? 1 : 2;
      setWinner(result);
      setGameOver(true);
      setThinking(false);
      setNotice(result === 0 ? "세균 수가 같아요 — 무승부" : `${result === 1 ? "파란" : "빨간"} 팀이 게임판을 더 많이 차지했어요`);
      window.setTimeout(() => playTone("win"), 140);
      return;
    }
    if (!nextMoves.length) {
      setCurrentPlayer(lastPlayer);
      setNotice(`${nextPlayer === 1 ? "파란" : "빨간"} 팀은 움직일 수 없어 차례를 넘겨요`);
    } else {
      setCurrentPlayer(nextPlayer);
      setNotice(nextPlayer === 1 ? "파란 팀 차례예요" : settings.mode === "ai" ? "컴퓨터가 다음 수를 생각하고 있어요" : "빨간 팀 차례예요");
    }
  }, [playTone, settings.mode]);

  const executeMove = useCallback((
    move: Move,
    player: Player,
    mode: RelationMode = relationMode,
    useBomb = false,
    authoritativeResult?: OnlineMoveResult,
  ) => {
    if (gameOver || animating || restartPromptOpen || exitPromptOpen) return;
    clearSequenceTimers();
    setAnimating(true);
    setHistory((previous) => [...previous, {
      board: [...board],
      numbers: [...numbers],
      player: currentPlayer,
      move: moveNumber,
      captures: [...captures] as [number, number],
      bombs: [...bombs] as [number, number],
      bombCharge: [...bombCharge] as [number, number],
      relationMode,
    }]);
    const result = authoritativeResult ?? applyMove(board, numbers, player, move, mode, { forceInfection: useBomb });
    let infectionCommitted = false;
    const commitInfection = () => {
      if (!result.infected.length || infectionCommitted) return;
      infectionCommitted = true;
      setBoard(result.board);
      setNumbers(result.numbers);
      setInfection({ cells: result.infected, player });
      setCaptures((value) => {
        const next: [number, number] = [...value] as [number, number];
        next[player - 1] += result.infected.length;
        return next;
      });
    };
    const opponent: Player = player === 1 ? 2 : 1;
    const finishSequence = () => {
      if (animationWatchdog.current !== null) {
        window.clearTimeout(animationWatchdog.current);
        animationWatchdog.current = null;
      }
      commitInfection();
      setBoard(result.board);
      setNumbers(result.numbers);
      setInfection(null);
      setProjectiles([]);
      setResisted([]);
      setArrived(null);
      setAnimating(false);
      setThinking(false);
      resolveEnd(result.board, player, opponent);
    };
    animationWatchdog.current = window.setTimeout(finishSequence, 3500);
    const bombUsed = useBomb && result.infected.length > 0;
    const chargeCompleted = bombCharge[player - 1] >= 4;
    setBombCharge((value) => {
      const next: [number, number] = [...value] as [number, number];
      next[player - 1] = chargeCompleted ? 0 : next[player - 1] + 1;
      return next;
    });
    if (chargeCompleted) {
      setChargeBurst(player);
      schedule(() => setChargeBurst(null), 480);
    }
    if (bombUsed || chargeCompleted) {
      setBombs((value) => {
        const next: [number, number] = [...value] as [number, number];
        next[player - 1] = Math.max(0, next[player - 1] - (bombUsed ? 1 : 0)) + (chargeCompleted ? 1 : 0);
        return next;
      });
    }
    setBombArmed(false);
    const movedBoard = [...result.board];
    const movedNumbers = [...result.numbers];
    result.infected.forEach((index) => { movedBoard[index] = opponent; });
    result.infected.forEach((index) => { movedNumbers[index] = numbers[index]; });
    setBoard(movedBoard);
    setNumbers(movedNumbers);
    setSelected(null);
    setHovered(null);
    setResisted([]);
    setMoveNumber((value) => value + 1);
    setArrived(move.to);
    playTone("move");
    schedule(() => setArrived(null), 500);
    const activeModeLabel = modeLabel(mode);
    const infectionRuleLabel = mode === "split"
      ? `${result.spawnedNumber}의 배수`
      : activeModeLabel;
    const spawnLabel = move.distance === 1
      ? mode === "split"
        ? `${result.attackerNumber} = ${result.parentNumber} × ${result.spawnedNumber} · 원래 세균과 새 세균의 수로 나뉘었어요`
        : mode === "divisor" && result.spawnedNumber === result.attackerNumber
        ? `${result.attackerNumber}은(는) 1 말고 다른 약수가 없어 같은 수로 새 세균을 만들었어요`
        : `${result.attackerNumber}의 ${activeModeLabel}인 ${result.spawnedNumber}번 새 세균을 만들었어요`
      : `${result.attackerNumber}번 세균이 두 칸 이동했어요`;
    const chargeLabel = chargeCompleted ? " · 세균탄 1개를 받았어요" : "";
    if (result.infected.length) {
      setNotice(bombUsed
        ? `${spawnLabel} · 세균탄은 숫자 조건 없이 사용할 수 있어요`
        : `${spawnLabel} · 주변 숫자에 ${infectionRuleLabel}가 있는지 확인해요`);
      schedule(() => {
        setProjectiles(result.infected.map((to, id) => ({ id, from: move.to, to, player, bomb: bombUsed })));
        setResisted(result.resisted);
        setNotice(bombUsed
          ? `세균탄으로 주변 상대 세균 ${result.infected.length}개를 감염시켜요`
          : `숫자 관계가 맞는 상대 세균 ${result.infected.length}개를 내 편으로 만들어요`);
      }, 260);
      schedule(() => {
        commitInfection();
        setNotice(`상대 세균 ${result.infected.length}개가 내 편이 되었어요${chargeLabel}`);
        playTone("infect");
      }, 820);
      schedule(finishSequence, 1580 + Math.max(0, result.infected.length - 1) * INFECTION_STAGGER_MS);
    } else {
      setResisted(result.resisted);
      const resultNotice = useBomb && !bombUsed
        ? `${spawnLabel} · 감염할 상대가 없어 세균탄을 쓰지 않았어요`
        : result.resisted.length
        ? `${spawnLabel} · 주변 숫자에 ${infectionRuleLabel}가 없어 감염되지 않았어요`
        : `${spawnLabel} · 바로 옆에 상대 세균이 없어요`;
      setNotice(`${resultNotice}${chargeLabel}`);
      schedule(finishSequence, result.resisted.length ? 1050 : 560);
    }
  }, [animating, board, bombCharge, bombs, captures, clearSequenceTimers, currentPlayer, exitPromptOpen, gameOver, moveNumber, numbers, playTone, relationMode, resolveEnd, restartPromptOpen, schedule]);

  // AI turn orchestration mirrors the timer lifecycle in visible UI state.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (setupOpen || restartPromptOpen || exitPromptOpen || gameOver || animating || settings.mode !== "ai" || currentPlayer !== 2) {
      setThinking(false);
      return;
    }
    setThinking(true);
    setNotice("컴퓨터가 게임판을 살펴보고 있어요");
    const action = chooseAiAction(board, numbers, settings.difficulty, 2, bombs[1]);
    if (!action) {
      setThinking(false);
      resolveEnd(board, 2, 1);
      return;
    }
    const pacing = settings.difficulty === "hard" ? 160 : 0;
    const selectTimer = window.setTimeout(() => {
      setSelected(action.move.from);
      setRelationMode(action.mode);
      setBombArmed(action.useBomb);
      playTone("select");
      setNotice(action.useBomb
        ? `컴퓨터가 ${numbers[action.move.from]}번 세균에 세균탄을 골랐어요`
        : `컴퓨터가 ${numbers[action.move.from]}번 세균과 ${modeLabel(action.mode)} 모드를 골랐어요`);
    }, 420 + pacing);
    const targetTimer = window.setTimeout(() => {
      setHovered(action.move.to);
      setNotice(action.useBomb
        ? "컴퓨터가 세균탄으로 감염할 곳을 확인해요"
        : action.mode === "split"
          ? "컴퓨터가 어떤 두 수로 나눌지 계산해요"
          : "컴퓨터가 주변 숫자의 약수·배수를 확인해요");
    }, 900 + pacing);
    const moveTimer = window.setTimeout(() => {
      setThinking(false);
      executeMove(action.move, 2, action.mode, action.useBomb);
    }, 1360 + pacing);
    return () => {
      window.clearTimeout(selectTimer);
      window.clearTimeout(targetTimer);
      window.clearTimeout(moveTimer);
    };
  }, [animating, board, bombs, currentPlayer, executeMove, exitPromptOpen, gameOver, numbers, playTone, resolveEnd, restartPromptOpen, settings, setupOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => () => clearSequenceTimers(), [clearSequenceTimers]);

  useEffect(() => {
    if (setupOpen || restartPromptOpen || exitPromptOpen || gameOver) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [exitPromptOpen, gameOver, restartPromptOpen, setupOpen]);

  useEffect(() => {
    if (!hydrated || animating) return;
    if (settings.mode === "online") {
      window.localStorage.removeItem(SAVED_GAME_KEY);
      window.sessionStorage.removeItem(SAVED_GAME_KEY);
      return;
    }
    const saved: SavedGame = {
      version: 1,
      started: gameStarted,
      board,
      numbers,
      currentPlayer,
      selected,
      relationMode,
      settings,
      setupOpen,
      gameOver,
      winner,
      moveNumber,
      elapsed,
      captures,
      bombs,
      bombCharge,
      bombArmed,
      history,
    };
    window.localStorage.setItem(SAVED_GAME_KEY, JSON.stringify(saved));
    window.sessionStorage.removeItem(SAVED_GAME_KEY);
  }, [animating, board, bombArmed, bombCharge, bombs, captures, currentPlayer, elapsed, gameOver, gameStarted, history, hydrated, moveNumber, numbers, relationMode, selected, settings, setupOpen, winner]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || setupOpen || gameOver) return;
      event.preventDefault();
      setRulesOpen(false);
      if (settings.mode === "online") {
        setExitPromptOpen(true);
        return;
      }
      setRestartReason("escape");
      setRestartPromptOpen(true);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [gameOver, settings.mode, setupOpen]);

  const startGame = useCallback((
    nextSettings = draftSettings,
    initial?: { board: Cell[]; numbers: NumberCell[] },
  ) => {
    clearSequenceTimers();
    const normalizedSettings = normalizeSettings(nextSettings);
    const freshBoard = initial?.board ?? createBoard(normalizedSettings.boardSize);
    setSettings(normalizedSettings);
    setDraftSettings(normalizedSettings);
    setBoard(freshBoard);
    setNumbers(initial?.numbers ?? createNumbers(freshBoard));
    setCurrentPlayer(1);
    setSelected(null);
    setHovered(null);
    setRelationMode("divisor");
    setThinking(false);
    setAnimating(false);
    setGameOver(false);
    setWinner(0);
    setMoveNumber(1);
    setElapsed(0);
    setCaptures([0, 0]);
    setBombs([2, 2]);
    setBombCharge([0, 0]);
    setChargeBurst(null);
    setBombArmed(false);
    setGameStarted(true);
    setExitPromptOpen(false);
    setRestartPromptOpen(false);
    setHistory([]);
    setInfection(null);
    setResisted([]);
    setProjectiles([]);
    setNotice("내 세균을 고른 뒤 약수·배수·분열 중 하나를 선택하세요");
    setOnlineHubOpen(false);
    setSetupOpen(false);
  }, [clearSequenceTimers, draftSettings]);

  useEffect(() => {
    onlineMessageHandlerRef.current = (message, senderUid) => {
      const hostUid = online.players.find((player) => player.slot === 0)?.uid;
      if (message.kind === "start") {
        if (!online.isHost && senderUid !== hostUid) return;
        setActiveSlot(message.activeSlot);
        setOnlineMatchId(message.matchId);
        setRatingDelta(null);
        handledOnlineRequests.current.clear();
        startGame(
          { mode: "online", difficulty: "medium", boardSize: message.boardSize },
          { board: message.board, numbers: message.numbers },
        );
        return;
      }

      if (message.kind === "move-request") {
        if (!online.isHost || handledOnlineRequests.current.has(message.requestId)) return;
        const actor = online.players.find((player) => player.slot === activeSlot);
        if (!actor || actor.uid !== senderUid || animating || gameOver) return;
        const player = teamForSlot(activeSlot);
        if (player !== currentPlayer || board[message.move.from] !== player) return;
        const allowed = legalMoves(board, player).some((move) =>
          move.from === message.move.from
          && move.to === message.move.to
          && move.distance === message.move.distance,
        );
        if (!allowed || (message.mode === "split" && message.move.distance !== 1)) return;
        if (message.useBomb && bombs[player - 1] <= 0) return;
        handledOnlineRequests.current.add(message.requestId);
        const result = applyMove(board, numbers, player, message.move, message.mode, { forceInfection: message.useBomb });
        let nextSlot = activeSlot;
        for (let offset = 1; offset <= online.matchSize; offset += 1) {
          const candidate = (activeSlot + offset) % online.matchSize;
          if (legalMoves(result.board, teamForSlot(candidate)).length) {
            nextSlot = candidate;
            break;
          }
        }
        void online.broadcast({
          kind: "move",
          requestId: message.requestId,
          actorSlot: activeSlot,
          player,
          move: message.move,
          mode: message.mode,
          useBomb: message.useBomb,
          nextSlot,
          result,
        });
        return;
      }

      if (message.kind === "move") {
        if (handledOnlineRequests.current.has(`done:${message.requestId}`)) return;
        if (!online.isHost && senderUid !== hostUid) return;
        handledOnlineRequests.current.add(`done:${message.requestId}`);
        setActiveSlot(message.nextSlot);
        executeMove(message.move, message.player, message.mode, message.useBomb, message.result);
      }
    };
    return () => {
      onlineMessageHandlerRef.current = () => undefined;
    };
  }, [activeSlot, animating, board, bombs, currentPlayer, executeMove, gameOver, numbers, online, startGame]);

  const requestExit = useCallback(() => {
    if (gameInProgress) {
      setRulesOpen(false);
      setExitPromptOpen(true);
      return;
    }
    if (online.roomCode) void online.leave();
    onExit();
  }, [gameInProgress, onExit, online]);

  const stopAndExit = useCallback(() => {
    window.localStorage.removeItem(SAVED_GAME_KEY);
    window.sessionStorage.removeItem(SAVED_GAME_KEY);
    if (settings.mode === "online") void online.leave();
    setGameStarted(false);
    setExitPromptOpen(false);
    onExit();
  }, [onExit, online, settings.mode]);

  const handleCell = (index: number) => {
    if (gameOver || restartPromptOpen || exitPromptOpen || thinking || animating || (settings.mode === "ai" && currentPlayer === 2)) return;
    if (settings.mode === "online" && online.localSlot !== activeSlot) {
      const activePlayer = online.players.find((player) => player.slot === activeSlot);
      setNotice(`${activePlayer?.name ?? "팀원"}님의 차례를 기다리고 있어요`);
      return;
    }
    const move = targetMap.get(index);
    if (move) {
      if (settings.mode === "online") {
        online.sendToHost({
          kind: "move-request",
          requestId: crypto.randomUUID(),
          move,
          mode: relationMode,
          useBomb: bombArmed,
        });
      } else {
        executeMove(move, currentPlayer, relationMode, bombArmed);
      }
      return;
    }
    if (board[index] === currentPlayer) {
      if (selected === index) {
        const nextRelationMode = nextMode(relationMode);
        setRelationMode(nextRelationMode);
        setNotice(nextRelationMode === "split" && !factorPairs(numbers[index] ?? 0).length
          ? `${numbers[index]}은(는) 1과 자기 자신으로만 나누어져 더 나눌 수 없어요`
          : `${numbers[index]}번 세균을 ${modeLabel(nextRelationMode)} 모드로 바꿨어요`);
      } else {
        setSelected(index);
        setBombArmed(false);
        setRelationMode("divisor");
        setNotice(`${numbers[index]}번 세균을 골랐어요 — 다시 누르면 배수·분열 모드로 바뀌어요`);
      }
      playTone("select");
    } else {
      setSelected(null);
      setBombArmed(false);
    }
  };

  const undo = () => {
    if (settings.mode === "online" || !history.length || restartPromptOpen || exitPromptOpen || thinking || animating) return;
    const steps = settings.mode === "ai" ? Math.min(2, history.length) : 1;
    const snapshot = history[history.length - steps];
    setBoard(snapshot.board);
    setNumbers(snapshot.numbers);
    setCurrentPlayer(snapshot.player);
    setRelationMode(snapshot.relationMode);
    setMoveNumber(snapshot.move);
    setCaptures(snapshot.captures);
    setBombs(snapshot.bombs ?? [2, 2]);
    setBombCharge(snapshot.bombCharge ?? [0, 0]);
    setChargeBurst(null);
    setBombArmed(false);
    setHistory((value) => value.slice(0, -steps));
    setGameOver(false);
    setWinner(0);
    setSelected(null);
    setInfection(null);
    setResisted([]);
    setProjectiles([]);
    setNotice("한 수 전으로 되돌렸어요");
  };

  const createOnlineRoom = () => {
    if (!ranked.user || !ranked.profile) {
      setAccountOpen(true);
      setAccountFeedback("랭크 방을 만들려면 먼저 로그인해주세요.");
      return;
    }
    setNewRoomTitle("");
    setRoomPasswordEnabled(false);
    setNewRoomPassword("");
    setRoomCreateOpen(true);
  };

  const submitCreateOnlineRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!ranked.profile || !newRoomTitle.trim()) return;
    const password = roomPasswordEnabled ? newRoomPassword : "";
    void online.createRoom(
      ranked.profile.displayName,
      draftSettings.boardSize,
      onlineMatchSize,
      ranked.profile.rating,
      newRoomTitle,
      password,
    ).then((created) => {
      if (!created) return;
      setRoomCreateOpen(false);
      setNewRoomPassword("");
    });
  };

  const attemptJoinRoom = async (code: string, password = "") => {
    if (!ranked.profile) return;
    const result = await online.joinRoom(code, ranked.profile.displayName, ranked.profile.rating, password);
    if (result === "password-required") {
      setPendingJoinCode(code);
      setJoinRoomPassword("");
      setRoomPasswordOpen(true);
    } else if (result === "joined") {
      setRoomPasswordOpen(false);
      setJoinRoomPassword("");
    }
  };

  const joinOnlineRoom = () => {
    if (!ranked.user || !ranked.profile) {
      setAccountOpen(true);
      setAccountFeedback("랭크 방에 참가하려면 먼저 로그인해주세요.");
      return;
    }
    void attemptJoinRoom(onlineJoinCode);
  };

  const joinListedRoom = (room: OnlineRoomSummary) => {
    if (!ranked.profile) return;
    setOnlineJoinCode(room.code);
    if (room.hasPassword) {
      setPendingJoinCode(room.code);
      setJoinRoomPassword("");
      setRoomPasswordOpen(true);
      return;
    }
    void attemptJoinRoom(room.code);
  };

  const submitRoomPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!joinRoomPassword) return;
    void attemptJoinRoom(pendingJoinCode, joinRoomPassword);
  };

  const startOnlineBattle = () => {
    if (!online.isHost || !online.allConnected) return;
    const freshBoard = createBoard(draftSettings.boardSize);
    void online.broadcast({
      kind: "start",
      board: freshBoard,
      numbers: createNumbers(freshBoard),
      boardSize: draftSettings.boardSize,
      activeSlot: 0,
      matchId: crypto.randomUUID(),
    });
  };

  useEffect(() => {
    if (settings.mode !== "online" || !gameOver || !onlineMatchId || !ranked.profile || online.localSlot === null) return;
    if (settledMatchRef.current === onlineMatchId) return;
    settledMatchRef.current = onlineMatchId;
    const myTeam = teamForSlot(online.localSlot);
    const opponents = online.players.filter((player) => teamForSlot(player.slot) !== myTeam);
    const opponentRating = opponents.length
      ? opponents.reduce((total, player) => total + player.rating, 0) / opponents.length
      : ranked.profile.rating;
    const outcome = winner === 0 ? "draw" : winner === myTeam ? "win" : "loss";
    void ranked.recordResult(onlineMatchId, outcome, opponentRating)
      .then((delta) => setRatingDelta(delta))
      .catch(() => setRatingDelta(null));
  }, [gameOver, online.localSlot, online.players, onlineMatchId, ranked, settings.mode, winner]);

  const submitAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAccountFeedback("");
    try {
      if (accountMode === "create") await ranked.createAccount(accountEmail, accountPassword, accountName);
      else await ranked.login(accountEmail, accountPassword);
      setAccountPassword("");
      setAccountOpen(false);
    } catch (reason) {
      setAccountFeedback(reason instanceof Error ? reason.message : "계정 요청을 처리하지 못했습니다.");
    }
  };

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileFeedback("");
    try {
      const updatedName = await ranked.updateDisplayName(profileName);
      setProfileName(updatedName);
      setProfileFeedback("닉네임이 변경되었습니다. 다음 대전부터 새 닉네임이 표시됩니다.");
    } catch (reason) {
      setProfileFeedback(reason instanceof Error ? reason.message : "닉네임을 변경하지 못했습니다.");
    }
  };

  const blueOnlineNames = online.players.filter((player) => teamForSlot(player.slot) === 1).map((player) => player.name).join(" · ");
  const redOnlineNames = online.players.filter((player) => teamForSlot(player.slot) === 2).map((player) => player.name).join(" · ");
  const playerTwoName = settings.mode === "ai" ? "컴퓨터" : settings.mode === "online" ? redOnlineNames || "빨간 팀" : "플레이어 2";
  const activeName = settings.mode === "online"
    ? online.players.find((player) => player.slot === activeSlot)?.name ?? "온라인 플레이어"
    : currentPlayer === 1 ? "플레이어 1" : playerTwoName;
  const gameLabel = settings.mode === "ai"
    ? `컴퓨터 · ${DIFFICULTY[settings.difficulty].label} · ${boardSize}×${boardSize}`
    : settings.mode === "online"
    ? `온라인 ${online.matchSize === 2 ? "1:1" : "2:2"} · ${online.roomCode} · ${boardSize}×${boardSize}`
    : `친구와 하기 · ${boardSize}×${boardSize}`;
  const displayedCharge: [number, number] = [
    chargeBurst === 1 ? 5 : bombCharge[0],
    chargeBurst === 2 ? 5 : bombCharge[1],
  ];

  return (
    <main className={`free-battle app-shell board-size-${boardSize}`}>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <button className="brand" onClick={requestExit} aria-label="게임 시작 화면으로 돌아가기">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><strong>페트리</strong><small>{"// 07"}</small></span>
        </button>
        <div className="topbar-center">
          <span className="live-dot" />
          <span>게임 시간</span>
          <b>{formatTime(elapsed)}</b>
        </div>
        <nav className="top-actions" aria-label="게임 메뉴">
          <button onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "소리 끄기" : "소리 켜기"}>{soundOn ? "◖))" : "◖×"}</button>
          <button onClick={() => setRulesOpen(true)} aria-label="게임 규칙 보기">?</button>
          <button className="mode-button" onClick={() => {
            if (settings.mode === "online") void online.leave();
            setSetupOpen(true);
          }}><span>{gameLabel}</span><b>변경</b></button>
        </nav>
      </header>

      <section className="status-rail" aria-live="polite">
        <div className={`turn-beacon p${currentPlayer}`}><span>{thinking ? "생각 중" : currentPlayer === 1 ? "파란 팀" : "빨간 팀"}</span></div>
        <div className="status-copy">
          <small>턴 {String(moveNumber).padStart(2, "0")} · {activeName}</small>
          <strong>{notice}</strong>
        </div>
        <div className="coverage">
          <span>채운 칸</span>
          <b>{Math.round(((board.length - emptyCount) / board.length) * 100)}%</b>
          <i><em style={{ width: `${((board.length - emptyCount) / board.length) * 100}%` }} /></i>
        </div>
      </section>

      <section className="game-layout">
        <aside className={`player-panel cyan ${currentPlayer === 1 && !gameOver ? "active" : ""}`}>
          <div className="player-topline"><span>파란 팀</span><i>● 준비됨</i></div>
          <div className="portrait"><Germ player={1} /><span className="scanline" /></div>
          <div className="identity"><small>{settings.mode === "online" ? "온라인 파란 팀" : "내 세균"}</small><h2>{settings.mode === "online" ? blueOnlineNames || "파란 팀" : "플레이어 1"}</h2></div>
          <div className="score-block"><small>세균 수</small><strong>{String(scores[0]).padStart(2, "0")}</strong></div>
          <div className="player-metrics">
            <span><small>감염</small><b>+{captures[0]}</b></span>
            <span><small>이동 가능</small><b>{legalMoves(board, 1).length}</b></span>
            <span><small>세균탄</small><b>×{bombs[0]}</b></span>
          </div>
        </aside>

        <section className="board-stage">
          <div className="petri-frame">
            <div className="frame-label top"><span>게임판</span><b>{String(boardSize).padStart(2, "0")} × {String(boardSize).padStart(2, "0")}</b></div>
            <div className="board-wrap">
              <div className="board-grid" data-size={boardSize} style={{ "--board-size": boardSize } as CSSProperties} role="grid" aria-label={`${boardSize} × ${boardSize} 세균전 게임판`}>
                {board.map((cell, index) => {
                  const move = targetMap.get(index);
                  const isInfected = infection?.cells.includes(index) ?? false;
                  const infectionOrder = isInfected ? infection?.cells.indexOf(index) ?? -1 : -1;
                  const comparison = previewComparisons.get(index);
                  const isResisted = resisted.includes(index);
                  const row = Math.floor(index / boardSize) + 1;
                  const col = index % boardSize + 1;
                  return (
                    <button
                      key={index}
                      className={[
                        "cell",
                        cell ? `occupied p${cell}` : "empty",
                        selected === index ? "selected" : "",
                        move ? `legal ${move.distance === 1 ? "clone" : "jump"}` : "",
                        comparison?.passes ? "will-infect" : "",
                        comparison && !comparison.passes ? "relation-blocked" : "",
                        isResisted ? "resisted" : "",
                        arrived === index ? "arrived" : "",
                        isInfected ? "hit" : "",
                      ].filter(Boolean).join(" ")}
                      style={isInfected ? {
                        "--impact-delay": `${infectionOrder * INFECTION_STAGGER_MS}ms`,
                      } as CSSProperties : undefined}
                      onClick={() => handleCell(index)}
                      onMouseEnter={() => move && setHovered(index)}
                      onMouseLeave={() => setHovered(null)}
                      role="gridcell"
                      aria-label={`${row}행 ${col}열, ${cell === 0 ? move ? move.distance === 1 ? "새 세균 만들기 가능" : "두 칸 이동 가능" : "빈 칸" : `${cell === 1 ? "파란" : "빨간"} 팀 ${numbers[index]}번 세균`}`}
                    >
                      <span className="cell-gridmark" />
                      {cell !== 0 && (
                        <Germ
                          player={cell}
                          infection={isInfected}
                          number={numbers[index] ?? undefined}
                          mode={selected === index ? relationMode : undefined}
                        />
                      )}
                      {move && <span className="move-hint"><i />{move.distance === 1 ? "+" : "↗"}</span>}
                      {bombArmed && selected === index && <span className="bomb-equipped" aria-hidden="true">✹</span>}
                      {comparison?.passes && <span className="preview-ring" />}
                      {comparison && <span className={`comparison-badge ${comparison.passes ? "pass" : "fail"}`}>{comparison.label} {comparison.passes ? "✓" : "×"}</span>}
                      {isResisted && <span className="resist-mark">관계 없음</span>}
                    </button>
                  );
                })}
                {projectiles.length > 0 && (
                  <div className="infection-projectile-layer" aria-hidden="true">
                    {projectiles.map((projectile) => {
                      const fromRow = Math.floor(projectile.from / boardSize);
                      const fromCol = projectile.from % boardSize;
                      const toRow = Math.floor(projectile.to / boardSize);
                      const toCol = projectile.to % boardSize;
                      return (
                        <span
                          key={`${projectile.from}-${projectile.to}-${projectile.id}`}
                          className={`infection-projectile p${projectile.player} ${projectile.bomb ? "bomb" : ""}`}
                          style={{
                            "--sx": `${((fromCol + .5) / boardSize) * 100}%`,
                            "--sy": `${((fromRow + .5) / boardSize) * 100}%`,
                            "--ex": `${((toCol + .5) / boardSize) * 100}%`,
                            "--ey": `${((toRow + .5) / boardSize) * 100}%`,
                            "--delay": `${projectile.id * 45}ms`,
                          } as CSSProperties}
                        ><i /></span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="board-controls">
            <button onClick={undo} disabled={settings.mode === "online" || !history.length || thinking || animating}><span>↶</span> 되돌리기</button>
            <div className="tactic-controls">
              {selected !== null ? (
                <button className={`relation-readout ${relationMode}`} onClick={() => handleCell(selected)}>
                  <span>{numbers[selected]}</span>
                  <b>{modeLabel(relationMode)} 모드</b>
                  <small>다시 눌러 바꾸기</small>
                </button>
              ) : (
                <div className="legend"><span><i className="clone-dot" />1칸 새 세균</span><span><i className="jump-dot" />2칸 이동</span></div>
              )}
              <button
                className={`bacteria-bomb ${bombArmed ? "armed" : ""}`}
                disabled={selected === null || bombs[currentPlayer - 1] === 0 || thinking || animating || (settings.mode === "online" && online.localSlot !== activeSlot)}
                onClick={() => {
                  const next = !bombArmed;
                  setBombArmed(next);
                  setNotice(next
                    ? `${numbers[selected ?? 0]}번 세균이 세균탄을 쓸 준비를 했어요 — 다음에는 숫자 조건 없이 감염돼요`
                    : "세균탄 사용을 취소했어요");
                  playTone("select");
                }}
                aria-pressed={bombArmed}
              >
                <i>✹</i><span><b>세균탄</b><small>{bombArmed ? "사용 준비" : "조건 없이 감염"}</small></span><em>×{bombs[currentPlayer - 1]}</em>
              </button>
            </div>
            <button onClick={() => {
              if (settings.mode === "online") {
                if (online.isHost) startOnlineBattle();
                else setNotice("온라인 대전은 방장만 다시 시작할 수 있어요");
                return;
              }
              setRestartReason("manual");
              setRestartPromptOpen(true);
            }}><span>↻</span> 새 게임</button>
          </div>
        </section>

        <aside className={`player-panel coral ${currentPlayer === 2 && !gameOver ? "active" : ""}`}>
          <div className="player-topline"><span>빨간 팀</span><i>● {settings.mode === "ai" ? "컴퓨터" : settings.mode === "online" ? "온라인" : "준비됨"}</i></div>
          <div className="portrait"><Germ player={2} /><span className="scanline" /></div>
          <div className="identity"><small>{settings.mode === "ai" ? "컴퓨터 세균" : settings.mode === "online" ? "온라인 상대 팀" : "상대 세균"}</small><h2>{playerTwoName}</h2></div>
          <div className="score-block"><small>세균 수</small><strong>{String(scores[1]).padStart(2, "0")}</strong></div>
          <div className="player-metrics">
            <span><small>감염</small><b>+{captures[1]}</b></span>
            <span><small>{settings.mode === "ai" ? "난이도" : "이동 가능"}</small><b>{settings.mode === "ai" ? DIFFICULTY[settings.difficulty].label : legalMoves(board, 2).length}</b></span>
            <span><small>세균탄</small><b>×{bombs[1]}</b></span>
          </div>
        </aside>
      </section>

      <section className="charge-dock" aria-label="세균탄 모으기">
        <div className={`charge-unit p1 ${currentPlayer === 1 && !gameOver ? "active" : ""} ${chargeBurst === 1 ? "charged" : ""}`}>
          <div className="charge-heading"><span><i /> 플레이어 1</span><b>세균탄 ×{bombs[0]}</b></div>
          <div className="charge-track" role="progressbar" aria-label="플레이어 1 세균탄 모으기" aria-valuemin={0} aria-valuemax={5} aria-valuenow={displayedCharge[0]}>
            <em style={{ width: `${(displayedCharge[0] / 5) * 100}%` }} />
            {[1, 2, 3, 4].map((tick) => <i key={tick} style={{ left: `${tick * 20}%` }} />)}
          </div>
          <small>{chargeBurst === 1 ? "세균탄 받음 · +1" : `${bombCharge[0]} / 5 내 차례`}</small>
        </div>
        <div className="charge-core"><span>✹</span><b>자동으로 모으기</b><small>5번 움직일 때마다 세균탄 +1</small></div>
        <div className={`charge-unit p2 ${currentPlayer === 2 && !gameOver ? "active" : ""} ${chargeBurst === 2 ? "charged" : ""}`}>
          <div className="charge-heading"><span><i /> {playerTwoName}</span><b>세균탄 ×{bombs[1]}</b></div>
          <div className="charge-track" role="progressbar" aria-label="플레이어 2 세균탄 모으기" aria-valuemin={0} aria-valuemax={5} aria-valuenow={displayedCharge[1]}>
            <em style={{ width: `${(displayedCharge[1] / 5) * 100}%` }} />
            {[1, 2, 3, 4].map((tick) => <i key={tick} style={{ left: `${tick * 20}%` }} />)}
          </div>
          <small>{chargeBurst === 2 ? "세균탄 받음 · +1" : `${bombCharge[1]} / 5 내 차례`}</small>
        </div>
      </section>

      <footer className="footer-line">
        <span>페트리 수학 연구소</span><i />
        <p>약수와 배수를 찾아 상대 세균을 내 편으로 만드세요.</p><i />
        <span>버전 07.26</span>
      </footer>

      {setupOpen && (
        <div className="modal-backdrop">
          <section className="setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title">
            <div className="setup-hero">
              <div className="hero-germ cyan-hero"><Germ player={1} /></div>
              <div className="versus"><h1 id="setup-title">수학 세균전</h1><p>약수·배수·분열로 세균을 늘리는 게임</p></div>
              <div className="hero-germ coral-hero"><Germ player={2} /></div>
            </div>

            <div className="mode-tabs">
              <button className={draftSettings.mode === "ai" ? "selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, mode: "ai" }))}>
                <span className="tab-icon" aria-hidden="true">💻</span><span><b>컴퓨터와 하기</b><small>컴퓨터와 겨뤄요</small></span>
              </button>
              <button className={draftSettings.mode === "local" ? "selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, mode: "local" }))}>
                <span className="tab-icon" aria-hidden="true">👥</span><span><b>친구와 하기</b><small>한 화면에서 둘이 해요</small></span>
              </button>
              <button className={draftSettings.mode === "online" ? "selected" : ""} onClick={() => { setDraftSettings((value) => ({ ...value, mode: "online" })); setOnlineSection("lobby"); setOnlineHubOpen(true); }}>
                <span className="tab-icon" aria-hidden="true">🌐</span><span><b>온라인 대전</b><small>1:1 또는 2:2 방을 만들어요</small></span>
              </button>
            </div>

            {draftSettings.mode !== "online" && <div className="board-size-select">
              <div className="select-heading"><span>게임판 크기</span><small>가로와 세로의 칸 수를 고르세요</small></div>
              <div className="size-grid">
                {BOARD_SIZES.map((size) => (
                  <button
                    key={size}
                    className={draftSettings.boardSize === size ? "selected" : ""}
                    onClick={() => setDraftSettings((value) => ({ ...value, boardSize: size }))}
                  >
                    <b>{size} × {size}</b>
                    <small>{size === 7 ? "빠른 게임" : size === 9 ? "보통 크기" : "큰 게임"}</small>
                  </button>
                ))}
              </div>
            </div>}

            {draftSettings.mode !== "online" && <div className={`difficulty-select ${draftSettings.mode === "local" ? "disabled" : ""}`}>
              <div className="select-heading"><span>컴퓨터 난이도</span><small>{draftSettings.mode === "local" ? "친구와 할 때는 사용하지 않아요" : "어려운 정도를 고르세요"}</small></div>
              <div className="difficulty-grid">
                {(Object.keys(DIFFICULTY) as Difficulty[]).map((level) => (
                  <button key={level} disabled={draftSettings.mode === "local"} className={draftSettings.difficulty === level ? "selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, difficulty: level }))}>
                    <span><b>{DIFFICULTY[level].label}</b><DifficultyBars count={DIFFICULTY[level].bars} /></span>
                    <small>{DIFFICULTY[level].detail}</small>
                  </button>
                ))}
              </div>
            </div>}

            {draftSettings.mode === "online" && !onlineHubOpen && (
              <button className="launch-button online-hub-launch" onClick={() => { setOnlineSection("lobby"); setOnlineHubOpen(true); }}><span>온라인 대전 로비 열기</span><i>↗</i></button>
            )}

            {draftSettings.mode === "online" && onlineHubOpen && (
              <section className="online-lobby" role="dialog" aria-modal="true" aria-labelledby="online-hub-title">
                <header className="online-hub-header">
                  <div className="online-hub-brand">
                    <span className="online-live-dot" aria-hidden="true" />
                    <div><h2 id="online-hub-title">온라인 배틀넷</h2></div>
                  </div>
                  <div className="online-hub-status"><span>● 서버 연결됨</span></div>
                  <button className="online-hub-close" type="button" onClick={() => setOnlineHubOpen(false)} aria-label="온라인 배틀넷 닫기">×</button>
                </header>
                <nav className="online-hub-nav" aria-label="온라인 배틀넷 메뉴">
                  <button className={onlineSection === "lobby" ? "selected" : ""} type="button" onClick={() => setOnlineSection("lobby")}><span aria-hidden="true">⌂</span><b>대전 로비</b></button>
                  <button className={onlineSection === "ranking" ? "selected" : ""} type="button" onClick={() => setOnlineSection("ranking")}><span aria-hidden="true">♛</span><b>랭킹</b></button>
                  <button className={onlineSection === "profile" ? "selected" : ""} type="button" onClick={() => setOnlineSection("profile")}><span aria-hidden="true">◎</span><b>마이페이지</b></button>
                </nav>

                <div className="online-hub-content">
                {onlineSection === "lobby" && <>
                <div className="online-hub-section-title"><div><h3>대전 로비</h3></div><span>{online.availableRooms.length}개 방 검색됨</span></div>
                <div className="rank-account-card">
                  {ranked.profile ? (
                    <>
                      <div className="rank-emblem" aria-hidden="true">{ratingTier(ranked.profile.rating).slice(0, 1)}</div>
                      <div>
                        <b>{ranked.profile.displayName}</b>
                        <span>{ratingTier(ranked.profile.rating)} · 포인트 {ranked.profile.rating} · {ranked.profile.wins}승 {ranked.profile.losses}패</span>
                      </div>
                      <button type="button" onClick={() => setOnlineSection("profile")}>마이페이지</button>
                      <button className="account-logout" type="button" onClick={() => void ranked.logout()}>로그아웃</button>
                    </>
                  ) : (
                    <>
                      <div className="rank-emblem locked" aria-hidden="true">R</div>
                      <div>
                        <b>{ranked.ready ? "로그인이 필요합니다" : "계정 확인 중"}</b>
                      </div>
                      <button type="button" onClick={() => { setAccountMode("create"); setAccountOpen(true); }}>계정 만들기</button>
                      <button type="button" onClick={() => { setAccountMode("login"); setAccountOpen(true); }}>로그인</button>
                    </>
                  )}
                </div>
                {!online.roomCode && ranked.profile && online.configured && (
                  <section className="room-browser" aria-labelledby="room-browser-title">
                    <header>
                      <div><b id="room-browser-title">참가 가능한 게임방</b></div>
                      <button type="button" onClick={() => void online.refreshRooms()} disabled={online.roomsLoading}>
                        <span aria-hidden="true">↻</span>{online.roomsLoading ? "불러오는 중" : "새로고침"}
                      </button>
                    </header>
                    {online.roomsLoading && !online.availableRooms.length ? (
                      <div className="room-browser-state">게임방 목록을 불러오는 중...</div>
                    ) : online.availableRooms.length ? (
                      <div className="room-list">
                        {online.availableRooms.map((room) => (
                          <article key={room.code} className={room.matchSize === 2 ? "duel" : "team"}>
                            <div className="room-mode"><strong>{room.matchSize === 2 ? "1 : 1" : "2 : 2"}</strong><small>{room.boardSize}×{room.boardSize} 보드</small></div>
                            <div className="room-details"><small>{room.hasPassword ? "🔒 비밀번호 방" : "공개 방"}</small><b>{room.title}</b><span>방장 {room.hostName} · 포인트 {room.hostRating}</span></div>
                            <div className="room-occupancy"><small>참가 인원</small><b>{room.playerCount} / {room.matchSize}</b><span>{room.matchSize - room.playerCount}자리 남음</span></div>
                            <button type="button" onClick={() => joinListedRoom(room)} disabled={online.status === "joining"}>참가</button>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="room-browser-state"><b>참가 가능한 방이 없습니다</b></div>
                    )}
                  </section>
                )}
                {!online.configured ? (
                  <div className="online-warning">
                    <b>온라인 설정이 필요합니다</b>
                    <p>Firebase 프로젝트 값을 환경 설정에 등록하면 방을 만들 수 있습니다.</p>
                  </div>
                ) : !online.roomCode ? (
                  <>
                    <div className="online-entry-actions">
                      <button onClick={createOnlineRoom} disabled={online.status === "joining" || !ranked.profile}><b>새 방 만들기</b></button>
                      <div>
                        <input
                          value={onlineJoinCode}
                          maxLength={6}
                          onChange={(event) => setOnlineJoinCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))}
                          placeholder="방 코드 6자리"
                          aria-label="참가할 방 코드"
                        />
                        <button onClick={joinOnlineRoom} disabled={online.status === "joining" || onlineJoinCode.length !== 6 || !ranked.profile}>참가</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="room-code-card">
                      <span><b>{online.roomTitle}</b><small>방 코드 · {online.matchSize === 2 ? "1:1" : "2:2"}</small></span><strong>{online.roomCode}</strong>
                      <button onClick={() => void navigator.clipboard?.writeText(online.roomCode)}>복사</button>
                    </div>
                    <div className="online-slots">
                      {Array.from({ length: online.matchSize }, (_, slot) => slot).map((slot) => {
                        const player = online.players.find((candidate) => candidate.slot === slot);
                        return (
                          <div key={slot} className={`${teamForSlot(slot) === 1 ? "blue" : "red"} ${player?.connected ? "connected" : ""}`}>
                            <span>{teamForSlot(slot) === 1 ? "파란" : "빨간"} 팀 · {Math.floor(slot / 2) + 1}</span>
                            <b>{player?.name ?? "기다리는 중"}</b>
                            <small>{player ? player.connected ? "직접 연결됨" : "연결 중" : "빈 자리"}</small>
                          </div>
                        );
                      })}
                    </div>
                    <p className="direct-only-note">TURN 없이 직접 연결만 사용합니다. 연결되지 않으면 다른 네트워크에서 다시 참가해주세요.</p>
                    {online.isHost ? (
                      <button className="online-start" onClick={startOnlineBattle} disabled={!online.allConnected}>{online.matchSize}명 모두 연결되면 대전 시작</button>
                    ) : (
                      <div className="online-waiting">방장이 대전을 시작하기를 기다리고 있어요</div>
                    )}
                    <button className="online-leave" onClick={() => void online.leave()}>방 나가기</button>
                  </>
                )}
                {online.error && <p className="online-error" role="alert">{online.error}</p>}
                </>}

                {onlineSection === "ranking" && (
                  <section className="online-hub-panel" aria-labelledby="online-ranking-title">
                    <div className="online-hub-section-title"><div><h3 id="online-ranking-title">온라인 랭킹 TOP 50</h3></div><span>포인트 순</span></div>
                    <div className="ranking-table" role="table" aria-label="온라인 상위 랭킹">
                      <div className="ranking-row heading" role="row"><span>순위</span><span>닉네임</span><span>티어</span><span>포인트</span><span>전적</span></div>
                      {ranked.leaderboard.length ? ranked.leaderboard.map((entry, index) => (
                        <div key={entry.uid} className={`ranking-row ${entry.uid === ranked.user?.uid ? "mine" : ""}`} role="row">
                          <strong>{index + 1}</strong><b>{entry.displayName}</b><span>{ratingTier(entry.rating)}</span><em>{entry.rating}</em><small>{entry.wins}승 {entry.losses}패 {entry.draws}무</small>
                        </div>
                      )) : <div className="ranking-empty">아직 등록된 랭크 기록이 없습니다. 첫 승리의 주인공이 되어보세요.</div>}
                    </div>
                  </section>
                )}

                {onlineSection === "profile" && (
                  <section className="online-hub-panel mypage-panel" aria-labelledby="mypage-title">
                    <div className="online-hub-section-title"><div><h3 id="mypage-title">마이페이지</h3></div></div>
                    {ranked.profile ? (
                      <div className="mypage-grid">
                        <div className="mypage-summary">
                          <img className="mypage-rank-badge" src={assetUrl(ratingTierBadge(ranked.profile.rating))} alt={`${ratingTier(ranked.profile.rating)} 배지`} />
                          <small>{ratingTier(ranked.profile.rating)}</small>
                          <h4>{ranked.profile.displayName}</h4>
                          <b>포인트 {ranked.profile.rating}</b>
                          <div><span><strong>{ranked.profile.wins}</strong>승</span><span><strong>{ranked.profile.losses}</strong>패</span><span><strong>{ranked.profile.draws}</strong>무</span></div>
                        </div>
                        <form className="profile-form" onSubmit={submitProfile}>
                          <div><h4>닉네임 수정</h4></div>
                          <label><span>닉네임</span><input value={profileName} maxLength={16} autoComplete="nickname" onChange={(event) => setProfileName(event.target.value)} placeholder="게임에서 사용할 닉네임" required /></label>
                          {profileFeedback && <div className="profile-feedback" role="status">{profileFeedback}</div>}
                          <button type="submit" disabled={ranked.busy || !profileName.trim() || profileName.trim() === ranked.profile.displayName}>{ranked.busy ? "저장 중..." : "닉네임 저장"}</button>
                          <button className="profile-logout" type="button" onClick={() => void ranked.logout()}>로그아웃</button>
                        </form>
                      </div>
                    ) : (
                      <div className="mypage-signed-out"><span aria-hidden="true">◎</span><h4>로그인이 필요합니다</h4><div><button type="button" onClick={() => { setAccountMode("create"); setAccountOpen(true); }}>계정 만들기</button><button type="button" onClick={() => { setAccountMode("login"); setAccountOpen(true); }}>로그인</button></div></div>
                    )}
                  </section>
                )}
                </div>
              </section>
            )}

            {draftSettings.mode !== "online" && <button className="launch-button" onClick={() => startGame()}><span>게임 시작</span><i>→</i></button>}
            <button className="free-exit-button" onClick={requestExit}>← 게임 시작 화면</button>
            <button className="rules-link" onClick={() => setRulesOpen(true)}>게임 규칙 보기 <span>?</span></button>
          </section>
        </div>
      )}

      {rulesOpen && (
        <div className="drawer-backdrop">
          <aside className="rules-drawer" role="dialog" aria-modal="true" aria-labelledby="rules-title">
            <button className="drawer-close" onClick={() => setRulesOpen(false)} aria-label="규칙 닫기">×</button>
            <span className="drawer-kicker">게임 설명 // 01</span>
            <h2 id="rules-title">게임 방법</h2>
            <p className="rules-lead">약수와 배수를 찾아 상대 세균을 내 편으로 만드세요.</p>
            <ol>
              <li><b>게임판 크기</b><p>게임을 시작할 때 7×7, 9×9, 11×11 중 하나를 고를 수 있어요. 크기가 달라도 게임 방법은 같아요.</p></li>
              <li><b>나오는 숫자</b><p>시작 세균과 새 세균에는 2부터 100까지의 수가 나와요. 대부분 1과 자기 자신 말고도 나누어지는 수이며, 약수 모드와 분열 모드에서는 1과 자기 자신으로만 나누어지는 수도 나올 수 있어요.</p></li>
              <li><b>구구단 숫자가 나오는 정도</b><p>시작 세균과 감염된 세균은 10번 중 약 9번, 2단부터 9단까지의 구구단에 나오는 수를 받아요. 가끔은 2부터 100까지의 다른 수가 나와요.</p></li>
              <li><b>새 세균의 숫자</b><p>약수 모드에서는 고른 세균의 약수 가운데 하나가 나와요. 1과 고른 세균의 수는 빼고 아무거나 하나를 고릅니다. 고를 약수가 없을 때만 같은 수가 나와요. 배수 모드에서는 100 이하인 배수 가운데 하나가 나와요.</p></li>
              <li><b>감염된 세균의 숫자</b><p>내 편이 된 상대 세균은 2부터 100까지의 새로운 수를 받아요. 이때도 구구단에 나오는 수가 먼저 나와요.</p></li>
              <li><b>모드 바꾸기</b><p>내 세균을 한 번 누르면 선택돼요. 같은 세균을 다시 누를 때마다 약수 → 배수 → 분열 순서로 바뀌어요.</p></li>
              <li><b>약수 모드</b><p>상대 세균의 숫자가 내가 고른 세균 숫자의 약수이면 감염돼요. 예를 들어 고른 세균이 6이고 상대가 3이면 성공이에요.</p></li>
              <li><b>배수 모드</b><p>상대 세균의 숫자가 내가 고른 세균 숫자의 배수이면 감염돼요. 예를 들어 고른 세균이 3이고 상대가 6이면 성공이에요.</p></li>
              <li><b>분열 모드</b><p>한 칸 옆에 새 세균을 만들면 고른 세균의 수를 곱셈식의 두 수로 나눠요. 예를 들어 87 = 3 × 29이면 고른 세균과 새 세균의 수가 3과 29가 돼요. 그다음 새 세균의 숫자를 기준으로 주변에 배수가 있으면 그 상대 세균을 감염시켜요.</p></li>
              <li><b>세균탄</b><p>각 플레이어는 세균탄 2개를 가지고 시작해요. 내 세균을 고른 뒤 세균탄을 누르면 다음 이동에서 숫자 조건 없이 옆에 있는 상대 세균을 모두 감염시켜요. 감염할 상대가 있을 때만 세균탄 1개를 써요. 내 차례를 5번 마치면 아래쪽 막대가 가득 차고 세균탄 1개를 받아요.</p></li>
              <li><b>이동과 승리</b><p>한 칸 움직이면 새 세균이 생기고, 두 칸 움직이면 원래 세균이 함께 이동해요. 게임판이 가득 차거나 모두 움직일 수 없을 때 세균이 더 많은 쪽이 이겨요.</p></li>
            </ol>
            <button className="drawer-action" onClick={() => setRulesOpen(false)}>이해했습니다</button>
          </aside>
        </div>
      )}

      {accountOpen && (
        <div className="account-modal-backdrop">
          <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="rank-account-title">
            <button className="account-modal-close" type="button" onClick={() => setAccountOpen(false)} aria-label="계정 창 닫기">×</button>
            <small>FACTOR FORCE // RANKED ACCOUNT</small>
            <h2 id="rank-account-title">{accountMode === "create" ? "계정 만들기" : "로그인"}</h2>
            <div className="account-tabs" role="tablist" aria-label="계정 메뉴">
              <button className={accountMode === "login" ? "selected" : ""} type="button" onClick={() => { setAccountMode("login"); setAccountFeedback(""); }}>로그인</button>
              <button className={accountMode === "create" ? "selected" : ""} type="button" onClick={() => { setAccountMode("create"); setAccountFeedback(""); }}>계정 만들기</button>
            </div>
            <form onSubmit={submitAccount}>
              {accountMode === "create" && (
                <label><span>닉네임</span><input value={accountName} maxLength={16} autoComplete="nickname" onChange={(event) => setAccountName(event.target.value)} placeholder="게임에서 사용할 닉네임" required /></label>
              )}
              <label><span>이메일</span><input type="email" value={accountEmail} autoComplete="email" onChange={(event) => setAccountEmail(event.target.value)} placeholder="name@example.com" required /></label>
              <label><span>비밀번호</span><input type="password" value={accountPassword} minLength={6} autoComplete={accountMode === "create" ? "new-password" : "current-password"} onChange={(event) => setAccountPassword(event.target.value)} placeholder="6자 이상" required /></label>
              {(accountFeedback || ranked.error) && <div className="account-feedback" role="alert">{accountFeedback || ranked.error}</div>}
              <button className="account-submit" type="submit" disabled={ranked.busy}>{ranked.busy ? "처리 중..." : accountMode === "create" ? "계정생성하기" : "로그인"}</button>
            </form>
          </section>
        </div>
      )}

      {roomCreateOpen && (
        <div className="account-modal-backdrop">
          <section className="account-modal room-create-modal" role="dialog" aria-modal="true" aria-labelledby="room-create-title">
            <button className="account-modal-close" type="button" onClick={() => setRoomCreateOpen(false)} aria-label="방 만들기 창 닫기">×</button>
            <small>ONLINE BATTLE // CREATE ROOM</small>
            <h2 id="room-create-title">새 대전방 만들기</h2>
            <p>방 제목, 게임판 크기와 대전 방식을 정하세요. 비밀번호는 선택 사항입니다.</p>
            <form onSubmit={submitCreateOnlineRoom}>
              <label><span>방 제목 <em>필수</em></span><input value={newRoomTitle} maxLength={30} autoFocus onChange={(event) => setNewRoomTitle(event.target.value)} placeholder="예: 약수 고수만 오세요" required /></label>
              <fieldset className="room-option-group room-create-board-size">
                <legend>게임판 크기</legend>
                <div className="room-option-grid three">
                  {BOARD_SIZES.map((size) => (
                    <button key={size} className={draftSettings.boardSize === size ? "selected" : ""} type="button" aria-pressed={draftSettings.boardSize === size} onClick={() => setDraftSettings((value) => ({ ...value, boardSize: size }))}>{size} × {size}</button>
                  ))}
                </div>
              </fieldset>
              <fieldset className="room-option-group room-create-match-size">
                <legend>대전 방식</legend>
                <div className="room-option-grid two">
                  <button className={onlineMatchSize === 2 ? "selected" : ""} type="button" aria-pressed={onlineMatchSize === 2} onClick={() => setOnlineMatchSize(2)}>1 : 1</button>
                  <button className={onlineMatchSize === 4 ? "selected" : ""} type="button" aria-pressed={onlineMatchSize === 4} onClick={() => setOnlineMatchSize(4)}>2 : 2</button>
                </div>
              </fieldset>
              <label className="room-password-toggle"><input type="checkbox" checked={roomPasswordEnabled} onChange={(event) => { setRoomPasswordEnabled(event.target.checked); if (!event.target.checked) setNewRoomPassword(""); }} /><span><b>비밀번호 사용</b><small>체크하면 비밀번호를 아는 사람만 참가할 수 있어요.</small></span></label>
              {roomPasswordEnabled && <label><span>방 비밀번호</span><input type="password" value={newRoomPassword} minLength={4} maxLength={20} autoComplete="new-password" onChange={(event) => setNewRoomPassword(event.target.value)} placeholder="4~20자" required /></label>}
              <div className="room-modal-summary"><span>{onlineMatchSize === 2 ? "1 : 1" : "2 : 2"}</span><span>{draftSettings.boardSize}×{draftSettings.boardSize} 보드</span><span>{roomPasswordEnabled ? "비공개" : "공개"}</span></div>
              <button className="account-submit" type="submit" disabled={online.status === "joining" || !newRoomTitle.trim() || (roomPasswordEnabled && newRoomPassword.length < 4)}>{online.status === "joining" ? "방 만드는 중..." : "대전방 만들기"}</button>
            </form>
          </section>
        </div>
      )}

      {roomPasswordOpen && (
        <div className="account-modal-backdrop">
          <section className="account-modal room-password-modal" role="dialog" aria-modal="true" aria-labelledby="room-password-title">
            <button className="account-modal-close" type="button" onClick={() => setRoomPasswordOpen(false)} aria-label="비밀번호 입력 창 닫기">×</button>
            <small>PRIVATE ROOM // {pendingJoinCode}</small>
            <h2 id="room-password-title">방 비밀번호 입력</h2>
            <p>방장이 설정한 비밀번호를 입력해야 참가할 수 있습니다.</p>
            <form onSubmit={submitRoomPassword}>
              <label><span>비밀번호</span><input type="password" value={joinRoomPassword} maxLength={20} autoFocus autoComplete="current-password" onChange={(event) => setJoinRoomPassword(event.target.value)} placeholder="방 비밀번호" required /></label>
              {online.error && <div className="account-feedback" role="alert">{online.error}</div>}
              <button className="account-submit" type="submit" disabled={online.status === "joining" || !joinRoomPassword}>{online.status === "joining" ? "확인 중..." : "비밀번호 확인 후 참가"}</button>
            </form>
          </section>
        </div>
      )}

      {restartPromptOpen && !setupOpen && (
        <div className="modal-backdrop restart-backdrop">
          <section className="restart-modal" role="alertdialog" aria-modal="true" aria-labelledby="restart-title" aria-describedby="restart-description">
            <span className="restart-icon" aria-hidden="true">↻</span>
            <small>다시 시작하기</small>
            <h2 id="restart-title">게임을 다시 시작할까요?</h2>
            <p id="restart-description">
              {restartReason === "escape"
                  ? "나가기 키를 눌렀어요. 지금 게임을 이어 하거나 새로 시작할 수 있어요."
                  : "지금까지 한 내용을 지우고 같은 설정으로 새 게임을 시작해요."}
            </p>
            <div>
              <button className="continue-game" onClick={() => setRestartPromptOpen(false)}>이어서 하기</button>
              <button className="confirm-restart" onClick={() => startGame(settings)}>다시 시작</button>
            </div>
          </section>
        </div>
      )}

      {exitPromptOpen && (
        <GameExitPrompt onContinue={() => setExitPromptOpen(false)} onStop={stopAndExit} />
      )}

      {gameOver && !setupOpen && (
        <div className="result-layer">
          <section className={`result-card ${winner === 2 ? "coral-win" : ""}`}>
            <span className="result-kicker">게임 끝</span>
            {winner !== 0 ? <Germ player={winner} /> : <div className="draw-symbol">＝</div>}
            <h2>{winner === 0 ? "무승부" : `${winner === 1 ? "파란" : "빨간"} 팀 승리`}</h2>
            <p>{scores[0]} <i>:</i> {scores[1]}</p>
            <small>{moveNumber - 1}번 움직임 · {formatTime(elapsed)}</small>
            {settings.mode === "online" && ranked.profile && (
              <div className={`rank-result ${ratingDelta !== null && ratingDelta < 0 ? "down" : "up"}`}>
                <span>{ratingTier(ranked.profile.rating)}</span>
                <b>포인트 {ranked.profile.rating}</b>
                <em>{ratingDelta === null ? "정산 중" : ratingDelta > 0 ? `+${ratingDelta}` : ratingDelta}</em>
              </div>
            )}
            <div>
              <button onClick={() => {
                if (settings.mode !== "online") startGame(settings);
                else if (online.isHost) startOnlineBattle();
                else setNotice("방장이 다시 시작하기를 기다리고 있어요");
              }}>{settings.mode === "online" && !online.isHost ? "방장 기다리기" : "다시 하기"}</button>
              <button onClick={() => {
                if (settings.mode === "online") void online.leave();
                setSetupOpen(true);
              }}>다른 게임하기</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
