"use client";

export const dynamic = "force-static";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import FreeBattle from "./free-battle";
import "./free-battle.css";
import { factorPairs, getDistance, legalMoves, type Move, type RelationMode } from "./game";
import {
  MODE_COPY,
  STAGE_LEARNING_TASKS,
  STORY_STAGES,
  applyBossPulse,
  applyEmergencyTreatment,
  applyStoryMove,
  chooseStoryAiMove,
  createStoryBattle,
  isLearningAnswerCorrect,
  type LearningTask,
  type StoryBattle,
  type StoryStage,
} from "./story";

const STORY_SAVE_KEY = "factor-force-story-progress-v2";
const LEGACY_STORY_SAVE_KEY = "factor-force-story-progress-v1";
const STORY_STAGE_COUNT = STORY_STAGES.length;
const BOSS_STAGE_ID = STORY_STAGES[STORY_STAGE_COUNT - 1].id;

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

type View = "title" | "map" | "battle" | "free";
type BattleResult = "clear" | "failed" | null;
type CinematicKind = "opening" | "ending";
type LearningGateState = {
  taskIndex: number;
  selected: string[];
  status: "answering" | "wrong" | "correct";
};

function loadProgress() {
  if (typeof window === "undefined") return [] as number[];
  try {
    const current = window.localStorage.getItem(STORY_SAVE_KEY);
    if (current !== null) {
      const value = JSON.parse(current);
      return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id) && id >= 1 && id <= STORY_STAGE_COUNT) : [];
    }

    const legacy = JSON.parse(window.localStorage.getItem(LEGACY_STORY_SAVE_KEY) ?? "[]");
    const migrated = Array.isArray(legacy)
      ? legacy
        .filter((id): id is number => Number.isInteger(id) && id >= 2 && id <= STORY_STAGE_COUNT + 1)
        .map((id) => id - 1)
      : [];
    window.localStorage.setItem(STORY_SAVE_KEY, JSON.stringify(migrated));
    return migrated;
  } catch {
    return [];
  }
}

function stageModeLabel(modes: RelationMode[]) {
  return modes.map((mode) => MODE_COPY[mode].label.replace(" 모드", "")).join(" · ");
}

function nextAllowedMode(current: RelationMode, allowed: RelationMode[]) {
  const currentIndex = allowed.indexOf(current);
  return allowed[(currentIndex + 1) % allowed.length] ?? allowed[0] ?? current;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function Germ({
  player,
  infection = false,
  number,
  mode,
  boss = false,
}: {
  player: 1 | 2;
  infection?: boolean;
  number?: number;
  mode?: RelationMode;
  boss?: boolean;
}) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const sprite = infection ? "bacteria-infection.png" : "bacteria-idle.png";
  return (
    <span
      className={`germ-sprite p${player} ${infection ? "infection" : "idle"} ${boss ? "boss" : ""}`}
      aria-hidden="true"
      style={{ backgroundImage: `url("${basePath}/assets/${sprite}")` }}
    >
      {number !== undefined && <b className="germ-number">{number}</b>}
      {mode && <em className={`germ-mode ${mode}`}>{MODE_COPY[mode].short}</em>}
    </span>
  );
}

function TitleScreen({ onStory, onFree }: { onStory: () => void; onFree: () => void }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return (
    <main className="title-screen">
      <img className="title-hero-image" src={`${basePath}/assets/story/opening.png`} alt="숫자 질병 세균의 확산에 맞서는 치료 세균 지구 방어대" />
      <div className="title-vignette" />
      <div className="title-grid" aria-hidden="true" />
      <section className="title-content">
        <div className="title-kicker"><i /> PETRI MATH LAB // GLOBAL RESPONSE</div>
        <div className="title-logo-lockup">
          <Germ player={1} />
          <div>
            <small>약수와 배수 지구 방어대</small>
            <h1>FACTOR<br /><em>FORCE</em></h1>
            <p>수학 세균전</p>
          </div>
          <Germ player={2} />
        </div>
        <p className="title-tagline">숫자의 관계를 찾아 감염을 뒤집고 지구를 구하라.</p>
        <div className="title-actions">
          <button className="story-launch" onClick={onStory}>
            <span><small>CAMPAIGN</small><b>스토리 모드</b><em>세계 감염 지역을 차례로 해방하세요</em></span><i>→</i>
          </button>
          <button className="free-launch" onClick={onFree}>
            <span><small>CLASSIC BATTLE</small><b>자유 대전</b><em>원본 수학 세균전 규칙으로 대전하세요</em></span><i>→</i>
          </button>
        </div>
        <footer><span>FACTOR FORCE</span><i /> <span>VERSION 07.26</span></footer>
      </section>
    </main>
  );
}

