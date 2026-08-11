"use client";

import { useEffect } from "react";

export function usePreventGameUnload(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [active]);
}

export function GameExitPrompt({
  onContinue,
  onStop,
}: {
  onContinue: () => void;
  onStop: () => void;
}) {
  return (
    <div className="game-exit-backdrop">
      <section
        className="game-exit-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="game-exit-title"
        aria-describedby="game-exit-description"
      >
        <span className="game-exit-icon" aria-hidden="true">!</span>
        <small>진행 중인 게임</small>
        <h2 id="game-exit-title">게임을 중단할까요?</h2>
        <p id="game-exit-description">
          지금 나가면 현재 게임은 끝납니다. 계속 플레이하면 진행 상황을 그대로 이어갈 수 있어요.
        </p>
        <div>
          <button className="game-exit-continue" onClick={onContinue}>계속하기</button>
          <button className="game-exit-stop" onClick={onStop}>게임 중단</button>
        </div>
      </section>
    </div>
  );
}
