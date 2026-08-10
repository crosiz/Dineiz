"use client";
import { useEffect, useRef, useState } from "react";

const stats = [
  { value: 10000, suffix: "+", label: "Daily orders processed" },
  { value: 500, suffix: "+", label: "Active restaurants" },
  { value: 14, suffix: " min", label: "Average setup time" },
  { value: 99.9, suffix: "%", label: "Uptime SLA" },
];

function AnimatedNumber({ value, suffix }: { value: number; suffix: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          const duration = 1200;
          const step = 16;
          const steps = duration / step;
          let current = 0;
          const inc = value / steps;
          const timer = setInterval(() => {
            current = Math.min(current + inc, value);
            setDisplay(parseFloat(current.toFixed(value % 1 !== 0 ? 1 : 0)));
            if (current >= value) clearInterval(timer);
          }, step);
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div ref={ref} className="text-4xl sm:text-5xl font-extrabold text-[#1d1d1f] tracking-tight" style={{ letterSpacing: '-0.04em' }}>
      {display}
      {suffix}
    </div>
  );
}

export function StatsBar() {
  return (
    <section className="bg-white border-y border-[#d2d2d7] py-16">
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {stats.map((s, i) => (
            <div key={s.label} className={`py-8 text-center ${i > 0 ? 'border-l border-[#d2d2d7]' : ''}`}>
              <AnimatedNumber value={s.value} suffix={s.suffix} />
              <div className="text-sm text-[#6e6e73] mt-2 font-medium">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
