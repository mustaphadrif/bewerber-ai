"use client";

/**
 * NavigationProgress — global navigation feedback for the App Router.
 *
 * Behavior:
 * - Starts on internal <a> clicks (capture phase) and on back/forward.
 * - The AI robot appears immediately when navigation starts.
 * - The progress bar appears shortly after navigation starts.
 * - Navigation is never blocked or delayed by the animation.
 * - Completion is signalled by the root template and/or pathname change.
 * - The robot plays its success state before fading out.
 *
 * Pure visual layer: never blocks clicks or delays navigation.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AiLoadingRobot,
  type RobotPhase,
} from "@/components/motion/ai-loading-robot";

const BAR_DELAY = 150; // ms before the progress bar becomes visible
const HIDE_DELAY = 260; // ms the completed bar stays before fading
const ROBOT_EXIT_DELAY = 820; // ms the robot stays for success + fade-out

type Phase = "idle" | "bar" | "robot" | "done";

export function NavigationProgress() {
  const pathname = usePathname();

  const [phase, setPhase] = useState<Phase>("idle");
  const [robotVisible, setRobotVisible] = useState(false);
  const [robotPhase, setRobotPhase] =
    useState<RobotPhase>("loading");

  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const armedRef = useRef(false);
  const doneRef = useRef(true);
  const robotVisibleRef = useRef(false);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const finish = useCallback(() => {
    if (doneRef.current) return;

    doneRef.current = true;
    armedRef.current = false;
    clearTimers();

    setPhase("done");

    timersRef.current.push(
      setTimeout(() => {
        setPhase("idle");
      }, HIDE_DELAY)
    );

    // Let the robot show its success expression before disappearing.
    if (robotVisibleRef.current) {
      setRobotPhase("success");

      timersRef.current.push(
        setTimeout(() => {
          setRobotVisible(false);
          robotVisibleRef.current = false;
        }, ROBOT_EXIT_DELAY)
      );
    }
  }, [clearTimers]);

  const start = useCallback(() => {
    if (!doneRef.current) return;

    doneRef.current = false;
    armedRef.current = true;

    clearTimers();

    /*
     * Show the robot immediately.
     *
     * The navigation itself is NOT delayed.
     * This only updates the visual loading layer.
     */
    setPhase("robot");
    setRobotPhase("loading");
    setRobotVisible(true);
    robotVisibleRef.current = true;

    /*
     * The progress bar appears slightly later.
     * This keeps the robot visible immediately while
     * avoiding an unnecessarily aggressive progress bar.
     */
    timersRef.current.push(
      setTimeout(() => {
        if (!doneRef.current) {
          setPhase("robot");
        }
      }, BAR_DELAY)
    );
  }, [clearTimers]);

  // Intercept internal link clicks in the capture phase.
  useEffect(() => {
    function onNavStart(event: MouseEvent) {
      const target = event.target as Element | null;

      const anchor = target?.closest?.(
        "a[href]"
      ) as HTMLAnchorElement | null;

      if (!anchor) return;

      // Do not interfere with new-tab navigation.
      if (anchor.target === "_blank") return;

      // Ignore modified clicks.
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const href = anchor.getAttribute("href") ?? "";

      // Only handle internal navigation.
      if (
        !href.startsWith("/") ||
        href.startsWith("//") ||
        href.startsWith("#")
      ) {
        return;
      }

      try {
        const url = new URL(href, window.location.origin);

        // Same pathname = no page navigation.
        if (url.pathname === window.location.pathname) {
          return;
        }
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

  // Completion signal from the root template.
  useEffect(() => {
    window.addEventListener("app:route-entered", finish);

    return () => {
      window.removeEventListener("app:route-entered", finish);
    };
  }, [finish]);

  // Fallback completion when pathname changes.
  useEffect(() => {
    if (armedRef.current) {
      armedRef.current = false;
      finish();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Cleanup on unmount.
  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  const barClass =
    phase === "done"
      ? "bwr-navbar__bar--done"
      : phase === "bar" || phase === "robot"
        ? "bwr-navbar__bar--on"
        : "";

  const visible = phase !== "idle";

  return (
    <div
      className="bwr-navbar flex flex-col items-center"
      aria-hidden="true"
    >
      <div className="bwr-navbar__track w-full">
        <div
          className={`bwr-navbar__bar ${
            visible ? barClass : ""
          }`}
        />
      </div>

      {robotVisible && (
        <div className="bwr-robot-pill bwr-robot-pill--on">
          <AiLoadingRobot
            phase={robotPhase}
            size={40}
          />
        </div>
      )}
    </div>
  );
}
