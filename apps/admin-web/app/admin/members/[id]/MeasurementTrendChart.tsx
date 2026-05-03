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

type MeasurementChartRow = {
  dateText: string;
  weight_kg: number | null;
  fat_percent: number | null;
  muscle_kg: number | null;
  height_cm: number | null;
};

export function MeasurementTrendChart({ rows }: { rows: MeasurementChartRow[] }) {
  return (
    <div className="h-[340px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
          <XAxis dataKey="dateText" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="weight_kg" name="Kilo (kg)" stroke="#0EA5E9" strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="fat_percent" name="Yağ %" stroke="#F59E0B" strokeWidth={2.2} dot={false} />
          <Line type="monotone" dataKey="muscle_kg" name="Kas (kg)" stroke="#10B981" strokeWidth={2.2} dot={false} />
          <Line type="monotone" dataKey="height_cm" name="Boy (cm)" stroke="#334155" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
