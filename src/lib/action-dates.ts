const APP_LOCALE = "en-US";

export function formatActionDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString(APP_LOCALE, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function isPlannedAction(isoDate: string): boolean {
  const actionDate = new Date(isoDate);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return actionDate.getTime() > todayEnd.getTime();
}

export function compareActionsByDateDesc(a: { date: string }, b: { date: string }): number {
  return new Date(b.date).getTime() - new Date(a.date).getTime();
}

export function compareActionsByDateAsc(a: { date: string }, b: { date: string }): number {
  return new Date(a.date).getTime() - new Date(b.date).getTime();
}
