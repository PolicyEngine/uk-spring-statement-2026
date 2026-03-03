import { useState, useEffect } from "react";
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

const OUTCOME_COLORS = {
  "Lose more than 5%": "#991b1b",
  "Lose less than 5%": "#dc2626",
  "No change": "#9ca3af",
  "Gain less than 5%": "#16a34a",
  "Gain more than 5%": "#15803d",
};

const OUTCOME_ORDER = [
  "Lose more than 5%",
  "Lose less than 5%",
  "No change",
  "Gain less than 5%",
  "Gain more than 5%",
];

/**
 * Stacked bar chart showing intra-decile winners and losers.
 * X-axis = income deciles 1-10, Y-axis = share of people (0-100%).
 * 5 stacked segments: red shades (lose), grey (no change), green shades (gain).
 */
export default function IntraDecileChart({
  reformId,
  selectedYear = 2028,
  onYearChange = null,
  availableYears = [2026, 2027, 2028, 2029, 2030],
}) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/data/intra_decile.csv")
      .then((res) => {
        if (!res.ok) return null;
        return res.text();
      })
      .then((csvText) => {
        if (!csvText) return;
        const lines = csvText.trim().split("\n");
        const headers = lines[0].split(",");
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(",");
          const row = {};
          headers.forEach((h, idx) => {
            row[h.trim()] = values[idx]?.trim();
          });
          rows.push(row);
        }
        setData(rows);
      })
      .catch(() => setData(null));
  }, []);

  if (!data || !reformId) return null;

  const filtered = data.filter(
    (row) =>
      row.reform_id === reformId &&
      parseInt(row.year) === selectedYear &&
      row.decile !== "All",
  );

  if (filtered.length === 0) return null;

  // Transform into chart data: one object per decile with outcome keys
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
      point[outcome] = row ? parseFloat(row.share) * 100 : 0;
    });
    return point;
  });

  const formatYearRange = (year) => `${year}-${(year + 1).toString().slice(-2)}`;
  const formatDecile = (value) => value.replace(/st|nd|rd|th/g, "");

  return (
    <div style={{ marginTop: "24px" }}>
      <h3
        className="chart-title"
        style={{ fontSize: "1.1rem", fontWeight: 600 }}
      >
        Winners and losers by income decile
      </h3>
      <p className="chart-description">
        Share of people in each income decile who gain, lose, or see no change
        in net income under the selected policy.
      </p>

      {onYearChange && (
        <div className="chart-controls">
          <div className="year-toggle">
            {availableYears.map((year) => (
              <button
                key={year}
                className={selectedYear === year ? "active" : ""}
                onClick={() => onYearChange(year)}
              >
                {formatYearRange(year)}
              </button>
            ))}
          </div>
        </div>
      )}

      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 10, right: 30, left: 60, bottom: 40 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="decile"
            tickFormatter={formatDecile}
            tick={{ fontSize: 12, fill: "#666" }}
            label={{
              value: "Income decile",
              position: "insideBottom",
              offset: -10,
              style: { fill: "#374151", fontSize: 12, fontWeight: 500 },
            }}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 12, fill: "#666" }}
            label={{
              value: "Share of people",
              angle: -90,
              position: "insideLeft",
              dx: -20,
              style: {
                textAnchor: "middle",
                fill: "#374151",
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
          color: "#666",
          textAlign: "center",
        }}
      >
        Decile 1 = lowest income, Decile 10 = highest income. Changes less than
        0.1% are classified as "No change".
      </p>
    </div>
  );
}
