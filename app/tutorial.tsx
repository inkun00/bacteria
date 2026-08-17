"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { assetUrl } from "./assets";
import type { RelationMode } from "./game";

type TutorialCell = { team: 0 | 1 | 2; number: number | null };
type TutorialAction =
  | { kind: "cell"; index: number }
  | { kind: "mode"; mode: RelationMode };

const TUTORIAL_COMPLETE_KEY = "factor-force-tutorial-complete-v1";
const EMPTY_CELL: TutorialCell = { team: 0, number: null };

const STEPS: Array<{
  lesson: string;
  title: string;
  instruction: string;
  principle: string;
  action: TutorialAction;
}> = [
  {
    lesson: "기초 조작",
    title: "치료 세균을 선택하세요",
    instruction: "빛나는 파란 세균 6을 눌러 이동 준비를 합니다.",
    principle: "파란색은 내 치료 세균, 빨간색은 치료해야 할 질병 세균입니다.",
    action: { kind: "cell", index: 11 },
  },
  {
    lesson: "약수 훈련",
    title: "약수 모드를 선택하세요",
    instruction: "6의 약수인 3을 치료하려면 약수 모드가 필요합니다.",
    principle: "상대 수가 내 세균 수를 나누어떨어지게 하면 약수 감염이 성공합니다. 6 ÷ 3 = 2",
    action: { kind: "mode", mode: "divisor" },
  },
  {
    lesson: "약수 훈련",
    title: "한 칸 옆으로 복제 이동하세요",
    instruction: "가운데 빛나는 빈칸을 누르면 새 세균이 생기고 주변의 3이 치료됩니다.",
    principle: "한 칸 이동하면 원래 세균은 남고, 도착한 칸에 새 세균이 만들어집니다.",
    action: { kind: "cell", index: 12 },
  },
  {
    lesson: "배수 훈련",
    title: "치료 세균 4를 선택하세요",
    instruction: "이번에는 빛나는 파란 세균 4를 눌러 보세요.",
    principle: "배수 모드는 내 수를 여러 번 더해 만들 수 있는 상대 수를 치료합니다.",
    action: { kind: "cell", index: 16 },
  },
  {
    lesson: "배수 훈련",
    title: "배수 모드로 바꾸세요",
    instruction: "8은 4의 배수이므로 배수 모드를 선택합니다.",
    principle: "8 ÷ 4 = 2처럼 나누어떨어지면 8은 4의 배수입니다.",
    action: { kind: "mode", mode: "multiple" },
  },
  {
    lesson: "배수 훈련",
    title: "8 가까이 복제 이동하세요",
    instruction: "빛나는 빈칸으로 이동해 주변의 질병 세균 8을 치료하세요.",
    principle: "이동한 세균 주변에서 선택한 숫자 관계가 맞는 질병 세균이 내 편으로 바뀝니다.",
    action: { kind: "cell", index: 17 },
  },
  {
    lesson: "분열 훈련",
    title: "치료 세균 12를 선택하세요",
    instruction: "마지막 훈련입니다. 파란 세균 12를 눌러 선택하세요.",
    principle: "분열 모드는 하나의 수를 두 자연수의 곱으로 나눠 두 세균을 만듭니다.",
    action: { kind: "cell", index: 6 },
  },
  {
    lesson: "분열 훈련",
    title: "분열 모드를 선택하세요",
    instruction: "12를 3 × 4로 나누기 위해 분열 모드를 선택합니다.",
    principle: "12 = 3 × 4처럼 1과 자기 자신이 아닌 곱셈식으로 수를 분열시킬 수 있습니다.",
    action: { kind: "mode", mode: "split" },
  },
  {
    lesson: "분열 훈련",
    title: "빈칸으로 분열하세요",
    instruction: "빛나는 빈칸을 누르면 12가 3과 4로 분열되고, 4의 배수인 8도 치료됩니다.",
    principle: "분열로 생긴 새 세균의 수를 기준으로 주변의 배수를 찾아 감염시킵니다.",
    action: { kind: "cell", index: 7 },
  },
];

const MODE_COPY: Record<RelationMode, { label: string; short: string }> = {
  divisor: { label: "약수 모드", short: "약" },
  multiple: { label: "배수 모드", short: "배" },
  split: { label: "분열 모드", short: "분" },
};

function makeBoard(entries: Array<[number, 1 | 2, number]>) {
  const board = Array.from({ length: 25 }, () => ({ ...EMPTY_CELL }));
  entries.forEach(([index, team, number]) => { board[index] = { team, number }; });
  return board;
}

const DIVISOR_BOARD = () => makeBoard([[11, 1, 6], [13, 2, 3], [4, 2, 5]]);
const MULTIPLE_BOARD = () => makeBoard([[16, 1, 4], [18, 2, 8], [4, 2, 10]]);
const SPLIT_BOARD = () => makeBoard([[6, 1, 12], [8, 2, 8], [23, 2, 7]]);

