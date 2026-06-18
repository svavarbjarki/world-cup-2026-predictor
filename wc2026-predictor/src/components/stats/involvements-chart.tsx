"use client";

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { flagEmoji } from "@/lib/data/teams";
import type { InvolvementsChart as InvolvementsData } from "@/lib/stats";
import {
  axisTick,
  ChartMessage,
  legendStyle,
  SERIES_COLORS,
  tooltipProps,
} from "./chart-kit";

function chartHeight(rows: number): number {
  return Math.max(96, rows * 26 + 32);
}

/** Stacked horizontal bars: goals + assists per player, ranked by total. */
export function InvolvementsChart({ data }: { data: InvolvementsData }) {
  if (data.state === "empty") {
    return <ChartMessage>No goals recorded yet</ChartMessage>;
  }
  const rows = data.rows.map((r) => ({
    label: `${flagEmoji(r.isoCode)} ${r.name}`,
    goals: r.goals,
    assists: r.assists,
  }));
  return (
    <ResponsiveContainer width="100%" height={chartHeight(rows.length)}>
      <BarChart
        layout="vertical"
        data={rows}
        margin={{ top: 2, right: 16, bottom: 2, left: 4 }}
      >
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={132}
        />
        <Tooltip {...tooltipProps} />
        <Legend wrapperStyle={legendStyle} />
        <Bar dataKey="goals" name="Goals" stackId="a" fill={SERIES_COLORS[0]} />
        <Bar
          dataKey="assists"
          name="Assists"
          stackId="a"
          fill={SERIES_COLORS[1]}
          radius={[0, 3, 3, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
