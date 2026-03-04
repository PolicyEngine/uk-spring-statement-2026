"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { colors } from "@policyengine/design-system/tokens/colors";


function shorten(group) {
  return group
    .replace("Single adult, no children", "Single adult")
    .replace("Couple, no children", "Couple")
    .replace("Couple with children", "Couple + kids")
    .replace("Single parent", "Single parent")
    .replace("Single pensioner", "Single pensioner")
    .replace("Pensioner couple", "Pensioner couple");
}

function formatCurrency(v) {
  if (v == null) return "\u2014";
  return `\u00a3${Math.abs(v).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function formatCurrencyChange(v) {
  if (v == null) return "\u2014";
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}\u00a3${Math.abs(v).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function ChangeBarChart({ comparison }) {
  const changeField = "change_nominal";
  const chartData = comparison
    .map((d) => ({
      group: shorten(d.group),
      change: d[changeField],
    }))
    .sort((a, b) => a.change - b.change);

  return (
    <div className="section-card">
      <h3 className="chart-title">
        Change in mean household net income by household type
      </h3>
      <p className="chart-subtitle">
        Change in mean household net income by household type, comparing pre- and post-Spring Statement OBR forecasts (&pound;/year)
      </p>
      <div className="chart-container-tall">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 40, left: 10, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
            <XAxis
              type="number"
              tickFormatter={(v) =>
                `${v >= 0 ? "+" : "-"}\u00a3${Math.abs(v)}`
              }
              tick={{ fontSize: 12, fill: colors.gray[500] }}
            />
            <YAxis
              type="category"
              dataKey="group"
              width={130}
              tick={{ fontSize: 12, fill: colors.gray[500] }}
            />
            <ReferenceLine x={0} stroke={colors.gray[500]} strokeWidth={1} />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: `1px solid ${colors.border.light}`,
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                fontSize: "0.85rem",
              }}
              formatter={(value) => [
                formatCurrencyChange(value) + "/year",
                "Change",
              ]}
            />
            <Bar
              dataKey="change"
              fill={colors.primary[600]}
              barSize={24}
              radius={[0, 4, 4, 0]}
              name="Change"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HouseholdSummaryTable({ stats, comparison }) {
  const reformedField = "reformed_hnet_nominal";
  const changeField = "change_nominal";

  return (
    <div className="section-card">
      <h3 className="chart-title">Impact on household income by household type</h3>
      <p className="chart-subtitle">
        Median and mean household net income by household type, comparing pre- and post-Spring Statement forecasts
      </p>
      <div className="overflow-x-auto">
        <table className="forecast-table">
          <thead>
            <tr>
              <th>Household type</th>
              <th>Median income</th>
              <th>Households (m)</th>
              <th>Mean income (pre)</th>
              <th>Mean income (post)</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((row) => {
              const comp =
                comparison.find((c) => c.group === row.group) || {};
              const change = comp[changeField];
              const changeClass =
                change > 0
                  ? "change-positive"
                  : change < 0
                    ? "change-negative"
                    : "change-zero";
              return (
                <tr key={row.group}>
                  <td>{row.group}</td>
                  <td>{formatCurrency(row.median_hnet)}</td>
                  <td>
                    {(row.weighted_n / 1e6).toFixed(2)}m
                  </td>
                  <td>{formatCurrency(comp.baseline_hnet)}</td>
                  <td>{formatCurrency(comp[reformedField])}</td>
                  <td className={changeClass}>
                    {formatCurrencyChange(change)}/yr
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HouseholdArchetypes({ selectedYear }) {
  const [allStats, setAllStats] = useState(null);
  const [allComparison, setAllComparison] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/household_stats.json")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/data/household_comparison.json")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([statsData, compData]) => {
      setAllStats(statsData);
      setAllComparison(compData);
    });
  }, []);

  if (!allStats || !allComparison) return null;

  const stats = allStats.filter((d) => d.year === selectedYear);
  const comparison = allComparison.filter((d) => d.year === selectedYear);

  if (stats.length === 0 || comparison.length === 0) return null;

  return (
    <div className="mt-8">
      <HouseholdSummaryTable stats={stats} comparison={comparison} />

      <div className="mt-8">
        <ChangeBarChart comparison={comparison} />
      </div>
    </div>
  );
}
