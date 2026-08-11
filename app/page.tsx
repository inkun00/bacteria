"use client";

/* eslint-disable @next/next/no-img-element -- Cinematic assets are pre-optimized WebP files and must swap instantly without a runtime image service. */

export const dynamic = "force-static";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import FreeBattle from "./free-battle";
import "./free-battle.css";
import { assetUrl } from "./assets";
import { GameExitPrompt, usePreventGameUnload } from "./game-navigation";
import { factorPairs, getDistance, legalMoves, type Move, type RelationMode } from "./game";
import { HALL_TIERS, getHallTier, hallTierRange, normalizeHallAttempts, type HallOfFameRecord } from "./hall-of-fame";
import {
  MODE_COPY,
  STAGE_LEARNING_TASKS,
  STORY_STAGES,
  applyBossTurn,
  applyEmergencyTreatment,
  applyStoryMove,
  chooseStoryAiMove,
  createStoryBattle,
  getStoryBattleOutcome,
  isLearningAnswerCorrect,
  type LearningTask,
  type StoryBattle,
  type StoryStage,
} from "./story";

const STORY_SAVE_KEY = "factor-force-story-progress-v2";
const LEGACY_STORY_SAVE_KEY = "factor-force-story-progress-v1";
const STORY_ATTEMPTS_KEY = "factor-force-story-attempts-v1";
const STORY_BATTLE_SAVE_KEY = "factor-force-active-battle-v1";
const STORY_STAGE_COUNT = STORY_STAGES.length;
const BOSS_STAGE_ID = STORY_STAGES[STORY_STAGE_COUNT - 1].id;
const MUSIC_TRACKS = {
  menu: "/assets/audio/space-battle.ogg",
  mission: "/assets/audio/mission-pulse.ogg",
  opening: "/assets/audio/opening-suspense.ogg",
  ending: "/assets/audio/ending-revelation.ogg",
} as const;
const OPENING_LOOP_END_SECONDS = 24.2;
const RESULT_SOUNDS = {
  clear: "/assets/audio/stage-clear.ogg",
  failed: "/assets/audio/stage-failed.ogg",
  bossClear: "/assets/audio/boss-clear.ogg",
  bossDefeat: "/assets/audio/boss-defeat.ogg",
} as const;
const INFECTION_TRAVEL_MS = 560;
const INFECTION_STAGGER_MS = 45;
const INFECTION_IMPACT_MS = 720;

function infectionSequenceDuration(targetCount: number) {
  if (targetCount <= 0) return 0;
  return INFECTION_TRAVEL_MS + (targetCount - 1) * INFECTION_STAGGER_MS + INFECTION_IMPACT_MS;
}

function stageBattleBeforeImpact(previous: StoryBattle, next: StoryBattle, targets: number[]) {
  if (!targets.length) return next;
  const staged: StoryBattle = {
    ...next,
    board: [...next.board],
    numbers: [...next.numbers],
  };
  targets.forEach((index) => {
    staged.board[index] = previous.board[index];
    staged.numbers[index] = previous.numbers[index];
  });
  if (next.bossIndex !== null && targets.includes(next.bossIndex)) {
    staged.bossHp = previous.bossHp;
    staged.bossPhase = previous.bossPhase;
  }
  return staged;
}

const OPENING_CAPTIONS = [
  "2042년, 숫자를 바꾸며 빠르게 늘어나는 질병 세균이 지구 곳곳에 나타났다.",
  "숫자가 새겨진 질병 세균은 도시의 교통 시설과 전기 시설을 따라 퍼졌고, 사람들의 일상은 하나씩 멈춰 갔다.",
  "세균들은 아무렇게나 움직이지 않았다. 약수와 배수 관계를 따라 이어지며 커다란 감염 길을 만들고 있었다.",
  "연구원들은 감염된 숫자의 규칙을 살핀 끝에, 올바른 약수와 배수 관계를 찾으면 세균을 치료할 수 있다는 사실을 알아냈다.",
  "수학 연구소는 그 원리를 이용해 질병 세균을 치료 세균으로 바꾸는 ‘치료 세균’을 만들었다.",
  "첫 실험은 성공했다. 치료 세균은 정확한 숫자 관계를 찾아 붉은 질병 세균을 안전한 치료 세균으로 바꾸었다.",
  "세계 방어대는 치료 세균을 각 대륙으로 보냈다. 이제 감염된 지역을 하나씩 구할 시간이었다.",
  "그러나 모든 감염의 시작에는 태평양 무인도의 우두머리 세균이 있었다. 세계를 구할 마지막 작전이 시작된다.",
];

const ENDING_CAPTIONS = [
  "태평양 무인도에서 마지막 치료 빛이 보스를 향했지만, 그 힘만으로는 아직 부족했습니다.",
  "그때 세계 곳곳의 연구소와 학교, 병원과 가정에서 사람들이 동시에 숫자의 규칙을 풀기 시작했습니다.",
  "서로 다른 언어와 시간 속에서도 모두가 답을 나누며 치료 에너지를 지구 한 바퀴로 이어 보냈습니다.",
  "수많은 사람의 지혜와 용기가 하나의 푸른 빛이 되어 무인도에 모였습니다.",
  "마침내 보스 세균의 붉은 장벽이 무너지고, 거대한 몸은 해로운 힘을 잃은 빛으로 흩어졌습니다.",
  "보스가 사라지자 전 세계의 질병 세균도 차례로 치료 세균으로 되돌아왔습니다.",
  "사람들은 함께 도시와 학교, 숲과 바다를 다시 돌보며 평화로운 일상을 되찾았습니다.",
  "전 세계가 힘을 합쳐 지켜 낸 지구. 약수와 배수로 이어진 우리의 연대는 새로운 평화를 밝혔습니다.",
];

type View = "title" | "map" | "battle" | "free" | "hall";
type BattleResult = "clear" | "failed" | null;
type CinematicKind = "opening" | "ending";
type LearningGateState = {
  taskIndex: number;
  selected: string[];
  status: "answering" | "wrong" | "correct";
};
type SavedStoryBattle = {
  version: 1;
  battleStageId: number;
  battle: StoryBattle;
  selectedCell: number | null;
  relationMode: RelationMode;
  turn: 1 | 2;
  feedback: string;
  moveCount: number;
  battleElapsed: number;
  freeBattle: boolean;
  learningGate: LearningGateState | null;
};
type HallOfFameStatus = "idle" | "submitting" | "success" | "error";

