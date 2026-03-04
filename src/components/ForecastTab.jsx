"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import ForecastTable from "./ForecastTable";
import { colors } from "@policyengine/design-system/tokens/colors";
import { chartColors } from "@policyengine/design-system/charts";

const SERIES_CONFIG = {
  earnings_growth: { title: "Earnings growth", unit: "%" },
  cpi_inflation: { title: "CPI inflation", unit: "%" },
  rpi_inflation: { title: "RPI inflation", unit: "%" },
  house_prices: { title: "House price growth", unit: "%" },
  per_capita_gdp: { title: "Per capita GDP growth", unit: "%" },
  social_rent: { title: "Social rent growth", unit: "%" },
};

const HERO_SERIES = [
  { key: "cpi_inflation", label: "CPI", targetYear: 2026 },
  { key: "rpi_inflation", label: "RPI", targetYear: 2026 },
  { key: "earnings_growth", label: "Earnings", targetYear: 2026 },
];

const COLORS = {
  previous: chartColors.secondary,
  updated: colors.primary[600],
};

function ForecastLineChart({ data, title, unit }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="section-card" style={{ animationDelay: "0ms" }}>
      <h3 className="text-base font-semibold text-gray-800 mb-2">{title}</h3>
      <p className="text-xs text-gray-500 mb-4">Annual growth rate ({unit})</p>
      <div className="w-full h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12, fill: colors.gray[500] }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: colors.gray[500] }}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
              tickCount={6}
            />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: `1px solid ${colors.border.light}`,
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                fontSize: "0.85rem",
              }}
              formatter={(value, name) => [
                `${value.toFixed(1)}%`,
                name === "previous"
                  ? "Pre-Spring Statement"
                  : "Spring Statement",
              ]}
            />
            <Legend
              formatter={(value) =>
                value === "previous"
                  ? "Pre-Spring Statement"
                  : "Spring Statement"
              }
              wrapperStyle={{ fontSize: "0.8rem" }}
            />
            <Line
              type="monotone"
              dataKey="previous"
              stroke={COLORS.previous}
              strokeWidth={2}
              dot={{ r: 3, fill: COLORS.previous }}
              activeDot={{ r: 5 }}
              name="previous"
            />
            <Line
              type="monotone"
              dataKey="updated"
              stroke={COLORS.updated}
              strokeWidth={2.5}
              dot={{ r: 3, fill: COLORS.updated }}
              activeDot={{ r: 5 }}
              name="updated"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ForecastTableCard({ data, title }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="section-card">
      <h3 className="text-base font-semibold text-gray-800 mb-2">{title}</h3>
      <ForecastTable data={data} />
    </div>
  );
}

function buildHeroCards(forecast) {
  return HERO_SERIES.map(({ key, label, targetYear }) => {
    const series = forecast[key];
    if (!series) return null;
    const row = series.find((r) => r.year === targetYear);
    if (!row) return null;
    const change = row.updated - row.previous;
    return {
      label: `${label} ${targetYear}`,
      previous: row.previous,
      updated: row.updated,
      change,
      unit: "pp",
    };
  }).filter(Boolean);
}

export default function ForecastTab({ data }) {
  const [viewMode, setViewMode] = useState("chart");
  const forecast = data?.forecast;

  if (!forecast) {
    return (
      <div className="data-message">
        <p>
          Forecast data not yet available. Ensure{" "}
          <code>public/data/economic_forecast.json</code> has been generated.
        </p>
      </div>
    );
  }

  const heroCards = buildHeroCards(forecast);
  const topRow = ["earnings_growth", "cpi_inflation", "rpi_inflation"];
  const bottomRow = ["house_prices", "per_capita_gdp", "social_rent"];

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      {/* Hero numbers */}
      <div className="grid grid-cols-3 gap-6 mb-8 max-lg:grid-cols-2 max-md:grid-cols-1">
        {heroCards.map((card) => (
          <div key={card.label} className="hero-card">
            <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wider">
              {card.label}
            </div>
            <div className="text-2xl font-bold text-gray-800 mb-1 tracking-tight">
              {card.previous}% &rarr; {card.updated}%
            </div>
            <div
              className={`text-base font-semibold ${
                card.change > 0
                  ? "change-positive"
                  : card.change < 0
                    ? "change-negative"
                    : "change-zero"
              }`}
            >
              {card.change > 0 ? "+" : ""}
              {card.change.toFixed(1)} {card.unit}
            </div>
          </div>
        ))}
      </div>

      {/* Chart / Table toggle */}
      <div className="view-toggle">
        <button
          className={viewMode === "chart" ? "active" : ""}
          onClick={() => setViewMode("chart")}
        >
          Chart
        </button>
        <button
          className={viewMode === "table" ? "active" : ""}
          onClick={() => setViewMode("table")}
        >
          Table
        </button>
      </div>

      {/* Top row */}
      <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4 tracking-tight">
        Key inflation and earnings forecasts
      </h2>
      <div className="charts-grid-3 grid grid-cols-3 gap-6 mb-6 max-lg:grid-cols-2 max-md:grid-cols-1">
        {topRow.map(
          (key) =>
            forecast[key] &&
            (viewMode === "chart" ? (
              <ForecastLineChart
                key={key}
                data={forecast[key]}
                title={SERIES_CONFIG[key].title}
                unit={SERIES_CONFIG[key].unit}
              />
            ) : (
              <ForecastTableCard
                key={key}
                data={forecast[key]}
                title={SERIES_CONFIG[key].title}
              />
            )),
        )}
      </div>

      {/* Bottom row */}
      <h2 className="text-xl font-bold text-gray-800 mt-8 mb-4 tracking-tight">
        Other economic indicators
      </h2>
      <div className="charts-grid-3 grid grid-cols-3 gap-6 mb-6 max-lg:grid-cols-2 max-md:grid-cols-1">
        {bottomRow.map(
          (key) =>
            forecast[key] &&
            (viewMode === "chart" ? (
              <ForecastLineChart
                key={key}
                data={forecast[key]}
                title={SERIES_CONFIG[key].title}
                unit={SERIES_CONFIG[key].unit}
              />
            ) : (
              <ForecastTableCard
                key={key}
                data={forecast[key]}
                title={SERIES_CONFIG[key].title}
              />
            )),
        )}
      </div>
    </div>
  );
}
