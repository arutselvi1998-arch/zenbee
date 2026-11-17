export type Recurrence = {
  frequency: "Daily" | "Weekly" | "Monthly" | "Custom";
  start_date: string;
  time: string;
  weekdays: number[];
  month_day: number;
  interval_hours: number;
  count: number;
};

/** Asia/Kolkata has a fixed UTC+05:30 offset. Returned dates are UTC ISO strings. */
export function occurrences(plan: Recurrence, now = new Date()): string[] {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(plan.start_date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(plan.time)
  )
    return [];
  const start = new Date(`${plan.start_date}T${plan.time}:00+05:30`);
  if (!Number.isFinite(start.getTime())) return [];
  if (plan.frequency === "Weekly" && !plan.weekdays.length) return [];
  if (
    plan.frequency === "Custom" &&
    (!Number.isFinite(plan.interval_hours) || plan.interval_hours < 1)
  )
    return [];
  const result: string[] = [];
  const step =
    plan.frequency === "Custom" ? plan.interval_hours * 3600000 : 86400000;
  // Bound iteration even for schedules whose starting date is far in the past.
  const skip = Math.max(
    0,
    Math.floor((now.getTime() - start.getTime()) / step),
  );
  const limit = Math.max(1, Math.min(30, plan.count));
  for (let i = skip; i < skip + 3700 && result.length < limit; i++) {
    const candidate = new Date(start.getTime() + i * step);
    if (candidate <= now) continue;
    const local = new Date(candidate.getTime() + 19800000);
    if (
      plan.frequency === "Weekly" &&
      !plan.weekdays.includes(local.getUTCDay())
    )
      continue;
    if (plan.frequency === "Monthly" && local.getUTCDate() !== plan.month_day)
      continue;
    result.push(candidate.toISOString());
  }
  return result;
}
