import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import DecileChart from "./DecileChart";
import BudgetBarChart from "./BudgetBarChart";
import PovertyImpactTable from "./PovertyImpactTable";
import LocalAreaSection from "./LocalAreaSection";
import OBRComparisonTable from "./OBRComparisonTable";
import "./Dashboard.css";
import { POLICY_NAMES, ALL_POLICY_IDS, REVENUE_POLICIES } from "../utils/policyConfig";
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

// Small chart component for threshold comparisons
const ThresholdChart = ({ data, baselineLabel = "Baseline", reformLabel = "Reform" }) => (
  <div style={{
    maxWidth: "450px",
    margin: "16px auto 8px auto",
    background: "#fafbfc",
    borderRadius: "8px",
    padding: "12px"
  }}>
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="year" tick={{ fontSize: 10 }} tickLine={false} />
        <YAxis
          tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          domain={['auto', 'auto']}
          width={45}
        />
        <Tooltip
          formatter={(value, name) => [`£${value.toLocaleString()}`, name]}
          labelFormatter={(label) => label}
          contentStyle={{ fontSize: "12px", borderRadius: "6px" }}
        />
        <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
        <Line
          type="monotone"
          dataKey="baseline"
          stroke="#9CA3AF"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ r: 3, fill: "#9CA3AF" }}
          name={baselineLabel}
        />
        <Line
          type="monotone"
          dataKey="reform"
          stroke="#0D9488"
          strokeWidth={2}
          dot={{ r: 3, fill: "#0D9488" }}
          name={reformLabel}
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

// Data for threshold charts
const BASIC_RATE_THRESHOLD_DATA = [
  { year: "2025-26", baseline: 15398, reform: 15398 },
  { year: "2026-27", baseline: 15706, reform: 16538 },
  { year: "2027-28", baseline: 16020, reform: 16872 },
  { year: "2028-29", baseline: 16341, reform: 17216 },
  { year: "2029-30", baseline: 16667, reform: 17567 },
  { year: "2030-31", baseline: 17001, reform: 17918 },
];

const INTERMEDIATE_RATE_THRESHOLD_DATA = [
  { year: "2025-26", baseline: 27492, reform: 27492 },
  { year: "2026-27", baseline: 28042, reform: 29527 },
  { year: "2027-28", baseline: 28603, reform: 30123 },
  { year: "2028-29", baseline: 29175, reform: 30738 },
  { year: "2029-30", baseline: 29758, reform: 31365 },
  { year: "2030-31", baseline: 30354, reform: 31992 },
];

const HIGHER_RATE_THRESHOLD_DATA = [
  { year: "2025-26", baseline: 43662, reform: 43662 },
  { year: "2026-27", baseline: 43662, reform: 43662 },
  { year: "2027-28", baseline: 44544, reform: 43662 },
  { year: "2028-29", baseline: 45453, reform: 43662 },
  { year: "2029-30", baseline: 46380, reform: 44553 },
  { year: "2030-31", baseline: 47308, reform: 45444 },
];

const ADVANCED_RATE_THRESHOLD_DATA = [
  { year: "2025-26", baseline: 75000, reform: 75000 },
  { year: "2026-27", baseline: 75000, reform: 75000 },
  { year: "2027-28", baseline: 76515, reform: 75000 },
  { year: "2028-29", baseline: 78076, reform: 75000 },
  { year: "2029-30", baseline: 79669, reform: 76530 },
  { year: "2030-31", baseline: 81262, reform: 78061 },
];

const TOP_RATE_THRESHOLD_DATA = [
  { year: "2025-26", baseline: 125140, reform: 125140 },
  { year: "2026-27", baseline: 125140, reform: 125140 },
  { year: "2027-28", baseline: 127668, reform: 125140 },
  { year: "2028-29", baseline: 130273, reform: 125140 },
  { year: "2029-30", baseline: 132930, reform: 127693 },
  { year: "2030-31", baseline: 135589, reform: 130247 },
];

// Section definitions for navigation
const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "income-tax-benefits", label: "Income tax and benefits" },
];

