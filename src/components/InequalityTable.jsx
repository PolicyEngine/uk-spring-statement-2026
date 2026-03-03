import { useState, useEffect } from "react";

const tableStyle = {
  margin: "12px auto 0 auto",
  width: "auto",
  borderCollapse: "collapse",
  fontSize: "14px",
  backgroundColor: "#fafafa",
  borderRadius: "6px",
  overflow: "hidden",
};
const thStyle = {
  textAlign: "left",
  padding: "10px 16px",
  borderBottom: "2px solid #e5e7eb",
  backgroundColor: "#f3f4f6",
};
const thRightStyle = {
  textAlign: "right",
  padding: "10px 16px",
  borderBottom: "2px solid #e5e7eb",
  backgroundColor: "#f3f4f6",
};
const tdStyle = {
  padding: "10px 16px",
  borderBottom: "1px solid #e5e7eb",
};
const tdRightStyle = {
  textAlign: "right",
  padding: "10px 16px",
  borderBottom: "1px solid #e5e7eb",
};

const METRIC_LABELS = {
  gini: "Gini coefficient",
  top_10_pct_share: "Top 10% income share",
  top_1_pct_share: "Top 1% income share",
};

/**
 * Table showing inequality metrics: Gini coefficient, top 10% and top 1% income shares.
 * Displays baseline vs reform vs change.
 */
export default function InequalityTable({
  reformId,
  selectedYear = 2028,
  onYearChange = null,
  availableYears = [2026, 2027, 2028, 2029, 2030],
}) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/data/inequality.csv")
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
      row.reform_id === reformId && parseInt(row.year) === selectedYear,
  );

  if (filtered.length === 0) return null;

  const formatYearRange = (year) => `${year}-${(year + 1).toString().slice(-2)}`;

  const formatValue = (metric, value) => {
    if (value == null || isNaN(value)) return "\u2014";
    const v = parseFloat(value);
    if (metric === "gini") return v.toFixed(4);
    return `${(v * 100).toFixed(1)}%`;
  };

  const formatChange = (metric, baseline, reform) => {
    if (baseline == null || reform == null) return "\u2014";
    const b = parseFloat(baseline);
    const r = parseFloat(reform);
    const diff = r - b;
    if (metric === "gini") {
      const sign = diff >= 0 ? "+" : "";
      return `${sign}${diff.toFixed(4)}`;
    }
    const pctDiff = diff * 100;
    const sign = pctDiff >= 0 ? "+" : "";
    return `${sign}${pctDiff.toFixed(2)}pp`;
  };

  return (
    <div style={{ marginTop: "24px" }}>
      <h3
        className="chart-title"
        style={{ fontSize: "1.1rem", fontWeight: 600 }}
      >
        Inequality impact
      </h3>
      <p className="chart-description">
        Change in income inequality metrics under the selected policy.
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

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Metric</th>
            <th style={thRightStyle}>Baseline</th>
            <th style={thRightStyle}>Reform</th>
            <th style={thRightStyle}>Change</th>
          </tr>
        </thead>
        <tbody>
          {["gini", "top_10_pct_share", "top_1_pct_share"].map((metric) => {
            const row = filtered.find((r) => r.metric === metric);
            if (!row) return null;
            return (
              <tr key={metric}>
                <td style={tdStyle}>{METRIC_LABELS[metric]}</td>
                <td style={tdRightStyle}>
                  {formatValue(metric, row.baseline)}
                </td>
                <td style={tdRightStyle}>
                  {formatValue(metric, row.reform)}
                </td>
                <td style={tdRightStyle}>
                  {formatChange(metric, row.baseline, row.reform)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p
        style={{
          marginTop: "8px",
          fontSize: "13px",
          color: "#666",
          textAlign: "center",
        }}
      >
        Based on equivalised household net income. The Gini coefficient ranges
        from 0 (perfect equality) to 1 (perfect inequality).
      </p>
    </div>
  );
}
