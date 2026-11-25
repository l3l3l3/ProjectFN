"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getRawSession, subscribe, type Session } from "./session";

/** undefined = ยังไม่รู้ (กำลัง hydrate), null = ยังไม่ได้ login */
export function useSession(): Session | null | undefined {
  const raw = useSyncExternalStore<string | null | undefined>(
    subscribe,
    getRawSession,
    () => undefined,
  );
  return useMemo(() => {
    if (raw === undefined || raw === null) return raw;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }, [raw]);
}
