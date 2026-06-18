"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GoalsByMinuteChart as GoalsByMinuteData } from "@/lib/stats";
import {
  axisTick,
  BAR_FILL,
  CHART_HEIGHT,
  ChartMessage,
  gridStroke,
  tooltipProps,
} from "./chart-kit";

/** Goals grouped into 15-minute windows across the tournament. */
export function GoalsByMinuteChart({ data }: { data: GoalsByMinuteData }) {
  if (data.state === "empty") {
    return <ChartMessage>No goal minutes recorded yet</ChartMessage>;
  }
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={data.rows} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
        <XAxis dataKey="bucket" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip {...tooltipProps} />
        <Bar dataKey="goals" name="Goals" fill={BAR_FILL} radius={[2, 2, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
