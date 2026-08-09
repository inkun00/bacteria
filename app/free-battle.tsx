import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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

type Mode = "ai" | "local";
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
  const mode: Mode = value?.mode === "local" ? "local" : "ai";
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
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const sprite = infection ? "bacteria-infection.png" : "bacteria-idle.png";

  return (
    <span
      className={`germ-sprite p${player} ${infection ? "infection" : "idle"}`}
      aria-hidden="true"
      style={{ backgroundImage: `url("${basePath}/assets/${sprite}")` }}
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
  const [restartPromptOpen, setRestartPromptOpen] = useState(false);
  const [restartReason, setRestartReason] = useState<"refresh" | "escape" | "manual">("manual");
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [infection, setInfection] = useState<{ cells: number[]; player: Player } | null>(null);
  const [resisted, setResisted] = useState<number[]>([]);
  const [projectiles, setProjectiles] = useState<InfectionProjectile[]>([]);
  const [arrived, setArrived] = useState<number | null>(null);
  const [notice, setNotice] = useState("내 세균을 고른 뒤 약수·배수·분열 중 하나를 선택하세요");
  const audioRef = useRef<AudioContext | null>(null);
  const sequenceTimers = useRef<number[]>([]);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(SAVED_GAME_KEY);
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
        setGameOver(saved.gameOver ?? false);
        setWinner(saved.winner === 1 || saved.winner === 2 ? saved.winner : 0);
        setMoveNumber(saved.moveNumber ?? 1);
        setElapsed(saved.elapsed ?? 0);
        setCaptures(saved.captures ?? [0, 0]);
        setBombs(saved.bombs ?? [2, 2]);
        setBombCharge(saved.bombCharge ?? [0, 0]);
        setBombArmed(saved.bombArmed ?? false);
        setHistory(saved.history ?? []);

        const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
        if (navigation?.type === "reload" && saved.setupOpen === false && !saved.gameOver) {
          setRestartReason("refresh");
          setRestartPromptOpen(true);
        }
      }
    } catch {
      window.sessionStorage.removeItem(SAVED_GAME_KEY);
    } finally {
      setHydrated(true);
    }
  }, []);

  const clearSequenceTimers = useCallback(() => {
    sequenceTimers.current.forEach((timer) => window.clearTimeout(timer));
    sequenceTimers.current = [];
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
    const AudioCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return;
    const context = audioRef.current ?? new AudioCtor();
    audioRef.current = context;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const frequencies = { select: 420, move: 280, infect: 160, win: 620 };
    oscillator.type = kind === "infect" ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(frequencies[kind], context.currentTime);
    if (kind === "win") oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.22);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + (kind === "win" ? 0.32 : 0.16));
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + (kind === "win" ? 0.34 : 0.18));
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
      setNotice(result === 0 ? "세균 수가 같아요 — 무승부" : `${result === 1 ? "청록" : "코랄"} 팀이 게임판을 더 많이 차지했어요`);
      window.setTimeout(() => playTone("win"), 140);
      return;
    }
    if (!nextMoves.length) {
      setCurrentPlayer(lastPlayer);
      setNotice(`${nextPlayer === 1 ? "청록" : "코랄"} 팀은 움직일 수 없어 차례를 넘겨요`);
    } else {
      setCurrentPlayer(nextPlayer);
      setNotice(nextPlayer === 1 ? "청록 팀 차례예요" : settings.mode === "ai" ? "컴퓨터가 다음 수를 생각하고 있어요" : "코랄 팀 차례예요");
    }
  }, [playTone, settings.mode]);

  const executeMove = useCallback((move: Move, player: Player, mode: RelationMode = relationMode, useBomb = false) => {
    if (gameOver || animating || restartPromptOpen) return;
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
    const result = applyMove(board, numbers, player, move, mode, { forceInfection: useBomb });
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
    const opponent: Player = player === 1 ? 2 : 1;
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
        ? `${result.attackerNumber} = ${result.parentNumber} × ${result.spawnedNumber} · 부모와 새 세균의 수가 나뉘었어요`
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
          : `숫자 조건이 맞는 세균 ${result.infected.length}개에 감염탄을 쏴요`);
      }, 260);
      schedule(() => {
        setBoard(result.board);
        setNumbers(result.numbers);
        setInfection({ cells: result.infected, player });
        setCaptures((value) => {
          const next: [number, number] = [...value] as [number, number];
          next[player - 1] += result.infected.length;
          return next;
        });
        setNotice(`상대 세균 ${result.infected.length}개가 내 편이 되었어요${chargeLabel}`);
        playTone("infect");
      }, 820);
      schedule(() => {
        setInfection(null);
        setProjectiles([]);
        setResisted([]);
        setAnimating(false);
        resolveEnd(result.board, player, opponent);
      }, 1580);
    } else {
      setResisted(result.resisted);
      const resultNotice = useBomb && !bombUsed
        ? `${spawnLabel} · 감염할 상대가 없어 세균탄을 쓰지 않았어요`
        : result.resisted.length
        ? `${spawnLabel} · 주변 숫자에 ${infectionRuleLabel}가 없어 감염되지 않았어요`
        : `${spawnLabel} · 바로 옆에 상대 세균이 없어요`;
      setNotice(`${resultNotice}${chargeLabel}`);
      schedule(() => {
        setResisted([]);
        setAnimating(false);
        resolveEnd(result.board, player, opponent);
      }, result.resisted.length ? 1050 : 560);
    }
  }, [animating, board, bombCharge, bombs, captures, clearSequenceTimers, currentPlayer, gameOver, moveNumber, numbers, playTone, relationMode, resolveEnd, restartPromptOpen, schedule]);

  useEffect(() => {
    if (setupOpen || restartPromptOpen || gameOver || animating || settings.mode !== "ai" || currentPlayer !== 2) {
      setThinking(false);
      return;
    }
    setThinking(true);
    setNotice("컴퓨터가 게임판을 살펴보고 있어요");
    const action = chooseAiAction(board, numbers, settings.difficulty, 2, bombs[1]);
    if (!action) return;
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
  }, [animating, board, bombs, currentPlayer, executeMove, gameOver, numbers, playTone, restartPromptOpen, settings, setupOpen]);

  useEffect(() => () => clearSequenceTimers(), [clearSequenceTimers]);

  useEffect(() => {
    if (setupOpen || restartPromptOpen || gameOver) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [gameOver, restartPromptOpen, setupOpen]);

  useEffect(() => {
    if (!hydrated || animating) return;
    const saved: SavedGame = {
      version: 1,
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
    window.sessionStorage.setItem(SAVED_GAME_KEY, JSON.stringify(saved));
  }, [animating, board, bombArmed, bombCharge, bombs, captures, currentPlayer, elapsed, gameOver, history, hydrated, moveNumber, numbers, relationMode, selected, settings, setupOpen, winner]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || setupOpen || gameOver) return;
      event.preventDefault();
      setRulesOpen(false);
      setRestartReason("escape");
      setRestartPromptOpen(true);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [gameOver, setupOpen]);

  const startGame = useCallback((nextSettings = draftSettings) => {
    clearSequenceTimers();
    const normalizedSettings = normalizeSettings(nextSettings);
    const freshBoard = createBoard(normalizedSettings.boardSize);
    setSettings(normalizedSettings);
    setDraftSettings(normalizedSettings);
    setBoard(freshBoard);
    setNumbers(createNumbers(freshBoard));
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
    setRestartPromptOpen(false);
    setHistory([]);
    setInfection(null);
    setResisted([]);
    setProjectiles([]);
    setNotice("내 세균을 고른 뒤 약수·배수·분열 중 하나를 선택하세요");
    setSetupOpen(false);
  }, [clearSequenceTimers, draftSettings]);

  const handleCell = (index: number) => {
    if (gameOver || restartPromptOpen || thinking || animating || (settings.mode === "ai" && currentPlayer === 2)) return;
    const move = targetMap.get(index);
    if (move) {
      executeMove(move, currentPlayer, relationMode, bombArmed);
      return;
    }
    if (board[index] === currentPlayer) {
      if (selected === index) {
        const nextRelationMode = nextMode(relationMode);
        setRelationMode(nextRelationMode);
        setNotice(nextRelationMode === "split" && !factorPairs(numbers[index] ?? 0).length
          ? `${numbers[index]}은(는) 소수이므로 더 분열할 수 없습니다`
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
    if (!history.length || restartPromptOpen || thinking || animating) return;
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

  const playerTwoName = settings.mode === "ai" ? "컴퓨터" : "플레이어 2";
  const activeName = currentPlayer === 1 ? "플레이어 1" : playerTwoName;
  const gameLabel = settings.mode === "ai"
    ? `컴퓨터 · ${DIFFICULTY[settings.difficulty].label} · ${boardSize}×${boardSize}`
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
        <button className="brand" onClick={onExit} aria-label="게임 시작 화면으로 돌아가기">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><strong>페트리</strong><small>// 07</small></span>
        </button>
        <div className="topbar-center">
          <span className="live-dot" />
          <span>게임 시간</span>
          <b>{formatTime(elapsed)}</b>
        </div>
        <nav className="top-actions" aria-label="게임 메뉴">
          <button onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "소리 끄기" : "소리 켜기"}>{soundOn ? "◖))" : "◖×"}</button>
          <button onClick={() => setRulesOpen(true)} aria-label="게임 규칙 보기">?</button>
          <button className="mode-button" onClick={() => setSetupOpen(true)}><span>{gameLabel}</span><b>변경</b></button>
        </nav>
      </header>

      <section className="status-rail" aria-live="polite">
        <div className={`turn-beacon p${currentPlayer}`}><span>{thinking ? "생각 중" : currentPlayer === 1 ? "청록" : "코랄"}</span></div>
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
          <div className="player-topline"><span>청록 팀</span><i>● 준비됨</i></div>
          <div className="portrait"><Germ player={1} /><span className="scanline" /></div>
          <div className="identity"><small>내 세균</small><h2>플레이어 1</h2></div>
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
                      onClick={() => handleCell(index)}
                      onMouseEnter={() => move && setHovered(index)}
                      onMouseLeave={() => setHovered(null)}
                      role="gridcell"
                      aria-label={`${row}행 ${col}열, ${cell === 0 ? move ? move.distance === 1 ? "새 세균 만들기 가능" : "두 칸 이동 가능" : "빈 칸" : `${cell === 1 ? "청록" : "코랄"} ${numbers[index]}번 세균`}`}
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
            <button onClick={undo} disabled={!history.length || thinking || animating}><span>↶</span> 되돌리기</button>
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
                disabled={selected === null || bombs[currentPlayer - 1] === 0 || thinking || animating}
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
              setRestartReason("manual");
              setRestartPromptOpen(true);
            }}><span>↻</span> 새 게임</button>
          </div>
        </section>

        <aside className={`player-panel coral ${currentPlayer === 2 && !gameOver ? "active" : ""}`}>
          <div className="player-topline"><span>코랄 팀</span><i>● {settings.mode === "ai" ? "컴퓨터" : "준비됨"}</i></div>
          <div className="portrait"><Germ player={2} /><span className="scanline" /></div>
          <div className="identity"><small>{settings.mode === "ai" ? "컴퓨터 세균" : "상대 세균"}</small><h2>{playerTwoName}</h2></div>
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
          <small>{chargeBurst === 1 ? "충전 완료 · +1" : `${bombCharge[0]} / 5 개인 턴`}</small>
        </div>
        <div className="charge-core"><span>✹</span><b>자동 충전</b><small>5턴마다 세균탄 +1</small></div>
        <div className={`charge-unit p2 ${currentPlayer === 2 && !gameOver ? "active" : ""} ${chargeBurst === 2 ? "charged" : ""}`}>
          <div className="charge-heading"><span><i /> {playerTwoName}</span><b>세균탄 ×{bombs[1]}</b></div>
          <div className="charge-track" role="progressbar" aria-label="플레이어 2 세균탄 모으기" aria-valuemin={0} aria-valuemax={5} aria-valuenow={displayedCharge[1]}>
            <em style={{ width: `${(displayedCharge[1] / 5) * 100}%` }} />
            {[1, 2, 3, 4].map((tick) => <i key={tick} style={{ left: `${tick * 20}%` }} />)}
          </div>
          <small>{chargeBurst === 2 ? "충전 완료 · +1" : `${bombCharge[1]} / 5 개인 턴`}</small>
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
                <span className="tab-icon">⌁</span><span><b>컴퓨터와 하기</b><small>컴퓨터와 겨뤄요</small></span>
              </button>
              <button className={draftSettings.mode === "local" ? "selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, mode: "local" }))}>
                <span className="tab-icon">◎</span><span><b>친구와 하기</b><small>한 화면에서 둘이 해요</small></span>
              </button>
            </div>

            <div className="board-size-select">
              <div className="select-heading"><span>게임판 크기</span><small>가로와 세로의 칸 수를 고르세요</small></div>
              <div className="size-grid">
                {BOARD_SIZES.map((size) => (
                  <button
                    key={size}
                    className={draftSettings.boardSize === size ? "selected" : ""}
                    onClick={() => setDraftSettings((value) => ({ ...value, boardSize: size }))}
                  >
                    <b>{size} × {size}</b>
                    <small>{size === 7 ? "빠른 대전" : size === 9 ? "표준 대전" : "대형 대전"}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className={`difficulty-select ${draftSettings.mode === "local" ? "disabled" : ""}`}>
              <div className="select-heading"><span>컴퓨터 난이도</span><small>{draftSettings.mode === "local" ? "친구와 할 때는 사용하지 않아요" : "어려운 정도를 고르세요"}</small></div>
              <div className="difficulty-grid">
                {(Object.keys(DIFFICULTY) as Difficulty[]).map((level) => (
                  <button key={level} disabled={draftSettings.mode === "local"} className={draftSettings.difficulty === level ? "selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, difficulty: level }))}>
                    <span><b>{DIFFICULTY[level].label}</b><DifficultyBars count={DIFFICULTY[level].bars} /></span>
                    <small>{DIFFICULTY[level].detail}</small>
                  </button>
                ))}
              </div>
            </div>

            <button className="launch-button" onClick={() => startGame()}><span>게임 시작</span><i>→</i></button>
            <button className="free-exit-button" onClick={onExit}>← 게임 시작 화면</button>
            <button className="rules-link" onClick={() => setRulesOpen(true)}>게임 규칙 보기 <span>?</span></button>
          </section>
        </div>
      )}

      {rulesOpen && (
        <div className="drawer-backdrop" onClick={() => setRulesOpen(false)}>
          <aside className="rules-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rules-title">
            <button className="drawer-close" onClick={() => setRulesOpen(false)} aria-label="규칙 닫기">×</button>
            <span className="drawer-kicker">게임 설명 // 01</span>
            <h2 id="rules-title">게임 방법</h2>
            <p className="rules-lead">약수와 배수를 찾아 상대 세균을 내 편으로 만드세요.</p>
            <ol>
              <li><b>게임판 크기</b><p>게임을 시작할 때 7×7, 9×9, 11×11 중 하나를 고를 수 있어요. 크기가 달라도 게임 방법은 같아요.</p></li>
              <li><b>나오는 숫자</b><p>시작 세균, 배수로 만든 새 세균, 감염된 세균에는 2부터 100까지의 합성수가 나와요. 합성수는 1과 자기 자신 말고도 약수가 있는 수예요. 약수 모드와 분열 모드에서는 소수도 나올 수 있어요.</p></li>
              <li><b>구구단 숫자가 나올 확률</b><p>시작 세균과 감염된 세균의 숫자는 90% 확률로 2단부터 9단까지의 구구단 숫자에서 나와요. 나머지 10%는 2부터 100까지의 다른 합성수에서 나와요.</p></li>
              <li><b>새 세균의 숫자</b><p>약수 모드에서는 고른 세균의 약수 가운데 하나가 나와요. 1과 고른 세균의 수는 빼고 아무거나 하나를 고르며, 소수도 나올 수 있어요. 고를 약수가 없을 때만 같은 수가 나와요. 배수 모드에서는 100 이하인 배수 가운데 하나가 나와요.</p></li>
              <li><b>감염된 세균의 숫자</b><p>내 편이 된 상대 세균은 새로운 합성수를 받아요. 이때도 구구단 숫자가 먼저 나와요.</p></li>
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

      {restartPromptOpen && !setupOpen && (
        <div className="modal-backdrop restart-backdrop">
          <section className="restart-modal" role="alertdialog" aria-modal="true" aria-labelledby="restart-title" aria-describedby="restart-description">
            <span className="restart-icon" aria-hidden="true">↻</span>
            <small>다시 시작하기</small>
            <h2 id="restart-title">게임을 다시 시작할까요?</h2>
            <p id="restart-description">
              {restartReason === "refresh"
                ? "새로고침 전 게임을 그대로 불러왔어요. 새 게임을 시작할지 골라 주세요."
                : restartReason === "escape"
                  ? "나가기 키를 눌렀어요. 지금 게임을 이어 하거나 새로 시작할 수 있어요."
                  : "지금까지 한 내용을 지우고 같은 설정으로 새 게임을 시작해요."}
            </p>
            <div>
              <button className="continue-game" autoFocus onClick={() => setRestartPromptOpen(false)}>이어서 하기</button>
              <button className="confirm-restart" onClick={() => startGame(settings)}>다시 시작</button>
            </div>
          </section>
        </div>
      )}

      {gameOver && !setupOpen && (
        <div className="result-layer">
          <section className={`result-card ${winner === 2 ? "coral-win" : ""}`}>
            <span className="result-kicker">게임 끝</span>
            {winner !== 0 ? <Germ player={winner} /> : <div className="draw-symbol">＝</div>}
            <h2>{winner === 0 ? "무승부" : `${winner === 1 ? "청록" : "코랄"} 팀 승리`}</h2>
            <p>{scores[0]} <i>:</i> {scores[1]}</p>
            <small>{moveNumber - 1}번 움직임 · {formatTime(elapsed)}</small>
            <div><button onClick={() => startGame(settings)}>다시 하기</button><button onClick={() => setSetupOpen(true)}>설정 바꾸기</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

