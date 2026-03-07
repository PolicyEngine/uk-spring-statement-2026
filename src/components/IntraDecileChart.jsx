"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { colors } from "@policyengine/design-system/tokens/colors";
import { chartColors } from "@policyengine/design-system/charts";


const OUTCOME_COLORS = {
  "Lose more than 5%": "#991b1b",    // red-800 — no token; darker error shade for severity distinction
  "Lose less than 5%": chartColors.negative,
  "No change": colors.gray[400],
  "Gain less than 5%": chartColors.positive,
  "Gain more than 5%": "#15803d",    // green-700 — no token; darker success shade for severity distinction
};

const OUTCOME_ORDER = [
  "Lose more than 5%",
  "Lose less than 5%",
  "No change",
  "Gain less than 5%",
  "Gain more than 5%",
];

export default function IntraDecileChart({ data, selectedYear, termsMode = "nominal" }) {
  if (!data) return null;

  const shareField = `share_${termsMode}`;

  const filtered = data.filter(
    (row) =>
      parseInt(row.year) === selectedYear && row.decile !== "All",
  );

  if (filtered.length === 0) return null;

  const deciles = [
    "1st", "2nd", "3rd", "4th", "5th",
    "6th", "7th", "8th", "9th", "10th",
  ];

  const chartData = deciles.map((decile) => {
    const point = { decile };
    OUTCOME_ORDER.forEach((outcome) => {
      const row = filtered.find(
        (r) => r.decile === decile && r.outcome === outcome,
      );
      point[outcome] = row ? parseFloat(row[shareField]) * 100 : 0;
    });
    return point;
  });

  const formatDecile = (value) => value.replace(/st|nd|rd|th/g, "");

  return (
    <div className="mt-6">
      <h3 className="chart-title">
        Winners and losers by income decile
      </h3>
      <p className="chart-description">
        Share of people in each income decile who gain, lose, or see no change
        in net income due to revised OBR forecasts.
      </p>

      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 60, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
          <XAxis
            dataKey="decile"
            tickFormatter={formatDecile}
            tick={{ fontSize: 12, fill: colors.gray[500] }}
            label={{
              value: "Income decile",
              position: "insideBottom",
              offset: -10,
              style: { fill: colors.gray[700], fontSize: 12, fontWeight: 500 },
            }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12, fill: colors.gray[500] }}
            label={{
              value: "Share of people",
              angle: -90,
              position: "insideLeft",
              dx: -20,
              style: {
                textAnchor: "middle",
                fill: colors.gray[700],
                fontSize: 12,
                fontWeight: 500,
              },
            }}
          />
          <Tooltip
            formatter={(value, name) => [`${value.toFixed(1)}%`, name]}
            contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
          />
          <Legend wrapperStyle={{ paddingTop: "20px" }} />
          {OUTCOME_ORDER.map((outcome) => (
            <Bar
              key={outcome}
              dataKey={outcome}
              stackId="stack"
              fill={OUTCOME_COLORS[outcome]}
              name={outcome}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <p
        style={{
          marginTop: "8px",
          fontSize: "13px",
          color: colors.gray[500],
          textAlign: "center",
        }}
      >
        Decile 1 = lowest income, Decile 10 = highest income. Changes less than
        0.1% are classified as "No change".
      </p>
    </div>
  );
}
