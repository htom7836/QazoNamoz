import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Bell, BookOpen, CalendarDays,
  Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Cloud, Heart,
  Home as HomeIcon, LogIn, LogOut, Moon, Plus, ShieldCheck, Sparkles, Sun, Target,
  Undo2, UserRound, X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  PRAYER_KEYS, PRAYER_LABELS, createDefaultQazoState, MAX_QAZO_RECORDS, MAX_QAZO_COUNT,
  type PrayerKey, type QazoAppState,
} from "@shared/qazo";
import {
  checkAndSendBrowserReminders, countsByPrayer, exportQazoData,
  loadLocalQazoState, localDateKey, progressSummary, recordsForLocalDay,
  remainingByPrayer, saveLocalQazoState, targetForLocalDay,
} from "@/lib/qazoState";
import { startLogin } from "@/const";
import { useTheme as useThemeContext } from "@/contexts/ThemeContext";

const ActivityChart = lazy(() => import("@/components/ActivityChart"));

type Section = "home" | "calculator" | "record" | "stats" | "profile";
const METHOD_LABELS: Record<QazoAppState["calculator"]["method"], string> = {
  hanafi: "Hanafiy", shafii: "Shofe’iy", maliki: "Molikiy", hanbali: "Hanbaliy", other: "Boshqa / o‘zim kiritaman",
};
const NAV: { id: Section; label: string; icon: typeof HomeIcon }[] = [
  { id: "home", label: "Bosh sahifa", icon: HomeIcon },
  { id: "calculator", label: "Qazo hisoblash", icon: Activity },
  { id: "record", label: "Qayd etish", icon: Check },
  { id: "stats", label: "Statistika", icon: Target },
  { id: "profile", label: "Profil", icon: UserRound },
];
const MONTH_NAMES = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
const WEEKDAYS = ["Du", "Se", "Cho", "Pa", "Ju", "Sha", "Ya"];
const PRAYER_META: Record<PrayerKey, { short: string; time: string }> = {
  bomdod: { short: "B", time: "Tong" },
  peshin: { short: "P", time: "Peshin" },
  asr: { short: "A", time: "Kunning ikkinchi yarmi" },
  shom: { short: "Sh", time: "Quyosh botishi" },
  xufton: { short: "X", time: "Kechqurun" },
};

function localWeekRecords(state: QazoAppState, now = new Date()) {
  const start = new Date(now);
  const mondayOffset = (now.getDay() + 6) % 7;
  start.setDate(now.getDate() - mondayOffset);
  start.setHours(0, 0, 0, 0);
  return state.records.filter(record => new Date(record.completedAt) >= start);
}

function getEstimate(state: QazoAppState): Record<PrayerKey, number> {
  const calc = state.calculator;
  const countedDays = Math.max(0, calc.daysCount - calc.excludedDays);
  return Object.fromEntries(PRAYER_KEYS.map(key => [
    key,
    !calc.selected.includes(key) ? 0 : calc.exactEnabled[key]
      ? calc.exactCounts[key]
      : countedDays,
  ])) as Record<PrayerKey, number>;
}

function presetForTarget(target: number) {
  if (target === 1) return "1 ta";
  if (target === 10) return "10 ta";
  if (target === 5) return "5 ta";
  return "custom";
}

function hasQazoProgress(state: QazoAppState) {
  return state.setupComplete || state.records.length > 0 || state.target !== 5
    || Object.values(state.missed).some(count => count > 0)
    || state.preferences.dailyReminderEnabled || state.preferences.weeklyReminderEnabled
    || state.calculator.daysCount > 0
    || PRAYER_KEYS.some(key => state.calculator.exactEnabled[key] && state.calculator.exactCounts[key] > 0);
}

function ProgressRing({ value, size = 124 }: { value: number; size?: number }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(value, 100) / 100) * circumference;
  return (
    <div className="progress-ring" style={{ width: size, height: size }} aria-label={`${value}% bajarildi`}>
      <svg viewBox="0 0 120 120" role="img" aria-hidden="true">
        <circle className="ring-track" cx="60" cy="60" r={radius} />
        <circle className="ring-value" cx="60" cy="60" r={radius} strokeDasharray={circumference} strokeDashoffset={offset} />
      </svg>
      <div className="ring-label"><strong>{value}%</strong><span>bajarildi</span></div>
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon, tone = "green" }: {
  label: string; value: string | number; detail?: string; icon: typeof Target; tone?: "green" | "gold" | "soft";
}) {
  return (
    <div className={`metric-card metric-${tone}`}>
      <div className="metric-head"><span>{label}</span><span className="metric-icon"><Icon size={17} /></span></div>
      <strong className="metric-value">{value}</strong>
      {detail && <span className="metric-detail">{detail}</span>}
    </div>
  );
}

function PrayerRow({ prayer, missed, completed, remaining, onComplete, compact = false }: {
  prayer: PrayerKey; missed: number; completed: number; remaining: number; onComplete: () => void; compact?: boolean;
}) {
  const percent = missed === 0 ? 0 : Math.min(100, Math.round((completed / missed) * 100));
  return (
    <article className={`prayer-row ${compact ? "prayer-row-compact" : ""}`}>
      <div className="prayer-mark" aria-hidden="true">{PRAYER_META[prayer].short}</div>
      <div className="prayer-info">
        <div className="prayer-title-line"><h3>{PRAYER_LABELS[prayer]}</h3><span>{completed.toLocaleString("uz-UZ")} / {missed.toLocaleString("uz-UZ")}</span></div>
        <div className="prayer-progress"><span style={{ width: `${percent}%` }} /></div>
        <div className="prayer-subline"><span>{PRAYER_META[prayer].time}</span><span>{remaining.toLocaleString("uz-UZ")} ta qoldi</span></div>
      </div>
      <button className="icon-button prayer-add" onClick={onComplete} disabled={remaining <= 0} aria-label={`${PRAYER_LABELS[prayer]} qazosini qayd etish`} title="Bajarildi">
        {remaining > 0 ? <Plus size={18} /> : <Check size={18} />}
      </button>
    </article>
  );
}

function PageHeading({ eyebrow, title, description, action }: {
  eyebrow: string; title: string; description: string; action?: ReactNode;
}) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>{action}</div>;
}