function Cinematic({ kind, onFinish }: { kind: CinematicKind; onFinish: () => void }) {
  const [captionIndex, setCaptionIndex] = useState(0);
  const captions = kind === "opening" ? OPENING_CAPTIONS : ENDING_CAPTIONS;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const sceneImages = kind === "opening"
    ? ["opening.png", "opening-02.png", "opening-03.png", "opening-04.png"]
    : ["ending.png"];
  const sceneImage = sceneImages[Math.min(captionIndex, sceneImages.length - 1)];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (captionIndex < captions.length - 1) setCaptionIndex((value) => value + 1);
      else onFinish();
    }, captionIndex === 0 ? 3200 : 2800);
    return () => window.clearTimeout(timer);
  }, [captionIndex, captions.length, onFinish]);

  return (
    <div className="cinematic" role="dialog" aria-modal="true" aria-label={kind === "opening" ? "오프닝" : "엔딩"}>
      <img key={`${kind}-${captionIndex}`} src={`${basePath}/assets/story/${sceneImage}`} alt="" />
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
  const unlocked = Math.min(STORY_STAGE_COUNT, Math.max(1, completed.length ? Math.max(...completed) + 1 : 1));
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
            <em>{stage.id === BOSS_STAGE_ID ? "BOSS" : stage.place.split(" · ")[1]}</em>
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
        <span className="stage-number">{stage.id === BOSS_STAGE_ID ? "BOSS" : `0${stage.id}`.slice(-2)}</span>
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

function LearningGate({
  stage,
  task,
  state,
  total,
  onToggle,
  onSubmit,
  onAdvance,
}: {
  stage: StoryStage;
  task: LearningTask;
  state: LearningGateState;
  total: number;
  onToggle: (option: string) => void;
  onSubmit: () => void;
  onAdvance: () => void;
}) {
  const isBoss = !!stage.boss;
  return (
    <div className="learning-gate" role="dialog" aria-modal="true" aria-labelledby="learning-gate-title">
      <section className={`learning-gate-card ${isBoss ? "boss" : ""}`}>
        <div className="learning-gate-head">
          <span className="learning-core-icon"><i /><i /><i /></span>
          <div>
            <small>{isBoss ? "BOSS RESISTANCE ANALYSIS" : "TREATMENT CORE UNLOCK"}</small>
            <h2 id="learning-gate-title">{isBoss ? "보스의 학습 내성을 해제하세요" : "지역 해방 마지막 관문"}</h2>
          </div>
          <b>{state.taskIndex + 1}/{total}</b>
        </div>

        <div className="learning-gate-progress" aria-label={`학습 관문 ${state.taskIndex + 1}/${total}`}>
          {Array.from({ length: total }, (_, index) => <i key={index} className={index <= state.taskIndex ? "active" : ""} />)}
        </div>

        <div className="learning-gate-copy">
          <span>{task.context}</span>
          <h3>{task.prompt}</h3>
          {task.multiple && <p>정답을 모두 선택한 뒤 치료 신호를 전송하세요.</p>}
        </div>

        <div className={`learning-options ${task.multiple ? "multiple" : ""}`}>
          {task.options.map((option) => {
            const selected = state.selected.includes(option);
            return (
              <button
                type="button"
                key={option}
                className={selected ? "selected" : ""}
                aria-pressed={selected}
                disabled={state.status === "correct"}
                onClick={() => onToggle(option)}
              >
                <i>{selected ? "✓" : task.multiple ? "+" : "·"}</i>
                <span>{option}</span>
              </button>
            );
          })}
        </div>

        {state.status === "wrong" && <div className="learning-feedback wrong"><b>방어막 유지</b><span>선택을 다시 살펴보세요. 나눗셈이나 곱셈 관계를 확인하면 됩니다.</span></div>}
        {state.status === "correct" && <div className="learning-feedback correct"><b>코어 해제 성공</b><span>{task.explanation}</span></div>}

        <div className="learning-gate-actions">
          {state.status === "correct" ? (
            <button className="primary" type="button" onClick={onAdvance}>
              {state.taskIndex + 1 === total ? isBoss ? "최종 치료 파장 발사" : "지역 해방 완료" : "다음 코어 분석"} →
            </button>
          ) : (
            <button className="primary" type="button" disabled={!state.selected.length} onClick={onSubmit}>치료 신호 전송</button>
          )}
        </div>
      </section>
    </div>
  );
}

function BattleBoard({
  battle,
  selected,
  hovered,
  flash,
  shot,
  relationMode,
  disabled,
  onCell,
  onHover,
}: {
  battle: StoryBattle;
  selected: number | null;
  hovered: number | null;
  flash: { infected: number[]; resisted: number[] };
  shot: { from: number; targets: number[]; player: 1 | 2 } | null;
  relationMode: RelationMode;
  disabled: boolean;
  onCell: (index: number) => void;
  onHover: (index: number | null) => void;
}) {
  const targets = useMemo(() => new Set(
    selected === null ? [] : legalMoves(battle.board, 1).filter((move) => move.from === selected).map((move) => move.to),
  ), [battle.board, selected]);

  return (
    <div className="petri-board-grid" role="grid" aria-label="7 × 7 세균전 게임판">
      {battle.board.map((cell, index) => {
        const number = battle.numbers[index];
        const isBoss = battle.bossIndex === index && battle.bossHp > 0;
        const isInfected = flash.infected.includes(index);
        const isResisted = flash.resisted.includes(index);
        const target = targets.has(index);
        return (
          <button
            key={index}
            role="gridcell"
            className={`petri-cell ${cell ? `occupied p${cell}` : "empty"} ${selected === index ? "selected" : ""} ${target ? `legal ${getDistance(selected ?? index, index, 7) === 1 ? "clone" : "jump"}` : ""} ${isInfected ? "hit" : ""} ${isResisted ? "resisted" : ""} ${isBoss ? "boss-cell" : ""}`}
            onClick={() => onCell(index)}
            onMouseEnter={() => onHover(index)}
            onMouseLeave={() => onHover(null)}
            disabled={disabled}
            aria-label={cell === 0 ? `빈 칸 ${index + 1}` : `${cell === 1 ? "치료" : "질병"} 세균 ${number}${isBoss ? `, 보스 내성 ${battle.bossHp}` : ""}`}
          >
            <span className="cell-gridmark" />
            {cell !== 0 && number !== null && (
              <Germ
                player={cell}
                infection={isInfected}
                number={number}
                mode={selected === index ? relationMode : undefined}
                boss={isBoss}
              />
            )}
            {target && <span className="move-hint"><i />{getDistance(selected ?? index, index, 7) === 1 ? "+" : "↗"}</span>}
            {hovered === index && cell === 2 && <span className="preview-ring" />}
            {isResisted && <span className="resist-mark">관계 없음</span>}
            {isBoss && <span className="boss-hp-mini">{battle.bossHp}</span>}
          </button>
        );
      })}
      {shot && shot.targets.length > 0 && (
        <div className="infection-projectile-layer" aria-hidden="true">
          {shot.targets.map((target, id) => {
            const fromRow = Math.floor(shot.from / 7);
            const fromCol = shot.from % 7;
            const toRow = Math.floor(target / 7);
            const toCol = target % 7;
            return (
              <span
                key={`${shot.from}-${target}-${id}`}
                className={`infection-projectile p${shot.player}`}
                style={{
                  "--sx": `${((fromCol + .5) / 7) * 100}%`,
                  "--sy": `${((fromRow + .5) / 7) * 100}%`,
                  "--ex": `${((toCol + .5) / 7) * 100}%`,
                  "--ey": `${((toRow + .5) / 7) * 100}%`,
                  "--delay": `${id * 45}ms`,
                } as CSSProperties}
              ><i /></span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [hydrated, setHydrated] = useState(false);
  const [completed, setCompleted] = useState<number[]>([]);
  const [selectedStageId, setSelectedStageId] = useState(1);
  const [view, setView] = useState<View>("title");
  const [battleStageId, setBattleStageId] = useState(1);
  const [battle, setBattle] = useState<StoryBattle>(() => createStoryBattle(STORY_STAGES[0]));
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [hoveredCell, setHoveredCell] = useState<number | null>(null);
  const [relationMode, setRelationMode] = useState<RelationMode>("divisor");
  const [turn, setTurn] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("치료 세균을 선택한 뒤 빛나는 칸으로 이동하세요.");
  const [flash, setFlash] = useState<{ infected: number[]; resisted: number[] }>({ infected: [], resisted: [] });
  const [infectionShot, setInfectionShot] = useState<{ from: number; targets: number[]; player: 1 | 2 } | null>(null);
  const [moveCount, setMoveCount] = useState(0);
  const [battleElapsed, setBattleElapsed] = useState(0);
  const [result, setResult] = useState<BattleResult>(null);
  const [cinematic, setCinematic] = useState<CinematicKind | null>(null);
  const [freeBattle, setFreeBattle] = useState(false);
  const [learningGate, setLearningGate] = useState<LearningGateState | null>(null);
  const timers = useRef<number[]>([]);

  const selectedStage = STORY_STAGES[selectedStageId - 1];
  const battleStage = STORY_STAGES[battleStageId - 1];
  const unlocked = Math.min(STORY_STAGE_COUNT, Math.max(1, completed.length ? Math.max(...completed) + 1 : 1));

  useEffect(() => {
    const progress = loadProgress();
    setCompleted(progress);
    setSelectedStageId(Math.min(STORY_STAGE_COUNT, Math.max(1, progress.length ? Math.max(...progress) + 1 : 1)));
    setHydrated(true);
    return () => timers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (view !== "battle" || result) return;
    const timer = window.setInterval(() => setBattleElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [result, view]);

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
    setBattleElapsed(0);
    setResult(null);
    setLearningGate(null);
    setFlash({ infected: [], resisted: [] });
    setInfectionShot(null);
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
    setLearningGate(null);
    persistCompletion(stage.id);
    setBusy(false);
    setTurn(1);
    if (stage.id === BOSS_STAGE_ID && !freeBattle) {
      schedule(() => setCinematic("ending"), 850);
    } else {
      setResult("clear");
    }
  }, [freeBattle, persistCompletion, schedule]);

  const requestCompletion = useCallback((stage: StoryStage) => {
    const tasks = STAGE_LEARNING_TASKS[stage.id] ?? [];
    if (freeBattle || !tasks.length) {
      finishBattle(stage);
      return;
    }
    setBusy(false);
    setTurn(1);
    setSelectedCell(null);
    setInfectionShot(null);
    setFeedback("질병 세균 제거 완료 · 치료 코어의 학습 방어막을 해제하세요.");
    setLearningGate({ taskIndex: 0, selected: [], status: "answering" });
  }, [finishBattle, freeBattle]);

  const resolveAiTurn = useCallback((afterPlayer: StoryBattle) => {
    let working = afterPlayer;
    if (battleStage.boss) {
      const pulse = applyBossPulse(working, battleStage);
      working = pulse;
      setBattle(working);
      if (pulse.relationText) setFeedback(pulse.relationText);
      setFlash({ infected: pulse.infected, resisted: [] });
      setInfectionShot(pulse.infected.length ? { from: working.bossIndex ?? 24, targets: pulse.infected, player: 2 } : null);
      if (!working.board.includes(1)) {
        setResult("failed");
        setBusy(false);
        return;
      }
    }

    const action = chooseStoryAiMove(working, battleStage);
    if (!action) {
      const recovery = applyEmergencyTreatment(working, battleStage);
      if (recovery) {
        setBattle(recovery.battle);
        setFlash({ infected: [recovery.openedIndex], resisted: [] });
        setInfectionShot({ from: recovery.sourceIndex, targets: [recovery.openedIndex], player: 1 });
        setFeedback(recovery.relationText);
        if (!recovery.battle.board.includes(2)) {
          schedule(() => requestCompletion(battleStage), 780);
          return;
        }
        schedule(() => {
          setFlash({ infected: [], resisted: [] });
          setInfectionShot(null);
          setTurn(1);
          setBusy(false);
        }, 700);
        return;
      }
      setTurn(1);
      setBusy(false);
      setInfectionShot(null);
      setFeedback("질병 세균이 이동할 수 없어요. 치료 작전을 계속하세요.");
      return;
    }
    const enemyResult = applyStoryMove(working, battleStage, 2, action.move, action.mode);
    setBattle(enemyResult);
    setFlash({ infected: enemyResult.infected, resisted: enemyResult.resisted });
    setInfectionShot(enemyResult.infected.length ? { from: action.move.to, targets: enemyResult.infected, player: 2 } : null);
    setFeedback(enemyResult.infected.length
      ? `역감염 발생! ${enemyResult.relationText}`
      : `질병 세균의 공격을 막았어요. ${enemyResult.relationText}`);
    setMoveCount((value) => value + 1);
    if (!enemyResult.board.includes(1)) {
      setResult("failed");
      setBusy(false);
      return;
    }
    const recovery = applyEmergencyTreatment(enemyResult, battleStage);
    if (recovery) {
      setBattle(recovery.battle);
      setFlash({ infected: [recovery.openedIndex], resisted: [] });
      setInfectionShot({ from: recovery.sourceIndex, targets: [recovery.openedIndex], player: 1 });
      setFeedback(recovery.relationText);
      if (!recovery.battle.board.includes(2)) {
          schedule(() => requestCompletion(battleStage), 780);
        return;
      }
      schedule(() => {
        setFlash({ infected: [], resisted: [] });
        setInfectionShot(null);
        setTurn(1);
        setBusy(false);
      }, 700);
      return;
    }
    schedule(() => {
      setFlash({ infected: [], resisted: [] });
      setInfectionShot(null);
      setTurn(1);
      setBusy(false);
    }, 650);
  }, [battleStage, requestCompletion, schedule]);

  const executePlayerMove = useCallback((move: Move) => {
    setBusy(true);
    setSelectedCell(null);
    const next = applyStoryMove(battle, battleStage, 1, move, relationMode);
    setBattle(next);
    setFlash({ infected: next.infected, resisted: next.resisted });
    const playerTargets = next.bossHit && next.bossIndex !== null && !next.infected.includes(next.bossIndex)
      ? [...next.infected, next.bossIndex]
      : next.infected;
    setInfectionShot(playerTargets.length ? { from: move.to, targets: playerTargets, player: 1 } : null);
    setFeedback(next.infected.length || next.bossHit ? next.relationText : `감염 조건 불일치. ${next.relationText}`);
    setMoveCount((value) => value + 1);
    if (!next.board.includes(2)) {
      schedule(() => requestCompletion(battleStage), 780);
      return;
    }
    setTurn(2);
    schedule(() => resolveAiTurn(next), battleStage.boss ? 1050 : 800);
  }, [battle, battleStage, relationMode, requestCompletion, resolveAiTurn, schedule]);

  const learningTasks = STAGE_LEARNING_TASKS[battleStage.id] ?? [];
  const activeLearningTask = learningGate ? learningTasks[learningGate.taskIndex] : null;

  const toggleLearningOption = useCallback((option: string) => {
    setLearningGate((current) => {
      if (!current || current.status === "correct") return current;
      const task = (STAGE_LEARNING_TASKS[battleStage.id] ?? [])[current.taskIndex];
      if (!task) return current;
      const selected = task.multiple
        ? current.selected.includes(option)
          ? current.selected.filter((item) => item !== option)
          : [...current.selected, option]
        : [option];
      return { ...current, selected, status: "answering" };
    });
  }, [battleStage.id]);

  const submitLearningAnswer = useCallback(() => {
    setLearningGate((current) => {
      if (!current) return current;
      const task = (STAGE_LEARNING_TASKS[battleStage.id] ?? [])[current.taskIndex];
      if (!task) return current;
      return { ...current, status: isLearningAnswerCorrect(task, current.selected) ? "correct" : "wrong" };
    });
  }, [battleStage.id]);

  const advanceLearningGate = useCallback(() => {
    if (!learningGate) return;
    if (learningGate.taskIndex + 1 < learningTasks.length) {
      setLearningGate({ taskIndex: learningGate.taskIndex + 1, selected: [], status: "answering" });
      return;
    }
    setLearningGate(null);
    finishBattle(battleStage);
  }, [battleStage, finishBattle, learningGate, learningTasks.length]);

  const handleCell = useCallback((index: number) => {
    if (busy || turn !== 1 || result) return;
    if (battle.board[index] === 1) {
      if (selectedCell === index) {
        const nextMode = nextAllowedMode(relationMode, battleStage.modes);
        setRelationMode(nextMode);
        setFeedback(battleStage.modes.length === 1
          ? `이번 작전은 ${MODE_COPY[nextMode].label}만 사용할 수 있어요.`
          : `${battle.numbers[index]} 치료 세균을 ${MODE_COPY[nextMode].label}(으)로 바꿨어요. 다시 누르면 다음 모드로 전환됩니다.`);
        return;
      }
      setSelectedCell(index);
      setFeedback(`${battle.numbers[index]} 치료 세균 선택 · 같은 세균을 다시 누르면 ${stageModeLabel(battleStage.modes)} 모드가 순서대로 바뀝니다.`);
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
  }, [battle.board, battle.numbers, battleStage.modes, busy, executePlayerMove, relationMode, result, selectedCell, turn]);

  const returnToMap = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    const nextStage = Math.min(STORY_STAGE_COUNT, Math.max(...completed, battleStage.id) + 1);
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
      setSelectedStageId(BOSS_STAGE_ID);
    }
  }, [beginBattle, cinematic]);

  const remainingDisease = battle.board.filter((cell) => cell === 2).length;
  const therapyCount = battle.board.filter((cell) => cell === 1).length;
  const occupiedPercent = Math.round(((remainingDisease + therapyCount) / battle.board.length) * 100);
  const therapyCaptures = Math.max(0, battleStage.enemyNumbers.length - remainingDisease);
  const diseaseCaptures = Math.max(0, battleStage.playerNumbers.length - therapyCount);
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

  if (view === "title") {
    return <TitleScreen onStory={() => setView("map")} onFree={() => setView("free")} />;
  }

  if (view === "free") {
    return <FreeBattle onExit={() => setView("title")} />;
  }

  return (
    <main className="story-app">
      {view === "map" && <header className="command-header">
        <button className="brand" onClick={() => setView("title")} aria-label="게임 시작 화면으로 이동">
          <span className="brand-mark">ƒ</span>
          <span><b>FACTOR FORCE</b><small>약수와 배수 지구 방어대</small></span>
        </button>
        <nav aria-label="게임 모드">
          <button className={view === "map" && !freeBattle ? "active" : ""} onClick={() => { setView("map"); setFreeBattle(false); }}>스토리 작전</button>
          <button onClick={() => setView("free")}>자유 대전</button>
        </nav>
        <div className="global-progress">
          <div><span>지구 해방률</span><b>{Math.round((completed.length / STORY_STAGE_COUNT) * 100)}%</b></div>
          <i><em style={{ width: `${(completed.length / STORY_STAGE_COUNT) * 100}%` }} /></i>
        </div>
      </header>}

      {view === "map" ? (
        <div className="map-layout">
          <section className="mission-brief">
            <small className="eyebrow">GLOBAL RESPONSE // 2042</small>
            <h1>숫자 감염으로부터<br /><em>지구를 해방하라</em></h1>
            <p>약수와 배수의 관계를 활용해 치료 세균을 복제하고, 대륙마다 퍼진 질병 세균을 모두 역감염시키세요.</p>
            <div className="brief-stats">
              <div><b>{completed.length}</b><span>해방 지역</span></div>
              <div><b>{STORY_STAGE_COUNT - completed.length}</b><span>남은 작전</span></div>
              <div><b>{completed.includes(BOSS_STAGE_ID) ? "안정" : "위험"}</b><span>지구 상태</span></div>
            </div>
            <div className="transmission-log">
              <span className="pulse-dot" />
              <div><small>연구소 통신</small><p>{completed.length === 0 ? "치료 세균 배양 완료. 마닐라의 첫 작전을 승인합니다." : completed.includes(BOSS_STAGE_ID) ? "전 세계 감염 신호 소멸. 지구 생태계가 정상화되었습니다." : `${unlocked}번 감염 지역의 구조 요청을 수신했습니다.`}</p></div>
            </div>
          </section>

          <WorldMap selected={selectedStageId} completed={completed} onSelect={setSelectedStageId} />
          <StagePanel stage={selectedStage} complete={completed.includes(selectedStage.id)} locked={selectedStage.id > unlocked && !completed.includes(selectedStage.id)} onStart={startSelectedStage} />
        </div>
      ) : (
        <div className="petri-battle-screen">
          <header className="petri-topbar">
            <button className="petri-brand" onClick={returnToMap} aria-label="세계 작전 지도로 돌아가기">
              <span className="petri-brand-mark"><i /><i /><i /></span>
              <span><strong>페트리</strong><small>// 07</small></span>
            </button>
            <div className="petri-topbar-center"><span className="petri-live-dot" /><span>게임 시간</span><b>{formatTime(battleElapsed)}</b></div>
            <nav className="petri-top-actions" aria-label="전투 메뉴">
              <button aria-label="소리">◖))</button>
              <button aria-label="학습 목표" title={battleStage.learning}>?</button>
              <button className="petri-stage-button" onClick={returnToMap}><span>{freeBattle ? "자유 대전" : `${battleStage.lesson} · 7×7`}</span><b>지도</b></button>
            </nav>
          </header>

          <section className="petri-status-rail" aria-live="polite">
            <div className={`petri-turn-beacon p${turn}`}><span>{busy ? "진행" : turn === 1 ? "청록" : "코랄"}</span></div>
            <div className="petri-status-copy">
              <small>턴 {String(moveCount + 1).padStart(2, "0")} · {turn === 1 ? "치료 세균" : "컴퓨터"} · {battleStage.title}</small>
              <strong>{liveComparison ?? feedback}</strong>
            </div>
            <div className="petri-coverage"><span>채운 칸</span><b>{occupiedPercent}%</b><i><em style={{ width: `${occupiedPercent}%` }} /></i></div>
          </section>

          <section className="petri-game-layout">
            <aside className={`petri-player-panel cyan ${turn === 1 && !result ? "active" : ""}`}>
              <div className="petri-player-topline"><span>청록 팀</span><i>● 준비됨</i></div>
              <div className="petri-portrait"><Germ player={1} /><span className="petri-scanline" /></div>
              <div className="petri-identity"><small>내 치료 세균</small><h2>플레이어 1</h2></div>
              <div className="petri-score-block"><small>세균 수</small><strong>{String(therapyCount).padStart(2, "0")}</strong></div>
              <div className="petri-player-metrics">
                <span><small>감염</small><b>+{therapyCaptures}</b></span>
                <span><small>이동 가능</small><b>{legalMoves(battle.board, 1).length}</b></span>
                <span><small>사용 모드</small><b>×{battleStage.modes.length}</b></span>
              </div>
            </aside>

            <section className="petri-board-stage">
              <div className="petri-frame">
                <div className="petri-frame-label"><span>게임판</span><b>07 × 07</b></div>
                <div className="petri-board-wrap">
                  <BattleBoard
                    battle={battle}
                    selected={selectedCell}
                    hovered={hoveredCell}
                    flash={flash}
                    shot={infectionShot}
                    relationMode={relationMode}
                    disabled={busy || !!result}
                    onCell={handleCell}
                    onHover={setHoveredCell}
                  />
                </div>
              </div>
              <div className="petri-board-controls">
                <button onClick={returnToMap}><span>↶</span> 작전 지도</button>
                <div className="petri-mode-controls" aria-label="치료 모드">
                  {selectedCell !== null ? (
                    <button
                      className={`petri-relation-toggle active ${relationMode}`}
                      disabled={busy}
                      onClick={() => handleCell(selectedCell)}
                      title="선택한 세균을 다시 눌러 다음 모드로 바꿉니다."
                    >
                      <i>{MODE_COPY[relationMode].short}</i>
                      <span><b>{MODE_COPY[relationMode].label}</b><small>{battleStage.modes.length > 1 ? "다시 눌러 모드 변경" : "이번 작전 전용"}</small></span>
                    </button>
                  ) : (
                    <div className="petri-mode-prompt"><i>약</i><span><b>세균을 선택하세요</b><small>같은 세균을 다시 눌러 모드 변경</small></span></div>
                  )}
                </div>
                <button onClick={() => beginBattle(battleStage, freeBattle)}><span>↻</span> 새 게임</button>
              </div>
            </section>

            <aside className={`petri-player-panel coral ${turn === 2 && !result ? "active" : ""}`}>
              <div className="petri-player-topline"><span>코랄 팀</span><i>● 컴퓨터</i></div>
              <div className="petri-portrait"><Germ player={2} /><span className="petri-scanline" /></div>
              <div className="petri-identity"><small>{battleStage.boss ? "원천균 지휘망" : "컴퓨터 세균"}</small><h2>{battleStage.boss ? "보스 세균" : "컴퓨터"}</h2></div>
              <div className="petri-score-block"><small>세균 수</small><strong>{String(remainingDisease).padStart(2, "0")}</strong></div>
              <div className="petri-player-metrics">
                <span><small>역감염</small><b>+{diseaseCaptures}</b></span>
                <span><small>난이도</small><b>{battleStage.difficulty === 1 ? "쉬움" : battleStage.difficulty === 2 ? "보통" : "어려움"}</b></span>
                <span><small>{battleStage.boss ? "내성" : "모드"}</small><b>{battleStage.boss ? `×${battle.bossHp}` : `×${battleStage.modes.length}`}</b></span>
              </div>
            </aside>
          </section>

          <section className="petri-learning-dock">
            <div><span><i /> {battleStage.lesson}</span><b>{MODE_COPY[relationMode].label}</b></div>
            <p>{battleStage.example}</p>
            <div className="petri-mission-progress"><span>{remainingDisease === 0 ? `학습 코어 ${learningTasks.length}개` : "남은 질병 세균"}</span><i><em style={{ width: `${Math.max(0, Math.min(100, (therapyCaptures / Math.max(1, battleStage.enemyNumbers.length)) * 100))}%` }} /></i><b>{remainingDisease === 0 ? "대기" : remainingDisease}</b></div>
          </section>
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
              <button className="primary" onClick={returnToMap}>{freeBattle ? "스토리 지도로" : battleStage.id < BOSS_STAGE_ID ? "다음 작전 확인" : "세계 지도"} →</button>
            </div>
          </section>
        </div>
      )}

      {learningGate && activeLearningTask && (
        <LearningGate
          stage={battleStage}
          task={activeLearningTask}
          state={learningGate}
          total={learningTasks.length}
          onToggle={toggleLearningOption}
          onSubmit={submitLearningAnswer}
          onAdvance={advanceLearningGate}
        />
      )}

      {cinematic && <Cinematic kind={cinematic} onFinish={handleCinematicFinish} />}
    </main>
  );
}
