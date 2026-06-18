"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PredictedGoalsChart as PredictedGoalsData } from "@/lib/stats";
import {
  axisTick,
  BAR_FILL,
  CHART_HEIGHT,
  ChartMessage,
  gridStroke,
  REFERENCE_COLOR,
  tooltipProps,
} from "./chart-kit";

/**
 * One bar per player for their total predicted group goals across the whole
 * tournament, with a horizontal reference line at the real goals scored so far.
 */
export function PredictedGoalsChart({ data }: { data: PredictedGoalsData }) {
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
        <Bar dataKey="predicted" name="Predicted goals" fill={BAR_FILL} radius={[2, 2, 0, 0]} />
        <ReferenceLine y={data.actualTotal} stroke={REFERENCE_COLOR} strokeDasharray="4 4">
          <Label
            value={`Actual so far: ${data.actualTotal}`}
            position="insideTopRight"
            fill={REFERENCE_COLOR}
            fontSize={11}
          />
        </ReferenceLine>
      </BarChart>
    </ResponsiveContainer>
  );
}
