"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { flagEmoji } from "@/lib/data/teams";
import type { PlayerRankChart as PlayerRankData } from "@/lib/stats";
import { axisTick, ChartMessage, tooltipProps } from "./chart-kit";

/** Height grows with the number of rows so bars never crowd. */
function chartHeight(rows: number): number {
  return Math.max(80, rows * 26 + 16);
}

/**
 * A horizontal ranked bar chart of players (scorers or assisters). The series
 * color and value label are passed in so the same chart serves both lists.
 */
export function PlayerRankChart({
  data,
  color,
  valueName,
  emptyLabel,
}: {
  data: PlayerRankData;
  color: string;
  valueName: string;
  emptyLabel: string;
}) {
  if (data.state === "empty") {
    return <ChartMessage>{emptyLabel}</ChartMessage>;
  }
  const rows = data.rows.map((r) => ({
    label: `${flagEmoji(r.isoCode)} ${r.name}`,
    value: r.value,
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
        <Bar dataKey="value" name={valueName} fill={color} radius={[0, 3, 3, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
