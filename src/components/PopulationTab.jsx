"use client";

import { useState, useMemo, useEffect } from "react";
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
import InequalityTable from "./InequalityTable";
import DetailedBudgetTable from "./DetailedBudgetTable";
import HouseholdArchetypes from "./HouseholdArchetypes";
import parseCSV from "../../lib/parseCSV";

const YEARS = [2026, 2027, 2028, 2029, 2030];

const DECILE_ORDER = [
  "1st", "2nd", "3rd", "4th", "5th",
  "6th", "7th", "8th", "9th", "10th",
];

function MetricsBar({ metrics, winnersLosers, distributional, year, termsMode }) {
  const cards = [];

  if (distributional && distributional.length > 0) {
    const allRow = distributional.find(
      (d) => d.year === year && d.decile === "All",
    );
    if (allRow) {
      const absChange = allRow[`absolute_change_${termsMode}`];
      cards.push({
        label: "Average household impact",
        value: `${absChange >= 0 ? "+" : ""}\u00a3${absChange.toFixed(0)}/year`,
      });
    }
  }

  if (winnersLosers && winnersLosers.length > 0) {
    const allRow = winnersLosers.find(
      (d) => d.year === year && d.decile === "All",
    );
    if (allRow) {
      cards.push({
        label: "Households gaining",
        value: `${allRow[`pct_gaining_${termsMode}`].toFixed(1)}%`,
      });
      cards.push({
        label: "Households losing",
        value: `${allRow[`pct_losing_${termsMode}`].toFixed(1)}%`,
      });
    }
  }

  if (metrics && metrics.length > 0) {
    const yearMetrics = metrics.filter((m) => m.year === year);
    const povertyChange = yearMetrics.find(
      (m) => m.metric === "abs_bhc_poverty_rate_change",
    );
    if (povertyChange) {
      cards.push({
        label: "Poverty rate change",
        value: `${povertyChange.value >= 0 ? "+" : ""}${povertyChange.value.toFixed(2)} pp`,
      });
    }
  }

  if (cards.length === 0) return null;

  return (
    <div className="metrics-bar">
      {cards.map((card) => (
        <div key={card.label} className="metric-card">
          <div className="metric-label">{card.label}</div>
          <div className="metric-value">{card.value}</div>
        </div>
      ))}
    </div>
  );
}

function DistributionalChart({ data, year, termsMode }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data
      .filter(
        (d) => d.year === year && d.decile !== "All" && d.decile !== "Overall",
      )
      .map((d) => ({
        decile: d.decile,
        impact: d[`absolute_change_${termsMode}`],
      }))
      .sort(
        (a, b) =>
          DECILE_ORDER.indexOf(a.decile) - DECILE_ORDER.indexOf(b.decile),
      );
  }, [data, year, termsMode]);

  if (chartData.length === 0) return null;

  const termsLabel = termsMode === "real" ? " (real terms)" : "";

  return (
    <div className="section-card">
      <h3 className="chart-title">Average annual impact by income decile</h3>
      <p className="chart-subtitle">
        Change in household net income{termsLabel} ({"\u00a3"}/year), {year}-
        {(year + 1).toString().slice(-2)}
      </p>
      <div className="chart-container-tall">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 24, left: 16, bottom: 32 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="decile"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              label={{
                value: "Income decile",
                position: "insideBottom",
                offset: -16,
                style: { fill: "#374151", fontSize: 12, fontWeight: 500 },
              }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickFormatter={(v) =>
                `${v >= 0 ? "" : "-"}\u00a3${Math.abs(v).toFixed(0)}`
              }
              tickLine={false}
              axisLine={false}
              width={70}
              allowDecimals={false}
              tickCount={6}
              label={{
                value: "Change in net income (\u00a3/year)",
                angle: -90,
                position: "insideLeft",
                dx: -8,
                style: {
                  textAnchor: "middle",
                  fill: "#374151",
                  fontSize: 12,
                  fontWeight: 500,
                },
              }}
            />
            <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                fontSize: "0.85rem",
              }}
              formatter={(value) => [
                `${value >= 0 ? "+" : ""}\u00a3${value.toFixed(2)}/year`,
                "Impact",
              ]}
              labelFormatter={(label) => `${label} decile`}
            />
            <Bar
              dataKey="impact"
              fill="#0d9488"
              radius={[4, 4, 0, 0]}
              name="Impact"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p
        style={{
          fontSize: "0.75rem",
          color: "#9ca3af",
          marginTop: "12px",
        }}
      >
        Decile 1 = lowest income households, Decile 10 = highest income
        households. Values show average annual change in household net income.
      </p>
    </div>
  );
}

