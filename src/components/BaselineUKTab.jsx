import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import D3LineChart from "./D3LineChart";
import "./ValidationTab.css";

// Format year for display (e.g., 2026 -> "2026–27")
const formatYearRange = (year) => `${year}-${(year + 1).toString().slice(-2)}`;

// Historical official poverty data (DWP HBAI, Stat-Xplore)
// Source: https://stat-xplore.dwp.gov.uk/ — Households Below Average Income
// Relative = 60% of UK median income; Absolute = 60% of 2010-11 median + CPI
// 2020-21 excluded (no HBAI data due to COVID). PolicyEngine projections from 2023.
const HISTORICAL_POVERTY_DATA = [
  { year: 2020, relativeBHC: 17.9, relativeAHC: 22.0, absoluteBHC: 14.0, absoluteAHC: 17.9 },
  { year: 2022, relativeBHC: 16.6, relativeAHC: 21.7, absoluteBHC: 13.4, absoluteAHC: 17.1 },
  { year: 2023, relativeBHC: 17.0, relativeAHC: 21.4, absoluteBHC: 14.1, absoluteAHC: 17.8 },
  { year: 2024, relativeBHC: 17.2, relativeAHC: 21.1, absoluteBHC: 15.0, absoluteAHC: 18.3 },
];

// Historical household income data (HBAI equivalised, annualised from weekly)
// Source: https://stat-xplore.dwp.gov.uk/ — HBAI Net Household Income (BHC)
// Nominal = in year prices; Real = in 2023-24 prices (CPI-adjusted by DWP)
// Weekly values × 52. 2020-21 excluded (no HBAI data). PE projections from 2023.
const HISTORICAL_HOUSEHOLD_INCOME_DATA = [
  { year: 2020, meanIncome: 34661, medianIncome: 28428, meanIncomeReal: 42709, medianIncomeReal: 35029 },
  { year: 2022, meanIncome: 35796, medianIncome: 29394, meanIncomeReal: 42157, medianIncomeReal: 34618 },
  { year: 2023, meanIncome: 39531, medianIncome: 32322, meanIncomeReal: 42159, medianIncomeReal: 34470 },
  { year: 2024, meanIncome: 41182, medianIncome: 33776, meanIncomeReal: 41182, medianIncomeReal: 33776 },
];

// CPI deflators to convert nominal values to 2023 real prices
// Source: OBR Economic and Fiscal Outlook, March 2025
// 2024: 2.5%, 2025: 3.2%, 2026: 2.1%, 2027-30: 2.0%
const CPI_DEFLATORS = {
  2023: 1.000,
  2024: 1.025,
  2025: 1.058,
  2026: 1.080,
  2027: 1.102,
  2028: 1.124,
  2029: 1.146,
  2030: 1.169,
};

function parseCSV(csvText) {
  const lines = csvText.trim().split("\n");

  const parseLine = (line) => {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  };

  const headers = parseLine(lines[0]);
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx];
    });
    data.push(row);
  }
  return data;
}

// Section definitions for navigation
const SECTIONS = [
  { id: "introduction", label: "Introduction" },
  { id: "economic-outlook", label: "Economic outlook" },
];

