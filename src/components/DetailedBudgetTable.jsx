"use client";

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

export default function DetailedBudgetTable({ data, selectedYear, termsMode = "nominal" }) {
  if (!data) return null;

  const reformField = `reform_${termsMode}`;
  const differenceField = `difference_${termsMode}`;

  const filtered = data.filter(
    (row) => parseInt(row.year) === selectedYear,
  );

  if (filtered.length === 0) return null;

  const formatValue = (value) => {
    if (value == null || isNaN(value)) return "\u2014";
    const v = parseFloat(value);
    if (Math.abs(v) < 0.5) return "\u00A30m";
    const sign = v >= 0 ? "" : "-";
    return `${sign}\u00A3${Math.abs(v).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}m`;
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
            <td style={tdRightStyle}>{formatValue(row[reformField])}</td>
            <td style={tdRightStyle}>{formatValue(row[differenceField])}</td>
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
        Per-program impact of revised OBR forecasts on government revenue and
        spending. Values in millions of pounds. Positive difference = fiscal improvement (higher tax revenue or lower spending).
      </p>

      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Program</th>
            <th style={thRightStyle}>Nov 2025 ({"\u00A3"}m)</th>
            <th style={thRightStyle}>Mar 2026 ({"\u00A3"}m)</th>
            <th style={thRightStyle}>Difference ({"\u00A3"}m)</th>
          </tr>
        </thead>
        <tbody>
          {renderGroup("Tax revenue", REVENUE_PROGRAMS)}
          {renderGroup("Benefit spending", SPENDING_PROGRAMS)}
        </tbody>
      </table>

    </div>
  );
}
