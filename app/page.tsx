"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BOARD_SIZE,
  applyMove,
  chooseAiMove,
  createBoard,
  getDistance,
  legalMoves,
  score,
  type Cell,
  type Difficulty,
  type Move,
  type Player,
} from "./game";

type Mode = "ai" | "local";
type Settings = { mode: Mode; difficulty: Difficulty };
type Snapshot = {
  board: Cell[];
  player: Player;
  move: number;
  captures: [number, number];
};

const DIFFICULTY = {
  easy: { label: "초급", detail: "느긋한 배양", bars: 1 },
  medium: { label: "중급", detail: "균형 잡힌 수읽기", bars: 2 },
  hard: { label: "고급", detail: "깊은 영역 분석", bars: 3 },
} as const;

function formatTime(seconds: number) {
  const min = Math.floor(seconds / 60).toString().padStart(2, "0");
  const sec = (seconds % 60).toString().padStart(2, "0");
  return `${min}:${sec}`;
}

function Germ({ player, infection = false }: { player: Player; infection?: boolean }) {
  return (
    <span
      className={`germ-sprite p${player} ${infection ? "infection" : "idle"}`}
      aria-hidden="true"
    />
  );
}

function DifficultyBars({ count }: { count: number }) {
  return (
    <span className="difficulty-bars" aria-hidden="true">
      {[1, 2, 3].map((bar) => <i key={bar} className={bar <= count ? "on" : ""} />)}
    </span>
  );
}