export default function BaselineUKTab() {
  const [loading, setLoading] = useState(true);
  const [baselineData, setBaselineData] = useState([]);
  const [povertyType, setPovertyType] = useState("absoluteBHC"); // absoluteBHC, absoluteAHC, relativeBHC, relativeAHC
  const [povertyAgeGroup, setPovertyAgeGroup] = useState("all"); // all, children, workingAge, pensioners
  const [incomeType, setIncomeType] = useState("mean"); // mean or median
  const [incomeAdjustment, setIncomeAdjustment] = useState("nominal"); // nominal or real
  const [incomeViewMode, setIncomeViewMode] = useState("both"); // outturn, forecast, both
  const [povertyViewMode, setPovertyViewMode] = useState("both"); // outturn, forecast, both
  const [activeSection, setActiveSection] = useState("introduction");

  // Refs for section elements
  const sectionRefs = useRef({});

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
      const scrollPosition = window.scrollY + 150; // Offset for header

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
    handleScroll(); // Initial check

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Intersection Observer for box highlighting
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-view");
          } else {
            entry.target.classList.remove("in-view");
          }
        });
      },
      { threshold: 0.3, rootMargin: "-100px 0px -100px 0px" }
    );

    const boxes = document.querySelectorAll(".section-box");
    boxes.forEach((box) => observer.observe(box));

    return () => observer.disconnect();
  }, [loading]);

  // Load UK baseline data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load baseline data
        const response = await fetch("/data/uk_baseline.csv");
        const csvText = await response.text();
        const parsed = parseCSV(csvText);

        // Transform data
        const data = parsed.map((row) => ({
          year: parseInt(row.year),
          meanIncome: parseFloat(row.mean_income_per_head),
          medianIncome: parseFloat(row.median_income_per_head),
          meanHouseholdIncome: parseFloat(row.mean_disposable_income),
          medianHouseholdIncome: parseFloat(row.median_disposable_income),
          medianTaxpayerIncome: parseFloat(row.median_taxpayer_income),
          taxpayerIncomeP25: parseFloat(row.taxpayer_income_p25),
          taxpayerIncomeP75: parseFloat(row.taxpayer_income_p75),
          meanIncomePerHead: parseFloat(row.mean_income_per_head),
          medianIncomePerHead: parseFloat(row.median_income_per_head),
          totalDisposableIncomeBn: parseFloat(row.total_disposable_income_bn),
          povertyBHC: parseFloat(row.poverty_rate_bhc),
          povertyAHC: parseFloat(row.poverty_rate_ahc),
          absolutePovertyBHC: parseFloat(row.absolute_poverty_bhc),
          absolutePovertyAHC: parseFloat(row.absolute_poverty_ahc),
          childPovertyBHC: parseFloat(row.child_poverty_bhc),
          childPovertyAHC: parseFloat(row.child_poverty_ahc),
          childAbsolutePoverty: parseFloat(row.child_absolute_poverty) || null,
          workingAgePovertyBHC: parseFloat(row.working_age_poverty_bhc),
          workingAgePovertyAHC: parseFloat(row.working_age_poverty_ahc),
          pensionerPovertyBHC: parseFloat(row.pensioner_poverty_bhc),
          pensionerPovertyAHC: parseFloat(row.pensioner_poverty_ahc),
          totalHouseholds: parseFloat(row.total_households),
          totalPopulation: parseFloat(row.total_population),
        }));

        setBaselineData(data);
        setLoading(false);
      } catch (error) {
        console.error("Error loading UK data:", error);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="uk-tab-loading">
        <div className="loading-spinner"></div>
        <p>Loading UK projections...</p>
      </div>
    );
  }

  return (
    <div className="uk-tab">
      {/* Section Navigation Sidebar */}
      <nav className="section-nav">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            className={`section-nav-dot ${activeSection === section.id ? "active" : ""}`}
            onClick={() => scrollToSection(section.id)}
            title={section.label}
            aria-label={`Navigate to ${section.label}`}
          />
        ))}
      </nav>

      {/* Introduction */}
      <h2 className="section-title" id="introduction" ref={(el) => (sectionRefs.current["introduction"] = el)}>Introduction</h2>
      <p className="chart-description">
        This dashboard, powered by{" "}
        <a
          href="https://policyengine.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          PolicyEngine
        </a>, presents a data-driven view of the UK's economic outlook following the UK
        Spring Statement 2026. It is organised into four sections: <strong>Baseline UK data</strong>{" "}
        projects household incomes and poverty rates through 2030 under current policy;{" "}
        <strong>Spring Statement</strong> analyses the impact of the announced
        policy changes; <strong>Household calculator</strong> lets you explore impacts on specific household types; and <strong>Validation</strong> compares estimates against official government statistics.
      </p>
      <p className="chart-description" style={{ marginTop: "12px" }}>
        PolicyEngine is an open-source microsimulation model that{" "}
        <a
          href="https://github.com/PolicyEngine/policyengine-uk-data/blob/main/policyengine_uk_data/datasets/local_areas/constituencies/calibrate.py"
          target="_blank"
          rel="noopener noreferrer"
        >
          reweights
        </a>{" "}
        the Family Resources Survey to match UK demographics and calibrates to official
        statistics from the ONS and HMRC. See also: PolicyEngine's{" "}
        <a
          href="https://www.policyengine.org/uk/autumn-budget-2025"
          target="_blank"
          rel="noopener noreferrer"
        >
          dashboard
        </a>{" "}
        for the UK Autumn Budget 2025 and our poverty{" "}
        <a
          href="https://www.policyengine.org/uk/research/uk-poverty-analysis"
          target="_blank"
          rel="noopener noreferrer"
        >
          methodology
        </a>.
      </p>

      {/* Economic outlook section */}
      <h2 className="section-title" id="economic-outlook" ref={(el) => (sectionRefs.current["economic-outlook"] = el)}>Economic outlook</h2>
      <p className="chart-description">
        This section shows PolicyEngine projections for household incomes and poverty rates through
        2030, assuming current legislated policy with no further changes.
      </p>

      <div className="charts-row">
        {/* Living standard chart */}
        <div className="section-box">
          <h3 className="chart-title">Living standards</h3>
          <p className="chart-description">
            {incomeType === "mean"
              ? "Mean income is total disposable income divided by the number of households."
              : "Median income is the middle value when all households are ranked by income."}{" "}
            {incomeAdjustment === "real" ? "Values adjusted to 2023 prices. " : ""}
            Solid lines show official DWP HBAI data; dashed lines show PolicyEngine projections.
          </p>
          {baselineData.length > 0 && (() => {
            const year2023 = baselineData.find(d => d.year === 2023);
            const year2030 = baselineData.find(d => d.year === 2030);
            if (!year2023 || !year2030) return null;
            let startValue = incomeType === "mean" ? year2023.meanHouseholdIncome : year2023.medianHouseholdIncome;
            let endValue = incomeType === "mean" ? year2030.meanHouseholdIncome : year2030.medianHouseholdIncome;
            // Apply CPI deflation for real values
            if (incomeAdjustment === "real") {
              startValue = startValue / CPI_DEFLATORS[2023];
              endValue = endValue / CPI_DEFLATORS[2030];
            }
            const pctChange = ((endValue - startValue) / startValue) * 100;
            const realSuffix = incomeAdjustment === "real" ? " (in 2023 prices)" : "";
            return (
              <p className="chart-summary">
                {incomeType === "mean" ? "Mean" : "Median"} household income is forecast to {pctChange > 0 ? "increase" : "decrease"} by {Math.abs(pctChange).toFixed(0)}% from £{(startValue / 1000).toFixed(0)}k to £{(endValue / 1000).toFixed(0)}k by 2030{realSuffix}.
              </p>
            );
          })()}
          <div className="chart-controls">
            <select
              className="chart-select"
              value={incomeType}
              onChange={(e) => setIncomeType(e.target.value)}
            >
              <option value="mean">Mean income</option>
              <option value="median">Median income</option>
            </select>
            <div className="view-toggle">
              <button className={incomeAdjustment === "nominal" ? "active" : ""} onClick={() => setIncomeAdjustment("nominal")}>Nominal</button>
              <button className={incomeAdjustment === "real" ? "active" : ""} onClick={() => setIncomeAdjustment("real")}>Real</button>
            </div>
            <div className="view-toggle">
              <button className={incomeViewMode === "outturn" ? "active" : ""} onClick={() => setIncomeViewMode("outturn")}>Outturn</button>
              <button className={incomeViewMode === "both" ? "active" : ""} onClick={() => setIncomeViewMode("both")}>Both</button>
              <button className={incomeViewMode === "forecast" ? "active" : ""} onClick={() => setIncomeViewMode("forecast")}>Forecast</button>
            </div>
          </div>
          <D3LineChart
            data={(() => {
              const merged = {};
              HISTORICAL_HOUSEHOLD_INCOME_DATA.forEach(d => {
                const historicalKey = incomeAdjustment === "real"
                  ? (incomeType === "mean" ? "meanIncomeReal" : "medianIncomeReal")
                  : (incomeType === "mean" ? "meanIncome" : "medianIncome");
                merged[d.year] = {
                  year: d.year,
                  historical: d[historicalKey],
                };
              });
              baselineData.filter(d => d.year >= 2023).forEach(d => {
                // PolicyEngine projections are in nominal terms
                // For real values, deflate by CPI to 2023 prices
                let projectionValue = incomeType === "mean" ? d.meanHouseholdIncome : d.medianHouseholdIncome;
                if (incomeAdjustment === "real" && CPI_DEFLATORS[d.year]) {
                  projectionValue = projectionValue / CPI_DEFLATORS[d.year];
                }
                if (merged[d.year]) {
                  merged[d.year].projection = projectionValue;
                } else {
                  merged[d.year] = {
                    year: d.year,
                    projection: projectionValue,
                  };
                }
              });
              return Object.values(merged).sort((a, b) => a.year - b.year);
            })()}
            yLabel={`Household income${incomeAdjustment === "real" ? " (2023 prices)" : ""}`}
            yFormat={(v) => `£${(v / 1000).toFixed(0)}k`}
            yDomain={[0, 55000]}
            viewMode={incomeViewMode}
          />
        </div>

        {/* Poverty rate chart */}
        <div className="section-box">
          <h3 className="chart-title">Poverty rate</h3>
          <p className="chart-description">
            {povertyType.includes("absolute")
              ? "Absolute poverty measures income below a fixed threshold adjusted for inflation."
              : "Relative poverty measures income below 60% of UK median income."}{" "}
            {povertyType.includes("AHC") ? "After housing costs." : "Before housing costs."}
          </p>
          {baselineData.length > 0 && (() => {
            const year2023 = baselineData.find(d => d.year === 2023);
            const year2030 = baselineData.find(d => d.year === 2030);
            if (!year2023 || !year2030) return null;

            const isAHC = povertyType.includes("AHC");
            const isAbsolute = povertyType.includes("absolute");
            let startValue, endValue;

            if (povertyAgeGroup === "all") {
              if (povertyType === "absoluteBHC") { startValue = year2023.absolutePovertyBHC; endValue = year2030.absolutePovertyBHC; }
              else if (povertyType === "absoluteAHC") { startValue = year2023.absolutePovertyAHC; endValue = year2030.absolutePovertyAHC; }
              else if (povertyType === "relativeBHC") { startValue = year2023.povertyBHC; endValue = year2030.povertyBHC; }
              else { startValue = year2023.povertyAHC; endValue = year2030.povertyAHC; }
            } else if (povertyAgeGroup === "children") {
              if (isAbsolute) { startValue = year2023.childAbsolutePoverty; endValue = year2030.childAbsolutePoverty; }
              else { startValue = isAHC ? year2023.childPovertyAHC : year2023.childPovertyBHC; endValue = isAHC ? year2030.childPovertyAHC : year2030.childPovertyBHC; }
            } else if (povertyAgeGroup === "workingAge") {
              startValue = isAHC ? year2023.workingAgePovertyAHC : year2023.workingAgePovertyBHC;
              endValue = isAHC ? year2030.workingAgePovertyAHC : year2030.workingAgePovertyBHC;
            } else if (povertyAgeGroup === "pensioners") {
              startValue = isAHC ? year2023.pensionerPovertyAHC : year2023.pensionerPovertyBHC;
              endValue = isAHC ? year2030.pensionerPovertyAHC : year2030.pensionerPovertyBHC;
            }

            if (startValue == null || endValue == null) return null;
            const ppChange = endValue - startValue;
            const ageLabel = povertyAgeGroup === "all" ? "" : povertyAgeGroup === "children" ? " child" : povertyAgeGroup === "workingAge" ? " working-age" : " pensioner";
            return (
              <p className="chart-summary">
                The{ageLabel} poverty rate is forecast to {ppChange > 0 ? "increase" : "decrease"} by {Math.abs(ppChange).toFixed(1)}pp from {startValue.toFixed(1)}% to {endValue.toFixed(1)}% by 2030.
              </p>
            );
          })()}
          <div className="chart-controls">
            <select
              className="chart-select"
              value={povertyType}
              onChange={(e) => setPovertyType(e.target.value)}
            >
              <option value="absoluteBHC">Absolute (BHC)</option>
              <option value="absoluteAHC">Absolute (AHC)</option>
              <option value="relativeBHC">Relative (BHC)</option>
              <option value="relativeAHC">Relative (AHC)</option>
            </select>
            <select
              className="chart-select"
              value={povertyAgeGroup}
              onChange={(e) => setPovertyAgeGroup(e.target.value)}
            >
              <option value="all">All people</option>
              <option value="children">Children</option>
              <option value="workingAge">Working-age</option>
              <option value="pensioners">Pensioners</option>
            </select>
            <div className="view-toggle">
              <button className={povertyViewMode === "outturn" ? "active" : ""} onClick={() => setPovertyViewMode("outturn")}>Outturn</button>
              <button className={povertyViewMode === "both" ? "active" : ""} onClick={() => setPovertyViewMode("both")}>Both</button>
              <button className={povertyViewMode === "forecast" ? "active" : ""} onClick={() => setPovertyViewMode("forecast")}>Forecast</button>
            </div>
          </div>
          <D3LineChart
            data={(() => {
              const merged = {};
              // Historical data only available for all people
              if (povertyAgeGroup === "all") {
                HISTORICAL_POVERTY_DATA.forEach(d => {
                  let value;
                  if (povertyType === "absoluteBHC") value = d.absoluteBHC;
                  else if (povertyType === "absoluteAHC") value = d.absoluteAHC;
                  else if (povertyType === "relativeBHC") value = d.relativeBHC;
                  else value = d.relativeAHC;
                  merged[d.year] = {
                    year: d.year,
                    historical: value,
                  };
                });
              }
              baselineData.filter(d => d.year >= 2023).forEach(d => {
                let value;
                const isAHC = povertyType.includes("AHC");
                const isAbsolute = povertyType.includes("absolute");

                if (povertyAgeGroup === "all") {
                  if (povertyType === "absoluteBHC") value = d.absolutePovertyBHC;
                  else if (povertyType === "absoluteAHC") value = d.absolutePovertyAHC;
                  else if (povertyType === "relativeBHC") value = d.povertyBHC;
                  else value = d.povertyAHC;
                } else if (povertyAgeGroup === "children") {
                  // Children have relative BHC/AHC and absolute poverty
                  if (isAbsolute) value = d.childAbsolutePoverty;
                  else value = isAHC ? d.childPovertyAHC : d.childPovertyBHC;
                } else if (povertyAgeGroup === "workingAge") {
                  // Working-age only has relative poverty (use relative for absolute)
                  value = isAHC ? d.workingAgePovertyAHC : d.workingAgePovertyBHC;
                } else if (povertyAgeGroup === "pensioners") {
                  // Pensioners only has relative poverty (use relative for absolute)
                  value = isAHC ? d.pensionerPovertyAHC : d.pensionerPovertyBHC;
                }

                if (merged[d.year]) {
                  merged[d.year].projection = value;
                } else {
                  merged[d.year] = {
                    year: d.year,
                    projection: value,
                  };
                }
              });
              return Object.values(merged).sort((a, b) => a.year - b.year);
            })()}
            yLabel="Poverty rate"
            yFormat={(v) => `${v.toFixed(0)}%`}
            yDomain={[0, 30]}
            viewMode={povertyViewMode}
          />
        </div>
      </div>
    </div>
  );
}
