"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  AwardDistribution,
  AwardDistributionChart as AwardData,
} from "@/lib/stats";
import { axisTick, BAR_FILL, ChartMessage, tooltipProps } from "./chart-kit";

/** Height grows with the number of nominees so labels never crowd. */
function chartHeight(rows: number): number {
  return Math.max(80, rows * 28 + 24);
}

/** One horizontal bar chart for a single award: a bar per picked nominee. */
function SingleAward({ award }: { award: AwardDistribution }) {
  return (
    <div>
      <h4 className="mb-1 text-xs font-medium text-text">{award.award}</h4>
      {award.state === "empty" ? (
        <ChartMessage>No picks yet</ChartMessage>
      ) : (
        <ResponsiveContainer width="100%" height={chartHeight(award.rows.length)}>
          <BarChart
            layout="vertical"
            data={award.rows}
            margin={{ top: 2, right: 12, bottom: 2, left: 4 }}
          >
            <XAxis type="number" hide allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="nominee"
              tick={axisTick}
              tickLine={false}
              axisLine={false}
              width={96}
            />
            <Tooltip {...tooltipProps} />
            <Bar dataKey="count" name="Picks" fill={BAR_FILL} radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

/** The four individual awards, each its own horizontal distribution. */
export function AwardDistributionChart({ data }: { data: AwardData }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {data.awards.map((award) => (
        <SingleAward key={award.award} award={award} />
      ))}
    </div>
  );
}
