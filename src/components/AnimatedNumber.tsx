"use client";

import { useEffect, useRef, useState } from "react";

export default function AnimatedNumber({
  value,
  format,
  className,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const [pop, setPop] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (value === prevRef.current) return;
    const from = prevRef.current;
    const to = value;
    prevRef.current = value;
    setPop(true);
    const duration = 600;
    const start = performance.now();

    let raf: number;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    const popTimeout = setTimeout(() => setPop(false), 400);
    // requestAnimationFrame is throttled or never fires in a backgrounded/
    // hidden tab, which would otherwise leave `display` stuck on a stale
    // value forever even though prevRef has already moved on. This safety
    // net guarantees the shown number always reaches the true total.
    const settleTimeout = setTimeout(() => setDisplay(to), duration + 100);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(popTimeout);
      clearTimeout(settleTimeout);
    };
  }, [value]);

  return (
    <span className={`numeric ${pop ? "number-pop" : ""} ${className ?? ""}`}>{format(display)}</span>
  );
}
