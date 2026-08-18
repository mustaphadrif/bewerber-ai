"use client";

/**
 * AiLoadingRobot — polished, lightweight 3D-style robot (Bewerber AI
 * assistant), visually matching the reference: white rounded body, blue
 * accents, rounded futuristic head, dark face screen, glowing curved eyes,
 * headphone pads, hovering base with glow ring.
 *
 * Built with layered SVG + CSS only (gradients, glow filters, soft shadows) —
 * the closest lightweight 3D look possible without a 3D engine. No external
 * assets, no dependencies. It only mounts during genuinely slow navigations
 * (see NavigationProgress), so it has zero effect on normal page performance.
 *
 * Character timeline (same character throughout, one SVG):
 *   enter → greet (raises hand) → wave (several times, with sparkles)
 *   → laugh (bright eyes + smile + subtle bob) → building (float + arm work
 *   + document blocks, loops) → success (positive expression + check)
 *   → exit (smooth fade).
 *
 * All animation is transform/opacity based and fully disabled under
 * prefers-reduced-motion (globals.css).
 */
import { useEffect, useRef, useState } from "react";

export type RobotPhase = "loading" | "success";

type Stage = "enter" | "greet" | "wave" | "laugh" | "build";

const SEQUENCE: Array<[number, Stage]> = [
  [260, "greet"], // raise hand
  [700, "wave"], // wave several times
  [1900, "laugh"], // short friendly laugh
  [2650, "build"], // working loop until navigation finishes
];

