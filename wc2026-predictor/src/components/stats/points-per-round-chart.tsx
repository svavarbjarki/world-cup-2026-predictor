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
import type { PointsPerRoundChart as PointsPerRoundData } from "@/lib/stats";
import {
  axisTick,
  CHART_HEIGHT,
  ChartMessage,
  gridStroke,
  legendStyle,
  seriesColor,
  tooltipProps,
} from "./chart-kit";

/** Grouped bars: one group per round, one bar per player within the group. */
export function PointsPerRoundChart({ data }: { data: PointsPerRoundData }) {
  if (data.state === "waiting") {
    return <ChartMessage>Waiting on results</ChartMessage>;
  }
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data.rows} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey="round" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...tooltipProps} />
        <Legend wrapperStyle={legendStyle} />
        {data.players.map((player, i) => (
          <Bar key={player} dataKey={player} fill={seriesColor(i)} radius={[2, 2, 0, 0]} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
