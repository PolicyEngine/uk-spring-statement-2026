"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as d3 from "d3";
import "./PersonalTab.css";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://policyengine--spring-statement-calculator-fastapi-app.modal.run";

const STUDENT_LOAN_PLANS = [
  { value: "NO_STUDENT_LOAN", label: "None" },
  { value: "PLAN_1", label: "Plan 1", description: "Started before Sept 2012 (Eng/Wales) or Scotland/NI" },
  { value: "PLAN_2", label: "Plan 2", description: "Started Sept 2012+ (England/Wales)" },
  { value: "PLAN_4", label: "Plan 4", description: "Scotland" },
  { value: "PLAN_5", label: "Plan 5", description: "Started Aug 2023+ (England)" },
];

const COLORS = {
  positive: "#059669",
  negative: "#dc2626",
  teal: "#319795",
  tealDark: "#2c7a7b",
  text: "#1e293b",
  textSecondary: "#475569",
  border: "#e2e8f0",
};

function formatCurrency(value) {
  const absVal = Math.abs(value);
  const formatted =
    absVal >= 1
      ? `\u00A3${absVal.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
      : `\u00A3${absVal.toFixed(2)}`;
  if (value < -0.005) return `\u2212${formatted}`;
  if (value > 0.005) return `+${formatted}`;
  return formatted;
}

export default function PersonalTab() {
  // Form state
  const [draftIncome, setDraftIncome] = useState(30000);
  const [draftChildren, setDraftChildren] = useState(0);
  const [draftChildrenAges, setDraftChildrenAges] = useState([]);
  const [draftRent, setDraftRent] = useState(800);
  const [draftIsCouple, setDraftIsCouple] = useState(true);
  const [draftPartnerIncome, setDraftPartnerIncome] = useState(0);
  const [draftAdultAge, setDraftAdultAge] = useState(30);
  const [draftPartnerAge, setDraftPartnerAge] = useState(30);
  const [draftRegion, setDraftRegion] = useState("LONDON");
  const [draftTenureType, setDraftTenureType] = useState("RENT_PRIVATELY");
  const [draftChildcare, setDraftChildcare] = useState(0);
  const [draftStudentLoan, setDraftStudentLoan] = useState("NO_STUDENT_LOAN");
  const [draftHasPostgrad, setDraftHasPostgrad] = useState(false);
  const [draftLoanBalance, setDraftLoanBalance] = useState(40000);
  const [draftSalaryGrowthRate, setDraftSalaryGrowthRate] = useState(0.03);
  const [draftInterestRate, setDraftInterestRate] = useState(0.04);
  const [draftYear, setDraftYear] = useState(2029);
  const [studentLoanExpanded, setStudentLoanExpanded] = useState(false);
  const [moreDetailsExpanded, setMoreDetailsExpanded] = useState(false);

  useEffect(() => {
    setDraftChildrenAges((prev) => {
      if (draftChildren === 0) return [];
      if (prev.length === draftChildren) return prev;
      const next = [...prev];
      while (next.length < draftChildren) next.push(5);
      return next.slice(0, draftChildren);
    });
  }, [draftChildren]);

  // API state
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasCalculated, setHasCalculated] = useState(false);

  // Multi-year state
  const [multiYearData, setMultiYearData] = useState(null);
  const [multiYearLoading, setMultiYearLoading] = useState(false);

  // Chart refs
  const multiYearChartRef = useRef(null);

  const handleCalculate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setMultiYearData(null);
    setMultiYearLoading(true);

    const effectiveStudentLoanPlan =
      draftStudentLoan === "NO_STUDENT_LOAN" && draftHasPostgrad
        ? "POSTGRADUATE"
        : draftStudentLoan;

    const requestBody = {
      employment_income: draftIncome,
      self_employment_income: 0,
      num_children: draftChildren,
      children_ages: draftChildrenAges.length > 0 ? draftChildrenAges : null,
      monthly_rent: draftRent,
      is_couple: draftIsCouple,
      partner_income: draftPartnerIncome,
      adult_age: draftAdultAge,
      partner_age: draftPartnerAge,
      region: draftRegion,
      tenure_type: draftTenureType,
      childcare_expenses: draftChildcare,
      student_loan_plan: effectiveStudentLoanPlan,
      salary_growth_rate: draftSalaryGrowthRate,
      year: draftYear,
    };

    const mainPromise = fetch(`${API_URL}/spring-statement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const multiYearPromise = fetch(`${API_URL}/spring-statement/multi-year`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    try {
      const response = await mainPromise;
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.detail || `Server error (${response.status})`);
      }
      const data = await response.json();
      setResult(data);
      setHasCalculated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }

    multiYearPromise
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMultiYearData(d))
      .catch(() => {})
      .finally(() => setMultiYearLoading(false));
  }, [
    draftIncome, draftChildren, draftChildrenAges, draftRent, draftIsCouple,
    draftPartnerIncome, draftAdultAge, draftPartnerAge, draftRegion,
    draftTenureType, draftChildcare,
    draftStudentLoan, draftHasPostgrad, draftLoanBalance,
    draftSalaryGrowthRate, draftInterestRate, draftYear,
  ]);

  // Multi-year bar chart data
  const multiYearChartData = useMemo(() => {
    if (!multiYearData?.yearly_impact) return [];
    return Object.entries(multiYearData.yearly_impact)
      .filter(([year]) => Number(year) <= 2029)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, impact]) => ({
        year,
        label: `${year}-${String(Number(year) + 1).slice(-2)}`,
        impact,
      }));
  }, [multiYearData]);

  // D3 multi-year bar chart
  useEffect(() => {
    if (!multiYearChartRef.current || multiYearChartData.length === 0) return;

    const container = multiYearChartRef.current;
    const containerWidth = container.clientWidth;
    const margin = { top: 24, right: 20, bottom: 40, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = 280;

    d3.select(container).selectAll("*").remove();

    const svg = d3.select(container)
      .append("svg")
      .attr("width", containerWidth)
      .attr("height", height + margin.top + margin.bottom);

    const g = svg.append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(multiYearChartData.map((d) => d.label))
      .range([0, width])
      .padding(0.35);

    const maxAbs = d3.max(multiYearChartData, (d) => Math.abs(d.impact)) || 10;
    const yExtent = maxAbs * 1.35;

    const y = d3.scaleLinear()
      .domain([-yExtent, yExtent])
      .range([height, 0]);

    g.append("g").attr("class", "grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""));

    g.append("line")
      .attr("x1", 0).attr("x2", width)
      .attr("y1", y(0)).attr("y2", y(0))
      .attr("stroke", "#94a3b8").attr("stroke-width", 1);

    const tooltip = d3.select(container).append("div").attr("class", "bar-tooltip");

    g.selectAll(".multi-year-bar")
      .data(multiYearChartData)
      .join("rect")
      .attr("class", "multi-year-bar")
      .attr("x", (d) => x(d.label))
      .attr("width", x.bandwidth())
      .attr("y", (d) => (d.impact >= 0 ? y(d.impact) : y(0)))
      .attr("height", (d) => Math.abs(y(d.impact) - y(0)))
      .attr("rx", 4)
      .attr("fill", (d) => d.impact >= 0 ? COLORS.positive : COLORS.negative)
      .attr("opacity", 0.85)
      .on("mouseenter", (event, d) => {
        const sign = d.impact >= 0 ? "+" : "\u2212";
        tooltip.style("opacity", 1)
          .html(
            `<div class="tooltip-label">${d.label}</div>` +
            `<div class="tooltip-value" style="color: ${d.impact >= 0 ? COLORS.positive : COLORS.negative}">${sign}\u00A3${Math.abs(d.impact).toFixed(2)}/year</div>`
          );
      })
      .on("mousemove", (event) => {
        tooltip.style("left", event.clientX + 12 + "px").style("top", event.clientY - 10 + "px");
      })
      .on("mouseleave", () => tooltip.style("opacity", 0));

    g.selectAll(".multi-year-label")
      .data(multiYearChartData)
      .join("text")
      .attr("class", "multi-year-label")
      .attr("x", (d) => x(d.label) + x.bandwidth() / 2)
      .attr("y", (d) => (d.impact >= 0 ? y(d.impact) - 8 : y(d.impact) + 18))
      .attr("text-anchor", "middle")
      .attr("fill", (d) => d.impact >= 0 ? COLORS.positive : COLORS.negative)
      .attr("font-size", "13px")
      .attr("font-weight", "600")
      .text((d) => {
        const sign = d.impact >= 0 ? "+" : "\u2212";
        return `${sign}\u00A3${Math.abs(d.impact).toFixed(0)}`;
      });

    g.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(0))
      .select(".domain").remove();

    g.selectAll(".axis text")
      .attr("font-size", "13px").attr("font-weight", "500")
      .attr("fill", "#475569").attr("dy", "1em");

    g.append("g").attr("class", "axis axis-y")
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `\u00A3${d}`))
      .select(".domain").remove();

    g.selectAll(".axis-y text")
      .attr("font-size", "11px").attr("font-weight", "500").attr("fill", "#475569");
  }, [multiYearChartData]);

  const netImpact = result?.impact?.household_net_income || 0;

  return (
    <div className="narrative-container">
      <p className="narrative-about">
        See how the Spring Statement 2026 OBR forecast changes affect your
        household&apos;s net income. Enter your details and hit Calculate to see your
        personal impact.
      </p>

      {/* Controls */}
      <div className="controls-panel">
        <div className="controls-panel-header">
          <h2 className="controls-panel-title">Your household</h2>
          <button
            className="calculate-button"
            onClick={handleCalculate}
            disabled={loading}
          >
            {loading ? "Calculating\u2026" : "Calculate"}
            {!loading && <span className="calculate-arrow">{"\u2192"}</span>}
          </button>
        </div>

        <div className="controls-group">
          <div className="controls-row controls-row-6">
            <div className="control-item control-span-2">
              <label>Fiscal year</label>
              <select value={draftYear} onChange={(e) => setDraftYear(parseInt(e.target.value))}>
                {[2025, 2026, 2027, 2028, 2029].map((y) => (
                  <option key={y} value={y}>{y}-{String(y + 1).slice(-2)}</option>
                ))}
              </select>
            </div>
            <div className="control-item control-span-2">
              <label>Employment income</label>
              <div className="salary-input-wrapper">
                <span className="currency-symbol">&pound;</span>
                <input
                  type="number"
                  value={draftIncome}
                  onChange={(e) => setDraftIncome(parseFloat(e.target.value) || 0)}
                  min={0} step={1000} placeholder="e.g. 30000"
                />
              </div>
            </div>
            <div className="control-item control-span-2">
              <label>Your age</label>
              <input
                type="number"
                value={draftAdultAge}
                onChange={(e) => setDraftAdultAge(parseInt(e.target.value) || 30)}
                min={16} max={100} className="age-input"
              />
            </div>
          </div>

          {/* Partner */}
          <div className="controls-row controls-row-6 controls-row-secondary">
            <div className="control-item control-span-2">
              <label>Couple</label>
              <button
                type="button"
                className={`switch ${draftIsCouple ? "switch-on" : ""}`}
                onClick={() => setDraftIsCouple(!draftIsCouple)}
                role="switch"
                aria-checked={draftIsCouple}
              >
                <span className="switch-thumb" />
                <span className="switch-label">{draftIsCouple ? "Yes" : "No"}</span>
              </button>
            </div>
            {draftIsCouple && (
              <>
                <div className="control-item control-span-2">
                  <label>Partner&apos;s income</label>
                  <div className="salary-input-wrapper">
                    <span className="currency-symbol">&pound;</span>
                    <input
                      type="number"
                      value={draftPartnerIncome}
                      onChange={(e) => setDraftPartnerIncome(parseFloat(e.target.value) || 0)}
                      min={0} step={1000}
                    />
                  </div>
                </div>
                <div className="control-item control-span-2">
                  <label>Partner&apos;s age</label>
                  <input
                    type="number"
                    value={draftPartnerAge}
                    onChange={(e) => setDraftPartnerAge(parseInt(e.target.value) || 30)}
                    min={16} max={100} className="age-input"
                  />
                </div>
              </>
            )}
          </div>

          {/* Children */}
          <div className="controls-row controls-row-6 controls-row-secondary">
            <div className="control-item control-span-2">
              <label>Children</label>
              <select
                value={draftChildren}
                onChange={(e) => setDraftChildren(parseInt(e.target.value))}
              >
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            {draftChildrenAges.map((age, i) => (
              <div className="control-item control-span-2" key={i}>
                <label>Child {i + 1} age</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setDraftChildrenAges((prev) => {
                      const next = [...prev];
                      next[i] = Math.min(Math.max(val, 0), 18);
                      return next;
                    });
                  }}
                  min={0} max={18} className="age-input"
                />
              </div>
            ))}
          </div>

        </div>

        {/* More details */}
        <div className="controls-group controls-group-expandable">
          <button
            className="cpi-expand-button"
            onClick={() => setMoreDetailsExpanded(!moreDetailsExpanded)}
          >
            <div className="controls-group-label">More household details</div>
            <span className={`expand-chevron ${moreDetailsExpanded ? "expanded" : ""}`}>
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          </button>
          {moreDetailsExpanded && (
            <div style={{ padding: "0 28px 20px" }}>
              <div className="controls-row controls-row-6">
                <div className="control-item control-span-2">
                  <label>Monthly rent</label>
                  <div className="salary-input-wrapper">
                    <span className="currency-symbol">&pound;</span>
                    <input
                      type="number"
                      value={draftRent}
                      onChange={(e) => setDraftRent(parseFloat(e.target.value) || 0)}
                      min={0} step={50}
                    />
                  </div>
                </div>
                <div className="control-item control-span-2">
                  <label>Monthly childcare</label>
                  <div className="salary-input-wrapper">
                    <span className="currency-symbol">&pound;</span>
                    <input
                      type="number"
                      value={draftChildcare}
                      onChange={(e) => setDraftChildcare(parseFloat(e.target.value) || 0)}
                      min={0} step={50}
                    />
                  </div>
                </div>
                <div className="control-item control-span-2">
                  <label>Region</label>
                  <select value={draftRegion} onChange={(e) => setDraftRegion(e.target.value)}>
                    <option value="NORTH_EAST">North East</option>
                    <option value="NORTH_WEST">North West</option>
                    <option value="YORKSHIRE">Yorkshire and the Humber</option>
                    <option value="EAST_MIDLANDS">East Midlands</option>
                    <option value="WEST_MIDLANDS">West Midlands</option>
                    <option value="EAST_OF_ENGLAND">East of England</option>
                    <option value="LONDON">London</option>
                    <option value="SOUTH_EAST">South East</option>
                    <option value="SOUTH_WEST">South West</option>
                    <option value="WALES">Wales</option>
                    <option value="SCOTLAND">Scotland</option>
                    <option value="NORTHERN_IRELAND">Northern Ireland</option>
                  </select>
                </div>
                <div className="control-item control-span-2">
                  <label>Tenure type</label>
                  <select value={draftTenureType} onChange={(e) => setDraftTenureType(e.target.value)}>
                    <option value="RENT_PRIVATELY">Rent (private)</option>
                    <option value="RENT_FROM_COUNCIL">Rent (council)</option>
                    <option value="RENT_FROM_HA">Rent (housing association)</option>
                    <option value="OWNED_WITH_MORTGAGE">Own (mortgage)</option>
                    <option value="OWNED_OUTRIGHT">Own (outright)</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Student loan */}
        <div className="controls-group controls-group-expandable">
          <button
            className="cpi-expand-button"
            onClick={() => setStudentLoanExpanded(!studentLoanExpanded)}
          >
            <div className="controls-group-label">Student loan details</div>
            <span className={`expand-chevron ${studentLoanExpanded ? "expanded" : ""}`}>
              <svg width="12" height="12" viewBox="0 0 12 12">
                <path d="M3 4.5L6 7.5L9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          </button>
          {studentLoanExpanded && (
            <div style={{ padding: "0 28px 20px" }}>
              <div className="controls-row controls-row-6" style={{ marginBottom: 14 }}>
                <div className="control-item control-span-2">
                  <label>Repayment plan</label>
                  <select value={draftStudentLoan} onChange={(e) => setDraftStudentLoan(e.target.value)}>
                    {STUDENT_LOAN_PLANS.map((plan) => (
                      <option key={plan.value} value={plan.value}>{plan.label}</option>
                    ))}
                  </select>
                  {draftStudentLoan !== "NO_STUDENT_LOAN" && (
                    <div className="control-hint">
                      {STUDENT_LOAN_PLANS.find((p) => p.value === draftStudentLoan)?.description}
                    </div>
                  )}
                </div>
                <div className="control-item control-span-2">
                  <div className="label-with-info">
                    <label>Postgraduate loan</label>
                    <span className="info-icon-wrapper">
                      <span className="info-icon">?</span>
                      <span className="info-tooltip">Adds 6% repayment above &pound;21,000 threshold</span>
                    </span>
                  </div>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={draftHasPostgrad} onChange={(e) => setDraftHasPostgrad(e.target.checked)} />
                    <span>{draftHasPostgrad ? "Yes" : "No"}</span>
                  </label>
                </div>
                <div className="control-item control-span-2">
                  <div className="label-with-info">
                    <label>Loan balance</label>
                    <span className="info-icon-wrapper">
                      <span className="info-icon">?</span>
                      <span className="info-tooltip">Outstanding student loan balance</span>
                    </span>
                  </div>
                  <div className="salary-input-wrapper">
                    <span className="currency-symbol">&pound;</span>
                    <input
                      type="number"
                      value={draftLoanBalance}
                      onChange={(e) => setDraftLoanBalance(parseFloat(e.target.value) || 0)}
                      min={0} max={500000} step={1000}
                    />
                  </div>
                </div>
              </div>
              <div className="controls-row controls-row-6">
                <div className="control-item control-span-2">
                  <div className="label-with-info">
                    <label>Salary growth</label>
                    <span className="info-icon-wrapper">
                      <span className="info-icon">?</span>
                      <span className="info-tooltip">Used for multi-year projections</span>
                    </span>
                  </div>
                  <select value={draftSalaryGrowthRate} onChange={(e) => setDraftSalaryGrowthRate(parseFloat(e.target.value))}>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((pct) => (
                      <option key={pct} value={pct / 100}>{pct}%</option>
                    ))}
                  </select>
                </div>
                <div className="control-item control-span-2">
                  <div className="label-with-info">
                    <label>Interest rate</label>
                    <span className="info-icon-wrapper">
                      <span className="info-icon">?</span>
                      <span className="info-tooltip">Annual interest rate on student loan</span>
                    </span>
                  </div>
                  <select value={draftInterestRate} onChange={(e) => setDraftInterestRate(parseFloat(e.target.value))}>
                    {[0, 1, 2, 3, 4, 5, 6, 7].map((pct) => (
                      <option key={pct} value={pct / 100}>{pct}%</option>
                    ))}
                  </select>
                </div>
              </div>
              {draftStudentLoan !== "NO_STUDENT_LOAN" && draftHasPostgrad && (
                <div className="student-loan-limitation-note">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 1L1 14h14L8 1z" stroke="#d97706" strokeWidth="1.5" fill="none" />
                    <path d="M8 6v3M8 11v1" stroke="#d97706" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span>
                    PolicyEngine currently models only one loan plan at a time. Your undergrad plan ({STUDENT_LOAN_PLANS.find((p) => p.value === draftStudentLoan)?.label}) will be used for the calculation.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error */}
      {error && <div className="api-error">Error: {error}</div>}

      {/* Results */}
      {(loading || hasCalculated) && !error && (
        <>
          {/* Headline impact */}
          {loading && !result ? (
            <div className="multi-year-loading"><span className="spinner" /> Calculating your impact...</div>
          ) : result && (
            <div
              className={`impact-headline ${netImpact > 0.5 ? "positive" : netImpact < -0.5 ? "negative" : "neutral"}`}
            >
              <p>
                The Spring Statement changes would{" "}
                {netImpact > 0.5 ? "increase" : netImpact < -0.5 ? "decrease" : "not significantly change"}{" "}
                your household&apos;s annual net income by{" "}
                <span className={`impact-amount ${netImpact > 0.5 ? "positive" : netImpact < -0.5 ? "negative" : "neutral"}`}>
                  {formatCurrency(netImpact)}
                </span>{" "}
                in {draftYear}-{String(draftYear + 1).slice(-2)}
              </p>
            </div>
          )}

          {/* Multi-Year Chart */}
          {(multiYearLoading || multiYearChartData.length > 0) && (
            <section className="narrative-section">
              <h2>Impact over time</h2>
              <p>
                Net household income impact for each fiscal year as OBR forecasts
                diverge before and after the Spring Statement.
              </p>
              {multiYearLoading ? (
                <div className="multi-year-loading"><span className="spinner" /> Loading multi-year projections...</div>
              ) : (
                <div className="impact-bar-chart multi-year-chart" ref={multiYearChartRef} />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
