"use client";

export const dynamic = "force-static";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { factorPairs, getDistance, legalMoves, type Move, type RelationMode } from "./game";
import {
  MODE_COPY,
  STORY_STAGES,
  applyBossPulse,
  applyStoryMove,
  chooseStoryAiMove,
  createStoryBattle,
  type StoryBattle,
  type StoryStage,
} from "./story";

const STORY_SAVE_KEY = "factor-force-story-progress-v1";

const OPENING_CAPTIONS = [
  "서기 2042년, 숫자를 바꾸며 증식하는 질병 세균이 지구 전역에 나타났다.",
  "약수와 배수의 감염망이 완성되면 지구의 모든 생명은 멈추고 만다.",
  "수학 연구소는 질병 세균을 역감염시키는 ‘치료 세균’을 개발했다.",
  "세계의 감염 지역을 해방하고, 태평양의 원천균을 제거하라!",
];

const ENDING_CAPTIONS = [
  "마지막 치료 파장이 원천균의 숫자 방어막을 무너뜨렸다.",
  "남아 있던 질병 세균은 모두 치료 세균으로 바뀌었다.",
  "해방된 대륙에 생명이 돌아오고, 지구는 다시 푸르게 빛났다.",
  "임무 완료. 약수와 배수로 지켜 낸 우리의 행성에 평화가 찾아왔다.",
];

type View = "map" | "battle";
type BattleResult = "clear" | "failed" | null;
type CinematicKind = "opening" | "ending";

function loadProgress() {
  if (typeof window === "undefined") return [] as number[];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORY_SAVE_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id) && id >= 1 && id <= 11) : [];
  } catch {
    return [];
  }
}

function stageModeLabel(modes: RelationMode[]) {
  return modes.map((mode) => MODE_COPY[mode].label.replace(" 모드", "")).join(" · ");
}

function Germ({
  kind,
  number,
  boss = false,
  active = false,
}: {
  kind: "therapy" | "disease";
  number: number;
  boss?: boolean;
  active?: boolean;
}) {
  return (
    <span className={`story-germ ${kind} ${boss ? "boss" : ""} ${active ? "active" : ""}`} aria-hidden="true">
      <i className="germ-eye left" />
      <i className="germ-eye right" />
      <b>{number}</b>
    </span>
  );
}

function Cinematic({ kind, onFinish }: { kind: CinematicKind; onFinish: () => void }) {
  const [captionIndex, setCaptionIndex] = useState(0);
  const captions = kind === "opening" ? OPENING_CAPTIONS : ENDING_CAPTIONS;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (captionIndex < captions.length - 1) setCaptionIndex((value) => value + 1);
      else onFinish();
    }, captionIndex === 0 ? 3200 : 2800);
    return () => window.clearTimeout(timer);
  }, [captionIndex, captions.length, onFinish]);

  return (
    <div className="cinematic" role="dialog" aria-modal="true" aria-label={kind === "opening" ? "오프닝" : "엔딩"}>
      <img src={`${basePath}/assets/story/${kind}.png`} alt="" />
      <div className="cinematic-vignette" />
      <div className="cinematic-topline">
        <span>{kind === "opening" ? "FACTOR FORCE · PROLOGUE" : "FACTOR FORCE · EPILOGUE"}</span>
        <button onClick={onFinish}>건너뛰기 <i>››</i></button>
      </div>
      <div className="cinematic-copy" key={captionIndex}>
        <small>{kind === "opening" ? `긴급 기록 0${captionIndex + 1}` : `평화 기록 0${captionIndex + 1}`}</small>
        <p>{captions[captionIndex]}</p>
        <div className="caption-progress">
          {captions.map((_, index) => <i key={index} className={index <= captionIndex ? "on" : ""} />)}
        </div>
      </div>
    </div>
  );
}