export default function Home() {
  const [board, setBoard] = useState<Cell[]>(createBoard);
  const [currentPlayer, setCurrentPlayer] = useState<Player>(1);
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [settings, setSettings] = useState<Settings>({ mode: "ai", difficulty: "medium" });
  const [draftSettings, setDraftSettings] = useState<Settings>({ mode: "ai", difficulty: "medium" });
  const [setupOpen, setSetupOpen] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<0 | Player>(0);
  const [moveNumber, setMoveNumber] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [captures, setCaptures] = useState<[number, number]>([0, 0]);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [infection, setInfection] = useState<{ cells: number[]; player: Player } | null>(null);
  const [arrived, setArrived] = useState<number | null>(null);
  const [notice, setNotice] = useState("청록 균주가 먼저 증식합니다");
  const audioRef = useRef<AudioContext | null>(null);

  const scores = useMemo(() => score(board), [board]);
  const emptyCount = board.filter((cell) => cell === 0).length;
  const selectedMoves = useMemo(
    () => selected === null ? [] : legalMoves(board, currentPlayer).filter((move) => move.from === selected),
    [board, currentPlayer, selected],
  );
  const targetMap = useMemo(() => new Map(selectedMoves.map((move) => [move.to, move])), [selectedMoves]);

  const previewInfections = useMemo(() => {
    if (hovered === null || !targetMap.has(hovered)) return new Set<number>();
    const result = new Set<number>();
    const row = Math.floor(hovered / BOARD_SIZE);
    const col = hovered % BOARD_SIZE;
    for (let y = Math.max(0, row - 1); y <= Math.min(BOARD_SIZE - 1, row + 1); y += 1) {
      for (let x = Math.max(0, col - 1); x <= Math.min(BOARD_SIZE - 1, col + 1); x += 1) {
        const index = y * BOARD_SIZE + x;
        if (board[index] !== 0 && board[index] !== currentPlayer) result.add(index);
      }
    }
    return result;
  }, [board, currentPlayer, hovered, targetMap]);

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
      setNotice(result === 0 ? "완벽한 균형 — 무승부" : `${result === 1 ? "청록" : "코랄"} 균주가 배양판을 지배했습니다`);
      window.setTimeout(() => playTone("win"), 140);
      return;
    }
    if (!nextMoves.length) {
      setCurrentPlayer(lastPlayer);
      setNotice(`${nextPlayer === 1 ? "청록" : "코랄"} 균주는 이동할 수 없어 턴을 넘깁니다`);
    } else {
      setCurrentPlayer(nextPlayer);
      setNotice(nextPlayer === 1 ? "청록 균주의 증식 차례" : settings.mode === "ai" ? "CORTEX가 배양 경로를 분석 중" : "코랄 균주의 증식 차례");
    }
  }, [playTone, settings.mode]);

  const executeMove = useCallback((move: Move, player: Player) => {
    if (gameOver) return;
    setHistory((previous) => [...previous, { board: [...board], player: currentPlayer, move: moveNumber, captures: [...captures] as [number, number] }]);
    const result = applyMove(board, player, move);
    setBoard(result.board);
    setSelected(null);
    setHovered(null);
    setMoveNumber((value) => value + 1);
    setArrived(move.to);
    window.setTimeout(() => setArrived(null), 520);
    if (result.infected.length) {
      setCaptures((value) => {
        const next: [number, number] = [...value] as [number, number];
        next[player - 1] += result.infected.length;
        return next;
      });
      setInfection({ cells: result.infected, player });
      window.setTimeout(() => setInfection(null), 760);
      playTone("infect");
    } else {
      playTone("move");
    }
    const nextPlayer = player === 1 ? 2 : 1;
    resolveEnd(result.board, player, nextPlayer);
  }, [board, captures, currentPlayer, gameOver, moveNumber, playTone, resolveEnd]);

  useEffect(() => {
    if (setupOpen || gameOver || settings.mode !== "ai" || currentPlayer !== 2) {
      setThinking(false);
      return;
    }
    setThinking(true);
    const delay = settings.difficulty === "hard" ? 760 : 540;
    const timer = window.setTimeout(() => {
      const move = chooseAiMove(board, settings.difficulty, 2);
      setThinking(false);
      if (move) executeMove(move, 2);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [board, currentPlayer, executeMove, gameOver, settings, setupOpen]);

  useEffect(() => {
    if (setupOpen || gameOver) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [gameOver, setupOpen]);

  const startGame = useCallback((nextSettings = draftSettings) => {
    setSettings(nextSettings);
    setDraftSettings(nextSettings);
    setBoard(createBoard());
    setCurrentPlayer(1);
    setSelected(null);
    setHovered(null);
    setThinking(false);
    setGameOver(false);
    setWinner(0);
    setMoveNumber(1);
    setElapsed(0);
    setCaptures([0, 0]);
    setHistory([]);
    setInfection(null);
    setNotice("청록 균주가 먼저 증식합니다");
    setSetupOpen(false);
  }, [draftSettings]);

  const handleCell = (index: number) => {
    if (gameOver || thinking || (settings.mode === "ai" && currentPlayer === 2)) return;
    const move = targetMap.get(index);
    if (move) {
      executeMove(move, currentPlayer);
      return;
    }
    if (board[index] === currentPlayer) {
      setSelected(selected === index ? null : index);
      playTone("select");
    } else {
      setSelected(null);
    }
  };

  const undo = () => {
    if (!history.length || thinking) return;
    const steps = settings.mode === "ai" ? Math.min(2, history.length) : 1;
    const snapshot = history[history.length - steps];
    setBoard(snapshot.board);
    setCurrentPlayer(snapshot.player);
    setMoveNumber(snapshot.move);
    setCaptures(snapshot.captures);
    setHistory((value) => value.slice(0, -steps));
    setGameOver(false);
    setWinner(0);
    setSelected(null);
    setInfection(null);
    setNotice("이전 배양 상태로 복원했습니다");
  };

  const playerTwoName = settings.mode === "ai" ? "CORTEX AI" : "PLAYER 2";
  const activeName = currentPlayer === 1 ? "PLAYER 1" : playerTwoName;
  const gameLabel = settings.mode === "ai" ? `AI · ${DIFFICULTY[settings.difficulty].label}` : "로컬 2인 대전";

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar">
        <button className="brand" onClick={() => setSetupOpen(true)} aria-label="게임 모드 선택 열기">
          <span className="brand-mark"><i /><i /><i /></span>
          <span><strong>PETRI</strong><small>// 07</small></span>
        </button>
        <div className="topbar-center">
          <span className="live-dot" />
          <span>LIVE CULTURE</span>
          <b>{formatTime(elapsed)}</b>
        </div>
        <nav className="top-actions" aria-label="게임 메뉴">
          <button onClick={() => setSoundOn((value) => !value)} aria-label={soundOn ? "소리 끄기" : "소리 켜기"}>{soundOn ? "◖))" : "◖×"}</button>
          <button onClick={() => setRulesOpen(true)} aria-label="게임 규칙 보기">?</button>
          <button className="mode-button" onClick={() => setSetupOpen(true)}><span>{gameLabel}</span><b>변경</b></button>
        </nav>
      </header>

      <section className="status-rail" aria-live="polite">
        <div className={`turn-beacon p${currentPlayer}`}><span>{thinking ? "분석" : `P${currentPlayer}`}</span></div>
        <div className="status-copy">
          <small>ROUND {String(moveNumber).padStart(2, "0")} · {activeName}</small>
          <strong>{notice}</strong>
        </div>
        <div className="coverage">
          <span>배양률</span>
          <b>{Math.round(((49 - emptyCount) / 49) * 100)}%</b>
          <i><em style={{ width: `${((49 - emptyCount) / 49) * 100}%` }} /></i>
        </div>
      </section>

      <section className="game-layout">
        <aside className={`player-panel cyan ${currentPlayer === 1 && !gameOver ? "active" : ""}`}>
          <div className="player-topline"><span>STRAIN 01</span><i>● ONLINE</i></div>
          <div className="portrait"><Germ player={1} /><span className="scanline" /></div>
          <div className="identity"><small>HUMAN CULTURE</small><h2>PLAYER 1</h2></div>
          <div className="score-block"><small>COLONY COUNT</small><strong>{String(scores[0]).padStart(2, "0")}</strong></div>
          <div className="player-metrics">
            <span><small>감염</small><b>+{captures[0]}</b></span>
            <span><small>이동 가능</small><b>{legalMoves(board, 1).length}</b></span>
          </div>
        </aside>

        <section className="board-stage">
          <div className="petri-frame">
            <div className="frame-label top"><span>SPECIMEN GRID</span><b>07 × 07</b></div>
            <div className="board-wrap">
              <div className="board-grid" role="grid" aria-label="7 x 7 세균전 배양판">
                {board.map((cell, index) => {
                  const move = targetMap.get(index);
                  const isInfected = infection?.cells.includes(index) ?? false;
                  const row = Math.floor(index / BOARD_SIZE) + 1;
                  const col = index % BOARD_SIZE + 1;
                  return (
                    <button
                      key={index}
                      className={[
                        "cell",
                        cell ? `occupied p${cell}` : "empty",
                        selected === index ? "selected" : "",
                        move ? `legal ${move.distance === 1 ? "clone" : "jump"}` : "",
                        previewInfections.has(index) ? "will-infect" : "",
                        arrived === index ? "arrived" : "",
                      ].filter(Boolean).join(" ")}
                      onClick={() => handleCell(index)}
                      onMouseEnter={() => move && setHovered(index)}
                      onMouseLeave={() => setHovered(null)}
                      role="gridcell"
                      aria-label={`${row}행 ${col}열, ${cell === 0 ? move ? move.distance === 1 ? "복제 가능" : "점프 가능" : "빈 칸" : cell === 1 ? "청록 세균" : "코랄 세균"}`}
                    >
                      <span className="cell-gridmark" />
                      {cell !== 0 && <Germ player={cell} infection={isInfected} />}
                      {move && <span className="move-hint"><i />{move.distance === 1 ? "+" : "↗"}</span>}
                      {previewInfections.has(index) && <span className="preview-ring" />}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="frame-label bottom"><span>BIO-CONTAINMENT: STABLE</span><b>◈ SECURE</b></div>
          </div>

          <div className="board-controls">
            <button onClick={undo} disabled={!history.length || thinking}><span>↶</span> 되돌리기</button>
            <div className="legend"><span><i className="clone-dot" />1칸 복제</span><span><i className="jump-dot" />2칸 이동</span></div>
            <button onClick={() => startGame(settings)}><span>↻</span> 재배양</button>
          </div>
        </section>

        <aside className={`player-panel coral ${currentPlayer === 2 && !gameOver ? "active" : ""}`}>
          <div className="player-topline"><span>STRAIN 02</span><i>● {settings.mode === "ai" ? "NEURAL" : "ONLINE"}</i></div>
          <div className="portrait"><Germ player={2} /><span className="scanline" /></div>
          <div className="identity"><small>{settings.mode === "ai" ? "SYNTHETIC CULTURE" : "HUMAN CULTURE"}</small><h2>{playerTwoName}</h2></div>
          <div className="score-block"><small>COLONY COUNT</small><strong>{String(scores[1]).padStart(2, "0")}</strong></div>
          <div className="player-metrics">
            <span><small>감염</small><b>+{captures[1]}</b></span>
            <span><small>{settings.mode === "ai" ? "지능" : "이동 가능"}</small><b>{settings.mode === "ai" ? DIFFICULTY[settings.difficulty].label : legalMoves(board, 2).length}</b></span>
          </div>
        </aside>
      </section>

      <footer className="footer-line">
        <span>PETRI LAB SYSTEMS</span><i />
        <p>선택한 세균에서 빛나는 칸으로 증식하세요. 인접한 상대 균주는 즉시 감염됩니다.</p><i />
        <span>BUILD 07.26</span>
      </footer>

      {setupOpen && (
        <div className="modal-backdrop">
          <section className="setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title">
            <div className="modal-kicker"><span /> NEW CULTURE PROTOCOL <span /></div>
            <div className="setup-hero">
              <div className="hero-germ cyan-hero"><Germ player={1} /></div>
              <div className="versus"><small>PETRI // 07</small><h1 id="setup-title">세균전</h1><p>번식하고, 감염시키고, 지배하라</p></div>
              <div className="hero-germ coral-hero"><Germ player={2} /></div>
            </div>

            <div className="mode-tabs">
              <button className={draftSettings.mode === "ai" ? "selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, mode: "ai" }))}>
                <span className="tab-icon">⌁</span><span><b>컴퓨터 대전</b><small>CORTEX AI와 맞서기</small></span>
              </button>
              <button className={draftSettings.mode === "local" ? "selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, mode: "local" }))}>
                <span className="tab-icon">◎</span><span><b>사용자 대전</b><small>한 화면에서 2인 플레이</small></span>
              </button>
            </div>

            <div className={`difficulty-select ${draftSettings.mode === "local" ? "disabled" : ""}`}>
              <div className="select-heading"><span>AI 배양 지능</span><small>{draftSettings.mode === "local" ? "사용자 대전에서는 적용되지 않습니다" : "난이도를 선택하세요"}</small></div>
              <div className="difficulty-grid">
                {(Object.keys(DIFFICULTY) as Difficulty[]).map((level) => (
                  <button key={level} disabled={draftSettings.mode === "local"} className={draftSettings.difficulty === level ? "selected" : ""} onClick={() => setDraftSettings((value) => ({ ...value, difficulty: level }))}>
                    <span><b>{DIFFICULTY[level].label}</b><DifficultyBars count={DIFFICULTY[level].bars} /></span>
                    <small>{DIFFICULTY[level].detail}</small>
                  </button>
                ))}
              </div>
            </div>

            <button className="launch-button" onClick={() => startGame()}><span>배양 시작</span><i>→</i></button>
            <button className="rules-link" onClick={() => setRulesOpen(true)}>게임 규칙 보기 <span>?</span></button>
          </section>
        </div>
      )}

      {rulesOpen && (
        <div className="drawer-backdrop" onClick={() => setRulesOpen(false)}>
          <aside className="rules-drawer" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="rules-title">
            <button className="drawer-close" onClick={() => setRulesOpen(false)} aria-label="규칙 닫기">×</button>
            <span className="drawer-kicker">CULTURE MANUAL // 01</span>
            <h2 id="rules-title">배양 프로토콜</h2>
            <p className="rules-lead">더 많은 영역을 자신의 균주로 채우면 승리합니다.</p>
            <ol>
              <li><b>복제</b><p>자신의 세균에서 가로·세로·대각선 1칸을 선택하면 원래 세균을 남긴 채 새 세균이 태어납니다.</p></li>
              <li><b>도약</b><p>2칸 떨어진 곳을 선택하면 세균이 이동합니다. 중간 칸은 건너뛸 수 있습니다.</p></li>
              <li><b>감염</b><p>도착 지점에 인접한 상대 세균은 모두 자신의 균주로 변환됩니다.</p></li>
              <li><b>종료</b><p>배양판이 가득 차거나 양쪽 모두 이동할 수 없으면 세균 수를 비교합니다.</p></li>
            </ol>
            <button className="drawer-action" onClick={() => setRulesOpen(false)}>이해했습니다</button>
          </aside>
        </div>
      )}

      {gameOver && !setupOpen && (
        <div className="result-layer">
          <section className={`result-card ${winner === 2 ? "coral-win" : ""}`}>
            <span className="result-kicker">CULTURE COMPLETE</span>
            {winner !== 0 ? <Germ player={winner} /> : <div className="draw-symbol">＝</div>}
            <h2>{winner === 0 ? "균형 배양" : `${winner === 1 ? "청록" : "코랄"} 균주 승리`}</h2>
            <p>{scores[0]} <i>:</i> {scores[1]}</p>
            <small>{moveNumber - 1}회 증식 · {formatTime(elapsed)}</small>
            <div><button onClick={() => startGame(settings)}>다시 배양</button><button onClick={() => setSetupOpen(true)}>모드 변경</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
