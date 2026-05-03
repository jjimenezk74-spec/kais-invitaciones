"use client";

import { CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

export function DashboardEventToast({ message }: { message?: string }) {
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, [message]);

  if (!message || !visible) return null;

  return (
    <div className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-900 shadow-[0_18px_55px_rgba(15,23,42,0.18)]">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
        <span>{message}</span>
      </div>
    </div>
  );
}
