"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TrainerMeasurementTrendRow = {
  dateText: string;
  weight_kg: number | null;
  fat_percent: number | null;
  muscle_kg: number | null;
  height_cm: number | null;
};

export function TrainerMemberMeasurementTrend({ rows }: { rows: TrainerMeasurementTrendRow[] }) {
  return (
    <div className="h-[320px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d9e7ff" />
          <XAxis dataKey="dateText" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="weight_kg" name="Kilo (kg)" stroke="#0f766e" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="fat_percent" name="Yağ %" stroke="#f97316" strokeWidth={2.2} dot={false} />
          <Line type="monotone" dataKey="muscle_kg" name="Kas (kg)" stroke="#2563eb" strokeWidth={2.2} dot={false} />
          <Line type="monotone" dataKey="height_cm" name="Boy (cm)" stroke="#64748b" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
