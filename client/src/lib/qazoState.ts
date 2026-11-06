import {
  createDefaultQazoState,
  PRAYER_KEYS,
  type PrayerKey,
  qazoAppStateSchema,
  type QazoAppState,
} from "@shared/qazo";

export const LOCAL_STATE_KEY = "qazo-namoz-state-v1";

function storageKey(ownerId?: string) {
  return `${LOCAL_STATE_KEY}:${ownerId ? `account-${ownerId}` : "guest"}`;
}

export function loadLocalQazoState(ownerId?: string): QazoAppState {
  try {
    const raw = localStorage.getItem(storageKey(ownerId));
    if (!raw) return createDefaultQazoState();
    const parsed = qazoAppStateSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : createDefaultQazoState();
  } catch {
    return createDefaultQazoState();
  }
}

export function saveLocalQazoState(state: QazoAppState, ownerId?: string) {
  try {
    localStorage.setItem(storageKey(ownerId), JSON.stringify(state));
  } catch {
    // Private-browsing storage may be unavailable; the current session remains usable.
  }
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function targetForLocalDay(state: QazoAppState, day: Date | string) {
  const key = typeof day === "string" ? day : localDateKey(day);
  const history = [...state.targetHistory].sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate));
  let target = history[0]?.target ?? state.target;
  for (const change of history) {
    if (change.effectiveDate > key) break;
    target = change.target;
  }
  return target;
}

export function countsByPrayer(state: QazoAppState) {
  return Object.fromEntries(PRAYER_KEYS.map(key => [
    key,
    state.records.filter(record => record.prayer === key).length,
  ])) as Record<PrayerKey, number>;
}

export function remainingByPrayer(state: QazoAppState) {
  const completed = countsByPrayer(state);
  return Object.fromEntries(PRAYER_KEYS.map(key => [
    key,
    Math.max(0, state.missed[key] - completed[key]),
  ])) as Record<PrayerKey, number>;
}

export function progressSummary(state: QazoAppState) {
  const completed = countsByPrayer(state);
  const remaining = remainingByPrayer(state);
  const totalMissed = PRAYER_KEYS.reduce((sum, key) => sum + state.missed[key], 0);
  const totalCompleted = PRAYER_KEYS.reduce((sum, key) => sum + Math.min(completed[key], state.missed[key]), 0);
  const totalRemaining = Math.max(0, totalMissed - totalCompleted);
  return {
    completed,
    remaining,
    totalMissed,
    totalCompleted,
    totalRemaining,
    percentage: totalMissed === 0 ? 0 : Math.round((totalCompleted / totalMissed) * 100),
  };
}

export function recordsForLocalDay(state: QazoAppState, day: Date | string) {
  const key = typeof day === "string" ? day : localDateKey(day);
  return state.records.filter(record => {
    const date = new Date(record.completedAt);
    return !Number.isNaN(date.getTime()) && localDateKey(date) === key;
  });
}

export function exportQazoData(state: QazoAppState) {
  const payload = {
    exportedAt: new Date().toISOString(),
    format: "qazo-namoz-v1",
    state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `qazo-namoz-zaxira-${localDateKey()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isoWeekKey(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() + 4 - (copy.getDay() || 7));
  const yearStart = new Date(copy.getFullYear(), 0, 1);
  const week = Math.ceil((((copy.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${copy.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

export function checkAndSendBrowserReminders(
  state: QazoAppState,
  update: (mutator: (current: QazoAppState) => QazoAppState) => void,
) {
  if (typeof window === "undefined" || !("Notification" in window) || Notification.permission !== "granted") return;
  const now = new Date();
  const today = localDateKey(now);
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const summary = progressSummary(state);
  const doneToday = recordsForLocalDay(state, now).length;
  const targetMet = doneToday >= state.target;
  const timeReached = currentTime >= state.preferences.dailyReminderTime;
  let dailySent = false;

  if (state.preferences.dailyReminderEnabled && timeReached && state.preferences.lastDailyNotificationDate !== today) {
    const title = targetMet ? "Bugungi reja bajarildi" : "Qazo rejangiz uchun bir qadam";
    const body = !state.preferences.targetReminderEnabled
      ? "Qazo rejangizga qaytish uchun bugun ham yaxshi imkoniyat."
      : targetMet
      ? `${doneToday} ta Qazo namozini qayd etdingiz. Barakalla!`
      : `${doneToday}/${state.target} ta bajarildi. Qolgan ${summary.totalRemaining.toLocaleString("uz-UZ")} ta Qazo namozi bor.`;
    new Notification(title, { body, tag: `qazo-daily-${today}` });
    dailySent = true;
  }

  const isWeeklyDay = now.getDay() === 0;
  const weekKey = isoWeekKey(now);
  const weeklySent = state.preferences.weeklyReminderEnabled && isWeeklyDay && timeReached && state.preferences.lastWeeklyNotificationWeek !== weekKey;
  if (weeklySent) {
    new Notification("Haftalik Qazo hisoboti", {
      body: `Bu hafta ${state.records.filter(record => {
        const at = new Date(record.completedAt);
        const start = new Date(now);
        start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
        start.setHours(0, 0, 0, 0);
        return at >= start;
      }).length} ta namoz qayd etildi. Har bir qadam muhim.`,
      tag: `qazo-weekly-${weekKey}`,
    });
  }

  if (dailySent || weeklySent) {
    update(current => ({
      ...current,
      preferences: {
        ...current.preferences,
        ...(dailySent ? { lastDailyNotificationDate: today } : {}),
        ...(weeklySent ? { lastWeeklyNotificationWeek: weekKey } : {}),
      },
    }));
  }
}
