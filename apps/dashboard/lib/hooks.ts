import { useState, useEffect } from "react";

/**
 * A hook that forces a component to re-render at a given interval.
 * Useful for live timers (e.g. shift durations, break times).
 * 
 * @param ms Interval in milliseconds (default: 60_000, 1 minute)
 */
export function useTick(ms = 60_000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
  
  return tick;
}
