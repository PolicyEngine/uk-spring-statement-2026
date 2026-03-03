"use client";

import { useState, useEffect } from "react";
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

function ChangeBarChart({ comparison, termsMode }) {
  const changeField = `change_${termsMode}`;
  const chartData = comparison
    .map((d) => ({
      group: shorten(d.group),
      change: d[changeField],
    }))
    .sort((a, b) => a.change - b.change);

  return (
    <div className="section-card">
      <h3 className="chart-title">
        Change in mean household net income by family type
      </h3>
      <p className="chart-subtitle">
        Difference between Spring Statement and pre-Spring Statement forecasts
        (&pound;/year)
      </p>
      <div className="chart-container-tall">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 40, left: 10, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              type="number"
              tickFormatter={(v) =>
                `${v >= 0 ? "+" : "-"}\u00a3${Math.abs(v)}`
              }
              tick={{ fontSize: 12, fill: "#6b7280" }}
            />
            <YAxis
              type="category"
              dataKey="group"
              width={130}
              tick={{ fontSize: 12, fill: "#6b7280" }}
            />
            <ReferenceLine x={0} stroke="#6b7280" strokeWidth={1} />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid #e5e7eb",
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
              fill="#0d9488"
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

function HouseholdSummaryTable({ stats, comparison, termsMode }) {
  const reformedField = `reformed_hnet_${termsMode}`;
  const changeField = `change_${termsMode}`;

  return (
    <div className="section-card">
      <h3 className="chart-title">Household income summary</h3>
      <div className="forecast-table-wrapper">
        <table className="forecast-table">
          <thead>
            <tr>
              <th>Household type</th>
              <th>Median income</th>
              <th>Population</th>
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
                    {Math.round(row.weighted_n).toLocaleString("en-GB")}
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

export default function HouseholdArchetypes() {
  const [termsMode, setTermsMode] = useState("nominal");
  const [stats, setStats] = useState(null);
  const [comparison, setComparison] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/household_stats.json")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
      fetch("/data/household_comparison.json")
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([statsData, compData]) => {
      setStats(statsData);
      setComparison(compData);
    });
  }, []);

  if (!stats || !comparison) return null;

  return (
    <div style={{ marginTop: "var(--pe-space-xl)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 className="section-heading">Impact by household type</h2>
        <div className="year-selector" style={{ marginBottom: 0 }}>
          <button className={termsMode === "nominal" ? "active" : ""} onClick={() => setTermsMode("nominal")}>Nominal {"\u00a3"}</button>
          <button className={termsMode === "real" ? "active" : ""} onClick={() => setTermsMode("real")}>Real {"\u00a3"}</button>
        </div>
      </div>
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--pe-text-secondary)",
          lineHeight: 1.6,
          marginBottom: "var(--pe-space-lg)",
        }}
      >
        Using PolicyEngine's microsimulation model, we calculated average
        household net income for six household groups under pre-Spring Statement
        and Spring Statement 2026 forecasts. These figures represent 2029
        projections.
      </p>

      <ChangeBarChart comparison={comparison} termsMode={termsMode} />

      <HouseholdSummaryTable stats={stats} comparison={comparison} termsMode={termsMode} />
    </div>
  );
}
