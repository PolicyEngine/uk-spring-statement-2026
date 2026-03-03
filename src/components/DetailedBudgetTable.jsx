"use client";

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
          <td
            colSpan={4}
            style={{
              fontWeight: 600,
              fontSize: "0.8rem",
              color: "var(--pe-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.03em",
              padding: "10px 12px",
              borderBottom: "1px solid var(--pe-gray-100)",
            }}
          >
            {label}
          </td>
        </tr>
        {rows.map((row) => (
          <tr key={row.program}>
            <td style={{ paddingLeft: "24px" }}>
              {PROGRAM_LABELS[row.program] || row.program}
            </td>
            <td>{formatValue(row.baseline)}</td>
            <td>{formatValue(row[reformField])}</td>
            <td>{formatValue(row[differenceField])}</td>
          </tr>
        ))}
      </>
    );
  };

  return (
    <div className="section-card" style={{ marginTop: "24px" }}>
      <h3 className="chart-title">Detailed budgetary breakdown</h3>
      <p className="chart-description">
        Per-program impact of revised OBR forecasts on government revenue and
        spending. Values in millions of pounds. Positive difference = fiscal improvement (higher tax revenue or lower spending).
      </p>

      <div className="forecast-table-wrapper">
        <table className="forecast-table">
          <thead>
            <tr>
              <th>Program</th>
              <th>Nov 2025 ({"\u00A3"}m)</th>
              <th>Mar 2026 ({"\u00A3"}m)</th>
              <th>Difference ({"\u00A3"}m)</th>
            </tr>
          </thead>
          <tbody>
            {renderGroup("Tax revenue", REVENUE_PROGRAMS)}
            {renderGroup("Benefit spending", SPENDING_PROGRAMS)}
          </tbody>
        </table>
      </div>
    </div>
  );
}