function loadActiveStoryBattle() {
  try {
    const raw = window.localStorage.getItem(STORY_BATTLE_SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<SavedStoryBattle>;
    const validMode = saved.relationMode === "divisor" || saved.relationMode === "multiple" || saved.relationMode === "split";
    const valid = saved.version === 1
      && Number.isInteger(saved.battleStageId)
      && (saved.battleStageId ?? 0) >= 1
      && (saved.battleStageId ?? 0) <= STORY_STAGE_COUNT
      && Array.isArray(saved.battle?.board)
      && saved.battle.board.length === 49
      && Array.isArray(saved.battle?.numbers)
      && saved.battle.numbers.length === 49
      && validMode;
    if (valid) return saved as SavedStoryBattle;
  } catch {
    // Invalid or outdated saves are discarded below.
  }
  window.localStorage.removeItem(STORY_BATTLE_SAVE_KEY);
  return null;
}

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

function AudioToggle({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return (
    <button
      className={`audio-toggle ${enabled ? "on" : "off"}`}
      type="button"
      aria-pressed={enabled}
      aria-label={enabled ? "배경음악과 효과음 끄기" : "배경음악과 효과음 켜기"}
      onClick={onToggle}
    >
      <span aria-hidden="true">{enabled ? "♪" : "×"}</span>
      <b>{enabled ? "소리 켜짐" : "소리 꺼짐"}</b>
    </button>
  );
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
  const storyDisease = player === 2 && !infection;
  const sprite = boss ? "boss-germ-sprite.webp" : infection ? "bacteria-infection.webp" : storyDisease ? "story-disease-germ-idle.webp" : "bacteria-idle.webp";
  return (
    <span
      className={`germ-sprite p${player} ${infection ? "infection" : "idle"} ${storyDisease ? "story-disease" : ""} ${boss ? "boss" : ""}`}
      aria-hidden="true"
      style={{ backgroundImage: `url("${assetUrl(`/assets/${sprite}`)}")` }}
    >
      {number !== undefined && <b className="germ-number">{number}</b>}
      {mode && <em className={`germ-mode ${mode}`}>{MODE_COPY[mode].short}</em>}
    </span>
  );
}

function TitleScreen({ onStory, onFree, onHallOfFame }: { onStory: () => void; onFree: () => void; onHallOfFame: () => void }) {
  return (
    <main className="title-screen">
      <img
        className="title-hero-image"
        src={assetUrl("/assets/story/opening.webp")}
        alt="숫자 질병 세균의 확산에 맞서는 치료 세균 지구 방어대"
        loading="eager"
        fetchPriority="high"
        decoding="async"
      />
      <div className="title-vignette" />
      <div className="title-grid" aria-hidden="true" />
      <section className="title-content">
        <div className="title-kicker"><i /> 페트리 수학 연구소 // 지구 구출 작전</div>
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
            <span><small>이야기 작전</small><b>스토리 모드</b><em>감염된 세계 여러 지역을 차례로 구하세요</em></span><i>→</i>
          </button>
          <button className="free-launch" onClick={onFree}>
            <span><small>자유롭게 겨루기</small><b>자유 대전</b><em>처음 수학 세균전 규칙으로 겨루세요</em></span><i>→</i>
          </button>
          <button className="hall-launch" onClick={onHallOfFame}>
            <span><small>WORLD DEFENSE HONORS</small><b>명예의 전당</b><em>Padlet에 기록된 세계 방어대 상위 50인을 확인하세요</em></span><i>★</i>
          </button>
        </div>
        <footer><span>FACTOR FORCE</span><i /> <span>버전 07.26</span></footer>
      </section>
    </main>
  );
}

function Cinematic({ kind, onFinish }: { kind: CinematicKind; onFinish: () => void }) {
  const [captionIndex, setCaptionIndex] = useState(0);
  const captions = kind === "opening" ? OPENING_CAPTIONS : ENDING_CAPTIONS;
  const sceneImages = kind === "opening"
    ? [
      "opening-01.webp",
      "opening-bridge-01.webp",
      "opening-02.webp",
      "opening-bridge-02.webp",
      "opening-03.webp",
      "opening-bridge-03.webp",
      "opening-04-human-lab.webp",
      "opening-bridge-04.webp",
    ]
    : [
      "ending-01.webp",
      "ending-02.webp",
      "ending-03.webp",
      "ending-04.webp",
      "ending-05.webp",
      "ending-06.webp",
      "ending-07.webp",
      "ending-08.webp",
    ];
  const sceneImage = sceneImages[Math.min(captionIndex, sceneImages.length - 1)];

  useEffect(() => {
    const sceneDuration = kind === "opening"
      ? captionIndex === 0 ? 6400 : 5600
      : captionIndex === 0 ? 5400 : captionIndex === captions.length - 1 ? 6200 : 4800;
    const timer = window.setTimeout(() => {
      if (captionIndex < captions.length - 1) setCaptionIndex((value) => value + 1);
      else onFinish();
    }, sceneDuration);
    return () => window.clearTimeout(timer);
  }, [captionIndex, captions.length, kind, onFinish]);

  return (
    <div className="cinematic" role="dialog" aria-modal="true" aria-label={kind === "opening" ? "오프닝" : "엔딩"}>
      <img
        className={kind === "opening" ? "opening-scene" : ""}
        key={`${kind}-${captionIndex}`}
        src={assetUrl(`/assets/story/${sceneImage}`)}
        alt=""
        loading="eager"
        decoding="async"
      />
      <div className="cinematic-vignette" />
      <div className="cinematic-topline">
        <span>{kind === "opening" ? "FACTOR FORCE · 이야기 시작" : "FACTOR FORCE · 이야기 끝"}</span>
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
    <section
      className="world-map"
      aria-label="세계 감염 지도"
      style={{ "--world-map-image": `url("${assetUrl("/assets/story/world-operation-map.webp")}")` } as CSSProperties}
    >
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
            <em>{stage.id === BOSS_STAGE_ID ? "보스" : stage.place.split(" · ")[1]}</em>
          </button>
        );
      })}
      <div className="map-legend"><span><i className="complete" /> 구하기 완료</span><span><i className="current" /> 작전 가능</span><span><i className="danger" /> 감염 지역</span></div>
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
        <span className="stage-number">{stage.id === BOSS_STAGE_ID ? "보스" : `0${stage.id}`.slice(-2)}</span>
        <div><small>{stage.lesson}</small><h2>{stage.title}</h2></div>
      </div>
      <div className="location-line"><i>⌖</i> {stage.place} <span>{stage.continent}</span></div>
      <div className="crisis-box">
        <small><i /> 지역 위기 상황</small>
        <p>{stage.crisis}</p>
      </div>
      <div className="stage-response">
        <small>연구소의 해결 계획</small>
        <p className="stage-story">{stage.story}</p>
      </div>
      <div className="mission-box">
        <small>작전 목표</small>
        <strong>{stage.mission}</strong>
      </div>
      <dl className="stage-facts">
        <div><dt>학습 목표</dt><dd>{stage.learning}</dd></div>
        <div><dt>사용 모드</dt><dd>{stageModeLabel(stage.modes)}</dd></div>
        <div><dt>핵심 단서</dt><dd>{stage.example}</dd></div>
      </dl>
      <div className="difficulty-line"><span>위험도</span><div>{[1, 2, 3].map((level) => <i key={level} className={level <= stage.difficulty ? "on" : ""} />)}</div></div>
      <button className="deploy-button" disabled={locked} onClick={onStart}>
        {locked ? "이전 지역을 먼저 구하세요" : complete ? "다시 작전하기" : stage.id === 1 ? "이야기부터 시작" : "치료 세균 보내기"}
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
            <small>{isBoss ? "보스 마지막 확인 문제" : "지역 마지막 확인 문제"}</small>
            <h2 id="learning-gate-title">{isBoss ? "배운 내용을 떠올려 보스를 물리치세요" : "지역을 구하는 마지막 문제"}</h2>
          </div>
          <b>{state.taskIndex + 1}/{total}</b>
        </div>

        <div className="learning-gate-progress" aria-label={`확인 문제 ${state.taskIndex + 1}/${total}`}>
          {Array.from({ length: total }, (_, index) => <i key={index} className={index <= state.taskIndex ? "active" : ""} />)}
        </div>

        <div className="learning-gate-copy">
          <span>{task.context}</span>
          <h3>{task.prompt}</h3>
          {task.multiple && <p>정답을 모두 고른 뒤 정답을 확인하세요.</p>}
          {task.shortAnswer && <p>계산한 답을 직접 쓴 뒤 정답을 확인하세요.</p>}
        </div>

        {task.shortAnswer ? (
          <div className="learning-short-answer">
            <label htmlFor={`learning-answer-${task.id}`}>답 직접 쓰기</label>
            <input
              id={`learning-answer-${task.id}`}
              inputMode="numeric"
              autoComplete="off"
              value={state.selected[0] ?? ""}
              placeholder={task.placeholder ?? "숫자로 입력하세요"}
              disabled={state.status === "correct"}
              onChange={(event) => onToggle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && state.selected[0]?.trim()) onSubmit();
              }}
            />
          </div>
        ) : <div className={`learning-options ${task.multiple ? "multiple" : ""}`}>
          {(task.options ?? []).map((option) => {
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
        </div>}

        {state.status === "wrong" && <div className="learning-feedback wrong"><b>다시 생각해 보세요</b><span>고른 답을 다시 살펴보세요. 나눗셈이나 곱셈 관계를 확인하면 됩니다.</span></div>}
        {state.status === "correct" && <div className="learning-feedback correct"><b>정답이에요</b><span>{task.explanation}</span></div>}

        <div className="learning-gate-actions">
          {state.status === "correct" ? (
            <button className="primary" type="button" onClick={onAdvance}>
              {state.taskIndex + 1 === total ? isBoss ? "마지막 치료 빛 보내기" : "지역 구하기 완료" : "다음 문제"} →
            </button>
          ) : (
            <button className="primary" type="button" disabled={!state.selected.some((value) => value.trim())} onClick={onSubmit}>정답 확인</button>
          )}
        </div>
      </section>
    </div>
  );
}

