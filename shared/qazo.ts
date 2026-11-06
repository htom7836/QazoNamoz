import { z } from "zod";

export const PRAYER_KEYS = ["bomdod", "peshin", "asr", "shom", "xufton"] as const;
export type PrayerKey = (typeof PRAYER_KEYS)[number];
export const MAX_QAZO_RECORDS = 20_000;
export const MAX_QAZO_COUNT = 1_000_000;

export const PRAYER_LABELS: Record<PrayerKey, string> = {
  bomdod: "Bomdod",
  peshin: "Peshin",
  asr: "Asr",
  shom: "Shom",
  xufton: "Xufton",
};

const nonNegativeCount = z.number().int().min(0).max(MAX_QAZO_COUNT);
const prayerCountsSchema = z.object({
  bomdod: nonNegativeCount,
  peshin: nonNegativeCount,
  asr: nonNegativeCount,
  shom: nonNegativeCount,
  xufton: nonNegativeCount,
});
const targetHistoryEntrySchema = z.object({
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  target: z.number().int().min(1).max(500),
}).strict();

export const qazoAppStateSchema = z.object({
  version: z.literal(1),
  setupComplete: z.boolean(),
  missed: prayerCountsSchema,
  target: z.number().int().min(1).max(500),
  targetHistory: z.array(targetHistoryEntrySchema).max(10_000).default([]),
  records: z.array(z.object({
    id: z.string().min(1).max(80),
    prayer: z.enum(PRAYER_KEYS),
    completedAt: z.string().min(1).max(40),
  }).strict()).max(MAX_QAZO_RECORDS),
  calculator: z.object({
    birthDate: z.string().max(10),
    regularStartAge: z.number().int().min(0).max(120).nullable(),
    missedStartAge: z.number().int().min(0).max(120).nullable(),
    daysCount: z.number().int().min(0).max(36500),
    excludedDays: z.number().int().min(0).max(36500),
    selected: z.array(z.enum(PRAYER_KEYS)).max(5),
    exactCounts: prayerCountsSchema,
    exactEnabled: z.object({
      bomdod: z.boolean(),
      peshin: z.boolean(),
      asr: z.boolean(),
      shom: z.boolean(),
      xufton: z.boolean(),
    }),
    method: z.enum(["hanafi", "shafii", "maliki", "hanbali", "other"]),
  }).strict(),
  preferences: z.object({
    dailyReminderEnabled: z.boolean(),
    dailyReminderTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
    targetReminderEnabled: z.boolean(),
    weeklyReminderEnabled: z.boolean(),
    lastDailyNotificationDate: z.string().max(10),
    lastWeeklyNotificationWeek: z.string().max(12),
  }).strict(),
}).strict();

export type QazoAppState = z.infer<typeof qazoAppStateSchema>;

export function createDefaultQazoState(): QazoAppState {
  const now = new Date();
  const effectiveDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return {
    version: 1,
    setupComplete: false,
    missed: { bomdod: 0, peshin: 0, asr: 0, shom: 0, xufton: 0 },
    target: 5,
    targetHistory: [{ effectiveDate, target: 5 }],
    records: [],
    calculator: {
      birthDate: "",
      regularStartAge: null,
      missedStartAge: null,
      daysCount: 0,
      excludedDays: 0,
      selected: [...PRAYER_KEYS],
      exactCounts: { bomdod: 0, peshin: 0, asr: 0, shom: 0, xufton: 0 },
      exactEnabled: { bomdod: false, peshin: false, asr: false, shom: false, xufton: false },
      method: "hanafi",
    },
    preferences: {
      dailyReminderEnabled: false,
      dailyReminderTime: "20:30",
      targetReminderEnabled: true,
      weeklyReminderEnabled: false,
      lastDailyNotificationDate: "",
      lastWeeklyNotificationWeek: "",
    },
  };
}
