"use client";

/**
 * NavigationProgress — global, honest navigation feedback for the App Router.
 *
 * Behavior:
 * - Starts on internal <a> clicks (capture phase) and on back/forward.
 * - Extremely fast navigations (< BAR_DELAY) show nothing at all.
 * - Slower navigations show a thin top progress bar (150ms threshold).
 * - Only when loading exceeds ROBOT_DELAY does the small AI robot appear.
 * - Completion is signalled by the root template (app:route-entered) and/or
 *   a pathname change; the bar then fills and everything fades out.
 *
 * Pure visual layer: never blocks clicks or delays navigation.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AiLoadingRobot, type RobotPhase } from "@/components/motion/ai-loading-robot";

const BAR_DELAY = 150; // ms before the progress bar becomes visible
const ROBOT_DELAY = 250; // ms before the robot appears
const HIDE_DELAY = 260; // ms the completed bar stays before fading
const ROBOT_EXIT_DELAY = 820; // ms the robot stays for success + fade-out

type Phase = "idle" | "bar" | "robot" | "done";

export function NavigationProgress() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [robotVisible, setRobotVisible] = useState(false);
  const [robotPhase, setRobotPhase] = useState<RobotPhase>("loading");
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const armedRef = useRef(false); // a navigation is in flight
  const doneRef = useRef(true);
  const robotVisibleRef = useRef(false); // ref mirror for stable callbacks

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    clearTimers();
    setPhase("done");
    timersRef.current.push(setTimeout(() => setPhase("idle"), HIDE_DELAY));
    // Robot: play success expression, then fade out and unmount.
    if (robotVisibleRef.current) {
      setRobotPhase("success");
      timersRef.current.push(setTimeout(() => setRobotVisible(false), ROBOT_EXIT_DELAY));
    }
  }, [clearTimers]);

  const start = useCallback(() => {
    if (!doneRef.current) return; // already navigating
    doneRef.current = false;
    armedRef.current = true;
    clearTimers();
    timersRef.current.push(
      setTimeout(() => {
        if (!doneRef.current) setPhase("bar");
      }, BAR_DELAY),
      setTimeout(() => {
        if (!doneRef.current) {
          setPhase("robot");
          setRobotPhase("loading");
          setRobotVisible(true);
          robotVisibleRef.current = true;
        }
      }, ROBOT_DELAY)
    );
  }, [clearTimers]);

  // Intercept internal link clicks (capture phase, before React handlers).
  useEffect(() => {
    function onNavStart(event: MouseEvent) {
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank") return;
      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("#")) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.pathname === window.location.pathname) return; // same page
      } catch {
        return;
      }
      start();
    }
    function onPopState() {
      start();
    }
    document.addEventListener("click", onNavStart, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onNavStart, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [start]);

  // Completion signal from the root template (new page mounted).
  useEffect(() => {
    window.addEventListener("app:route-entered", finish);
    return () => window.removeEventListener("app:route-entered", finish);
  }, [finish]);

  // Fallback completion: any pathname change during an armed navigation.
  useEffect(() => {
    if (armedRef.current) {
      armedRef.current = false;
      finish();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Cleanup on unmount.
  useEffect(() => clearTimers, [clearTimers]);

  const barClass =
    phase === "done"
      ? "bwr-navbar__bar--done"
      : phase === "bar" || phase === "robot"
        ? "bwr-navbar__bar--on"
        : "";
  const visible = phase !== "idle";

  return (
    <div className="bwr-navbar flex flex-col items-center" aria-hidden="true">
      <div className="bwr-navbar__track w-full">
        <div className={`bwr-navbar__bar ${visible ? barClass : ""}`} />
      </div>
      {robotVisible && (
        <div className="bwr-robot-pill bwr-robot-pill--on">
          <AiLoadingRobot phase={robotPhase} size={40} />
        </div>
      )}
    </div>
  );
}
