export function perfLabel(label: string) {
  if (process.env.NODE_ENV === "production") return null;
  return `[KAIS PERF] ${label}-${Math.random().toString(36).slice(2, 8)}`;
}

export function perfStart(label: string) {
  const scopedLabel = perfLabel(label);
  if (scopedLabel) console.time(scopedLabel);
  return scopedLabel;
}

export function perfEnd(label: string | null) {
  if (label) console.timeEnd(label);
}

export async function timed<T>(label: string, promise: PromiseLike<T>): Promise<T> {
  const scopedLabel = perfStart(label);
  try {
    return await promise;
  } finally {
    perfEnd(scopedLabel);
  }
}