export function AiLoadingRobot({
  phase = "loading",
  size = 40,
  className,
}: {
  phase?: RobotPhase;
  size?: number;
  className?: string;
}) {
  const [stage, setStage] = useState<Stage>("enter");
  const [exiting, setExiting] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Play the greeting → wave → laugh → building sequence once mounted.
  useEffect(() => {
    if (phase !== "loading") return;
    for (const [ms, s] of SEQUENCE) {
      timers.current.push(setTimeout(() => setStage(s), ms));
    }
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };
  }, [phase]);

  // Success: bright expression + check, then smooth exit (parent unmounts).
  useEffect(() => {
    if (phase !== "success") return;
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
    setStage("build");
    timers.current.push(setTimeout(() => setExiting(true), 460));
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current = [];
    };
  }, [phase]);

  const stageClass = stage === "enter" ? "" : `robot3d--${stage}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={`robot3d ${stageClass} ${phase === "success" ? "robot3d--success" : ""} ${exiting ? "robot3d--exit" : ""} ${className ?? ""}`}
    >
      <defs>
        <radialGradient id="bwr-body" cx="35%" cy="26%" r="85%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="62%" stopColor="#eef3f9" />
          <stop offset="100%" stopColor="#d3deeb" />
        </radialGradient>
        <linearGradient id="bwr-blue" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4f8bff" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <radialGradient id="bwr-face" cx="42%" cy="28%" r="90%">
          <stop offset="0%" stopColor="#3d4d68" />
          <stop offset="70%" stopColor="#1c2739" />
          <stop offset="100%" stopColor="#0f172a" />
        </radialGradient>
        <linearGradient id="bwr-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="bwr-band" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
        <filter id="bwr-glow" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="1.7" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="bwr-soft" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1.6" stdDeviation="1.8" floodColor="#0f172a" floodOpacity="0.28" />
        </filter>
      </defs>

      {/* Head */}
      <g className="robot3d__head">
        <rect x="15" y="9" width="34" height="26" rx="13" fill="url(#bwr-body)" stroke="url(#bwr-blue)" strokeWidth="2.4" filter="url(#bwr-soft)" />
        {/* headphone pads */}
        <rect x="10.5" y="14.5" width="5.5" height="12" rx="2.75" fill="url(#bwr-blue)" />
        <rect x="48" y="14.5" width="5.5" height="12" rx="2.75" fill="url(#bwr-blue)" />
        {/* dark face screen */}
        <rect x="21" y="13.5" width="22" height="16" rx="8" fill="url(#bwr-face)" />
        <path d="M23 14.6c4-1.4 8.6-1.8 13.2-1.1l1.7 2.5-3.3 1.1c-4.5-.4-8.9.1-12.7 1.5z" fill="url(#bwr-sheen)" opacity="0.5" />

        {/* eyes — glowing curved arcs (reference expression) */}
        <g className="robot3d__eyes">
          <path d="M24.2 21.4c1.4-1.7 3.9-1.7 5.3 0" stroke="#7ab8ff" strokeWidth="3" strokeLinecap="round" opacity="0.4" filter="url(#bwr-glow)" className="robot3d__eye-glow" />
          <path d="M34.5 21.4c1.4-1.7 3.9-1.7 5.3 0" stroke="#7ab8ff" strokeWidth="3" strokeLinecap="round" opacity="0.4" filter="url(#bwr-glow)" className="robot3d__eye-glow" />
          <path d="M24.2 21.4c1.4-1.7 3.9-1.7 5.3 0" stroke="#e0efff" strokeWidth="1.9" strokeLinecap="round" fill="none" className="robot3d__eye-core" />
          <path d="M34.5 21.4c1.4-1.7 3.9-1.7 5.3 0" stroke="#e0efff" strokeWidth="1.9" strokeLinecap="round" fill="none" className="robot3d__eye-core" />
        </g>

        {/* mouth — smile */}
        <g className="robot3d__mouth">
          <path d="M27.8 25.6c1.7 1.3 3.7 1.3 5.4 0" stroke="#94a3b8" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </g>
      </g>

      {/* Body — rounded, tapering to a hovering base */}
      <g className="robot3d__body">
        <rect x="20" y="38" width="24" height="17" rx="8.5" fill="url(#bwr-body)" stroke="url(#bwr-blue)" strokeWidth="2.4" filter="url(#bwr-soft)" />
        {/* blue band */}
        <path d="M20 49.5c0 4.7 3.8 5.5 8 5.5h8c4.2 0 8-.8 8-5.5v-1.5H20z" fill="url(#bwr-band)" opacity="0.92" />
        {/* chest light */}
        <circle cx="32" cy="43.5" r="2.1" fill="url(#bwr-blue)" filter="url(#bwr-glow)" className="robot3d__chest" />
      </g>

      {/* Hover glow ring (no legs — floating base) */}
      <ellipse cx="32" cy="59" rx="9.5" ry="2.1" fill="#3b82f6" opacity="0.22" filter="url(#bwr-glow)" className="robot3d__halo" />

      {/* Arms — white segments with dark joints */}
      <g className="robot3d__arm robot3d__arm--l">
        <circle cx="15" cy="40" r="2.4" fill="#334155" />
        <rect x="11.5" y="42" width="7" height="12" rx="3.5" fill="url(#bwr-body)" stroke="url(#bwr-blue)" strokeWidth="1.8" filter="url(#bwr-soft)" />
      </g>
      <g className="robot3d__arm robot3d__arm--r">
        <circle cx="49" cy="40" r="2.4" fill="#334155" />
        <rect x="45.5" y="42" width="7" height="12" rx="3.5" fill="url(#bwr-body)" stroke="url(#bwr-blue)" strokeWidth="1.8" filter="url(#bwr-soft)" />
      </g>

      {/* Wave sparkles (visible while waving) */}
      <g className="robot3d__sparkles">
        <path d="M53 24l1.1 2.3 2.3 1.1-2.3 1.1L53 30.8l-1.1-2.3-2.3-1.1 2.3-1.1z" fill="#60a5fa" className="robot3d__sparkle robot3d__sparkle--1" />
        <path d="M58.5 30l.8 1.7 1.7.8-1.7.8-.8 1.7-.8-1.7-1.7-.8 1.7-.8z" fill="#93c5fd" className="robot3d__sparkle robot3d__sparkle--2" />
        <path d="M50.5 32.5l.6 1.3 1.3.6-1.3.6-.6 1.3-.6-1.3-1.3-.6 1.3-.6z" fill="#bfdbfe" className="robot3d__sparkle robot3d__sparkle--3" />
      </g>

      {/* Building blocks / documents (beside the body, stack one by one) */}
      <g className="robot3d__blocks">
        <rect x="38" y="55.4" width="9" height="2.2" rx="1.1" fill="#ffffff" stroke="url(#bwr-blue)" strokeWidth="0.9" className="robot3d__block robot3d__block--1" />
        <rect x="40.4" y="57.9" width="9" height="2.2" rx="1.1" fill="#ffffff" stroke="url(#bwr-blue)" strokeWidth="0.9" className="robot3d__block robot3d__block--2" />
        <rect x="42.8" y="60.4" width="9" height="2.2" rx="1.1" fill="#ffffff" stroke="url(#bwr-blue)" strokeWidth="0.9" className="robot3d__block robot3d__block--3" />
      </g>

      {/* Success check */}
      <g className="robot3d__check">
        <circle cx="32" cy="31" r="13" fill="#059669" opacity="0.14" />
        <path d="M25.5 31.5l4.4 4.4 8.6-9.2" stroke="#10b981" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  );
}