function HallOfFame({
  attempts,
  name,
  comment,
  status,
  error,
  onNameChange,
  onCommentChange,
  onSubmit,
  onFinish,
}: {
  attempts: number;
  name: string;
  comment: string;
  status: HallOfFameStatus;
  error: string;
  onNameChange: (value: string) => void;
  onCommentChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFinish: () => void;
}) {
  const submitted = status === "success";
  const tier = getHallTier(attempts);
  return (
    <div className="hall-of-fame" role="dialog" aria-modal="true" aria-labelledby="hall-of-fame-title">
      <section className="hall-of-fame-card">
        <img className="hall-of-fame-badge" src={assetUrl(tier.badge)} alt={`${tier.title} 뱃지`} />
        <small>BOSS STAGE CLEAR · LEVEL {tier.level}</small>
        <h2 id="hall-of-fame-title">{tier.title}</h2>
        <p>{tier.description} 칭호와 뱃지를 획득했습니다.</p>
        <div className="hall-of-fame-record">
          <span>전체 클리어 기록<br /><small>{hallTierRange(tier)} 등급</small></span>
          <strong>{attempts}<small>회</small></strong>
        </div>

        {submitted ? (
          <div className="hall-of-fame-success" role="status">
            <b>칭호와 기록이 Padlet 명예의 전당에 등록되었습니다.</b>
            <span>처음 화면의 명예의 전당에서 순위를 확인할 수 있습니다.</span>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <label htmlFor="hall-of-fame-name">닉네임</label>
            <input
              id="hall-of-fame-name"
              name="nickname"
              type="text"
              value={name}
              maxLength={30}
              autoComplete="nickname"
              disabled={status === "submitting"}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="명예의 전당에 표시할 이름"
              required
            />
            <div className="hall-of-fame-label-row">
              <label htmlFor="hall-of-fame-comment">클리어 소감</label>
              <small>{comment.length}/200</small>
            </div>
            <textarea
              id="hall-of-fame-comment"
              name="comment"
              value={comment}
              maxLength={200}
              rows={3}
              disabled={status === "submitting"}
              onChange={(event) => onCommentChange(event.target.value)}
              placeholder="지구를 구한 소감을 남겨 주세요"
              required
            />
            {status === "error" && <div className="hall-of-fame-error" role="alert">{error}</div>}
            <button className="primary" type="submit" disabled={status === "submitting" || !name.trim() || !comment.trim()}>
              {status === "submitting" ? "기록을 올리는 중..." : "명예의 전당에 기록 올리기"}
            </button>
          </form>
        )}

        <button className="hall-of-fame-finish" type="button" onClick={onFinish}>
          {submitted ? "처음 화면으로" : "기록하지 않고 끝내기"}
        </button>
      </section>
    </div>
  );
}