function WinnersLosersChart({ data, year, termsMode }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data
      .filter(
        (d) => d.year === year && d.decile !== "All" && d.decile !== "Overall",
      )
      .map((d) => ({
        decile: d.decile,
        gaining: d[`pct_gaining_${termsMode}`],
        losing: d[`pct_losing_${termsMode}`] ? -Math.abs(d[`pct_losing_${termsMode}`]) : 0,
        unchanged: d[`pct_unchanged_${termsMode}`] || 0,
      }))
      .sort(
        (a, b) =>
          DECILE_ORDER.indexOf(a.decile) - DECILE_ORDER.indexOf(b.decile),
      );
  }, [data, year, termsMode]);

  if (chartData.length === 0) return null;

  return (
    <div className="section-card">
      <h3 className="chart-title">Winners and losers by income decile</h3>
      <p className="chart-subtitle">
        Percentage of households gaining vs losing, {year}-
        {(year + 1).toString().slice(-2)}
      </p>
      <div className="chart-container-tall">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 24, left: 16, bottom: 32 }}
            stackOffset="sign"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="decile"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
              label={{
                value: "Income decile",
                position: "insideBottom",
                offset: -16,
                style: { fill: "#374151", fontSize: 12, fontWeight: 500 },
              }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
              domain={[-60, 60]}
              ticks={[-60, -40, -20, 0, 20, 40, 60]}
            />
            <ReferenceLine y={0} stroke="#6b7280" strokeWidth={1} />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                fontSize: "0.85rem",
              }}
              formatter={(value, name) => [
                `${Math.abs(value).toFixed(1)}%`,
                name === "gaining" ? "Gaining" : "Losing",
              ]}
              labelFormatter={(label) => `${label} decile`}
            />
            <Bar
              dataKey="gaining"
              fill="#059669"
              stackId="stack"
              name="gaining"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="losing"
              fill="#dc2626"
              stackId="stack"
              name="losing"
              radius={[0, 0, 4, 4]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function PopulationTab({ data }) {
  const [selectedYear, setSelectedYear] = useState(2026);
  const [termsMode, setTermsMode] = useState("nominal");
  const [extraData, setExtraData] = useState({
    inequality: null,
    detailedBudget: null,
  });

  // Load extra CSV files for new components
  useEffect(() => {
    Promise.all([
      fetch("/data/inequality.csv")
        .then((r) => (r.ok ? r.text() : null))
        .catch(() => null),
      fetch("/data/detailed_budgetary_impact.csv")
        .then((r) => (r.ok ? r.text() : null))
        .catch(() => null),
    ]).then(([inequality, detailedBudget]) => {
      setExtraData({
        inequality: inequality ? parseCSV(inequality) : null,
        detailedBudget: detailedBudget ? parseCSV(detailedBudget) : null,
      });
    });
  }, []);

  const hasDistributional =
    data?.distributional && data.distributional.length > 0;
  const hasWinnersLosers =
    data?.winnersLosers && data.winnersLosers.length > 0;

  if (!hasDistributional && !hasWinnersLosers) {
    return (
      <div className="data-message">
        <p>
          Population impact data not yet generated. Run{" "}
          <code>uv run spring-statement-data generate</code> to generate
          microsimulation results.
        </p>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "var(--pe-space-lg)" }}>
        <div className="year-selector" style={{ marginBottom: 0 }}>
          {YEARS.map((year) => (
            <button
              key={year}
              className={selectedYear === year ? "active" : ""}
              onClick={() => setSelectedYear(year)}
            >
              {year}-{(year + 1).toString().slice(-2)}
            </button>
          ))}
        </div>

        <div className="year-selector" style={{ marginBottom: 0 }}>
          <button
            className={termsMode === "nominal" ? "active" : ""}
            onClick={() => setTermsMode("nominal")}
          >
            Nominal {"\u00a3"}
          </button>
          <button
            className={termsMode === "real" ? "active" : ""}
            onClick={() => setTermsMode("real")}
          >
            Real {"\u00a3"}
          </button>
        </div>
      </div>

      <MetricsBar
        metrics={data.metrics}
        winnersLosers={data.winnersLosers}
        distributional={data.distributional}
        year={selectedYear}
        termsMode={termsMode}
      />

      <div className="charts-grid">
        {hasDistributional && (
          <DistributionalChart
            data={data.distributional}
            year={selectedYear}
            termsMode={termsMode}
          />
        )}
        {hasWinnersLosers && (
          <WinnersLosersChart
            data={data.winnersLosers}
            year={selectedYear}
            termsMode={termsMode}
          />
        )}
      </div>

      <InequalityTable
        data={extraData.inequality}
        selectedYear={selectedYear}
        termsMode={termsMode}
      />

      <DetailedBudgetTable
        data={extraData.detailedBudget}
        selectedYear={selectedYear}
        termsMode={termsMode}
      />

      <HouseholdArchetypes termsMode={termsMode} />
    </div>
  );
}
