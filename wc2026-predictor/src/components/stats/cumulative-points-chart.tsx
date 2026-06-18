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
import type { CumulativePointsChart as CumulativePointsData } from "@/lib/stats";
import {
  axisTick,
  CHART_HEIGHT,
  ChartMessage,
  gridStroke,
  legendStyle,
  seriesColor,
  tooltipProps,
} from "./chart-kit";

/** One line per player; x = round, y = running total points so far. */
export function CumulativePointsChart({ data }: { data: CumulativePointsData }) {
  if (data.state === "waiting") {
    return <ChartMessage>Waiting on results</ChartMessage>;
  }
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={data.rows} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey="round" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...tooltipProps} />
        <Legend wrapperStyle={legendStyle} />
        {data.players.map((player, i) => (
          <Line
            key={player}
            type="monotone"
            dataKey={player}
            stroke={seriesColor(i)}
            strokeWidth={2}
            dot={{ r: 2 }}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
