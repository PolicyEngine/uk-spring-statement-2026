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

const SERIES_CONFIG = {
  earnings_growth: { title: "Earnings growth", unit: "%" },
  cpi_inflation: { title: "CPI inflation", unit: "%" },
  rpi_inflation: { title: "RPI inflation", unit: "%" },
  house_prices: { title: "House price growth", unit: "%" },
  per_capita_gdp: { title: "Per capita GDP growth", unit: "%" },
  social_rent: { title: "Social rent growth", unit: "%" },
};

const HERO_CARDS = [
  {
    label: "CPI 2026",
    previous: 2.5,
    updated: 2.3,
    change: -0.2,
    unit: "pp",
  },
  {
    label: "RPI 2026",
    previous: 3.7,
    updated: 3.1,
    change: -0.6,
    unit: "pp",
  },
  {
    label: "Earnings 2026",
    previous: 3.3,
    updated: 3.4,
    change: 0.1,
    unit: "pp",
  },
];

const COLORS = {
  previous: "#9ca3af",
  updated: "#0d9488",
};

function ForecastLineChart({ data, title, unit }) {
  if (!data || data.length === 0) return null;

  return (
    <div className="section-card" style={{ animationDelay: "0ms" }}>
      <h3 className="chart-title">{title}</h3>
      <p className="chart-subtitle">Annual growth rate ({unit})</p>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 8, right: 24, left: 8, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 12, fill: "#6b7280" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "#6b7280" }}
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
                border: "1px solid #e5e7eb",
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

export default function ForecastTab({ data }) {
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

  const topRow = ["earnings_growth", "cpi_inflation", "rpi_inflation"];
  const bottomRow = ["house_prices", "per_capita_gdp", "social_rent"];

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      {/* Hero numbers */}
      <div className="hero-numbers">
        {HERO_CARDS.map((card) => (
          <div key={card.label} className="hero-card">
            <div className="hero-label">{card.label}</div>
            <div className="hero-value">
              {card.previous}% &rarr; {card.updated}%
            </div>
            <div
              className={`hero-change ${
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

      {/* Top row charts */}
      <h2 className="section-heading">Key inflation and earnings forecasts</h2>
      <div className="charts-grid-3">
        {topRow.map(
          (key) =>
            forecast[key] && (
              <ForecastLineChart
                key={key}
                data={forecast[key]}
                title={SERIES_CONFIG[key].title}
                unit={SERIES_CONFIG[key].unit}
              />
            ),
        )}
      </div>

      {/* Top row tables */}
      <div className="charts-grid-3">
        {topRow.map(
          (key) =>
            forecast[key] && (
              <div key={`table-${key}`} className="section-card">
                <h3 className="chart-title">
                  {SERIES_CONFIG[key].title} data
                </h3>
                <ForecastTable data={forecast[key]} />
              </div>
            ),
        )}
      </div>

      {/* Bottom row charts */}
      <h2 className="section-heading">Other economic indicators</h2>
      <div className="charts-grid-3">
        {bottomRow.map(
          (key) =>
            forecast[key] && (
              <ForecastLineChart
                key={key}
                data={forecast[key]}
                title={SERIES_CONFIG[key].title}
                unit={SERIES_CONFIG[key].unit}
              />
            ),
        )}
      </div>

      {/* Bottom row tables */}
      <div className="charts-grid-3">
        {bottomRow.map(
          (key) =>
            forecast[key] && (
              <div key={`table-${key}`} className="section-card">
                <h3 className="chart-title">
                  {SERIES_CONFIG[key].title} data
                </h3>
                <ForecastTable data={forecast[key]} />
              </div>
            ),
        )}
      </div>
    </div>
  );
}
