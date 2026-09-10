"use client";

import { useEffect, useState } from "react";

// Ticks local time (corrected by server offset) so the page can fire captures
// exactly at targetTimes without waiting for network events (§8–§10).
export function useCaptureSession(targetTimes: number[] | null, offset: number) {
  const [now, setNow] = useState(() => Date.now() + offset);

  useEffect(() => {
    if (!targetTimes) return;
    const id = setInterval(() => setNow(Date.now() + offset), 100);
    return () => clearInterval(id);
  }, [targetTimes, offset]);

  if (!targetTimes) return { now, nextIndex: -1, remainingMs: 0, pastEnd: false };
  let nextIndex = targetTimes.findIndex((t) => t > now);
  if (nextIndex === -1) nextIndex = targetTimes.length; // all due
  const remainingMs = nextIndex < targetTimes.length ? Math.max(0, targetTimes[nextIndex] - now) : 0;
  return { now, nextIndex, remainingMs, pastEnd: nextIndex >= targetTimes.length };
}
