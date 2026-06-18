"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AccuracyChart as AccuracyData } from "@/lib/stats";
import {
  ACCURACY_COLORS,
  axisTick,
  CHART_HEIGHT,
  ChartMessage,
  gridStroke,
  legendStyle,
  tooltipProps,
} from "./chart-kit";

/** Stacked bar per player: exact score / correct result / wrong, by count. */
export function AccuracyChart({ data }: { data: AccuracyData }) {
  if (data.state === "waiting") {
    return <ChartMessage>Waiting on results</ChartMessage>;
  }
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data.rows} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey="player" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...tooltipProps} />
        <Legend wrapperStyle={legendStyle} />
        <Bar dataKey="exact" name="Exact score" stackId="a" fill={ACCURACY_COLORS.exact} />
        <Bar dataKey="result" name="Right result" stackId="a" fill={ACCURACY_COLORS.result} />
        <Bar dataKey="wrong" name="Wrong" stackId="a" fill={ACCURACY_COLORS.wrong} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
