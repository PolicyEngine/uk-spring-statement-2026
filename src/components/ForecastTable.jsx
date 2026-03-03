/**
 * Reusable forecast data table.
 * Shows Year, Previous, Updated, Change columns with color-coded change values.
 */
export default function ForecastTable({ data, format = "percent" }) {
  if (!data || data.length === 0) return null;

  const formatValue = (value) => {
    if (value === null || value === undefined) return "—";
    if (format === "currency") {
      return `${value >= 0 ? "" : "-"}${Math.abs(value).toFixed(1)}%`;
    }
    return `${value.toFixed(1)}%`;
  };

  const formatChange = (value) => {
    if (value === null || value === undefined) return "—";
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toFixed(1)} pp`;
  };

  const getChangeClass = (value) => {
    if (value === null || value === undefined || Math.abs(value) < 0.05) {
      return "change-zero";
    }
    return value > 0 ? "change-positive" : "change-negative";
  };

  return (
    <div className="forecast-table-wrapper">
      <table className="forecast-table">
        <thead>
          <tr>
            <th>Year</th>
            <th>Previous</th>
            <th>Updated</th>
            <th>Change</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.year}>
              <td>{row.year}</td>
              <td>{formatValue(row.previous)}</td>
              <td>{formatValue(row.updated)}</td>
              <td className={getChangeClass(row.change)}>
                {formatChange(row.change)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