function EmptyState({ icon: Icon, title, description, action }: {
  icon: typeof BookOpen; title: string; description: string; action?: ReactNode;
}) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export default function Home() {
  const auth = useAuth();
  const userId = auth.user?.openId ?? null;
  const { theme, toggleTheme } = useThemeContext();
  const [section, setSection] = useState<Section>("home");
  const [state, setState] = useState<QazoAppState>(() => loadLocalQazoState());
  const [stateOwner, setStateOwner] = useState<string | null>(null);
  const [cloudOwner, setCloudOwner] = useState<string | null>(null);
  const [cloudErrorFor, setCloudErrorFor] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => localDateKey());
  const [calculatorStep, setCalculatorStep] = useState(1);
  const [goalDraft, setGoalDraft] = useState(String(state.target));
  const [goalChoice, setGoalChoice] = useState(() => presetForTarget(state.target));
  const hydratedOwner = useRef<string | null>(null);
  const remote = trpc.qazo.load.useQuery({ expectedOpenId: userId ?? "" }, {
    enabled: auth.isAuthenticated && Boolean(userId), retry: false, refetchOnMount: "always", refetchOnWindowFocus: false,
  });
  const saveMutation = trpc.qazo.save.useMutation({
    onError: () => toast.error("Bulutga saqlash amalga oshmadi. Internetni tekshirib, qayta urinib ko‘ring."),
  });
  const updateState = useCallback((mutator: (current: QazoAppState) => QazoAppState) => {
    setState(current => mutator(current));
  }, []);

  useEffect(() => {
    if (!userId) {
      hydratedOwner.current = null;
      setCloudOwner(null);
      setCloudErrorFor(null);
      setStateOwner(null);
      const guestState = loadLocalQazoState();
      setState(guestState);
      setGoalDraft(String(guestState.target));
      setGoalChoice(presetForTarget(guestState.target));
      return;
    }
    if (hydratedOwner.current === userId) return;
    const accountLocal = loadLocalQazoState(userId);
    setStateOwner(userId);
    setCloudOwner(null);
    setCloudErrorFor(null);
    setState(accountLocal);
    setGoalDraft(String(accountLocal.target));
    setGoalChoice(presetForTarget(accountLocal.target));
    if (remote.isSuccess && !remote.isFetching && remote.data.ownerOpenId === userId) {
      let next = remote.data.state ?? accountLocal;
      if (!remote.data.state && !hasQazoProgress(accountLocal)) {
        const guestState = loadLocalQazoState();
        if (hasQazoProgress(guestState) && window.confirm("Mehmon rejimidagi Qazo ma’lumotlarini hozir kirgan akkauntingizga ko‘chirasizmi? Akkauntda hali saqlangan Qazo ma’lumoti yo‘q.")) {
          next = guestState;
          toast.success("Mehmon ma’lumotlari akkauntga ko‘chirilmoqda");
        }
      }
      setState(next);
      setGoalDraft(String(next.target));
      setGoalChoice(presetForTarget(next.target));
      saveLocalQazoState(next, userId);
      hydratedOwner.current = userId;
      setCloudOwner(userId);
      setCloudErrorFor(null);
    } else if (remote.isError) {
      setCloudErrorFor(userId);
    }
  }, [userId, remote.isSuccess, remote.isError, remote.isFetching, remote.dataUpdatedAt]);

  useEffect(() => {
    if (!auth.isAuthenticated) {
      if (stateOwner === null) saveLocalQazoState(state);
      return;
    }
    if (!userId || stateOwner !== userId) return;
    if (cloudOwner !== userId) {
      if (cloudErrorFor === userId) saveLocalQazoState(state, userId);
      return;
    }
    saveLocalQazoState(state, userId);
    const timer = window.setTimeout(() => saveMutation.mutate(state), 600);
    return () => window.clearTimeout(timer);
  }, [state, stateOwner, auth.isAuthenticated, userId, cloudOwner, cloudErrorFor]);

  const totals = useMemo(() => progressSummary(state), [state]);
  const today = useMemo(() => recordsForLocalDay(state, new Date()), [state]);
  const todayCount = today.length;
  const weekCount = useMemo(() => localWeekRecords(state).length, [state]);
  const prayerCounts = useMemo(() => countsByPrayer(state), [state]);
  const remaining = useMemo(() => remainingByPrayer(state), [state]);
  const estimate = useMemo(() => getEstimate(state), [state]);
  const cloudLoading = auth.isAuthenticated && Boolean(userId) && cloudOwner !== userId && cloudErrorFor !== userId && remote.isFetching;

  useEffect(() => {
    if (!state.preferences.dailyReminderEnabled && !state.preferences.weeklyReminderEnabled) return;
    const run = () => checkAndSendBrowserReminders(state, updateState);
    run();
    const timer = window.setInterval(run, 15_000);
    window.addEventListener("focus", run);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", run);
    };
  }, [state, updateState]);

  const completePrayer = (prayer: PrayerKey) => {
    if (remaining[prayer] <= 0) return;
    if (state.records.length >= MAX_QAZO_RECORDS) {
      toast.error(`Qaydlar chegarasi (${MAX_QAZO_RECORDS.toLocaleString("uz-UZ")}) to‘ldi. Davom etishdan oldin zaxira nusxa oling.`);
      return;
    }
    updateState(current => ({
      ...current,
      records: [...current.records, { id: crypto.randomUUID(), prayer, completedAt: new Date().toISOString() }],
    }));
    toast.success(`${PRAYER_LABELS[prayer]} qazosini qayd etdik`);
  };

  const removeRecord = (id: string) => {
    updateState(current => ({ ...current, records: current.records.filter(record => record.id !== id) }));
    toast.success("Qayd yangilandi");
  };

  const undoLastRecord = () => {
    if (!state.records.length) return;
    updateState(current => ({ ...current, records: current.records.slice(0, -1) }));
    toast("Oxirgi qayd bekor qilindi", { icon: <Undo2 size={16} /> });
  };

  const changeCalculator = (patch: Partial<QazoAppState["calculator"]>) => {
    updateState(current => ({ ...current, calculator: { ...current.calculator, ...patch } }));
  };

  const saveCalculation = () => {
    const completed = countsByPrayer(state);
    const missed = Object.fromEntries(PRAYER_KEYS.map(key => [key, completed[key] + estimate[key]])) as QazoAppState["missed"];
    if (PRAYER_KEYS.some(key => missed[key] > MAX_QAZO_COUNT)) {
      toast.error(`Har bir namoz turi uchun eng ko‘p hisob ${MAX_QAZO_COUNT.toLocaleString("uz-UZ")} ta. Aniq sonlarni kamaytiring.`);
      return;
    }
    updateState(current => ({
      ...current,
      setupComplete: true,
      missed,
    }));
    toast.success("Hisob saqlandi. Joriy qayd etilgan namozlaringiz saqlab qolindi.");
    setSection("home");
  };

  const enableDailyReminder = async () => {
    if (!("Notification" in window)) {
      toast.error("Bu brauzer bildirishnomalarni qo‘llab-quvvatlamaydi.");
      return;
    }
    let permission = Notification.permission;
    if (permission !== "granted") permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.error("Bildirishnoma ruxsati berilmadi. Brauzer sozlamalaridan ruxsat berishingiz mumkin.");
      return;
    }
    const now = new Date();
    const selectedTime = state.preferences.dailyReminderTime;
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    updateState(current => ({
      ...current,
      preferences: {
        ...current.preferences,
        dailyReminderEnabled: true,
        ...(currentTime >= selectedTime ? { lastDailyNotificationDate: localDateKey(now) } : {}),
      },
    }));
    toast.success("Har kungi eslatma yoqildi. Brauzer sahifasini ochiq qoldiring.");
  };

  const toggleWeeklyReminder = async () => {
    if (!state.preferences.weeklyReminderEnabled) {
      if (!("Notification" in window)) { toast.error("Bu brauzer bildirishnomalarni qo‘llab-quvvatlamaydi."); return; }
      let permission = Notification.permission;
      if (permission !== "granted") permission = await Notification.requestPermission();
      if (permission !== "granted") { toast.error("Haftalik xabarnoma uchun brauzer ruxsati kerak."); return; }
    }
    updateState(current => ({ ...current, preferences: { ...current.preferences, weeklyReminderEnabled: !current.preferences.weeklyReminderEnabled } }));
  };

  const signIn = () => {
    try { startLogin(); } catch { toast.error("Kirish oynasini ochib bo‘lmadi. Keyinroq urinib ko‘ring."); }
  };

  const exportData = () => {
    exportQazoData(state);
    toast.success("Zaxira fayli yuklab olindi");
  };

  const resetData = () => {
    if (!window.confirm("Barcha hisoblangan miqdorlar va qaydlar o‘chiriladi. Davom etasizmi? Bu amalni ortga qaytarib bo‘lmaydi.")) return;
    const fresh = createDefaultQazoState();
    setState(fresh);
    setGoalDraft(String(fresh.target));
    setGoalChoice(presetForTarget(fresh.target));
    saveLocalQazoState(fresh, auth.isAuthenticated ? userId ?? undefined : undefined);
    toast.success("Qaydlar tozalandi");
  };

  const setGoal = (value: number, choice = "custom") => {
    if (!Number.isFinite(value) || value < 1 || value > 500) return;
    const normalized = Math.floor(value);
    const todayKey = localDateKey();
    updateState(current => {
      let history = current.targetHistory;
      if (history.length === 0) {
        const recordDates = current.records.map(record => localDateKey(new Date(record.completedAt))).sort();
        history = [{ effectiveDate: recordDates[0] ?? todayKey, target: current.target }];
      }
      const targetHistory = [...history.filter(change => change.effectiveDate !== todayKey), { effectiveDate: todayKey, target: normalized }]
        .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))
        .slice(-10_000);
      return { ...current, target: normalized, targetHistory };
    });
    setGoalDraft(String(normalized));
    setGoalChoice(choice);
  };

  const changeMonth = (delta: number) => setMonth(current => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (monthStart.getDay() + 6) % 7;
  const calendarStart = new Date(monthStart);
  calendarStart.setDate(monthStart.getDate() - mondayOffset);
  const calendarDays = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);
    date.setDate(calendarStart.getDate() + index);
    return date;
  });

  const dateLabel = new Intl.DateTimeFormat("uz-UZ", { weekday: "long", day: "numeric", month: "long" }).format(new Date(`${selectedDay}T12:00:00`));
  const selectedRecords = recordsForLocalDay(state, selectedDay).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const recentRecords = [...state.records].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 6);
  const chartDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    return { day: new Intl.DateTimeFormat("uz-UZ", { weekday: "short" }).format(date), soni: recordsForLocalDay(state, date).length };
  });
  const monthlyRecords = state.records.filter(record => {
    const date = new Date(record.completedAt);
    return date.getFullYear() === new Date().getFullYear() && date.getMonth() === new Date().getMonth();
  });
  const daysToFinish = totals.totalRemaining === 0 ? 0 : Math.ceil(totals.totalRemaining / state.target);

  if (auth.loading || (auth.isAuthenticated ? stateOwner !== userId : stateOwner !== null)) {
    return <div className="loading-screen" role="status"><div className="loading-mark"><span>ق</span></div><p>Ma’lumotlaringiz xavfsiz yuklanmoqda…</p></div>;
  }

  if (cloudLoading) {
    return <div className="loading-screen"><div className="loading-mark"><span>ق</span></div><p>Ma’lumotlar yuklanmoqda…</p></div>;
  }

  return (
    <div className="app-shell">
      <aside className="side-rail">
        <div className="brand-lockup"><div className="brand-mark"><span>ق</span></div><div><strong>Qazo Namoz</strong><small>Har bir qadam muhim</small></div></div>
        <div className="rail-label">MENYU</div>
        <nav className="side-nav" aria-label="Asosiy navigatsiya">
          {NAV.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${section === id ? "nav-active" : ""}`} onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined}><Icon size={19} /><span>{label}</span>{id === "record" && todayCount > 0 && <span className="nav-count">{todayCount}</span>}</button>)}
        </nav>
        <div className="rail-bottom"><div className="rail-quote"><span className="quote-star">✳</span><p>“Oz bo‘lsa ham, muntazam amal eng suyuklidir.”</p><small>— Hadis mazmuni</small></div><div className="privacy-note"><ShieldCheck size={15} /><span>Ma’lumotlaringiz o‘zingizniki</span></div></div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => setSection("home")} aria-label="Bosh sahifaga"><span className="brand-mark small"><span>ق</span></span><strong>Qazo Namoz</strong></button>
          <div className="topbar-right">
            <span className={`sync-badge ${auth.isAuthenticated && cloudOwner === userId ? "sync-cloud" : "sync-local"}`}>
              {auth.isAuthenticated && cloudOwner === userId ? <Cloud size={14} /> : <ShieldCheck size={14} />}
              {auth.isAuthenticated && cloudOwner === userId ? "Bulut bilan sinxron" : "Qurilmada saqlanmoqda"}
            </span>
            {toggleTheme && <button className="icon-button top-icon" onClick={toggleTheme} aria-label={theme === "dark" ? "Yorug‘ mavzu" : "Qorong‘i mavzu"}>{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>}
            {auth.isAuthenticated ? <button className="profile-chip" onClick={() => setSection("profile")}><span className="avatar">{(auth.user?.name?.[0] ?? "F").toUpperCase()}</span><span className="profile-name">{auth.user?.name ?? "Foydalanuvchi"}</span><ChevronDown size={14} /></button> : <button className="button button-outline sign-in-top" onClick={signIn}><LogIn size={16} /> Kirish</button>}
          </div>
        </header>

        {cloudErrorFor === userId && auth.isAuthenticated && <div className="sync-warning"><Cloud size={16} /><span>Bulut bilan bog‘lanib bo‘lmadi. Qurilmadagi nusxa saqlanmoqda.</span><button onClick={() => { setCloudErrorFor(null); void remote.refetch(); }}>Qayta urinish</button></div>}
        <main className="content-area">
          {section === "home" && <>
            <PageHeading eyebrow={new Intl.DateTimeFormat("uz-UZ", { weekday: "long", day: "numeric", month: "long" }).format(new Date())} title="Assalomu alaykum!" description="Bugun ham kichik bir qadam bilan davom eting." action={<button className="button button-primary heading-action" onClick={() => setSection("record")}><Plus size={17} /> Qazo qayd etish</button>} />
            {!state.setupComplete && totals.totalMissed === 0 && <div className="setup-callout"><div className="setup-callout-icon"><Sparkles size={20} /></div><div><strong>Shaxsiy hisobingizni boshlang</strong><p>O‘tkazib yuborilgan namozlaringizni o‘zingiz tanlagan taxmin asosida kiriting.</p></div><button className="button button-dark" onClick={() => setSection("calculator")}>Hisoblash <ArrowRight size={16} /></button></div>}
            <div className="overview-grid">
              <section className="overview-card progress-overview"><div className="overview-copy"><p className="eyebrow">UMUMIY NATIJA</p><h2>Yo‘lingizdagi<br />taraqqiyot</h2><p className="muted">Har bir bajarilgan namoz maqsadga yaqinlashtiradi.</p><div className="overview-legend"><span><i className="legend-dot green-dot" /> Bajarildi <b>{totals.totalCompleted.toLocaleString("uz-UZ")}</b></span><span><i className="legend-dot gold-dot" /> Qolgan <b>{totals.totalRemaining.toLocaleString("uz-UZ")}</b></span></div></div><ProgressRing value={totals.percentage} /></section>
              <section className="daily-card"><div className="daily-card-top"><div><span className="eyebrow light-eyebrow">BUGUNGI REJA</span><h2>Barqarorlik<br />harakatdan boshlanadi</h2></div><div className="target-icon"><Target size={19} /></div></div><div className="daily-progress-line"><span style={{ width: `${Math.min(100, (todayCount / state.target) * 100)}%` }} /></div><div className="daily-count-line"><strong>{todayCount}<small> / {state.target} namoz</small></strong><span>{todayCount >= state.target ? "Maqsad bajarildi" : `${Math.max(0, state.target - todayCount)} ta qoldi`}</span></div><button className="daily-cta" onClick={() => setSection("record")}>Bugungi qaydlarni ko‘rish <ArrowRight size={15} /></button></section>
            </div>
            <div className="metric-grid">
              <Metric label="Jami qazo" value={totals.totalMissed.toLocaleString("uz-UZ")} detail="Hisobingiz bo‘yicha" icon={BookOpen} tone="soft" />
              <Metric label="Bajarildi" value={totals.totalCompleted.toLocaleString("uz-UZ")} detail="Barcha qaydlar" icon={Check} tone="green" />
              <Metric label="Qolgan" value={totals.totalRemaining.toLocaleString("uz-UZ")} detail="Bosqichma-bosqich" icon={Heart} tone="gold" />
              <Metric label="Haftalik" value={weekCount.toLocaleString("uz-UZ")} detail={`Maqsad: ${state.target * 7} ta`} icon={CalendarDays} tone="soft" />
            </div>
            <section className="section-block"><div className="section-title-row"><div><p className="eyebrow">BESH VAQT NAMOZ</p><h2>Namozlar bo‘yicha</h2></div><button className="text-button" onClick={() => setSection("calculator")}>Hisobni ko‘rish <ArrowRight size={15} /></button></div><div className="prayer-list">{PRAYER_KEYS.map(key => <PrayerRow key={key} prayer={key} missed={state.missed[key]} completed={prayerCounts[key]} remaining={remaining[key]} onComplete={() => completePrayer(key)} />)}</div></section>
            <section className="section-block recent-section"><div className="section-title-row"><div><p className="eyebrow">SO‘NGGI FAOLIYAT</p><h2>Yaqinda qayd etilgan</h2></div><button className="text-button" onClick={() => setSection("record")}>Barchasi <ArrowRight size={15} /></button></div>{recentRecords.length ? <div className="recent-list">{recentRecords.slice(0, 4).map(record => <RecordLine key={record.id} record={record} onRemove={() => removeRecord(record.id)} />)}</div> : <div className="mini-empty">Hozircha qayd yo‘q. Birinchi bajarilgan namozingizni qo‘shing.</div>}</section>
            <footer className="soft-footer"><span>✳</span> Shoshilmang. Izchil davom eting.</footer>
          </>}

          {section === "calculator" && <>
            <PageHeading eyebrow="SHAXSIY HISOB" title="Qazo hisoblash" description="Hisobingizni o‘zingiz bilgan ma’lumotlarga tayangan holda kiriting." />
            <div className="notice-card"><ShieldCheck size={18} /><div><strong>Bu faqat taxminiy hisob</strong><p>Yosh bo‘yicha kunlarni avtomatik ravishda qazo deb hisoblamaymiz. Ishonchli diniy ilm egasi bilan maslahatlashib, zarur bo‘lsa sonlarni qo‘lda tuzating.</p></div></div>
            <div className="calculator-layout">
              <div className="form-card">
                <div className="wizard-steps" role="tablist" aria-label="Qazo hisoblash bosqichlari">
                  {[{ number: 1, label: "Davr" }, { number: 2, label: "Namozlar" }, { number: 3, label: "Miqdor" }].map(item => <button key={item.number} role="tab" aria-selected={calculatorStep === item.number} className={`wizard-step ${calculatorStep === item.number ? "wizard-step-active" : ""} ${calculatorStep > item.number ? "wizard-step-done" : ""}`} onClick={() => setCalculatorStep(item.number)}><span>{calculatorStep > item.number ? <Check size={13} /> : `0${item.number}`}</span>{item.label}</button>)}
                </div>
                {calculatorStep === 1 && <div className="wizard-panel"><div className="form-section-heading"><span className="step-number">01</span><div><h2>Vaqt oralig‘i</h2><p>Yosh ma’lumotlari kontekst beradi, o‘z-o‘zidan qazo sonini belgilamaydi.</p></div></div>
                  <div className="form-grid"><label className="field"><span>Tug‘ilgan sana <small>(ixtiyoriy)</small></span><input type="date" value={state.calculator.birthDate} onChange={event => changeCalculator({ birthDate: event.target.value })} /></label><label className="field"><span>Namozni muntazam boshlagan yosh <small>(ixtiyoriy)</small></span><input type="number" min="0" max="120" placeholder="Masalan, 15" value={state.calculator.regularStartAge ?? ""} onChange={event => changeCalculator({ regularStartAge: event.target.value === "" ? null : Math.min(120, Math.max(0, Math.floor(Number(event.target.value) || 0))) })} /></label><label className="field"><span>Namoz qoldira boshlagan taxminiy yosh <small>(ixtiyoriy)</small></span><input type="number" min="0" max="120" placeholder="Masalan, 18" value={state.calculator.missedStartAge ?? ""} onChange={event => changeCalculator({ missedStartAge: event.target.value === "" ? null : Math.min(120, Math.max(0, Math.floor(Number(event.target.value) || 0))) })} /></label><label className="field"><span>Hisobga olinadigan qazo kunlari</span><input type="number" min="0" max="36500" placeholder="Faqat o‘zingiz taxmin qilgan kunlar" value={state.calculator.daysCount || ""} onChange={event => changeCalculator({ daysCount: Math.min(36500, Math.max(0, Math.floor(Number(event.target.value) || 0))) })} /><small>Yosh oralig‘idan avtomatik hisoblanmaydi.</small></label><label className="field"><span>Muntazam o‘qilgan davrlar, kunlarda</span><input type="number" min="0" max={state.calculator.daysCount} placeholder="Ayriladigan kunlar" value={state.calculator.excludedDays || ""} onChange={event => changeCalculator({ excludedDays: Math.min(state.calculator.daysCount, Math.max(0, Math.floor(Number(event.target.value) || 0))) })} /><small>Bu davrlar taxminiy qazo kunlaridan ayriladi.</small></label><label className="field"><span>Tanlangan fiqhiy yo‘nalish</span><select value={state.calculator.method} onChange={event => changeCalculator({ method: event.target.value as QazoAppState["calculator"]["method"] })}><option value="hanafi">Hanafiy</option><option value="shafii">Shofe’iy</option><option value="maliki">Molikiy</option><option value="hanbali">Hanbaliy</option><option value="other">Boshqa / o‘zim kiritaman</option></select><small>Tanlov shaxsiy yondashuvingizni natijada saqlaydi. Hisob tanlangan besh farz namoz va siz kiritgan kunlarga asoslanadi; fiqhiy tafsilotlar uchun aniq sonlarni qo‘lda kiriting.</small></label></div>
                  <div className="wizard-controls"><span>1 / 3</span><button className="button button-primary" onClick={() => setCalculatorStep(2)}>Davom etish <ArrowRight size={15} /></button></div>
                </div>}
                {calculatorStep === 2 && <div className="wizard-panel"><div className="form-section-heading"><span className="step-number">02</span><div><h2>Qaysi namozlar?</h2><p>Faqat hisobga olmoqchi bo‘lgan farz namozlarni belgilang.</p></div></div>
                  <div className="prayer-select-grid">{PRAYER_KEYS.map(key => { const selected = state.calculator.selected.includes(key); return <button key={key} className={`prayer-select ${selected ? "selected" : ""}`} aria-pressed={selected} onClick={() => changeCalculator({ selected: selected ? state.calculator.selected.filter(item => item !== key) : [...state.calculator.selected, key] })}><span className="check-box">{selected && <Check size={14} />}</span>{PRAYER_LABELS[key]}</button>; })}</div>
                  <p className="helper-note wizard-note">Bu dastur avtomatik ravishda farz bo‘lmagan namozlarni hisobga qo‘shmaydi.</p>
                  <div className="wizard-controls"><button className="button button-outline" onClick={() => setCalculatorStep(1)}><ArrowLeft size={15} /> Orqaga</button><span>2 / 3</span><button className="button button-primary" onClick={() => setCalculatorStep(3)}>Davom etish <ArrowRight size={15} /></button></div>
                </div>}
                {calculatorStep === 3 && <div className="wizard-panel"><div className="form-section-heading"><span className="step-number">03</span><div><h2>Aniq sonlarni kiriting</h2><p>Ma’lum sonlaringiz bo‘lsa, taxmin o‘rniga qo‘lda kiriting.</p></div></div>
                  <p className="helper-note">Aniq son yoqilmagan tanlangan namozlarda kunlar bo‘yicha taxmin ishlatiladi.</p>
                  <div className="exact-counts-grid">{PRAYER_KEYS.map(key => <label key={key} className={`exact-count ${state.calculator.selected.includes(key) ? "" : "field-disabled"}`}><span>{PRAYER_LABELS[key]}</span><div><input type="checkbox" checked={state.calculator.exactEnabled[key]} disabled={!state.calculator.selected.includes(key)} onChange={event => changeCalculator({ exactEnabled: { ...state.calculator.exactEnabled, [key]: event.target.checked } })} aria-label={`${PRAYER_LABELS[key]} uchun aniq sonni yoqish`} /><input type="number" min="0" max="1000000" disabled={!state.calculator.selected.includes(key) || !state.calculator.exactEnabled[key]} value={state.calculator.exactCounts[key]} onChange={event => changeCalculator({ exactCounts: { ...state.calculator.exactCounts, [key]: Math.min(MAX_QAZO_COUNT, Math.max(0, Math.floor(Number(event.target.value) || 0))) } })} /></div></label>)}</div>
                  <div className="calculator-result"><div><span className="eyebrow">TAXMINIY HISOB · {METHOD_LABELS[state.calculator.method]}</span><h3>Natija</h3><p>{Math.max(0, state.calculator.daysCount - state.calculator.excludedDays).toLocaleString("uz-UZ")} hisobga olingan kun × tanlangan farz namozlar</p></div><div className="result-counts">{PRAYER_KEYS.map(key => <span key={key}>{PRAYER_LABELS[key]} <b>{estimate[key].toLocaleString("uz-UZ")}</b></span>)}</div></div>
                  <div className="wizard-controls"><button className="button button-outline" onClick={() => setCalculatorStep(2)}><ArrowLeft size={15} /> Orqaga</button><span>3 / 3</span><button className="button button-primary" onClick={saveCalculation}><Check size={17} /> Hisobni saqlash</button></div>
                  <p className="wizard-save-note">Saqlash joriy bajarilgan qaydlaringizni saqlab qoladi.</p>
                </div>}
              </div>
              <aside className="calculator-aside"><div className="aside-card"><div className="aside-icon"><BookOpen size={19} /></div><h3>Hisobingiz — sizning tanlovingiz</h3><p>Har kimning vaziyati turlicha. Avtomatik hisob o‘rniga aniq bilgan sonlaringizni kiriting yoki taxminingizni tuzating.</p></div><div className="aside-card quiet-card"><CircleHelp size={19} /><h3>Qanday boshlash kerak?</h3><ol><li>Faqat o‘zingiz hisobga olmoqchi bo‘lgan kunlarni yozing.</li><li>Muntazam o‘qigan davrlaringizni ayiring.</li><li>Har bir namoz sonini alohida tekshirib chiqing.</li></ol></div></aside>
            </div>
          </>}

          {section === "record" && <>
            <PageHeading eyebrow="KUNLIK AMAL" title="Qazo qayd etish" description="Har bir tugma bitta bajarilgan qazo namozini qayd qiladi." action={state.records.length > 0 ? <button className="button button-outline" onClick={undoLastRecord}><Undo2 size={16} /> Oxirgi amalni bekor qilish</button> : undefined} />
            <div className="tracker-intro"><div><div className="target-icon light-target"><Target size={19} /></div><div><strong>Bugungi maqsad</strong><p>Hozircha {todayCount} / {state.target} ta namoz qayd etildi.</p></div></div><div className="tracker-intro-progress"><span style={{ width: `${Math.min(100, (todayCount / state.target) * 100)}%` }} /></div></div>
            <div className="record-grid">{PRAYER_KEYS.map(key => <article key={key} className={`record-card ${remaining[key] === 0 ? "record-complete" : ""}`}><div className="record-card-head"><div className="prayer-mark large-mark">{PRAYER_META[key].short}</div><span className="record-status">{remaining[key] === 0 ? "Bajarilgan" : `${remaining[key].toLocaleString("uz-UZ")} ta qolgan`}</span></div><h2>Qazo {PRAYER_LABELS[key]}</h2><p>Hisobdagi jami {state.missed[key].toLocaleString("uz-UZ")} ta namozdan</p><div className="record-count-line"><strong>{prayerCounts[key].toLocaleString("uz-UZ")}</strong><span>bajarildi</span></div><button className={`button ${remaining[key] === 0 ? "button-done" : "button-primary record-button"}`} disabled={remaining[key] === 0} onClick={() => completePrayer(key)}>{remaining[key] === 0 ? <><Check size={16} /> Hammasi bajarildi</> : <><Plus size={16} /> Bajarildi</>}</button></article>)}</div>
            <section className="section-block calendar-section"><div className="section-title-row"><div><p className="eyebrow">FAOLIYAT KUNLARI</p><h2>Kalendar va tarix</h2></div><div className="month-switch"><button className="icon-button" aria-label="Oldingi oy" onClick={() => changeMonth(-1)}><ChevronLeft size={18} /></button><strong>{MONTH_NAMES[month.getMonth()]} {month.getFullYear()}</strong><button className="icon-button" aria-label="Keyingi oy" onClick={() => changeMonth(1)}><ChevronRight size={18} /></button></div></div><CalendarGrid days={calendarDays} month={month} state={state} selectedDay={selectedDay} onSelect={setSelectedDay} /><div className="selected-day-heading"><div><strong>{dateLabel}</strong><span>{selectedRecords.length} ta namoz qayd etildi</span></div>{selectedDay === localDateKey() && <span className="today-pill">Bugun</span>}</div>{selectedRecords.length ? <div className="recent-list">{selectedRecords.map(record => <RecordLine key={record.id} record={record} onRemove={() => removeRecord(record.id)} />)}</div> : <div className="mini-empty">Bu sana uchun qayd topilmadi.</div>}</section>
          </>}

          {section === "stats" && <>
            <PageHeading eyebrow="IZCHILLIKNI KO‘RING" title="Statistika" description="Bosib o‘tgan yo‘lingizni kuzating, shoshilmasdan davom eting." />
            <div className="stats-summary-grid"><Metric label="Jami bajarildi" value={totals.totalCompleted.toLocaleString("uz-UZ")} detail="Barcha qaydlar" icon={Check} tone="green" /><Metric label="Qolgan namozlar" value={totals.totalRemaining.toLocaleString("uz-UZ")} detail="Hisobingiz bo‘yicha" icon={BookOpen} tone="gold" /><Metric label="Umumiy natija" value={`${totals.percentage}%`} detail={`${totals.totalMissed.toLocaleString("uz-UZ")} ta hisobdan`} icon={Activity} tone="soft" /><Metric label="Shu oy" value={monthlyRecords.length.toLocaleString("uz-UZ")} detail="Qayd etilgan namoz" icon={CalendarDays} tone="soft" /></div>
            <div className="analytics-grid"><section className="chart-card"><div className="section-title-row chart-heading"><div><p className="eyebrow">OXIRGI 7 KUN</p><h2>Kunlik faollik</h2></div><span className="chart-tag"><i className="legend-dot green-dot" /> Namozlar</span></div><div className="chart-wrap"><Suspense fallback={<div className="chart-loading" aria-label="Grafik yuklanmoqda" />}><ActivityChart data={chartDays} /></Suspense></div></section><section className="chart-card prayer-stats-card"><div className="section-title-row chart-heading"><div><p className="eyebrow">BESH VAQT</p><h2>Namozlar bo‘yicha</h2></div></div><div className="stat-prayers">{PRAYER_KEYS.map(key => { const pct = state.missed[key] ? Math.round((Math.min(prayerCounts[key], state.missed[key]) / state.missed[key]) * 100) : 0; return <div className="stat-prayer" key={key}><div><span>{PRAYER_LABELS[key]}</span><b>{prayerCounts[key].toLocaleString("uz-UZ")} / {state.missed[key].toLocaleString("uz-UZ")}</b></div><div className="prayer-progress"><span style={{ width: `${pct}%` }} /></div></div>; })}</div></section></div>
            <div className="progress-summary-card"><div className="summary-ring"><ProgressRing value={totals.percentage} size={104} /></div><div className="summary-copy"><p className="eyebrow">TAXMINIY MUDDAT</p><h2>{daysToFinish ? `Taxminan ${daysToFinish.toLocaleString("uz-UZ")} kun` : "Siz hali boshlamadingiz"}</h2><p>Kunlik maqsadingizni {state.target} ta deb olsak, qolgan namozlar uchun taxminiy muddat. Reja va holatingizga qarab o‘zgartirishingiz mumkin.</p></div><button className="button button-outline" onClick={() => setSection("profile")}>Maqsadni sozlash <ArrowRight size={15} /></button></div>
            <section className="section-block"><div className="section-title-row"><div><p className="eyebrow">BU HAFTA</p><h2>Haftalik natija</h2></div><span className="week-total">{weekCount} ta qayd</span></div><div className="weekly-strip">{chartDays.map((day, index) => <div className="weekly-day" key={`${day.day}-${index}`}><span>{day.day}</span><div className="weekly-bar"><i style={{ height: `${Math.max(8, Math.min(100, (day.soni / Math.max(1, state.target)) * 100))}%` }} /></div><b>{day.soni}</b></div>)}</div></section>
          </>}

          {section === "profile" && <>
            <PageHeading eyebrow="SHAXSIY SOZLAMALAR" title="Profil" description="Rejangiz, eslatmalaringiz va ma’lumotlaringizni boshqaring." />
            <section className="profile-card"><div className="profile-card-avatar">{auth.isAuthenticated ? (auth.user?.name?.[0] ?? "F").toUpperCase() : <UserRound size={22} />}</div><div className="profile-card-copy"><strong>{auth.isAuthenticated ? auth.user?.name ?? "Foydalanuvchi" : "Mehmon rejimi"}</strong><span>{auth.isAuthenticated ? auth.user?.email ?? "Hisobingiz ulangan" : "Ma’lumotlar ushbu qurilmada saqlanadi"}</span></div>{auth.isAuthenticated ? <button className="button button-outline" onClick={async () => { try { await auth.logout(); toast.success("Hisobdan chiqdingiz"); } catch { toast.error("Hisobdan chiqib bo‘lmadi"); } }}><LogOut size={16} /> Chiqish</button> : <button className="button button-primary" onClick={signIn}><LogIn size={16} /> Hisobga kirish</button>}</section>
            {!auth.isAuthenticated && <div className="cloud-info"><Cloud size={17} /><span>Hisobga kirgach, ma’lumotlaringiz akkauntingiz bilan bulutda saqlanadi va qurilmalar o‘rtasida sinxronlanadi.</span></div>}
            <section className="settings-card"><div className="settings-heading"><div className="settings-icon"><Target size={18} /></div><div><h2>Kunlik reja</h2><p>O‘zingizga mos maqsadni belgilang. Istalgan vaqtda o‘zgartira olasiz.</p></div></div><div className="goal-options">{[{ label: "1 ta", value: 1 }, { label: "5 ta", value: 5 }, { label: "10 ta", value: 10 }, { label: "To‘liq 5 vaqt", value: 5 }].map(item => <button key={item.label} className={`goal-option ${goalChoice === item.label ? "goal-selected" : ""}`} onClick={() => setGoal(item.value, item.label)}>{item.label}</button>)}</div><div className="custom-goal-row"><label className="field"><span>Shaxsiy kunlik maqsad</span><input type="number" min="1" max="500" value={goalDraft} onChange={event => setGoalDraft(event.target.value)} onBlur={() => setGoal(Number(goalDraft), "custom")} /></label><button className="button button-outline" onClick={() => setGoal(Number(goalDraft), "custom")}>Saqlash</button></div><p className="settings-hint">Kuniga {state.target} ta maqsadda qolgan qazo namozlar taxminan {daysToFinish.toLocaleString("uz-UZ")} kunda tugaydi.</p></section>
            <section className="settings-card"><div className="settings-heading"><div className="settings-icon gold-settings-icon"><Bell size={18} /></div><div><h2>Eslatmalar</h2><p>Kerak bo‘lsa, o‘zingizga qulay vaqtda eslatma oling.</p></div></div><div className="setting-row"><div className="setting-copy"><strong>Har kungi eslatma</strong><span>{state.preferences.dailyReminderEnabled ? "Yoqilgan" : "O‘chirilgan"}</span></div><label className="switch"><input type="checkbox" checked={state.preferences.dailyReminderEnabled} onChange={event => { if (event.target.checked) void enableDailyReminder(); else updateState(current => ({ ...current, preferences: { ...current.preferences, dailyReminderEnabled: false } })); }} /><span /></label></div>{state.preferences.dailyReminderEnabled && <div className="reminder-time-row"><label className="field"><span>Eslatma vaqti</span><input type="time" value={state.preferences.dailyReminderTime} onChange={event => updateState(current => ({ ...current, preferences: { ...current.preferences, dailyReminderTime: event.target.value } }))} /></label><span className="timezone-hint"><Clock3 size={14} /> Qurilmangiz vaqti ({Intl.DateTimeFormat().resolvedOptions().timeZone || "mahalliy vaqt"})</span></div>}<div className="setting-row"><div className="setting-copy"><strong>Haftalik hisobot</strong><span>Yakshanba kuni, brauzer ochiq bo‘lganda</span></div><label className="switch"><input type="checkbox" checked={state.preferences.weeklyReminderEnabled} onChange={() => void toggleWeeklyReminder()} /><span /></label></div><div className="setting-row"><div className="setting-copy"><strong>Maqsadni eslatish</strong><span>Kunlik bildirishnomada bajarilgan sonni ko‘rsatish</span></div><label className="switch"><input type="checkbox" checked={state.preferences.targetReminderEnabled} onChange={event => updateState(current => ({ ...current, preferences: { ...current.preferences, targetReminderEnabled: event.target.checked } }))} /><span /></label></div><div className="reminder-disclosure"><Bell size={15} /><span>Brauzer bildirishnomalariga ruxsat bering va eslatma ishlashi uchun Qazo Namoz sahifasini ochiq qoldiring. Brauzer yopiq yoki qurilma o‘chiq bo‘lsa, web-eslatma yuborilmaydi.</span></div>{typeof Notification !== "undefined" && Notification.permission === "denied" && <p className="permission-denied">Bildirishnomalar brauzer sozlamalarida bloklangan. Ularni brauzer sozlamalaridan yoqing.</p>}</section>
            <section className="settings-card"><div className="settings-heading"><div className="settings-icon"><Sun size={18} /></div><div><h2>Ko‘rinish</h2><p>Ko‘zingizga qulay rang uslubini tanlang.</p></div></div><div className="theme-control"><button className={`theme-choice ${theme === "light" ? "theme-selected" : ""}`} onClick={() => { if (theme === "dark") toggleTheme?.(); }}><Sun size={17} /> Yorug‘</button><button className={`theme-choice ${theme === "dark" ? "theme-selected" : ""}`} onClick={() => { if (theme === "light") toggleTheme?.(); }}><Moon size={17} /> Qorong‘i</button></div></section>
            <section className="settings-card data-card"><div className="settings-heading"><div className="settings-icon"><ShieldCheck size={18} /></div><div><h2>Ma’lumotlaringiz</h2><p>Zaxira nusxa oling yoki hisobni tozalang.</p></div></div><div className="data-actions"><button className="button button-outline" onClick={exportData}><ArrowDownToLine size={16} /> Ma’lumotlarni yuklab olish</button><button className="button button-danger-outline" onClick={resetData}><X size={16} /> Hisobni tozalash</button></div><p className="data-note">Zaxira fayli ushbu qurilmaga yuklanadi. Hisobni tozalash tasdiqlangandan keyin joriy qaydlarni o‘chiradi.</p></section>
            <section className="settings-card faq-card"><div className="settings-heading"><div className="settings-icon"><CircleHelp size={18} /></div><div><h2>Ko‘p so‘raladigan savollar</h2><p>Qisqa yo‘riqnoma</p></div></div><details><summary>Qazo namozlarni qanday qayd qilaman?<ChevronDown size={16} /></summary><p>“Qayd etish” bo‘limidan tegishli namoz turini tanlab, “Bajarildi” tugmasini bosing. Qayd sanasi va vaqti avtomatik saqlanadi.</p></details><details><summary>Hisoblagich barcha kunlarni avtomatik sanaydimi?<ChevronDown size={16} /></summary><p>Yo‘q. Hisoblagich faqat o‘zingiz kiritgan qazo kunlari va namozlarni ishlatadi. Hisob taxminiy bo‘lib, zarur bo‘lsa qo‘lda tuzatiladi.</p></details><details><summary>Ma’lumotlarim qayerda saqlanadi?<ChevronDown size={16} /></summary><p>Mehmon rejimida ma’lumotlar shu qurilmada saqlanadi. Hisobga kirganingizda ma’lumotlarni shaxsiy akkauntingiz bilan sinxronlash mumkin.</p></details></section>
          </>}
        </main>
        <footer className="desktop-footer"><span>Qazo Namoz</span><span>Shaxsiy odatlaringiz uchun sokin hamroh</span><span>✳</span></footer>
      </div>

      <nav className="mobile-nav" aria-label="Mobil navigatsiya">{NAV.map(({ id, label, icon: Icon }) => <button key={id} className={section === id ? "mobile-nav-active" : ""} onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined}><Icon size={19} /><span>{label === "Qazo hisoblash" ? "Hisob" : label === "Bosh sahifa" ? "Bosh sahifa" : label === "Qayd etish" ? "Qayd" : label}</span></button>)}</nav>
    </div>
  );
}

function RecordLine({ record, onRemove }: { record: QazoAppState["records"][number]; onRemove: () => void }) {
  const when = new Date(record.completedAt);
  return <div className="record-line"><div className="record-line-check"><Check size={15} /></div><div className="record-line-text"><strong>Qazo {PRAYER_LABELS[record.prayer]}</strong><span>{new Intl.DateTimeFormat("uz-UZ", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(when)}</span></div><button className="remove-record" onClick={() => { if (window.confirm("Ushbu qaydni o‘chirasizmi?")) onRemove(); }} aria-label="Qaydni tuzatish"><X size={15} /></button></div>;
}

function CalendarGrid({ days, month, state, selectedDay, onSelect }: {
  days: Date[]; month: Date; state: QazoAppState; selectedDay: string; onSelect: (key: string) => void;
}) {
  return <div><div className="calendar-legend"><span><i className="calendar-key-activity" />Qayd bor</span><span><i className="calendar-key-goal" />Kunlik maqsad bajarildi</span></div><div className="calendar-grid"><div className="calendar-weekdays">{WEEKDAYS.map(day => <span key={day}>{day}</span>)}</div><div className="calendar-days">{days.map((date, index) => {
    const key = localDateKey(date);
    const count = recordsForLocalDay(state, key).length;
    const inMonth = date.getMonth() === month.getMonth();
    const targetMet = count > 0 && count >= targetForLocalDay(state, key);
    return <button key={`${key}-${index}`} className={`calendar-day ${inMonth ? "" : "outside-month"} ${selectedDay === key ? "calendar-selected" : ""} ${key === localDateKey() ? "calendar-today" : ""} ${count > 0 ? "has-activity" : ""} ${targetMet ? "goal-achieved" : ""}`} onClick={() => onSelect(key)} aria-label={`${key}, ${count} ta qayd${targetMet ? ", kunlik maqsad bajarildi" : ""}`} title={targetMet ? "Kunlik maqsad bajarildi" : undefined}><span>{date.getDate()}</span>{count > 0 && <i>{count}</i>}</button>;
  })}</div></div></div>;
}
