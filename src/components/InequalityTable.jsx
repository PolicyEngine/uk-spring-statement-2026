"use client";

const METRIC_LABELS = {
  gini: "Gini coefficient",
  top_10_pct_share: "Top 10% income share",
  top_1_pct_share: "Top 1% income share",
};

export default function InequalityTable({ data, selectedYear }) {
  if (!data) return null;

  const reformField = "reform_nominal";

  const filtered = data.filter(
    (row) => parseInt(row.year) === selectedYear,
  );

  if (filtered.length === 0) return null;

  const formatValue = (metric, value) => {
    if (value == null || isNaN(value)) return "\u2014";
    const v = parseFloat(value);
    if (metric === "gini") return v.toFixed(2);
    return `${(v * 100).toFixed(2)}%`;
  };

  const formatChange = (metric, baseline, reform) => {
    if (baseline == null || reform == null) return "\u2014";
    const b = parseFloat(baseline);
    const r = parseFloat(reform);
    const diff = r - b;
    if (metric === "gini") {
      const sign = diff >= 0 ? "+" : "";
      return `${sign}${diff.toFixed(2)}`;
    }
    const pctDiff = diff * 100;
    const sign = pctDiff >= 0 ? "+" : "";
    return `${sign}${pctDiff.toFixed(2)} pp`;
  };

  return (
    <div className="section-card" style={{ marginTop: "24px" }}>
      <h3 className="chart-title">Inequality impact</h3>
      <p className="chart-description">
        Change in income inequality metrics from revised OBR forecasts. Based on equivalised household net income. The Gini coefficient ranges from 0 (perfect equality) to 1 (perfect inequality).
      </p>

      <div className="forecast-table-wrapper">
        <table className="forecast-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>Nov 2025</th>
              <th>Mar 2026</th>
              <th>Change</th>
            </tr>
          </thead>
          <tbody>
            {["gini", "top_10_pct_share", "top_1_pct_share"].map((metric) => {
              const row = filtered.find((r) => r.metric === metric);
              if (!row) return null;
              return (
                <tr key={metric}>
                  <td>{METRIC_LABELS[metric]}</td>
                  <td>{formatValue(metric, row.baseline)}</td>
                  <td>{formatValue(metric, row[reformField])}</td>
                  <td>{formatChange(metric, row.baseline, row[reformField])}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
