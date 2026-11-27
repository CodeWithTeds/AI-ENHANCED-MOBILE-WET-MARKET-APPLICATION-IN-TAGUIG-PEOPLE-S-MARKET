import { useEffect, useRef, useState } from 'react';

/**
 * Ticks current epoch milliseconds every second while `active` is true.
 * Invokes `onExpire` once when transitioning into an expired deadline.
 */
export function useNowTick(
  active: boolean,
  deadlineIso?: string | null,
  onExpire?: () => void,
): number {
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const expiredFiredRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const immediate = setTimeout(() => {
      setNowMs(Date.now());
    }, 0);
    const id = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearTimeout(immediate);
      clearInterval(id);
    };
  }, [active]);

  useEffect(() => {
    if (!active || !deadlineIso || !onExpire) {
      return;
    }

    const deadlineMs = Date.parse(deadlineIso);
    if (Number.isNaN(deadlineMs)) {
      return;
    }

    if (nowMs >= deadlineMs && expiredFiredRef.current !== deadlineIso) {
      expiredFiredRef.current = deadlineIso;
      onExpire();
    }
  }, [active, deadlineIso, nowMs, onExpire]);

  return nowMs;
}
