"use client";

import { Fragment, useEffect, useMemo, useState } from "react";

type CountdownValue = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

type CountdownVariant = "default" | "luxe";

export function Countdown({
  date,
  time,
  compact = false,
  variant = "default"
}: {
  date: string;
  time: string;
  compact?: boolean;
  variant?: CountdownVariant;
}) {
  const target = useMemo(() => new Date(`${date}T${time || "00:00"}`).getTime(), [date, time]);
  const [remaining, setRemaining] = useState<CountdownValue | null>(null);

  useEffect(() => {
    function updateRemaining() {
      setRemaining(getRemainingTime(target));
    }
    updateRemaining();
    const id = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(id);
  }, [target]);

  const cells: Array<[string, number | undefined]> = [
    ["Días", remaining?.days],
    ["Horas", remaining?.hours],
    ["Min", remaining?.minutes],
    ["Seg", remaining?.seconds]
  ];

  if (variant === "luxe") {
    return (
      <div className="flex items-stretch">
        {cells.map(([label, value], i) => (
          <Fragment key={label}>
            <div className="flex flex-1 flex-col items-center px-2 sm:px-4 md:px-5">
              <div className="font-display text-[2.6rem] font-light italic leading-none text-[#f5ecd9] tabular-nums sm:text-5xl md:text-6xl">
                {typeof value === "number" ? String(value).padStart(2, "0") : "--"}
              </div>
              <div className="mt-3 text-[0.58rem] font-semibold uppercase tracking-[0.4em] text-[#d4af37]/85 sm:text-[0.62rem]">
                {label}
              </div>
            </div>
            {i < cells.length - 1 ? (
              <span aria-hidden="true" className="self-center text-3xl text-[#d4af37]/55 sm:text-4xl">·</span>
            ) : null}
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-4 text-center ${compact ? "gap-1.5" : "gap-2"}`}>
      {cells.map(([label, value]) => (
        <div
          key={label}
          className={`rounded-lg border border-white/25 bg-white/20 backdrop-blur ${compact ? "px-2 py-2" : "px-2 py-3"}`}
        >
          <div className={`${compact ? "text-lg" : "text-2xl"} font-semibold text-white`}>
            {typeof value === "number" ? String(value).padStart(2, "0") : "--"}
          </div>
          <div className={`${compact ? "text-[9px]" : "text-[11px]"} uppercase tracking-[0.18em] text-white/75`}>
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}

function getRemainingTime(target: number): CountdownValue {
  const diff = Math.max(0, target - Date.now());
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000)
  };
}
