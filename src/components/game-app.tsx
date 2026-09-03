import { useEffect, useRef, useState } from "react";
import {
  HomeScreen,
  HowScreen,
  JuniorScreen,
  OverScreen,
  PauseScreen,
  PlayHud,
  ScoresScreen,
  SetupScreen,
} from "@/components/overlays";
import { preloadAssets } from "@/game/assets";
import { audio } from "@/game/audio";
import { SliceEngine } from "@/game/engine";
import { useGame } from "@/game/store";
import type { Mode, Op } from "@/game/types";

export function GameApp() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SliceEngine | null>(null);
  const screen = useGame((s) => s.screen);
  const save = useGame((s) => s.save);
  const setScreen = useGame((s) => s.setScreen);
  const setHud = useGame((s) => s.setHud);
  const finishRun = useGame((s) => s.finishRun);
  const mode = useGame((s) => s.mode);
  const [bootError, setBootError] = useState<string | null>(null);
  const playing = screen === "playing" || screen === "paused" || screen === "over";

  useEffect(() => {
    void preloadAssets().catch((err: unknown) => {
      setBootError(err instanceof Error ? err.message : "Could not load MathSlash.");
    });
  }, []);

  useEffect(() => {
    audio.setMuted(save.muted);
  }, [save.muted]);

  useEffect(() => {
    engineRef.current?.setShake(save.shake);
  }, [save.shake]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") audio.unlock();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (!playing) {
      engineRef.current?.destroy();
      engineRef.current = null;
      window.__mathSlash = undefined;
      return;
    }
    const canvas = canvasRef.current;
    let cancelled = false;
    void (async () => {
      const loaded = await preloadAssets();
      if (cancelled || !canvas) return;
      const engine = new SliceEngine(canvas, loaded, {
        onHud: setHud,
        onOver: (result) => {
          finishRun(result.score, result.solved, result.maxCombo);
        },
        onEvent: (kind) => {
          if (kind === "correct") audio.correct();
          else if (kind === "wrong") audio.wrong();
          else if (kind === "miss") audio.miss();
          else if (kind === "combo") {
            audio.correct();
            audio.combo(useGame.getState().hud.combo);
          } else if (kind === "throw") audio.throwWhoosh();
        },
      });
      engine.setShake(useGame.getState().save.shake);
      engineRef.current = engine;
      window.__mathSlash = engine.debug();
      engine.start(useGame.getState().config, useGame.getState().mode);
    })();
    return () => {
      cancelled = true;
      engineRef.current?.destroy();
      engineRef.current = null;
      window.__mathSlash = undefined;
    };
  }, [playing, setHud, finishRun]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      const s = useGame.getState().screen;
      if (s === "playing") {
        engineRef.current?.setPaused(true);
        setScreen("paused");
      } else if (s === "paused") {
        engineRef.current?.setPaused(false);
        setScreen("playing");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setScreen]);

  const startRun = (nextMode: Mode = "classic") => {
    useGame.getState().setMode(nextMode);
    audio.unlock();
    audio.slice();
    setHud({
      score: 0,
      combo: 0,
      lives: 3,
      solved: 0,
      problem: "",
      reveal: null,
      feedback: null,
    });
    setScreen("playing");
  };

  const startJunior = (op: Op) => {
    useGame.getState().patchConfig({ op, difficulty: "easy", table: "all" });
    startRun("junior");
  };

  const pause = () => {
    engineRef.current?.setPaused(true);
    setScreen("paused");
  };
  const resume = () => {
    audio.unlock();
    engineRef.current?.setPaused(false);
    setScreen("playing");
  };
  const quit = () => {
    engineRef.current?.stop();
    setScreen("home");
  };
  const again = () => {
    audio.unlock();
    setScreen("playing");
    requestAnimationFrame(() => {
      engineRef.current?.start(useGame.getState().config, useGame.getState().mode);
    });
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <div className="beach-photo absolute inset-0 bg-cover bg-center" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-bg/16 to-bg/44" />

      {playing ? (
        <canvas ref={canvasRef} className="absolute inset-0 z-[1] h-full w-full touch-none pointer-events-auto" />
      ) : null}

      <div className="pointer-events-none absolute inset-0 z-[2]">
        {bootError ? (
          <div className="pointer-events-auto flex h-full items-center justify-center px-6 text-center">
            <p className="text-sm text-danger">{bootError}</p>
          </div>
        ) : (
          <>
            {screen === "home" ? (
              <HomeScreen
                onPlay={() => {
                  audio.unlock();
                  useGame.getState().setMode("classic");
                  setScreen("setup");
                }}
              />
            ) : null}
            {screen === "setup" ? <SetupScreen onStart={() => startRun("classic")} /> : null}
            {screen === "junior" ? <JuniorScreen onPick={startJunior} /> : null}
            {screen === "how" ? <HowScreen /> : null}
            {screen === "scores" ? <ScoresScreen /> : null}
            {screen === "playing" || screen === "paused" || screen === "over" ? (
              <PlayHud onPause={pause} />
            ) : null}
            {screen === "paused" ? <PauseScreen onResume={resume} onQuit={quit} /> : null}
            {screen === "over" && mode !== "junior" ? (
              <OverScreen onAgain={again} onMenu={() => setScreen("home")} />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}
