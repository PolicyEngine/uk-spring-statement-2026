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
const groupHeaderStyle = {
  padding: "10px 16px",
  borderBottom: "1px solid #e5e7eb",
  backgroundColor: "#f9fafb",
  fontWeight: 600,
  fontSize: "13px",
  color: "#374151",
};

const PROGRAM_LABELS = {
  income_tax: "Income Tax",
  national_insurance: "National Insurance (employee)",
  ni_employer: "National Insurance (employer)",
  vat: "VAT",
  council_tax: "Council Tax",
  fuel_duty: "Fuel Duty",
  tax_credits: "Tax Credits",
  universal_credit: "Universal Credit",
  child_benefit: "Child Benefit",
  state_pension: "State Pension",
  pension_credit: "Pension Credit",
};

const REVENUE_PROGRAMS = [
  "income_tax",
  "national_insurance",
  "ni_employer",
  "vat",
  "council_tax",
  "fuel_duty",
];

const SPENDING_PROGRAMS = [
  "tax_credits",
  "universal_credit",
  "child_benefit",
  "state_pension",
  "pension_credit",
];

/**
 * Table showing per-program budgetary breakdown.
 * Revenue programs and spending programs are grouped separately.
 */
export default function DetailedBudgetTable({
  reformId,
  selectedYear = 2028,
  onYearChange = null,
  availableYears = [2026, 2027, 2028, 2029, 2030],
}) {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("/data/detailed_budgetary_impact.csv")
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

  const formatValue = (value) => {
    if (value == null || isNaN(value)) return "\u2014";
    const v = parseFloat(value);
    if (Math.abs(v) < 0.5) return "\u00A30m";
    const sign = v >= 0 ? "" : "-";
    return `${sign}\u00A3${Math.abs(v).toFixed(0)}m`;
  };

  const renderGroup = (label, programs) => {
    const rows = programs
      .map((prog) => filtered.find((r) => r.program === prog))
      .filter(Boolean);

    if (rows.length === 0) return null;

    return (
      <>
        <tr>
          <td style={groupHeaderStyle} colSpan={4}>
            {label}
          </td>
        </tr>
        {rows.map((row) => (
          <tr key={row.program}>
            <td style={{ ...tdStyle, paddingLeft: "28px" }}>
              {PROGRAM_LABELS[row.program] || row.program}
            </td>
            <td style={tdRightStyle}>{formatValue(row.baseline)}</td>
            <td style={tdRightStyle}>{formatValue(row.reform)}</td>
            <td style={tdRightStyle}>{formatValue(row.difference)}</td>
          </tr>
        ))}
      </>
    );
  };

  return (
    <div style={{ marginTop: "24px" }}>
      <h3
        className="chart-title"
        style={{ fontSize: "1.1rem", fontWeight: 600 }}
      >
        Detailed budgetary breakdown
      </h3>
      <p className="chart-description">
        Per-program breakdown of budgetary impact. Positive difference = revenue
        gain or spending reduction for government.
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
            <th style={thStyle}>Program</th>
            <th style={thRightStyle}>Baseline (\u00A3m)</th>
            <th style={thRightStyle}>Reform (\u00A3m)</th>
            <th style={thRightStyle}>Difference (\u00A3m)</th>
          </tr>
        </thead>
        <tbody>
          {renderGroup("Tax revenue", REVENUE_PROGRAMS)}
          {renderGroup("Benefit spending", SPENDING_PROGRAMS)}
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
        Values in millions of pounds. Positive difference = fiscal improvement
        (higher tax revenue or lower spending).
      </p>
    </div>
  );
}
