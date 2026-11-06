import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function ActivityChart({ data }: { data: { day: string; soni: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "var(--muted-ink)", fontSize: 12 }} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--muted-ink)", fontSize: 11 }} />
        <Tooltip cursor={{ fill: "var(--chart-hover)" }} contentStyle={{ borderRadius: 12, borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink)" }} />
        <Bar dataKey="soni" name="Namozlar" fill="var(--emerald)" radius={[6, 6, 0, 0]} maxBarSize={38} />
      </BarChart>
    </ResponsiveContainer>
  );
}