function WorldMap({
  selected,
  completed,
  onSelect,
}: {
  selected: number;
  completed: number[];
  onSelect: (id: number) => void;
}) {
  const unlocked = Math.min(11, Math.max(1, completed.length ? Math.max(...completed) + 1 : 1));
  return (
    <section className="world-map" aria-label="세계 감염 지도">
      <div className="map-grid" />
      <div className="continent north-america"><span>북아메리카</span></div>
      <div className="continent south-america"><span>남아메리카</span></div>
      <div className="continent europe"><span>유럽</span></div>
      <div className="continent africa"><span>아프리카</span></div>
      <div className="continent asia"><span>아시아</span></div>
      <div className="continent oceania"><span>오세아니아</span></div>
      <div className="map-route" aria-hidden="true" />
      {STORY_STAGES.map((stage) => {
        const isComplete = completed.includes(stage.id);
        const isUnlocked = stage.id <= unlocked || isComplete;
        return (
          <button
            key={stage.id}
            className={`stage-pin ${selected === stage.id ? "selected" : ""} ${isComplete ? "complete" : ""} ${!isUnlocked ? "locked" : ""} ${stage.boss ? "boss-pin" : ""}`}
            style={{ left: `${stage.x}%`, top: `${stage.y}%` }}
            onClick={() => isUnlocked && onSelect(stage.id)}
            aria-label={`${stage.id} 스테이지 ${stage.title}${isUnlocked ? "" : " 잠김"}`}
          >
            <span>{isComplete ? "✓" : isUnlocked ? stage.id : "⌁"}</span>
            <em>{stage.id === 11 ? "BOSS" : stage.place.split(" · ")[1]}</em>
          </button>
        );
      })}
      <div className="map-legend"><span><i className="complete" /> 해방 완료</span><span><i className="current" /> 작전 가능</span><span><i className="danger" /> 감염 지역</span></div>
    </section>
  );
}

function StagePanel({
  stage,
  complete,
  locked,
  onStart,
}: {
  stage: StoryStage;
  complete: boolean;
  locked: boolean;
  onStart: () => void;
}) {
  return (
    <aside className="stage-panel">
      <div className="stage-panel-head">
        <span className="stage-number">{stage.id === 11 ? "BOSS" : `0${stage.id}`.slice(-2)}</span>
        <div><small>{stage.lesson}</small><h2>{stage.title}</h2></div>
      </div>
      <div className="location-line"><i>⌖</i> {stage.place} <span>{stage.continent}</span></div>
      <p className="stage-story">{stage.story}</p>
      <div className="mission-box">
        <small>MISSION OBJECTIVE</small>
        <strong>{stage.mission}</strong>
      </div>
      <dl className="stage-facts">
        <div><dt>학습 목표</dt><dd>{stage.learning}</dd></div>
        <div><dt>사용 모드</dt><dd>{stageModeLabel(stage.modes)}</dd></div>
        <div><dt>핵심 단서</dt><dd>{stage.example}</dd></div>
      </dl>
      <div className="difficulty-line"><span>위험도</span><div>{[1, 2, 3].map((level) => <i key={level} className={level <= stage.difficulty ? "on" : ""} />)}</div></div>
      <button className="deploy-button" disabled={locked} onClick={onStart}>
        {locked ? "이전 지역을 먼저 해방하세요" : complete ? "다시 작전하기" : stage.id === 1 ? "오프닝부터 시작" : "치료 세균 투입"}
        {!locked && <span>→</span>}
      </button>
    </aside>
  );
}

