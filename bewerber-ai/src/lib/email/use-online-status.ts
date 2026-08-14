"use client";

/**
 * Online/offline indicator hook.
 * Uses the browser's online/offline events so the UI always reflects the
 * real connection state (no fake status).
 */
import { useEffect, useState } from "react";

export type ConnectionState = "online" | "offline";

export function useOnlineStatus(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(() =>
    typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "online"
  );

  useEffect(() => {
    function handleOnline() {
      setState("online");
    }
    function handleOffline() {
      setState("offline");
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return state;
}