function HallOfFameBoard({ onBack }: { onBack: () => void }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const [records, setRecords] = useState<HallOfFameRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRecords = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${basePath}/api/hall-of-fame`, { signal, cache: "no-store" });
      const payload = await response.json().catch(() => null) as { records?: HallOfFameRecord[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "명예의 전당을 불러오지 못했습니다.");
      setRecords(payload?.records ?? []);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(requestError instanceof Error ? requestError.message : "명예의 전당을 불러오지 못했습니다.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => void loadRecords(controller.signal));
    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [loadRecords]);

  const dateLabel = (createdAt: string) => {
    if (!createdAt) return "-";
    const date = new Date(createdAt);
    return Number.isNaN(date.getTime()) ? "-" : new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  };

  return (
    <main className="hall-board-screen">
      <header className="hall-board-header">
        <button type="button" onClick={onBack}>← 처음 화면</button>
        <div><small>FACTOR FORCE</small><h1>명예의 전당</h1></div>
        <button type="button" onClick={() => void loadRecords()} disabled={loading}>↻ 새로고침</button>
      </header>

      <section className="hall-board-intro">
        <span>WORLD DEFENSE HONORS</span>
        <h2>지구를 구한 최고의 방어대원</h2>
        <p>전체 스토리를 더 적은 도전 횟수로 클리어한 순서입니다. 같은 기록은 먼저 등록한 대원이 앞섭니다.</p>
      </section>

      {loading ? (
        <div className="hall-board-state" role="status"><i>∴</i><b>Padlet 기록을 불러오는 중...</b></div>
      ) : error ? (
        <div className="hall-board-state error" role="alert"><b>{error}</b><button type="button" onClick={() => void loadRecords()}>다시 시도</button></div>
      ) : records.length === 0 ? (
        <div className="hall-board-state"><b>아직 등록된 기록이 없습니다.</b><p>첫 번째 지구 구원의 전설이 되어 보세요.</p></div>
      ) : (
        <>
          <section className="hall-podium" aria-label="상위 3위">
            {records.slice(0, 3).map((record) => (
              <article key={record.id} className={`rank-${record.rank}`}>
                <strong>{record.rank}</strong>
                <img src={assetUrl(record.tier.badge)} alt={`${record.tier.title} 뱃지`} />
                <h3>{record.nickname}</h3>
                <b>{record.tier.title}</b>
                <p>{record.attempts}회 클리어</p>
              </article>
            ))}
          </section>

          <section className="hall-ranking" aria-label="명예의 전당 1위부터 50위">
            <div className="hall-ranking-head"><span>순위 / 대원</span><span>칭호</span><span>클리어 기록</span><span>클리어 소감</span><span>등록일</span></div>
            {records.map((record) => (
              <article key={record.id} className={record.rank <= 3 ? `top-rank rank-${record.rank}` : ""}>
                <div className="hall-rank-player">
                  <strong>{record.rank}</strong>
                  <img src={assetUrl(record.tier.badge)} alt="" aria-hidden="true" />
                  <b>{record.nickname}</b>
                </div>
                <div className="hall-rank-tier"><small>LEVEL {record.tier.level}</small><b>{record.tier.title}</b></div>
                <strong className="hall-rank-attempts">{record.attempts}<small>회</small></strong>
                <p>{record.comment}</p>
                <time dateTime={record.createdAt}>{dateLabel(record.createdAt)}</time>
              </article>
            ))}
          </section>
        </>
      )}

      <section className="hall-tier-guide">
        <div><small>RANK SYSTEM</small><h2>10단계 칭호</h2></div>
        <div className="hall-tier-grid">
          {HALL_TIERS.map((tier) => (
            <article key={tier.level}>
              <img src={assetUrl(tier.badge)} alt="" aria-hidden="true" />
              <span><small>LEVEL {tier.level} · {hallTierRange(tier)}</small><b>{tier.title}</b></span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function BattleBoard({
  battle,
  selected,
  hovered,
  flash,
  shot,
  bossDefeatCell,
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
  bossDefeatCell: number | null;
  relationMode: RelationMode;
  disabled: boolean;
  onCell: (index: number) => void;
  onHover: (index: number | null) => void;
}) {
  const targets = useMemo(() => new Set(
    selected === null ? [] : legalMoves(battle.board, 1).filter((move) => move.from === selected).map((move) => move.to),
  ), [battle.board, selected]);

  return (
    <div className={`petri-board-grid ${bossDefeatCell !== null ? "boss-defeating" : ""}`} role="grid" aria-label="7 × 7 세균전 게임판">
      {battle.board.map((cell, index) => {
        const number = battle.numbers[index];
        const isBoss = battle.bossIndex === index && battle.bossHp > 0;
        const isInfected = flash.infected.includes(index);
        const infectionOrder = isInfected ? flash.infected.indexOf(index) : -1;
        const isResisted = flash.resisted.includes(index);
        const target = targets.has(index);
        return (
          <button
            key={index}
            role="gridcell"
            className={`petri-cell ${cell ? `occupied p${cell}` : "empty"} ${selected === index ? "selected" : ""} ${target ? `legal ${getDistance(selected ?? index, index, 7) === 1 ? "clone" : "jump"}` : ""} ${isInfected ? "hit" : ""} ${isResisted ? "resisted" : ""} ${isBoss ? "boss-cell" : ""}`}
            style={isInfected ? {
              "--impact-delay": `${INFECTION_TRAVEL_MS + infectionOrder * INFECTION_STAGGER_MS}ms`,
            } as CSSProperties : undefined}
            onClick={() => onCell(index)}
            onMouseEnter={() => onHover(index)}
            onMouseLeave={() => onHover(null)}
            disabled={disabled}
            aria-label={cell === 0 ? `빈 칸 ${index + 1}` : `${cell === 1 ? "치료" : "질병"} 세균 ${number}${isBoss ? `, 앞으로 ${battle.bossHp}번 더 치료` : ""}`}
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
      {bossDefeatCell !== null && (
        <div
          className="boss-defeat-effect"
          role="status"
          aria-label="보스 세균이 붕괴했습니다"
          style={{
            "--boss-x": `${(((bossDefeatCell % 7) + .5) / 7) * 100}%`,
            "--boss-y": `${((Math.floor(bossDefeatCell / 7) + .5) / 7) * 100}%`,
            "--boss-image": `url("${assetUrl("/assets/boss-germ-sprite.webp")}")`,
          } as CSSProperties}
        >
          <span className="boss-defeat-core" aria-hidden="true">
            <i className="boss-defeat-sprite" />
            <i className="boss-defeat-flash" />
            <i className="boss-defeat-ring ring-one" />
            <i className="boss-defeat-ring ring-two" />
            {Array.from({ length: 16 }, (_, index) => (
              <i
                className="boss-defeat-particle"
                key={index}
                style={{
                  "--particle-angle": `${index * 22.5}deg`,
                  "--particle-distance": `${58 + (index % 4) * 12}px`,
                  "--particle-delay": `${620 + (index % 5) * 55}ms`,
                } as CSSProperties}
              />
            ))}
          </span>
          <strong aria-hidden="true">보스 세균 붕괴</strong>
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
  const [bossDefeatCell, setBossDefeatCell] = useState<number | null>(null);
  const [cinematic, setCinematic] = useState<CinematicKind | null>(null);
  const [freeBattle, setFreeBattle] = useState(false);
  const [learningGate, setLearningGate] = useState<LearningGateState | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [storyAttempts, setStoryAttempts] = useState(0);
  const [hallOfFameOpen, setHallOfFameOpen] = useState(false);
  const [hallOfFameName, setHallOfFameName] = useState("");
  const [hallOfFameComment, setHallOfFameComment] = useState("");
  const [hallOfFameStatus, setHallOfFameStatus] = useState<HallOfFameStatus>("idle");
  const [hallOfFameError, setHallOfFameError] = useState("");
  const [storyExitPromptOpen, setStoryExitPromptOpen] = useState(false);
  const timers = useRef<number[]>([]);
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const infectionSfxRef = useRef<HTMLAudioElement | null>(null);
  const resultSfxRef = useRef<Record<keyof typeof RESULT_SOUNDS, HTMLAudioElement> | null>(null);
  const soundEnabledRef = useRef(true);

  const selectedStage = STORY_STAGES[selectedStageId - 1];
  const battleStage = STORY_STAGES[battleStageId - 1];
  const unlocked = Math.min(STORY_STAGE_COUNT, Math.max(1, completed.length ? Math.max(...completed) + 1 : 1));
  const storyGameInProgress = hydrated && view === "battle" && !result && !cinematic && !hallOfFameOpen;

  usePreventGameUnload(storyGameInProgress);

  useEffect(() => {
    const restoreFrame = window.requestAnimationFrame(() => {
      const progress = loadProgress();
      const savedAttempts = Number(window.localStorage.getItem(STORY_ATTEMPTS_KEY) ?? 0);
      const trackedAttempts = Number.isInteger(savedAttempts) && savedAttempts > 0 ? savedAttempts : 0;
      const restoredAttempts = Math.max(trackedAttempts, progress.length);
      setCompleted(progress);
      setStoryAttempts(restoredAttempts);
      if (restoredAttempts !== trackedAttempts) {
        window.localStorage.setItem(STORY_ATTEMPTS_KEY, String(restoredAttempts));
      }
      setSelectedStageId(Math.min(STORY_STAGE_COUNT, Math.max(1, progress.length ? Math.max(...progress) + 1 : 1)));
      const activeBattle = loadActiveStoryBattle();
      if (activeBattle) {
        setBattleStageId(activeBattle.battleStageId);
        setSelectedStageId(activeBattle.battleStageId);
        setBattle(activeBattle.battle);
        setSelectedCell(activeBattle.selectedCell);
        setHoveredCell(null);
        setRelationMode(activeBattle.relationMode);
        setTurn(activeBattle.turn === 2 ? 2 : 1);
        setFeedback(activeBattle.feedback);
        setMoveCount(activeBattle.moveCount);
        setBattleElapsed(activeBattle.battleElapsed);
        setFreeBattle(activeBattle.freeBattle);
        setLearningGate(activeBattle.learningGate);
        setResult(null);
        setBusy(false);
        setFlash({ infected: [], resisted: [] });
        setInfectionShot(null);
        setBossDefeatCell(null);
        setView("battle");
      }
      setHydrated(true);
    });
    return () => {
      window.cancelAnimationFrame(restoreFrame);
      timers.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const bgm = new Audio(assetUrl(MUSIC_TRACKS.menu));
    const infectionSfx = new Audio(assetUrl("/assets/audio/infection-splat.ogg"));
    const resultSounds = {
      clear: new Audio(assetUrl(RESULT_SOUNDS.clear)),
      failed: new Audio(assetUrl(RESULT_SOUNDS.failed)),
      bossClear: new Audio(assetUrl(RESULT_SOUNDS.bossClear)),
      bossDefeat: new Audio(assetUrl(RESULT_SOUNDS.bossDefeat)),
    };
    bgm.loop = true;
    bgm.preload = "auto";
    bgm.volume = 0.18;
    infectionSfx.volume = 0.56;
    resultSounds.clear.volume = 0.55;
    resultSounds.failed.volume = 0.48;
    resultSounds.bossClear.volume = 0.62;
    resultSounds.bossDefeat.volume = 0.68;
    infectionSfx.preload = "auto";
    infectionSfx.load();
    Object.values(resultSounds).forEach((sound) => { sound.preload = "none"; });
    bgmRef.current = bgm;
    infectionSfxRef.current = infectionSfx;
    resultSfxRef.current = resultSounds;

    const startMusic = () => {
      if (soundEnabledRef.current) bgm.play().catch(() => undefined);
    };
    let loopFrame = 0;
    const maintainSeamlessLoop = () => {
      const loopEnd = Number(bgm.dataset.loopEnd || 0);
      if (loopEnd > 0 && !bgm.paused && bgm.currentTime >= loopEnd) {
        bgm.currentTime = 0;
      }
      loopFrame = window.requestAnimationFrame(maintainSeamlessLoop);
    };
    loopFrame = window.requestAnimationFrame(maintainSeamlessLoop);
    window.addEventListener("pointerdown", startMusic, { once: true });
    window.addEventListener("keydown", startMusic, { once: true });

    return () => {
      window.removeEventListener("pointerdown", startMusic);
      window.removeEventListener("keydown", startMusic);
      window.cancelAnimationFrame(loopFrame);
      bgm.pause();
      infectionSfx.pause();
      Object.values(resultSounds).forEach((sound) => sound.pause());
      bgmRef.current = null;
      infectionSfxRef.current = null;
      resultSfxRef.current = null;
    };
  }, []);

  useEffect(() => {
    const bgm = bgmRef.current;
    if (!bgm) return;
    const isMissionView = view === "battle" || view === "free";
    const track = cinematic === "opening"
      ? MUSIC_TRACKS.opening
      : cinematic === "ending"
        ? MUSIC_TRACKS.ending
        : isMissionView
          ? MUSIC_TRACKS.mission
          : MUSIC_TRACKS.menu;
    const nextSource = assetUrl(track);
    if (bgm.getAttribute("src") === nextSource) return;

    bgm.pause();
    bgm.src = nextSource;
    bgm.currentTime = 0;
    bgm.loop = cinematic !== "opening";
    bgm.dataset.loopEnd = cinematic === "opening" ? String(OPENING_LOOP_END_SECONDS) : "";
    bgm.volume = cinematic === "opening" ? 0.22 : cinematic === "ending" ? 0.2 : isMissionView ? 0.14 : 0.18;
    bgm.load();
    if (soundEnabledRef.current) bgm.play().catch(() => undefined);
  }, [cinematic, view]);

  useEffect(() => {
    if (!soundEnabledRef.current || !infectionShot?.targets.length) return;
    const impactTimer = window.setTimeout(() => {
      const sound = infectionSfxRef.current;
      if (!sound || !soundEnabledRef.current) return;
      sound.currentTime = 0;
      sound.play().catch(() => undefined);
    }, INFECTION_TRAVEL_MS);
    return () => window.clearTimeout(impactTimer);
  }, [infectionShot]);

  useEffect(() => {
    if (!soundEnabledRef.current) return;
    const cue = bossDefeatCell !== null ? "bossDefeat" : cinematic === "ending" ? "bossClear" : result;
    if (!cue) return;
    const resultSounds = resultSfxRef.current;
    const sound = resultSounds?.[cue];
    if (!resultSounds || !sound) return;
    Object.values(resultSounds).forEach((item) => {
      item.pause();
      item.currentTime = 0;
    });
    sound.play().catch(() => undefined);
  }, [bossDefeatCell, cinematic, result]);

  useEffect(() => {
    if (view !== "battle" || result || storyExitPromptOpen) return;
    const timer = window.setInterval(() => setBattleElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [result, storyExitPromptOpen, view]);

  useEffect(() => {
    if (!hydrated) return;
    if (!storyGameInProgress) {
      window.localStorage.removeItem(STORY_BATTLE_SAVE_KEY);
      return;
    }
    if (busy || infectionShot || bossDefeatCell !== null) return;
    const saved: SavedStoryBattle = {
      version: 1,
      battleStageId,
      battle,
      selectedCell,
      relationMode,
      turn,
      feedback,
      moveCount,
      battleElapsed,
      freeBattle,
      learningGate,
    };
    window.localStorage.setItem(STORY_BATTLE_SAVE_KEY, JSON.stringify(saved));
  }, [battle, battleElapsed, battleStageId, bossDefeatCell, busy, feedback, freeBattle, hydrated, infectionShot, learningGate, moveCount, relationMode, selectedCell, storyGameInProgress, turn]);

  useEffect(() => {
    if (!hydrated) return;
    window.scrollTo(0, 0);
  }, [battleStageId, cinematic, hydrated, view]);

  const schedule = useCallback((callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timers.current.push(timer);
  }, []);

  const toggleSound = useCallback(() => {
    setSoundEnabled((current) => {
      const next = !current;
      soundEnabledRef.current = next;
      if (next) bgmRef.current?.play().catch(() => undefined);
      else {
        bgmRef.current?.pause();
        infectionSfxRef.current?.pause();
        Object.values(resultSfxRef.current ?? {}).forEach((sound) => sound.pause());
      }
      return next;
    });
  }, []);

  const persistCompletion = useCallback((stageId: number) => {
    if (freeBattle) return;
    setCompleted((previous) => {
      const next = previous.includes(stageId) ? previous : [...previous, stageId].sort((a, b) => a - b);
      window.localStorage.setItem(STORY_SAVE_KEY, JSON.stringify(next));
      return next;
    });
  }, [freeBattle]);

  const registerStoryAttempt = useCallback(() => {
    setStoryAttempts((previous) => {
      const next = previous + 1;
      window.localStorage.setItem(STORY_ATTEMPTS_KEY, String(next));
      return next;
    });
  }, []);

  const beginBattle = useCallback((stage: StoryStage, free = false) => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    if (!free) registerStoryAttempt();
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
    setBossDefeatCell(null);
    setLearningGate(null);
    setStoryExitPromptOpen(false);
    setFlash({ infected: [], resisted: [] });
    setInfectionShot(null);
    setFeedback(`${MODE_COPY[stage.modes[0]].label} 준비 완료. ${stage.mission}`);
    setView("battle");
  }, [registerStoryAttempt]);

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
    setFeedback("질병 세균을 모두 없앴어요. 지역을 구하는 마지막 문제를 풀어 보세요.");
    setLearningGate({ taskIndex: 0, selected: [], status: "answering" });
  }, [finishBattle, freeBattle]);

  const resolveAiTurn = useCallback((afterPlayer: StoryBattle) => {
    let working = afterPlayer;
    if (battleStage.boss) {
      const bossAction = applyBossTurn(working, battleStage);
      working = bossAction;
      setBattle(working);
      if (bossAction.relationText) setFeedback(bossAction.relationText);
      setFlash({ infected: bossAction.infected, resisted: [] });
      setInfectionShot(bossAction.infected.length ? { from: working.bossIndex ?? 24, targets: bossAction.infected, player: 2 } : null);
      if (getStoryBattleOutcome(working) === "failed") {
        setResult("failed");
        setBusy(false);
        return;
      }
    }

    const action = chooseStoryAiMove(working, battleStage);
    if (!action) {
      if (getStoryBattleOutcome(working) === "failed") {
        setResult("failed");
        setBusy(false);
        return;
      }
      const recovery = applyEmergencyTreatment(working, battleStage);
      if (recovery) {
        setBattle(stageBattleBeforeImpact(working, recovery.battle, [recovery.openedIndex]));
        setFlash({ infected: [recovery.openedIndex], resisted: [] });
        setInfectionShot({ from: recovery.sourceIndex, targets: [recovery.openedIndex], player: 1 });
        schedule(() => setBattle(recovery.battle), INFECTION_TRAVEL_MS);
        setFeedback(recovery.relationText);
        if (!recovery.battle.board.includes(2)) {
          schedule(() => requestCompletion(battleStage), infectionSequenceDuration(1) + 80);
          return;
        }
        schedule(() => {
          setFlash({ infected: [], resisted: [] });
          setInfectionShot(null);
          setTurn(1);
          setBusy(false);
        }, infectionSequenceDuration(1) + 80);
        return;
      }
      setTurn(1);
      setBusy(false);
      setInfectionShot(null);
      setFeedback("질병 세균이 이동할 수 없어요. 치료 작전을 계속하세요.");
      return;
    }
    const enemyResult = applyStoryMove(working, battleStage, 2, action.move, action.mode);
    setBattle(stageBattleBeforeImpact(working, enemyResult, enemyResult.infected));
    setFlash({ infected: enemyResult.infected, resisted: enemyResult.resisted });
    setInfectionShot(enemyResult.infected.length ? { from: action.move.to, targets: enemyResult.infected, player: 2 } : null);
    if (enemyResult.infected.length) schedule(() => setBattle(enemyResult), INFECTION_TRAVEL_MS);
    setFeedback(enemyResult.infected.length
      ? `치료 세균이 질병 세균으로 바뀌었어요! ${enemyResult.relationText}`
      : `질병 세균의 공격을 막았어요. ${enemyResult.relationText}`);
    setMoveCount((value) => value + 1);
    if (getStoryBattleOutcome(enemyResult) === "failed") {
      const failureDelay = infectionSequenceDuration(enemyResult.infected.length);
      if (failureDelay) {
        schedule(() => {
          setResult("failed");
          setBusy(false);
        }, failureDelay + 80);
      } else {
        setResult("failed");
        setBusy(false);
      }
      return;
    }
    const settleEnemyTurn = () => {
      const recovery = applyEmergencyTreatment(enemyResult, battleStage);
      if (recovery) {
        setBattle(stageBattleBeforeImpact(enemyResult, recovery.battle, [recovery.openedIndex]));
        setFlash({ infected: [recovery.openedIndex], resisted: [] });
        setInfectionShot({ from: recovery.sourceIndex, targets: [recovery.openedIndex], player: 1 });
        schedule(() => setBattle(recovery.battle), INFECTION_TRAVEL_MS);
        setFeedback(recovery.relationText);
        if (!recovery.battle.board.includes(2)) {
          schedule(() => requestCompletion(battleStage), infectionSequenceDuration(1) + 80);
          return;
        }
        schedule(() => {
          setFlash({ infected: [], resisted: [] });
          setInfectionShot(null);
          setTurn(1);
          setBusy(false);
        }, infectionSequenceDuration(1) + 80);
        return;
      }
      setFlash({ infected: [], resisted: [] });
      setInfectionShot(null);
      setTurn(1);
      setBusy(false);
    };
    const enemySequenceDelay = infectionSequenceDuration(enemyResult.infected.length);
    if (enemySequenceDelay) schedule(settleEnemyTurn, enemySequenceDelay + 80);
    else schedule(settleEnemyTurn, 650);
  }, [battleStage, requestCompletion, schedule]);

  const executePlayerMove = useCallback((move: Move) => {
    setBusy(true);
    setSelectedCell(null);
    const next = applyStoryMove(battle, battleStage, 1, move, relationMode);
    const bossDefeated = battle.bossHp > 0 && next.bossHit && next.bossHp === 0;
    setBattle(next);
    setFlash({ infected: next.infected, resisted: next.resisted });
    const playerTargets = next.bossHit && next.bossIndex !== null && !next.infected.includes(next.bossIndex)
      ? [...next.infected, next.bossIndex]
      : next.infected;
    const playerSequenceDelay = infectionSequenceDuration(playerTargets.length);
    if (playerTargets.length) {
      setBattle(stageBattleBeforeImpact(battle, next, playerTargets));
      schedule(() => setBattle(next), INFECTION_TRAVEL_MS);
    }
    setInfectionShot(playerTargets.length ? { from: move.to, targets: playerTargets, player: 1 } : null);
    setFeedback(bossDefeated
      ? "마지막 치료가 적중했습니다! 보스 세균의 핵이 붕괴합니다."
      : next.infected.length || next.bossHit ? next.relationText : `숫자 관계가 맞지 않아요. ${next.relationText}`);
    if (bossDefeated) {
      setBossDefeatCell(next.bossIndex ?? move.to);
      schedule(() => setBossDefeatCell(null), 2150);
    }
    setMoveCount((value) => value + 1);
    const outcome = getStoryBattleOutcome(next);
    if (outcome === "clear") {
      schedule(() => requestCompletion(battleStage), bossDefeated ? 2200 : Math.max(780, playerSequenceDelay + 80));
      return;
    }
    if (outcome === "failed") {
      if (playerSequenceDelay) {
        schedule(() => {
          setResult("failed");
          setBusy(false);
        }, playerSequenceDelay + 80);
      } else {
        setResult("failed");
        setBusy(false);
      }
      return;
    }
    setTurn(2);
    schedule(
      () => resolveAiTurn(next),
      bossDefeated ? 2200 : Math.max(battleStage.boss ? 1050 : 800, playerSequenceDelay + 80),
    );
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
          : `${battle.numbers[index]} 치료 세균을 ${MODE_COPY[nextMode].label}(으)로 바꿨어요. 다시 누르면 다음 모드로 바뀝니다.`);
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

  const returnToMap = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    const nextStage = Math.min(STORY_STAGE_COUNT, Math.max(...completed, battleStage.id) + 1);
    setSelectedStageId(nextStage);
    setView("map");
    setResult(null);
    setBusy(false);
    setFreeBattle(false);
    setStoryExitPromptOpen(false);
  }, [battleStage.id, completed]);

  const requestReturnToMap = useCallback(() => {
    if (storyGameInProgress) {
      setStoryExitPromptOpen(true);
      return;
    }
    returnToMap();
  }, [returnToMap, storyGameInProgress]);

  const stopStoryBattle = useCallback(() => {
    window.localStorage.removeItem(STORY_BATTLE_SAVE_KEY);
    setStoryExitPromptOpen(false);
    returnToMap();
  }, [returnToMap]);

  const resetCompletedStory = useCallback(() => {
    window.localStorage.removeItem(STORY_SAVE_KEY);
    window.localStorage.removeItem(LEGACY_STORY_SAVE_KEY);
    window.localStorage.removeItem(STORY_ATTEMPTS_KEY);
    window.localStorage.removeItem(STORY_BATTLE_SAVE_KEY);
    setCinematic(null);
    setResult(null);
    setLearningGate(null);
    setSelectedCell(null);
    setHoveredCell(null);
    setFlash({ infected: [], resisted: [] });
    setInfectionShot(null);
    setBossDefeatCell(null);
    setBusy(false);
    setFreeBattle(false);
    setCompleted([]);
    setStoryAttempts(0);
    setSelectedStageId(1);
    setBattleStageId(1);
    setBattle(createStoryBattle(STORY_STAGES[0]));
    setHallOfFameOpen(false);
    setHallOfFameName("");
    setHallOfFameComment("");
    setHallOfFameStatus("idle");
    setHallOfFameError("");
    setView("title");
  }, []);

  const submitHallOfFame = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = hallOfFameName.replace(/\s+/g, " ").trim();
    const comment = hallOfFameComment.replace(/\s+/g, " ").trim();
    const attempts = normalizeHallAttempts(storyAttempts);
    if (!name || !comment) return;

    setHallOfFameStatus("submitting");
    setHallOfFameError("");
    try {
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const response = await fetch(`${basePath}/api/hall-of-fame`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: name, attempts, comment }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "기록을 올리지 못했습니다.");
      setHallOfFameName(name);
      setHallOfFameComment(comment);
      setHallOfFameStatus("success");
    } catch (error) {
      setHallOfFameStatus("error");
      setHallOfFameError(error instanceof Error ? error.message : "기록을 올리지 못했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }, [hallOfFameComment, hallOfFameName, storyAttempts]);

  const handleCinematicFinish = useCallback(() => {
    if (cinematic === "opening") {
      setCinematic(null);
      beginBattle(STORY_STAGES[0]);
    } else {
      setCinematic(null);
      setHallOfFameName("");
      setHallOfFameComment("");
      setHallOfFameStatus("idle");
      setHallOfFameError("");
      setHallOfFameOpen(true);
    }
  }, [beginBattle, cinematic]);

  const remainingDisease = battle.board.filter((cell) => cell === 2).length;
  const therapyCount = battle.board.filter((cell) => cell === 1).length;
  const occupiedPercent = Math.round(((remainingDisease + therapyCount) / battle.board.length) * 100);
  const boardFull = !battle.board.includes(0);
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

  if (!hydrated) return <main className="story-app loading-screen"><div className="loader-germ">∴</div><p>치료 세균을 만드는 중...</p></main>;

  if (view === "title") {
    return <><TitleScreen onStory={() => setView("map")} onFree={() => setView("free")} onHallOfFame={() => setView("hall")} /><AudioToggle enabled={soundEnabled} onToggle={toggleSound} /></>;
  }

  if (view === "free") {
    return <><FreeBattle onExit={() => setView("title")} /><AudioToggle enabled={soundEnabled} onToggle={toggleSound} /></>;
  }

  if (view === "hall") {
    return <><HallOfFameBoard onBack={() => setView("title")} /><AudioToggle enabled={soundEnabled} onToggle={toggleSound} /></>;
  }

  return (
    <main className={`story-app view-${view}`}>
      <AudioToggle enabled={soundEnabled} onToggle={toggleSound} />
      {view === "map" && <header className="command-header">
        <button className="brand" onClick={() => setView("title")} aria-label="게임 시작 화면으로 이동">
          <span className="brand-mark factor-mark" aria-hidden="true"><i /><i /><i /></span>
          <span><b>FACTOR FORCE</b><small>약수와 배수 지구 방어대</small></span>
        </button>
        <nav className="desktop-mode-nav" aria-label="게임 모드">
          <button className={view === "map" && !freeBattle ? "active" : ""} onClick={() => { setView("map"); setFreeBattle(false); }}>스토리 작전</button>
          <button onClick={() => setView("free")}>자유 대전</button>
        </nav>
        <div className="global-progress">
          <div><span>지구를 구한 정도</span><b>{Math.round((completed.length / STORY_STAGE_COUNT) * 100)}%</b></div>
          <i><em style={{ width: `${(completed.length / STORY_STAGE_COUNT) * 100}%` }} /></i>
        </div>
      </header>}
      {view === "map" && <nav className="mobile-mode-nav" aria-label="모바일 게임 모드">
        <button className="active" onClick={() => { setView("map"); setFreeBattle(false); }}><span aria-hidden="true">●</span> 스토리 작전</button>
        <button onClick={() => setView("free")}><span aria-hidden="true">◆</span> 자유 대전</button>
      </nav>}

      {view === "map" ? (
        <div className="map-layout">
          <section className="mission-brief">
            <small className="eyebrow">지구 구출 작전 // 2042</small>
            <h1>숫자 감염으로부터<br /><em>지구를 구하라</em></h1>
            <p>약수와 배수의 관계를 이용해 치료 세균을 새로 만들고, 대륙마다 퍼진 질병 세균을 치료 세균으로 바꾸세요.</p>
            <div className="brief-stats">
              <div><b>{completed.length}</b><span>구한 지역</span></div>
              <div><b>{STORY_STAGE_COUNT - completed.length}</b><span>남은 작전</span></div>
              <div><b>{completed.includes(BOSS_STAGE_ID) ? "안정" : "위험"}</b><span>지구 상태</span></div>
            </div>
            <div className="transmission-log">
              <span className="pulse-dot" />
              <div><small>연구소 소식</small><p>{completed.length === 0 ? "치료 세균을 모두 만들었어요. 마닐라의 첫 작전을 시작할 수 있습니다." : completed.includes(BOSS_STAGE_ID) ? "전 세계의 감염 신호가 사라졌어요. 지구의 자연이 원래 모습을 되찾았습니다." : `${unlocked}번 감염 지역에서 도와 달라는 연락이 왔습니다.`}</p></div>
            </div>
          </section>

          <WorldMap selected={selectedStageId} completed={completed} onSelect={setSelectedStageId} />
          <StagePanel stage={selectedStage} complete={completed.includes(selectedStage.id)} locked={selectedStage.id > unlocked && !completed.includes(selectedStage.id)} onStart={startSelectedStage} />
        </div>
      ) : (
        <div className="petri-battle-screen">
          <header className="petri-topbar">
            <button className="petri-brand" onClick={requestReturnToMap} aria-label="세계 작전 지도로 돌아가기">
              <span className="petri-brand-mark"><i /><i /><i /></span>
              <span><strong>페트리</strong><small>{"// 07"}</small></span>
            </button>
            <div className="petri-topbar-center"><span className="petri-live-dot" /><span>게임 시간</span><b>{formatTime(battleElapsed)}</b></div>
            <nav className="petri-top-actions" aria-label="전투 메뉴">
              <button aria-label="학습 목표" title={battleStage.learning}>?</button>
              <button className="petri-stage-button" onClick={requestReturnToMap}><span>{freeBattle ? "자유 대전" : `${battleStage.lesson} · 7×7`}</span><b>지도</b></button>
            </nav>
          </header>

          <section className="petri-status-rail" aria-live="polite">
            <div className={`petri-turn-beacon p${turn}`}><span>{busy ? "진행 중" : turn === 1 ? "파란 팀" : "빨간 팀"}</span></div>
            <div className="petri-status-copy">
              <small>턴 {String(moveCount + 1).padStart(2, "0")} · {turn === 1 ? "치료 세균" : "컴퓨터"} · {battleStage.title}</small>
              <strong>{liveComparison ?? feedback}</strong>
            </div>
            <div className="petri-coverage"><span>채운 칸</span><b>{occupiedPercent}%</b><i><em style={{ width: `${occupiedPercent}%` }} /></i></div>
          </section>

          <section className="petri-game-layout">
            <aside className={`petri-player-panel cyan ${turn === 1 && !result ? "active" : ""}`}>
              <div className="petri-player-topline"><span>파란 팀</span><i>● 준비됨</i></div>
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
                    bossDefeatCell={bossDefeatCell}
                    relationMode={relationMode}
                    disabled={busy || !!result}
                    onCell={handleCell}
                    onHover={setHoveredCell}
                  />
                </div>
              </div>
              <div className="petri-board-controls">
                <button onClick={requestReturnToMap}><span>↶</span> 작전 지도</button>
                <div className="petri-mode-controls" aria-label="치료 모드">
                  {selectedCell !== null ? (
                    <button
                      className={`petri-relation-toggle active ${relationMode}`}
                      disabled={busy}
                      onClick={() => handleCell(selectedCell)}
                      title="선택한 세균을 다시 눌러 다음 모드로 바꿉니다."
                    >
                      <i>{MODE_COPY[relationMode].short}</i>
                      <span><b>{MODE_COPY[relationMode].label}</b><small>{battleStage.modes.length > 1 ? "다시 눌러 모드 바꾸기" : "이번 작전에서만 사용"}</small></span>
                    </button>
                  ) : (
                    <div className="petri-mode-prompt"><i>약</i><span><b>세균을 선택하세요</b><small>같은 세균을 다시 눌러 모드 변경</small></span></div>
                  )}
                </div>
                <button onClick={() => beginBattle(battleStage, freeBattle)}><span>↻</span> 새 게임</button>
              </div>
            </section>

            <aside className={`petri-player-panel coral ${turn === 2 && !result ? "active" : ""}`}>
              <div className="petri-player-topline"><span>빨간 팀</span><i>● 컴퓨터</i></div>
              <div className="petri-portrait"><Germ player={2} /><span className="petri-scanline" /></div>
              <div className="petri-identity"><small>{battleStage.boss ? "우두머리 세균 무리" : "컴퓨터 세균"}</small><h2>{battleStage.boss ? "보스 세균" : "컴퓨터"}</h2></div>
              <div className="petri-score-block"><small>세균 수</small><strong>{String(remainingDisease).padStart(2, "0")}</strong></div>
              <div className="petri-player-metrics">
                <span><small>빼앗김</small><b>+{diseaseCaptures}</b></span>
                <span><small>난이도</small><b>{battleStage.boss ? "최종전" : battleStage.difficulty === 1 ? "쉬움" : battleStage.difficulty === 2 ? "보통" : "어려움"}</b></span>
                <span><small>{battleStage.boss ? "남은 치료" : "모드"}</small><b>{battleStage.boss ? `×${battle.bossHp}` : `×${battleStage.modes.length}`}</b></span>
              </div>
            </aside>
          </section>

          <section className="petri-learning-dock">
            <div><span><i /> {battleStage.lesson}</span><b>{MODE_COPY[relationMode].label}</b></div>
            <p>{battleStage.example}</p>
            <div className="petri-mission-progress"><span>{remainingDisease === 0 ? `확인 문제 ${learningTasks.length}개` : "남은 질병 세균"}</span><i><em style={{ width: `${Math.max(0, Math.min(100, (therapyCaptures / Math.max(1, battleStage.enemyNumbers.length)) * 100))}%` }} /></i><b>{remainingDisease === 0 ? "준비" : remainingDisease}</b></div>
          </section>
        </div>
      )}

      {result && (
        <div className="result-overlay">
          <section className={`result-card ${result}`}>
            <span className="result-symbol">{result === "clear" ? "✓" : "!"}</span>
            <small>{result === "clear" ? "지역 구하기 성공" : "치료 작전 실패"}</small>
            <h2>{result === "clear" ? `${battleStage.place} 구하기 완료` : boardFull ? "게임판이 가득 찼어요" : "치료 세균이 모두 감염됐어요"}</h2>
            <p>{result === "clear" ? `${battleStage.lesson}의 핵심 개념으로 질병 세균을 모두 제거했습니다.` : boardFull ? "질병 세균이 남은 채 모든 칸이 점유되어 미션에 실패했습니다." : "숫자 관계와 모드를 다시 확인하고 재도전하세요."}</p>
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

      {storyExitPromptOpen && (
        <GameExitPrompt onContinue={() => setStoryExitPromptOpen(false)} onStop={stopStoryBattle} />
      )}

      {cinematic && <Cinematic kind={cinematic} onFinish={handleCinematicFinish} />}
      {hallOfFameOpen && (
        <HallOfFame
          attempts={normalizeHallAttempts(storyAttempts)}
          name={hallOfFameName}
          comment={hallOfFameComment}
          status={hallOfFameStatus}
          error={hallOfFameError}
          onNameChange={setHallOfFameName}
          onCommentChange={setHallOfFameComment}
          onSubmit={submitHallOfFame}
          onFinish={resetCompletedStory}
        />
      )}
    </main>
  );
}