function TutorialGerm({ team, number, infecting }: { team: 1 | 2; number: number; infecting: boolean }) {
  const sprite = infecting ? "bacteria-infection.webp" : "bacteria-idle.webp";
  return (
    <span
      className={`germ-sprite p${team} ${infecting ? "infection" : "idle"}`}
      style={{ backgroundImage: `url("${assetUrl(`/assets/${sprite}`)}")` }}
      aria-hidden="true"
    >
      <b className="germ-number">{number}</b>
    </span>
  );
}

export { TUTORIAL_COMPLETE_KEY };

export default function TutorialMode({
  onExit,
  onComplete,
  onStory,
}: {
  onExit: () => void;
  onComplete: () => void;
  onStory: () => void;
}) {
  const [step, setStep] = useState(0);
  const [board, setBoard] = useState<TutorialCell[]>(DIVISOR_BOARD);
  const [selected, setSelected] = useState<number | null>(null);
  const [mode, setMode] = useState<RelationMode>("divisor");
  const [infected, setInfected] = useState<number[]>([]);
  const [animating, setAnimating] = useState(false);
  const [done, setDone] = useState(false);
  const [feedback, setFeedback] = useState("빛나는 파란 세균부터 눌러 보세요.");
  const timers = useRef<number[]>([]);
  const current = STEPS[Math.min(step, STEPS.length - 1)];

  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const moduleState = useMemo(() => ({
    divisor: step >= 3,
    multiple: step >= 6,
    split: done,
  }), [done, step]);

  const schedule = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timers.current.push(timer);
  };

  const resetTutorial = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
    setStep(0);
    setBoard(DIVISOR_BOARD());
    setSelected(null);
    setMode("divisor");
    setInfected([]);
    setAnimating(false);
    setDone(false);
    setFeedback("빛나는 파란 세균부터 눌러 보세요.");
  };

  const wrongAction = () => {
    setFeedback(current.action.kind === "mode"
      ? `지금은 ${MODE_COPY[current.action.mode].label} 버튼을 눌러 보세요.`
      : "청록색으로 빛나는 칸을 눌러 보세요.");
  };

  const finishMove = (changed: TutorialCell[], infectionIndex: number, nextStep: number) => {
    setBoard(changed);
    setInfected([infectionIndex]);
    setAnimating(true);
    setFeedback("감염 성공! 숫자 관계가 맞아 질병 세균이 치료됐습니다.");
    schedule(() => {
      setInfected([]);
      setSelected(null);
      setAnimating(false);
      if (nextStep === 3) {
        setBoard(MULTIPLE_BOARD());
        setMode("divisor");
        setFeedback("좋아요! 이제 배수 감염을 연습합니다.");
      } else if (nextStep === 6) {
        setBoard(SPLIT_BOARD());
        setMode("divisor");
        setFeedback("마지막으로 수를 두 세균으로 나누는 분열을 연습합니다.");
      } else {
        setDone(true);
        setFeedback("기초 훈련을 모두 마쳤습니다!");
        onComplete();
      }
      setStep(nextStep);
    }, 920);
  };

  const handleCell = (index: number) => {
    if (animating || done) return;
    if (current.action.kind !== "cell" || current.action.index !== index) {
      wrongAction();
      return;
    }

    if (step === 0 || step === 3 || step === 6) {
      setSelected(index);
      setStep((value) => value + 1);
      setFeedback("선택 완료! 이제 안내된 감염 모드를 눌러 보세요.");
      return;
    }

    const changed = board.map((cell) => ({ ...cell }));
    if (step === 2) {
      changed[12] = { team: 1, number: 6 };
      changed[13] = { team: 1, number: 3 };
      finishMove(changed, 13, 3);
    } else if (step === 5) {
      changed[17] = { team: 1, number: 4 };
      changed[18] = { team: 1, number: 8 };
      finishMove(changed, 18, 6);
    } else if (step === 8) {
      changed[6] = { team: 1, number: 3 };
      changed[7] = { team: 1, number: 4 };
      changed[8] = { team: 1, number: 8 };
      finishMove(changed, 8, 9);
    }
  };

  const handleMode = (nextMode: RelationMode) => {
    if (animating || done) return;
    if (current.action.kind !== "mode" || current.action.mode !== nextMode) {
      wrongAction();
      return;
    }
    setMode(nextMode);
    setStep((value) => value + 1);
    setFeedback(`${MODE_COPY[nextMode].label} 준비 완료! 이제 빛나는 빈칸으로 이동하세요.`);
  };

  return (
    <main className="tutorial-screen">
      <div className="tutorial-grid-bg" aria-hidden="true" />
      <header className="tutorial-header">
        <button className="tutorial-brand" onClick={onExit} aria-label="게임 시작 화면으로 돌아가기">
          <span className="tutorial-brand-mark"><i /><i /><i /></span>
          <span><b>FACTOR FORCE</b><small>훈련 연구소</small></span>
        </button>
        <div className="tutorial-progress" aria-label={`튜토리얼 ${Math.min(step + 1, STEPS.length)}단계 중 ${STEPS.length}단계`}>
          <span>기초 훈련 진행도</span>
          <i><em style={{ width: `${(Math.min(step, STEPS.length) / STEPS.length) * 100}%` }} /></i>
          <b>{String(Math.min(step + 1, STEPS.length)).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}</b>
        </div>
        <button className="tutorial-reset" onClick={resetTutorial}>↻ 처음부터</button>
      </header>

      <section className="tutorial-status" aria-live="polite">
        <span>GUIDED TRAINING</span>
        <div><small>{current.lesson}</small><strong>{done ? "기초 훈련 완료" : current.title}</strong></div>
        <p>{feedback}</p>
      </section>

      <div className="tutorial-layout">
        <aside className="tutorial-coach-panel">
          <span className="tutorial-kicker">연구원 안내 // {String(Math.min(step + 1, STEPS.length)).padStart(2, "0")}</span>
          <h1>{done ? "훈련 완료!" : current.title}</h1>
          <p>{done ? "약수·배수·분열의 핵심 조작을 모두 익혔습니다. 이제 실제 작전을 시작할 준비가 됐어요." : current.instruction}</p>
          <div className="tutorial-next-action">
            <i aria-hidden="true">→</i>
            <span><small>지금 할 일</small><b>{current.action.kind === "mode" ? `${MODE_COPY[current.action.mode].label} 누르기` : "빛나는 칸 누르기"}</b></span>
          </div>
          <div className="tutorial-modules">
            <div className={moduleState.divisor ? "complete" : step < 3 ? "active" : ""}><i>{moduleState.divisor ? "✓" : "1"}</i><span><b>약수 감염</b><small>나누어떨어지는 수</small></span></div>
            <div className={moduleState.multiple ? "complete" : step >= 3 && step < 6 ? "active" : ""}><i>{moduleState.multiple ? "✓" : "2"}</i><span><b>배수 감염</b><small>몇 배가 되는 수</small></span></div>
            <div className={moduleState.split ? "complete" : step >= 6 ? "active" : ""}><i>{moduleState.split ? "✓" : "3"}</i><span><b>분열 감염</b><small>곱셈식으로 나누기</small></span></div>
          </div>
        </aside>

        <section className="tutorial-lab" aria-label="튜토리얼 실습 게임판">
          <div className="tutorial-dish">
            <div className="tutorial-board" role="grid" aria-label="5 곱하기 5 훈련 게임판">
              {board.map((cell, index) => {
                const expected = !done && current.action.kind === "cell" && current.action.index === index;
                return (
                  <button
                    key={index}
                    className={`tutorial-cell team-${cell.team} ${selected === index ? "selected" : ""} ${expected ? "expected" : ""} ${infected.includes(index) ? "infected" : ""}`}
                    onClick={() => handleCell(index)}
                    disabled={animating}
                    role="gridcell"
                    aria-label={cell.team === 0 ? `${index + 1}번 빈칸` : `${cell.team === 1 ? "치료" : "질병"} 세균 ${cell.number}`}
                  >
                    {cell.team !== 0 && cell.number !== null && <TutorialGerm team={cell.team} number={cell.number} infecting={infected.includes(index)} />}
                    {expected && cell.team === 0 && <span className="tutorial-target"><i />이동</span>}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="tutorial-mode-bar" aria-label="감염 모드 선택">
            {(Object.keys(MODE_COPY) as RelationMode[]).map((item) => {
              const expected = !done && current.action.kind === "mode" && current.action.mode === item;
              return (
                <button key={item} className={`${mode === item ? "selected" : ""} ${expected ? "expected" : ""}`} onClick={() => handleMode(item)} disabled={animating}>
                  <i>{MODE_COPY[item].short}</i><span>{MODE_COPY[item].label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="tutorial-principle-panel">
          <span className="tutorial-kicker">원리 카드</span>
          <div className={`tutorial-formula ${mode}`}>
            <small>{MODE_COPY[mode].label}</small>
            <b>{step < 3 ? "6 ÷ 3 = 2" : step < 6 ? "8 ÷ 4 = 2" : "12 = 3 × 4"}</b>
          </div>
          <p>{current.principle}</p>
          <div className="tutorial-legend">
            <span><i className="cyan" />치료 세균</span>
            <span><i className="coral" />질병 세균</span>
            <span><i className="pulse" />다음 조작</span>
          </div>
          <div className="tutorial-tip"><span>TIP</span><p>잘못 눌러도 게임이 진행되지 않아요. 청록색으로 빛나는 곳을 차례대로 누르면 됩니다.</p></div>
        </aside>
      </div>

      {done && (
        <div className="tutorial-complete-layer">
          <section role="dialog" aria-modal="true" aria-labelledby="tutorial-complete-title">
            <span className="tutorial-complete-badge">✓</span>
            <small>TRAINING COMPLETE</small>
            <h2 id="tutorial-complete-title">기초 훈련을 완료했습니다</h2>
            <p>약수·배수·분열 모드로 질병 세균을 치료하는 방법을 모두 익혔어요.</p>
            <div><button onClick={onExit}>시작 화면</button><button className="primary" onClick={onStory}>스토리 작전 시작 →</button></div>
          </section>
        </div>
      )}
    </main>
  );
}
