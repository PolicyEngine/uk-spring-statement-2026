"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { colors } from "@policyengine/design-system/tokens/colors";
import { chartColors } from "@policyengine/design-system/charts";

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
  positive: chartColors.positive,
  negative: chartColors.negative,
  teal: colors.primary[500],
  tealDark: colors.primary[600],
  text: colors.gray[800],
  textSecondary: colors.gray[600],
  border: colors.border.light,
};

const DECOMP_KEYS = ["market_income", "taxes", "benefits", "purchasing_power"];
const DECOMP_META = {
  market_income: { label: "Market income", color: colors.blue[600] },
  taxes: { label: "Taxes", color: colors.gray[400] },
  benefits: { label: "Benefits", color: colors.gray[600] },
  purchasing_power: { label: "Purchasing power", color: colors.blue[700] },
};

function formatCurrency(value) {
  const absVal = Math.abs(value);
  const formatted = `\u00A3${absVal.toLocaleString("en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
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
  const [studentLoanExpanded, setStudentLoanExpanded] = useState(false);
  const [breakdownYear, setBreakdownYear] = useState(2026);
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
      year: 2026,
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
  ]);

  // Multi-year chart data — use real (2026£) decomposition when available
  const multiYearChartData = useMemo(() => {
    const decomp = multiYearData?.yearly_decomposition;
    const impacts = multiYearData?.yearly_impact;
    if (!impacts) return [];
    return Object.entries(impacts)
      .filter(([year]) => Number(year) <= 2029)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, nominalImpact]) => {
        const d = decomp?.[year];
        return {
          year,
          label: `${year}-${String(Number(year) + 1).slice(-2)}`,
          impact: d ? d.total : nominalImpact,
          ...(d || {}),
        };
      });
  }, [multiYearData]);

  // D3 stacked bar chart — decomposed into market income, taxes, benefits, purchasing power
  useEffect(() => {
    if (!multiYearChartRef.current || multiYearChartData.length === 0) return;

    const hasDecomp = multiYearChartData[0].purchasing_power !== undefined;
    const container = multiYearChartRef.current;
    const containerWidth = container.clientWidth;
    const margin = { top: 24, right: 20, bottom: 60, left: 60 };
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

    // Compute stack offsets for diverging bars
    const stackedData = multiYearChartData.map((d) => {
      const entry = { ...d, segments: [] };
      if (!hasDecomp) {
        entry.segments = [{ key: "total", value: d.impact, y0: 0, y1: d.impact, color: d.impact >= 0 ? COLORS.positive : COLORS.negative }];
        return entry;
      }
      let posOffset = 0;
      let negOffset = 0;
      DECOMP_KEYS.forEach((key) => {
        const val = d[key] || 0;
        if (Math.abs(val) < 0.005) return;
        const seg = { key, value: val, color: DECOMP_META[key].color };
        if (val >= 0) {
          seg.y0 = posOffset;
          seg.y1 = posOffset + val;
          posOffset += val;
        } else {
          seg.y1 = negOffset;
          seg.y0 = negOffset + val;
          negOffset += val;
        }
        entry.segments.push(seg);
      });
      return entry;
    });

    const allValues = stackedData.flatMap((d) => d.segments.flatMap((s) => [s.y0, s.y1]));
    const maxAbs = Math.max(d3.max(allValues, Math.abs) || 10, 1);
    const yExtent = maxAbs * 1.35;

    const y = d3.scaleLinear()
      .domain([-yExtent, yExtent])
      .range([height, 0]);

    g.append("g").attr("class", "grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(""));

    g.append("line")
      .attr("x1", 0).attr("x2", width)
      .attr("y1", y(0)).attr("y2", y(0))
      .attr("stroke", colors.gray[400]).attr("stroke-width", 1);

    const tooltip = d3.select(container).append("div").attr("class", "bar-tooltip");

    // Draw stacked segments
    stackedData.forEach((d) => {
      d.segments.forEach((seg) => {
        g.append("rect")
          .attr("x", x(d.label))
          .attr("width", x.bandwidth())
          .attr("y", y(Math.max(seg.y0, seg.y1)))
          .attr("height", Math.abs(y(seg.y0) - y(seg.y1)))
          .attr("fill", seg.color)
          .attr("opacity", 0.85)
          .on("mouseenter", (event) => {
            const rows = d.segments
              .filter((s) => Math.abs(s.value) >= 0.005)
              .map((s) => {
                const sLabel = DECOMP_META[s.key]?.label || s.key;
                const sSign = s.value >= 0 ? "+" : "\u2212";
                const sColor = s.value >= 0 ? COLORS.positive : COLORS.negative;
                return `<div class="tooltip-breakdown-row"><span class="tooltip-breakdown-label">${sLabel}</span><span style="color:${sColor}">${sSign}\u00A3${Math.abs(s.value).toFixed(1)}</span></div>`;
              })
              .join("");
            const totalSign = d.impact >= 0 ? "+" : "\u2212";
            const totalColor = d.impact >= 0 ? COLORS.positive : COLORS.negative;
            tooltip.style("opacity", 1)
              .html(
                `<div class="tooltip-label">${d.label}</div>` +
                `<div class="tooltip-breakdown">${rows}</div>` +
                `<div style="margin-top:6px;padding-top:6px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;gap:16px;font-weight:600"><span>Net</span><span style="color:${totalColor}">${totalSign}\u00A3${Math.abs(d.impact).toFixed(1)}/yr</span></div>`
              );
          })
          .on("mousemove", (event) => {
            tooltip.style("left", event.clientX + 12 + "px").style("top", event.clientY - 10 + "px");
          })
          .on("mouseleave", () => tooltip.style("opacity", 0));
      });
    });

    // Total labels above/below bars
    stackedData.forEach((d) => {
      const total = d.impact;
      const topY = d3.max(d.segments, (s) => Math.max(s.y0, s.y1)) || 0;
      const botY = d3.min(d.segments, (s) => Math.min(s.y0, s.y1)) || 0;
      const labelY = total >= 0 ? y(topY) - 8 : y(botY) + 18;
      g.append("text")
        .attr("x", x(d.label) + x.bandwidth() / 2)
        .attr("y", labelY)
        .attr("text-anchor", "middle")
        .attr("fill", total >= 0 ? COLORS.positive : COLORS.negative)
        .attr("font-size", "13px")
        .attr("font-weight", "600")
        .text(`${total >= 0 ? "+" : "\u2212"}\u00A3${Math.abs(total).toFixed(1)}`);
    });

    // Net total line with dots (like Winners/Losers chart)
    const linePoints = stackedData.map((d) => ({
      x: x(d.label) + x.bandwidth() / 2,
      y: y(d.impact),
    }));

    const line = d3.line().x((d) => d.x).y((d) => d.y).curve(d3.curveMonotoneX);

    g.append("path")
      .datum(linePoints)
      .attr("d", line)
      .attr("fill", "none")
      .attr("stroke", colors.gray[800])
      .attr("stroke-width", 2);

    g.selectAll(".net-dot")
      .data(linePoints)
      .join("circle")
      .attr("class", "net-dot")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", 4)
      .attr("fill", colors.gray[800])
      .attr("stroke", colors.gray[800]);

    g.append("g").attr("class", "axis")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(0))
      .select(".domain").remove();

    g.selectAll(".axis text")
      .attr("font-size", "13px").attr("font-weight", "500")
      .attr("fill", colors.gray[600]).attr("dy", "1em");

    g.append("g").attr("class", "axis axis-y")
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `\u00A3${d}`))
      .select(".domain").remove();

    g.selectAll(".axis-y text")
      .attr("font-size", "11px").attr("font-weight", "500").attr("fill", colors.gray[600]);

    // Legend (only when decomposition is available)
    if (hasDecomp) {
      const activeKeys = DECOMP_KEYS.filter((key) =>
        stackedData.some((d) => Math.abs(d[key] || 0) >= 0.005)
      );
      const legend = svg.append("g")
        .attr("transform", `translate(${margin.left}, ${height + margin.top + 36})`);
      let lx = 0;
      activeKeys.forEach((key) => {
        const meta = DECOMP_META[key];
        legend.append("rect").attr("x", lx).attr("y", 0).attr("width", 12).attr("height", 12).attr("rx", 2).attr("fill", meta.color).attr("opacity", 0.85);
        legend.append("text").attr("x", lx + 16).attr("y", 10).attr("font-size", "11px").attr("fill", colors.gray[600]).text(meta.label);
        lx += meta.label.length * 7 + 30;
      });
      // Net line legend
      legend.append("line").attr("x1", lx).attr("x2", lx + 16).attr("y1", 6).attr("y2", 6).attr("stroke", colors.gray[800]).attr("stroke-width", 2);
      legend.append("circle").attr("cx", lx + 8).attr("cy", 6).attr("r", 3).attr("fill", colors.gray[800]);
      legend.append("text").attr("x", lx + 22).attr("y", 10).attr("font-size", "11px").attr("fill", colors.gray[600]).text("Net");
    }
  }, [multiYearChartData]);

  const decomposition = multiYearData?.yearly_decomposition?.[String(breakdownYear)] ?? result?.decomposition;
  const realImpact = decomposition?.total ?? result?.impact?.household_net_income ?? 0;

  return (
    <div className="max-w-[1400px] mx-auto pt-4 pb-6 font-sans text-gray-800 leading-relaxed">
      <p className="text-[0.95rem] leading-relaxed text-gray-600 mb-6">
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
          <div className="controls-row controls-row-4">
            <div className="control-item control-span-2">
              <label>Employment income (2025-26)</label>
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
                  <label>Partner&apos;s income (2025-26)</label>
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
            <>
              <div
                className={`impact-headline ${realImpact > 10 ? "positive" : realImpact < -10 ? "negative" : "neutral"}`}
              >
                <p>
                  The Spring Statement changes would{" "}
                  {realImpact > 0.5 ? "increase" : realImpact < -0.5 ? "decrease" : "not significantly change"}{" "}
                  your household&apos;s annual net income by{" "}
                  <span className={`impact-amount ${realImpact > 0.5 ? "positive" : realImpact < -0.5 ? "negative" : "neutral"}`}>
                    {formatCurrency(realImpact)}
                  </span>{" "}
                  in {breakdownYear}-{String(breakdownYear + 1).slice(-2)}
                  {breakdownYear > 2026 && " (in 2026 prices)"}
                </p>
              </div>

              {/* Decomposition table */}
              {decomposition && (
                <div className="decomp-breakdown">
                  <div className="decomp-header">
                    <h3 className="text-sm font-semibold text-gray-700">
                      Breakdown of household net income impact
                    </h3>
                    <div className="year-selector">
                      {[2026, 2027, 2028, 2029].map((y) => (
                        <button
                          key={y}
                          className={breakdownYear === y ? "active" : ""}
                          onClick={() => setBreakdownYear(y)}
                        >
                          {y}-{String(y + 1).slice(-2)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <table className="decomp-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>Pre-Statement</th>
                        <th>Post-Statement</th>
                        <th>Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["market_income", "taxes", "benefits"].map((key) => {
                        const meta = DECOMP_META[key];
                        const detail = decomposition.details?.[key];
                        const change = decomposition[key] || 0;
                        return (
                          <tr key={key}>
                            <td className="decomp-table-label">
                              <span className="decomp-color-dot" style={{ backgroundColor: meta.color }} />
                              {meta.label}
                            </td>
                            <td className="decomp-table-value">{detail ? `£${Math.abs(detail.baseline).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}</td>
                            <td className="decomp-table-value">{detail ? `£${Math.abs(detail.reform).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}</td>
                            <td className={`decomp-table-change ${change > 0.005 ? "positive" : change < -0.005 ? "negative" : "zero"}`}>
                              {formatCurrency(change)}
                            </td>
                          </tr>
                        );
                      })}
                      {(() => {
                        const nominalChange = (decomposition.market_income || 0) + (decomposition.taxes || 0) + (decomposition.benefits || 0);
                        return (
                          <tr className="decomp-table-net-row">
                            <td className="decomp-table-label font-semibold">Net income (nominal)</td>
                            <td className="decomp-table-value font-semibold">
                              {decomposition.details?.net_income ? `£${decomposition.details.net_income.baseline.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                            </td>
                            <td className="decomp-table-value font-semibold">
                              {decomposition.details?.net_income ? `£${decomposition.details.net_income.reform.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                            </td>
                            <td className={`decomp-table-change font-semibold ${nominalChange > 0.005 ? "positive" : nominalChange < -0.005 ? "negative" : "zero"}`}>
                              {formatCurrency(nominalChange)}
                            </td>
                          </tr>
                        );
                      })()}
                      <tr className="decomp-table-purchasing-row">
                        <td className="decomp-table-label">
                          <span className="decomp-color-dot" style={{ backgroundColor: DECOMP_META.purchasing_power.color }} />
                          {DECOMP_META.purchasing_power.label}
                        </td>
                        <td className="decomp-table-value"></td>
                        <td className="decomp-table-value"></td>
                        <td className={`decomp-table-change ${decomposition.purchasing_power > 0.005 ? "positive" : decomposition.purchasing_power < -0.005 ? "negative" : "zero"}`}>
                          {formatCurrency(decomposition.purchasing_power)}
                        </td>
                      </tr>
                      <tr className="decomp-table-total-row">
                        <td className="decomp-table-label font-semibold">Net change (2026 prices)</td>
                        <td className="decomp-table-value"></td>
                        <td className="decomp-table-value"></td>
                        <td className={`decomp-table-change font-semibold ${decomposition.total > 0.005 ? "positive" : decomposition.total < -0.005 ? "negative" : "zero"}`}>
                          {formatCurrency(decomposition.total)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <details className="methodology-details mt-3">
                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">How is this calculated?</summary>
                    <ul className="text-xs text-gray-400 mt-2 leading-relaxed list-disc pl-4 space-y-1">
                      <li>PolicyEngine uprates your 2025-26 income under both the pre- and post-Spring Statement OBR forecasts</li>
                      <li>Market income, taxes, benefits, and net income (nominal) are shown in <strong>cash terms</strong> for that year</li>
                      <li>Purchasing power captures the effect of different CPI forecasts on the purchasing power of post-Statement net income</li>
                      <li>Purchasing power = post-Statement net income × (CPI<sub>pre</sub> / CPI<sub>post</sub> − 1), where CPI<sub>pre</sub> and CPI<sub>post</sub> are the price level indices for that year under the pre- and post-Statement forecasts</li>
                      <li>Net change (2026 prices) = nominal net income change + purchasing power</li>
                      <li>This is the impact of revised macroeconomic forecasts (earnings and CPI), not a direct estimate of policy changes</li>
                    </ul>
                  </details>
                </div>
              )}
            </>
          )}

          {/* Multi-Year Chart */}
          {(multiYearLoading || multiYearChartData.length > 0) && (
            <section className="narrative-section">
              <h2>Impact over time (2026 prices)</h2>
              <p>
                Real household income impact for each fiscal year, broken down by
                market income, taxes, benefits, and purchasing power.
              </p>
              {multiYearLoading ? (
                <div key="loading" className="multi-year-loading"><span className="spinner" /> Loading multi-year projections...</div>
              ) : (
                <div key="chart" className="impact-bar-chart multi-year-chart" ref={multiYearChartRef} />
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