// Common table styles
const tableStyle = {
  margin: "12px auto 0 auto",
  width: "auto",
  borderCollapse: "collapse",
  fontSize: "14px",
  backgroundColor: "#fafafa",
  borderRadius: "6px",
  overflow: "hidden",
};
const thStyle = { textAlign: "left", padding: "10px 16px", borderBottom: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" };
const thCenterStyle = { textAlign: "center", padding: "10px 16px", borderBottom: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" };
const thRightStyle = { textAlign: "right", padding: "10px 16px", borderBottom: "2px solid #e5e7eb", backgroundColor: "#f3f4f6" };
const tdStyle = { padding: "10px 16px", borderBottom: "1px solid #e5e7eb" };
const tdCenterStyle = { textAlign: "center", padding: "10px 16px", borderBottom: "1px solid #e5e7eb" };
const tdRightStyle = { textAlign: "right", padding: "10px 16px", borderBottom: "1px solid #e5e7eb" };
const noteStyle = { marginTop: "12px", fontSize: "13px", color: "#666", textAlign: "left", width: "100%" };
const summaryStyle = { cursor: "pointer", color: "#2c6e49", fontWeight: "500" };

// Policy descriptions (active voice, clear impacts)
const POLICY_INFO = {
  policy_a: {
    name: "Policy A",
    description: "Policy details to be confirmed",
    explanation: (
      <li>
        <strong>Policy A</strong>: Policy details to be confirmed.
      </li>
    ),
  },
  policy_b: {
    name: "Policy B",
    description: "Policy details to be confirmed",
    explanation: (
      <li>
        <strong>Policy B</strong>: Policy details to be confirmed.
      </li>
    ),
  },
  policy_c: {
    name: "Policy C",
    description: "Policy details to be confirmed",
    explanation: (
      <li>
        <strong>Policy C</strong>: Policy details to be confirmed.
      </li>
    ),
  },
  policy_d: {
    name: "Policy D",
    description: "Policy details to be confirmed",
    explanation: (
      <li>
        <strong>Policy D</strong>: Policy details to be confirmed.
      </li>
    ),
  },
  policy_e: {
    name: "Policy E",
    description: "Policy details to be confirmed",
    explanation: (
      <li>
        <strong>Policy E</strong>: Policy details to be confirmed.
      </li>
    ),
  },
  policy_f: {
    name: "Policy F",
    description: "Policy details to be confirmed",
    explanation: (
      <li>
        <strong>Policy F</strong>: Policy details to be confirmed.
      </li>
    ),
  },
  combined: {
    name: "all policies",
    description: "Full UK Spring Statement 2026 package",
    explanation: null, // Will be rendered dynamically
  },
};

export default function Dashboard({ selectedPolicies = [] }) {
  // Determine effective policy for data loading
  const effectivePolicy = useMemo(() => {
    if (selectedPolicies.length >= 2) return "combined";
    if (selectedPolicies.length === 1) return selectedPolicies[0];
    return null;
  }, [selectedPolicies]);

  const isStacked = selectedPolicies.length >= 2;
  const [loading, setLoading] = useState(true);
  const [povertyMetrics, setPovertyMetrics] = useState([]);
  const [budgetaryData, setBudgetaryData] = useState(null);
  const [rawBudgetaryData, setRawBudgetaryData] = useState([]);
  const [rawDistributionalData, setRawDistributionalData] = useState([]);
  const [activeSection, setActiveSection] = useState("introduction");
  const [selectedYear, setSelectedYear] = useState(2028);

  const AVAILABLE_YEARS = [2026, 2027, 2028, 2029, 2030];

  // Refs for section elements
  const sectionRefs = useRef({});

  // Parse CSV text into array of objects
  const parseCSV = (csvText) => {
    const lines = csvText.trim().split("\n");
    const headers = lines[0].split(",");
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",");
      const row = {};
      headers.forEach((header, idx) => {
        row[header.trim()] = values[idx]?.trim();
      });
      data.push(row);
    }
    return data;
  };

  // Load data from CSV files
  useEffect(() => {
    async function loadData() {
      if (!effectivePolicy) return;

      try {
        const [distRes, metricsRes, budgetRes] = await Promise.all([
          fetch("/data/distributional_impact.csv"),
          fetch("/data/metrics.csv"),
          fetch("/data/budgetary_impact.csv"),
        ]);

        if (distRes.ok) {
          const csvText = await distRes.text();
          const data = parseCSV(csvText);

          // Store raw data for year selection and stacked charts
          setRawDistributionalData(data);
        }

        if (metricsRes.ok) {
          const csvText = await metricsRes.text();
          const data = parseCSV(csvText);

          // Filter to effective policy and transform for table
          const policyMetrics = data
            .filter(row => row.reform_id === effectivePolicy)
            .map(row => ({
              year: parseInt(row.year),
              metric: row.metric,
              value: parseFloat(row.value),
            }));
          setPovertyMetrics(policyMetrics);
        }

        if (budgetRes.ok) {
          const csvText = await budgetRes.text();
          const data = parseCSV(csvText);

          // Store raw data for stacked charts
          setRawBudgetaryData(data);

          // Group by reform
          const byReform = {};
          data.forEach(row => {
            const id = row.reform_id;
            if (!byReform[id]) {
              byReform[id] = {
                id,
                name: row.reform_name,
                years: {},
              };
            }
            byReform[id].years[row.year] = parseFloat(row.value) || 0;
          });

          setBudgetaryData(byReform);
        }
      } catch (err) {
        console.warn("Using fallback data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [effectivePolicy]);

  // Scroll to section handler
  const scrollToSection = useCallback((sectionId) => {
    const element = sectionRefs.current[sectionId];
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // Track active section on scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 150;

      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const section = SECTIONS[i];
        const element = sectionRefs.current[section.id];
        if (element && element.offsetTop <= scrollPosition) {
          setActiveSection(section.id);
          break;
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Transform budgetary data for stacked charts
  const stackedBudgetData = useMemo(() => {
    if (!isStacked || rawBudgetaryData.length === 0) return null;

    const years = [2026, 2027, 2028, 2029, 2030];
    return years.map(year => {
      const dataPoint = { year };
      let netImpact = 0;

      ALL_POLICY_IDS.forEach(policyId => {
        const policyName = POLICY_NAMES[policyId];
        const row = rawBudgetaryData.find(
          r => r.reform_id === policyId && parseInt(r.year) === year
        );
        const value = row ? parseFloat(row.value) || 0 : 0;
        dataPoint[policyName] = value;
        // Only include in netImpact if policy is selected
        if (selectedPolicies.includes(policyId)) {
          netImpact += value;
        }
      });

      dataPoint.netImpact = netImpact;
      return dataPoint;
    });
  }, [isStacked, rawBudgetaryData, selectedPolicies]);

  // Transform distributional data for stacked decile chart
  const stackedDecileData = useMemo(() => {
    if (!isStacked || rawDistributionalData.length === 0) return null;

    const deciles = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
    return deciles.map(decile => {
      const dataPoint = { decile };
      let netRelative = 0;
      let netAbsolute = 0;

      ALL_POLICY_IDS.forEach(policyId => {
        const policyName = POLICY_NAMES[policyId];
        const row = rawDistributionalData.find(
          r => r.reform_id === policyId && r.year === String(selectedYear) && r.decile === decile
        );
        const relValue = row ? parseFloat(row.value) || 0 : 0;
        const absValue = row ? parseFloat(row.absolute_change) || 0 : 0;
        dataPoint[`${policyName}_relative`] = relValue;
        dataPoint[`${policyName}_absolute`] = absValue;
        // Only include in net if policy is selected
        if (selectedPolicies.includes(policyId)) {
          netRelative += relValue;
          netAbsolute += absValue;
        }
      });

      dataPoint.netRelative = netRelative;
      dataPoint.netAbsolute = netAbsolute;
      return dataPoint;
    });
  }, [isStacked, rawDistributionalData, selectedYear, selectedPolicies]);

  // Calculate decile chart y-axis domain across ALL years for consistent axis
  const decileYAxisDomain = useMemo(() => {
    if (!isStacked || rawDistributionalData.length === 0) return null;

    const deciles = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
    let maxAbsRelative = 0;
    let maxAbsAbsolute = 0;

    // Check all years to find max values
    AVAILABLE_YEARS.forEach(year => {
      deciles.forEach(decile => {
        let posRelative = 0, negRelative = 0;
        let posAbsolute = 0, negAbsolute = 0;

        selectedPolicies.forEach(policyId => {
          const policyName = POLICY_NAMES[policyId];
          const row = rawDistributionalData.find(
            r => r.reform_id === policyId && r.year === String(year) && r.decile === decile
          );
          const relValue = row ? parseFloat(row.value) || 0 : 0;
          const absValue = row ? parseFloat(row.absolute_change) || 0 : 0;

          // Check if this is a revenue policy (values should be negative)
          const isRevenue = REVENUE_POLICIES.includes(policyId);
          const adjustedRel = isRevenue ? -Math.abs(relValue) : relValue;
          const adjustedAbs = isRevenue ? -Math.abs(absValue) : absValue;

          if (adjustedRel > 0) posRelative += adjustedRel;
          else negRelative += adjustedRel;
          if (adjustedAbs > 0) posAbsolute += adjustedAbs;
          else negAbsolute += adjustedAbs;
        });

        maxAbsRelative = Math.max(maxAbsRelative, Math.abs(posRelative), Math.abs(negRelative));
        maxAbsAbsolute = Math.max(maxAbsAbsolute, Math.abs(posAbsolute), Math.abs(negAbsolute));
      });
    });

    // Round up to nice numbers
    const relInterval = maxAbsRelative <= 1 ? 0.5 : maxAbsRelative <= 3 ? 1 : 2;
    const absInterval = maxAbsAbsolute <= 50 ? 10 : maxAbsAbsolute <= 100 ? 20 : 50;
    const roundedRelative = Math.ceil((maxAbsRelative * 1.1) / relInterval) * relInterval || 1;
    const roundedAbsolute = Math.ceil((maxAbsAbsolute * 1.1) / absInterval) * absInterval || 40;

    return {
      relative: [-roundedRelative, roundedRelative],
      absolute: [-roundedAbsolute, roundedAbsolute],
    };
  }, [isStacked, rawDistributionalData, selectedPolicies]);

  // Get decile data filtered by selected year - aggregate selected policies
  const decileDataForYear = useMemo(() => {
    if (rawDistributionalData.length === 0) return [];

    // If multiple policies selected, aggregate their values
    if (selectedPolicies.length > 1) {
      const deciles = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
      return deciles.map(decile => {
        let relativeSum = 0;
        let absoluteSum = 0;

        selectedPolicies.forEach(policyId => {
          const row = rawDistributionalData.find(
            r => r.reform_id === policyId && r.year === String(selectedYear) && r.decile === decile
          );
          if (row) {
            relativeSum += parseFloat(row.value) || 0;
            absoluteSum += parseFloat(row.absolute_change) || 0;
          }
        });

        return {
          decile,
          relativeChange: relativeSum,
          absoluteChange: absoluteSum,
        };
      });
    }

    // Single policy - use directly
    return rawDistributionalData
      .filter(row =>
        row.year === String(selectedYear) &&
        row.reform_id === effectivePolicy &&
        row.decile !== "All"
      )
      .map(row => ({
        decile: row.decile,
        relativeChange: parseFloat(row.value) || 0,
        absoluteChange: parseFloat(row.absolute_change) || 0,
      }));
  }, [rawDistributionalData, selectedYear, effectivePolicy, selectedPolicies]);

  const policyInfo = POLICY_INFO[effectivePolicy] || POLICY_INFO.policy_a;

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading UK projections...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Introduction */}
      <h2 className="section-title" id="introduction" ref={(el) => (sectionRefs.current["introduction"] = el)}>Introduction</h2>
      <p className="chart-description">
        The Chancellor announced the UK Spring Statement 2026 on [date to be confirmed].
        This dashboard estimates how the statement affects household incomes, poverty rates, and different areas across the UK.
      </p>
      <details className="budget-measures-details" style={{ marginTop: "12px" }}>
        <summary style={{ cursor: "pointer", color: "#2c6e49", fontWeight: "500" }}>
          Click to see what the Spring Statement includes
        </summary>
        <ul className="policy-list">
          {isStacked ? (
            <>
              {POLICY_INFO.policy_a.explanation}
              {POLICY_INFO.policy_b.explanation}
              {POLICY_INFO.policy_c.explanation}
              {POLICY_INFO.policy_d.explanation}
              {POLICY_INFO.policy_e.explanation}
              {POLICY_INFO.policy_f.explanation}
            </>
          ) : (
            policyInfo.explanation
          )}
        </ul>
        <details className="methodology-details" style={{ marginTop: "12px" }}>
          <summary>Methodology</summary>
          <p>
            This analysis uses the PolicyEngine microsimulation model, which{" "}
            reweights the Family Resources Survey to match UK demographics.
          </p>
        </details>
      </details>

      {/* Income Tax and Benefits Section */}
      <h2 className="section-title" id="income-tax-benefits" ref={(el) => (sectionRefs.current["income-tax-benefits"] = el)} style={{ marginTop: "32px" }}>Income tax and benefits</h2>

      {/* Budgetary Impact Section */}
      <h3 className="section-title" id="budgetary-impact" ref={(el) => (sectionRefs.current["budgetary-impact"] = el)} style={{ fontSize: "1.4rem", fontWeight: 600, color: "#374151", borderBottom: "none", marginTop: "24px", marginBottom: "12px", padding: "0" }}>Budgetary impact</h3>
      <p className="chart-description">
        This section shows the estimated fiscal cost of the measures to the UK Government.
      </p>

      {isStacked && stackedBudgetData ? (
        <BudgetBarChart
          data={stackedBudgetData}
          title="Estimated budgetary impact"
          description="Positive values indicate revenue gains for the Government, whilst negative values indicate costs to the Treasury."
          tooltipLabel="Cost"
          stacked={true}
          selectedPolicies={selectedPolicies}
        />
      ) : budgetaryData && budgetaryData[effectivePolicy] && (
        <BudgetBarChart
          data={Object.entries(budgetaryData[effectivePolicy].years)
            .map(([year, value]) => ({ year: parseInt(year), value }))
            .sort((a, b) => a.year - b.year)}
          title="Estimated budgetary impact"
          description="Positive values indicate revenue gains for the Government, whilst negative values indicate costs to the Treasury."
          tooltipLabel="Cost"
        />
      )}

      {/* OBR Comparison Table */}
      <OBRComparisonTable />

      {/* Living Standards Section */}
      <h3 className="section-title" id="living-standards" ref={(el) => (sectionRefs.current["living-standards"] = el)} style={{ fontSize: "1.4rem", fontWeight: 600, color: "#374151", borderBottom: "none", marginTop: "48px", paddingTop: "32px", borderTop: "1px solid #e5e7eb", marginBottom: "12px", padding: "32px 0 0 0" }}>Living standards</h3>
      <p className="chart-description">
        This section shows how UK household incomes change as a result of the {policyInfo.name} policy.
      </p>

      {/* Decile Impact Chart */}
      {(isStacked && stackedDecileData) || decileDataForYear.length > 0 ? (
        <DecileChart
          data={decileDataForYear}
          title="Impact by income decile"
          description="Impact of selected policies across income deciles. Values shown are averages across all households in each decile."
          stacked={isStacked}
          stackedData={stackedDecileData}
          selectedYear={selectedYear}
          onYearChange={setSelectedYear}
          availableYears={AVAILABLE_YEARS}
          selectedPolicies={selectedPolicies}
          fixedYAxisDomain={decileYAxisDomain}
        />
      ) : null}

      {/* Poverty Section */}
      <h3 className="section-title" id="poverty" ref={(el) => (sectionRefs.current["poverty"] = el)} style={{ fontSize: "1.4rem", fontWeight: 600, color: "#374151", borderBottom: "none", marginTop: "48px", paddingTop: "32px", borderTop: "1px solid #e5e7eb", marginBottom: "12px", padding: "32px 0 0 0" }}>Poverty rate</h3>
      <p className="chart-description">
        This section shows how poverty rates change under the budget measures.
        The UK uses four poverty measures: absolute vs relative poverty, each measured before or after housing costs.
        Absolute poverty uses a fixed threshold (60% of 2010-11 median income, adjusted for inflation),
        while relative poverty uses 60% of current median income.
              </p>

      {/* Poverty Impact Table */}
      {povertyMetrics.length > 0 && (
        <PovertyImpactTable
          data={povertyMetrics}
          title="Poverty rate impact by year"
          policyName={`the ${policyInfo.name} policy`}
        />
      )}

      {/* Local Authority Impact Section */}
      <h3 className="section-title" id="local-authorities" ref={(el) => (sectionRefs.current["local-authorities"] = el)} style={{ fontSize: "1.4rem", fontWeight: 600, color: "#374151", borderBottom: "none", marginTop: "48px", paddingTop: "32px", borderTop: "1px solid #e5e7eb", marginBottom: "12px", padding: "32px 0 0 0" }}>Impact by local authority</h3>
      <p className="chart-description">
        This section shows how the measures affect different local authorities across the UK.
        Select a local authority to see the estimated impact on households in that area.
      </p>

      <LocalAreaSection
        selectedPolicies={selectedPolicies}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        availableYears={AVAILABLE_YEARS}
      />

      {/* Additional policy section placeholder */}
      {/* Additional policy-specific sections to be added here */}
    </div>
  );
}