function BattleBoard({
  battle,
  stage,
  selected,
  hovered,
  flash,
  disabled,
  onCell,
  onHover,
}: {
  battle: StoryBattle;
  stage: StoryStage;
  selected: number | null;
  hovered: number | null;
  flash: { infected: number[]; resisted: number[] };
  disabled: boolean;
  onCell: (index: number) => void;
  onHover: (index: number | null) => void;
}) {
  const targets = useMemo(() => new Set(
    selected === null ? [] : legalMoves(battle.board, 1).filter((move) => move.from === selected).map((move) => move.to),
  ), [battle.board, selected]);

  return (
    <div className="battle-board" role="grid" aria-label="감염 치료 전장">
      {battle.board.map((cell, index) => {
        const number = battle.numbers[index];
        const isBoss = battle.bossIndex === index && battle.bossHp > 0;
        return (
          <button
            key={index}
            role="gridcell"
            className={`battle-cell ${cell === 0 ? "empty" : cell === 1 ? "therapy-cell" : "disease-cell"} ${selected === index ? "selected" : ""} ${targets.has(index) ? "target" : ""} ${flash.infected.includes(index) ? "infected" : ""} ${flash.resisted.includes(index) ? "resisted" : ""} ${isBoss ? "boss-cell" : ""}`}
            onClick={() => onCell(index)}
            onMouseEnter={() => onHover(index)}
            onMouseLeave={() => onHover(null)}
            disabled={disabled}
            aria-label={cell === 0 ? `빈 칸 ${index + 1}` : `${cell === 1 ? "치료" : "질병"} 세균 ${number}${isBoss ? `, 보스 내성 ${battle.bossHp}` : ""}`}
          >
            {cell !== 0 && number !== null && <Germ kind={cell === 1 ? "therapy" : "disease"} number={number} boss={isBoss} active={hovered === index || selected === index} />}
            {targets.has(index) && <span className="target-mark">+</span>}
            {isBoss && <span className="boss-hp-mini">{battle.bossHp}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [selectedStageId, setSelectedStageId] = useState(1);
  const [view, setView] = useState<View>("map");
  const [battleStageId, setBattleStageId] = useState(1);
  const [battle, setBattle] = useState<StoryBattle>(() => createStoryBattle(STORY_STAGES[0]));
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [relationMode, setRelationMode] = useState<RelationMode>("divisor");
  const [turn, setTurn] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("치료 세균을 선택한 뒤 빛나는 칸으로 이동하세요.");
  const [flash, setFlash] = useState<{ infected: number[]; resisted: number[] }>({ infected: [], resisted: [] });
  const [moveCount, setMoveCount] = useState(0);
  const [result, setResult] = useState<BattleResult>(null);
  const [cinematic, setCinematic] = useState<CinematicKind | null>(null);
  const [freeBattle, setFreeBattle] = useState(false);
  const timers = useRef<number[]>([]);

  const selectedStage = STORY_STAGES[selectedStageId - 1];
  const battleStage = STORY_STAGES[battleStageId - 1];
  const unlocked = Math.min(11, Math.max(1, completed.length ? Math.max(...completed) + 1 : 1));

  useEffect(() => {
    const progress = loadProgress();
    setCompleted(progress);
    setSelectedStageId(Math.min(11, Math.max(1, progress.length ? Math.max(...progress) + 1 : 1)));
    setHydrated(true);
    return () => timers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timers.current.push(timer);
  }, []);

  const persistCompletion = useCallback((stageId: number) => {
    if (freeBattle) return;
    setCompleted((previous) => {
      const next = previous.includes(stageId) ? previous : [...previous, stageId].sort((a, b) => a - b);
      window.localStorage.setItem(STORY_SAVE_KEY, JSON.stringify(next));
      return next;
    });
  }, [freeBattle]);

  const beginBattle = useCallback((stage: StoryStage, free = false) => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setFreeBattle(free);
    setBattleStageId(stage.id);
    setBattle(createStoryBattle(stage));
    setRelationMode(stage.modes[0]);
    setSelectedCell(null);
    setHoveredCell(null);
    setTurn(1);
    setBusy(false);
    setMoveCount(0);
    setResult(null);
    setFlash({ infected: [], resisted: [] });
    setFeedback(`${MODE_COPY[stage.modes[0]].label} 준비 완료. ${stage.mission}`);
    setView("battle");
  }, []);

  const startSelectedStage = useCallback(() => {
    if (selectedStage.id === 1 && !completed.includes(1)) {
      setCinematic("opening");
      return;
    }
    beginBattle(selectedStage);
  }, [beginBattle, completed, selectedStage]);

  const finishBattle = useCallback((stage: StoryStage) => {
    persistCompletion(stage.id);
    setBusy(false);
    setTurn(1);
    if (stage.id === 11 && !freeBattle) {
      schedule(() => setCinematic("ending"), 850);
    } else {
      setResult("clear");
    }
  }, [freeBattle, persistCompletion, schedule]);

  const resolveAiTurn = useCallback((afterPlayer: StoryBattle) => {
    let working = afterPlayer;
    if (battleStage.boss) {
      const pulse = applyBossPulse(working, battleStage);
      working = pulse;
      setBattle(working);
      if (pulse.relationText) setFeedback(pulse.relationText);
      setFlash({ infected: pulse.infected, resisted: [] });
    }

    const action = chooseStoryAiMove(working, battleStage);
    if (!action) {
      setTurn(1);
      setBusy(false);
      setFeedback("질병 세균이 이동할 수 없어요. 치료 작전을 계속하세요.");
      return;
    }
    const enemyResult = applyStoryMove(working, battleStage, 2, action.move, action.mode);
    setBattle(enemyResult);
    setFlash({ infected: enemyResult.infected, resisted: enemyResult.resisted });
    setFeedback(enemyResult.infected.length
      ? `역감염 발생! ${enemyResult.relationText}`
      : `질병 세균의 공격을 막았어요. ${enemyResult.relationText}`);
    setMoveCount((value) => value + 1);
    if (!enemyResult.board.includes(1)) {
      setResult("failed");
      setBusy(false);
      return;
    }
    schedule(() => {
      setFlash({ infected: [], resisted: [] });
      setTurn(1);
      setBusy(false);
    }, 650);
  }, [battleStage, schedule]);

  const executePlayerMove = useCallback((move: Move) => {
    setBusy(true);
    setSelectedCell(null);
    const next = applyStoryMove(battle, battleStage, 1, move, relationMode);
    setBattle(next);
    setFlash({ infected: next.infected, resisted: next.resisted });
    setFeedback(next.infected.length || next.bossHit ? next.relationText : `감염 조건 불일치. ${next.relationText}`);
    setMoveCount((value) => value + 1);
    if (!next.board.includes(2)) {
      finishBattle(battleStage);
      return;
    }
    setTurn(2);
    schedule(() => resolveAiTurn(next), battleStage.boss ? 1050 : 800);
  }, [battle, battleStage, finishBattle, relationMode, resolveAiTurn, schedule]);

  const handleCell = useCallback((index: number) => {
    if (busy || turn !== 1 || result) return;
    if (battle.board[index] === 1) {
      setSelectedCell(index);
      setFeedback(`${battle.numbers[index]} 치료 세균 선택 · 빈 칸으로 1칸 복제하거나 2칸 이동하세요.`);
      return;
    }
    if (selectedCell === null || battle.board[index] !== 0) return;
    const distance = getDistance(selectedCell, index, 7);
    if (distance !== 1 && distance !== 2) return;
    if (relationMode === "split" && distance === 1 && factorPairs(battle.numbers[selectedCell] ?? 0).length === 0) {
      setFeedback("이 수는 두 자연수의 곱으로 분열할 수 없어요. 다른 치료 세균을 골라 보세요.");
      return;
    }
    executePlayerMove({ from: selectedCell, to: index, distance });
  }, [battle.board, battle.numbers, busy, executePlayerMove, relationMode, result, selectedCell, turn]);

  const chooseMode = (mode: RelationMode) => {
    if (!battleStage.modes.includes(mode) || busy) return;
    setRelationMode(mode);
    setSelectedCell(null);
    setFeedback(`${MODE_COPY[mode].label}: ${MODE_COPY[mode].explanation}`);
  };

  const returnToMap = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    const nextStage = Math.min(11, Math.max(...completed, battleStage.id) + 1);
    setSelectedStageId(nextStage);
    setView("map");
    setResult(null);
    setBusy(false);
    setFreeBattle(false);
  };

  const handleCinematicFinish = useCallback(() => {
    if (cinematic === "opening") {
      setCinematic(null);
      beginBattle(STORY_STAGES[0]);
    } else {
      setCinematic(null);
      setResult(null);
      setView("map");
      setSelectedStageId(11);
    }
  }, [beginBattle, cinematic]);

  const remainingDisease = battle.board.filter((cell) => cell === 2).length;
  const therapyCount = battle.board.filter((cell) => cell === 1).length;
  const selectedNumber = selectedCell === null ? null : battle.numbers[selectedCell];
  const hoverNumber = hoveredCell === null ? null : battle.numbers[hoveredCell];
  const liveComparison = selectedNumber && hoverNumber && battle.board[hoveredCell ?? 0] === 2
    ? relationMode === "divisor"
      ? `${selectedNumber} ÷ ${hoverNumber}${selectedNumber % hoverNumber === 0 ? ` = ${selectedNumber / hoverNumber}` : " → 나머지 있음"}`
      : relationMode === "multiple"
        ? `${hoverNumber} ÷ ${selectedNumber}${hoverNumber % selectedNumber === 0 ? ` = ${hoverNumber / selectedNumber}` : " → 나머지 있음"}`
        : "분열 후 새 수의 배수인지 확인"
    : null;

  if (!hydrated) return <main className="story-app loading-screen"><div className="loader-germ">∴</div><p>치료 세균을 배양하는 중...</p></main>;

  return (
    <main className="story-app">
      <header className="command-header">
        <button className="brand" onClick={() => setView("map")} aria-label="세계 작전 지도로 이동">
          <span className="brand-mark">ƒ</span>
          <span><b>FACTOR FORCE</b><small>약수와 배수 지구 방어대</small></span>
        </button>
        <nav aria-label="게임 모드">
          <button className={view === "map" && !freeBattle ? "active" : ""} onClick={() => { setView("map"); setFreeBattle(false); }}>스토리 작전</button>
          <button className={freeBattle ? "active" : ""} onClick={() => beginBattle(STORY_STAGES[9], true)}>자유 대전</button>
        </nav>
        <div className="global-progress">
          <div><span>지구 해방률</span><b>{Math.round((completed.length / 11) * 100)}%</b></div>
          <i><em style={{ width: `${(completed.length / 11) * 100}%` }} /></i>
        </div>
      </header>

      {view === "map" ? (
        <div className="map-layout">
          <section className="mission-brief">
            <small className="eyebrow">GLOBAL RESPONSE // 2042</small>
            <h1>숫자 감염으로부터<br /><em>지구를 해방하라</em></h1>
            <p>약수와 배수의 관계를 활용해 치료 세균을 복제하고, 대륙마다 퍼진 질병 세균을 모두 역감염시키세요.</p>
            <div className="brief-stats">
              <div><b>{completed.length}</b><span>해방 지역</span></div>
              <div><b>{11 - completed.length}</b><span>남은 작전</span></div>
              <div><b>{completed.includes(11) ? "안정" : "위험"}</b><span>지구 상태</span></div>
            </div>
            <div className="transmission-log">
              <span className="pulse-dot" />
              <div><small>연구소 통신</small><p>{completed.length === 0 ? "서울 연구소에서 치료 세균 배양 완료. 첫 작전을 승인합니다." : completed.includes(11) ? "전 세계 감염 신호 소멸. 지구 생태계가 정상화되었습니다." : `${unlocked}번 감염 지역의 구조 요청을 수신했습니다.`}</p></div>
            </div>
          </section>

          <WorldMap selected={selectedStageId} completed={completed} onSelect={setSelectedStageId} />
          <StagePanel stage={selectedStage} complete={completed.includes(selectedStage.id)} locked={selectedStage.id > unlocked && !completed.includes(selectedStage.id)} onStart={startSelectedStage} />
        </div>
      ) : (
        <div className="battle-layout">
          <aside className="battle-brief">
            <button className="back-map" onClick={() => setView("map")}>← 세계 지도</button>
            <span className="battle-stage-number">{freeBattle ? "FREE" : battleStage.id === 11 ? "BOSS" : `STAGE ${String(battleStage.id).padStart(2, "0")}`}</span>
            <h1>{freeBattle ? "종합 모의 전투" : battleStage.title}</h1>
            <p>{battleStage.mission}</p>
            <div className="objective-card">
              <small>작전 목표</small>
              <strong>질병 세균 전멸</strong>
              <div><span>남은 질병</span><b>{remainingDisease}</b></div>
              {battleStage.boss && <div><span>보스 내성</span><b>{battle.bossHp} / {battle.bossMaxHp}</b></div>}
            </div>
            <div className="lesson-card">
              <small>{battleStage.lesson}</small>
              <strong>{battleStage.learning}</strong>
              <p>{battleStage.example}</p>
            </div>
          </aside>

          <section className="battle-center">
            <div className="battle-statusbar">
              <div className="unit-count therapy"><span>치료 세균</span><b>{therapyCount}</b></div>
              <div className={`turn-indicator ${turn === 2 ? "enemy" : ""}`}><i /> {busy ? (turn === 2 ? "질병 세균 변이 중" : "감염 판정 중") : turn === 1 ? "치료 세균 차례" : "질병 세균 차례"}</div>
              <div className="unit-count disease"><span>질병 세균</span><b>{remainingDisease}</b></div>
            </div>
            <BattleBoard battle={battle} stage={battleStage} selected={selectedCell} hovered={hoveredCell} flash={flash} disabled={busy || !!result} onCell={handleCell} onHover={setHoveredCell} />
            <div className={`feedback-console ${flash.infected.length ? "success" : flash.resisted.length ? "warning" : ""}`}>
              <span>ƒx</span><p>{liveComparison ?? feedback}</p>
            </div>
          </section>

          <aside className="control-panel">
            <small className="eyebrow">TREATMENT CONTROL</small>
            <h2>치료 방식 선택</h2>
            <p>이 스테이지의 학습 내용에 맞는 모드만 사용할 수 있습니다.</p>
            <div className="mode-buttons">
              {(Object.keys(MODE_COPY) as RelationMode[]).map((mode) => {
                const allowed = battleStage.modes.includes(mode);
                return (
                  <button key={mode} disabled={!allowed || busy} className={`${relationMode === mode ? "active" : ""} ${!allowed ? "locked" : ""}`} onClick={() => chooseMode(mode)}>
                    <span>{MODE_COPY[mode].short}</span>
                    <div><b>{MODE_COPY[mode].label}</b><small>{allowed ? MODE_COPY[mode].explanation : "이번 차시에서는 잠겨 있어요."}</small></div>
                    <i>{allowed ? relationMode === mode ? "ON" : "선택" : "잠김"}</i>
                  </button>
                );
              })}
            </div>
            <div className="how-to-move">
              <small>조작 방법</small>
              <ol>
                <li><span>1</span> 파란 치료 세균을 선택</li>
                <li><span>2</span> 빛나는 빈 칸으로 이동</li>
                <li><span>3</span> 주변 숫자 관계를 확인</li>
              </ol>
              <p><b>1칸</b> 이동하면 복제 · <b>2칸</b> 이동하면 자리 이동</p>
            </div>
            <button className="restart-button" onClick={() => beginBattle(battleStage, freeBattle)}>↻ 이 스테이지 다시 시작</button>
            <div className="move-counter"><span>작전 턴</span><b>{moveCount}</b></div>
          </aside>
        </div>
      )}

      {result && (
        <div className="result-overlay">
          <section className={`result-card ${result}`}>
            <span className="result-symbol">{result === "clear" ? "✓" : "!"}</span>
            <small>{result === "clear" ? "REGION LIBERATED" : "TREATMENT FAILED"}</small>
            <h2>{result === "clear" ? `${battleStage.place} 해방 완료` : "치료 세균이 모두 감염됐어요"}</h2>
            <p>{result === "clear" ? `${battleStage.lesson}의 핵심 개념으로 질병 세균을 모두 제거했습니다.` : "숫자 관계와 모드를 다시 확인하고 재도전하세요."}</p>
            <div>
              <button onClick={() => beginBattle(battleStage, freeBattle)}>다시 하기</button>
              <button className="primary" onClick={returnToMap}>{freeBattle ? "스토리 지도로" : battleStage.id < 11 ? "다음 작전 확인" : "세계 지도"} →</button>
            </div>
          </section>
        </div>
      )}

      {cinematic && <Cinematic kind={cinematic} onFinish={handleCinematicFinish} />}
    </main>
  );
}
