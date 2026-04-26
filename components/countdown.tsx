"use client";

import { useEffect, useMemo, useState } from "react";

type CountdownValue = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export function Countdown({ date, time }: { date: string; time: string }) {
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

  return (
    <div className="grid grid-cols-4 gap-2 text-center">
      {[
        ["Días", remaining?.days],
        ["Horas", remaining?.hours],
        ["Min", remaining?.minutes],
        ["Seg", remaining?.seconds]
      ].map(([label, value]) => (
        <div key={label} className="rounded-lg border border-white/25 bg-white/20 px-2 py-3 backdrop-blur">
          <div className="text-2xl font-semibold text-white">
            {typeof value === "number" ? String(value).padStart(2, "0") : "--"}
          </div>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/75">{label}</div>
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
