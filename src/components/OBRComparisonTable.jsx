import React, { useState, useEffect } from "react";
import "./OBRComparisonTable.css";

function OBRComparisonTable() {
  const [comparisonData, setComparisonData] = useState(null);
  const [showBehavioural, setShowBehavioural] = useState(false);

  useEffect(() => {
    // Fetch both OBR comparison data and PolicyEngine budgetary impact data
    Promise.all([
      fetch("/data/obr_comparison.csv").then((res) => res.text()),
      fetch("/data/budgetary_impact.csv").then((res) => res.text()),
    ])
      .then(([obrCsvText, peCsvText]) => {
        // Parse OBR data
        const obrLines = obrCsvText.trim().split("\n");
        const obrHeaders = obrLines[0].split(",");
        const staticIdx = obrHeaders.indexOf("obr_static_value");
        const behaviouralIdx = obrHeaders.indexOf("obr_post_behavioural_value");

        const obrData = {};
        for (let i = 1; i < obrLines.length; i++) {
          const values = obrLines[i].split(",");
          const reform_id = values[0];
          const year = parseInt(values[2]);
          const key = `${reform_id}_${year}`;
          obrData[key] = {
            reform_id,
            reform_name: values[1],
            year,
            obr_static:
              staticIdx >= 0 && values[staticIdx]
                ? parseFloat(values[staticIdx])
                : null,
            obr_behavioural:
              behaviouralIdx >= 0 && values[behaviouralIdx]
                ? parseFloat(values[behaviouralIdx])
                : null,
          };
        }

        // Parse PolicyEngine budgetary impact data
        const peLines = peCsvText.trim().split("\n");
        const peHeaders = peLines[0].split(",");
        const reformIdIdx = peHeaders.indexOf("reform_id");
        const yearIdx = peHeaders.indexOf("year");
        const valueIdx = peHeaders.indexOf("value");

        for (let i = 1; i < peLines.length; i++) {
          const values = peLines[i].split(",");
          const reform_id = values[reformIdIdx];
          const year = parseInt(values[yearIdx]);
          const pe_value = parseFloat(values[valueIdx]);
          const key = `${reform_id}_${year}`;

          if (obrData[key]) {
            obrData[key].policyengine_value = pe_value;
          }
        }

        // Convert to array
        const data = Object.values(obrData);
        setComparisonData(data);
      })
      .catch((err) => console.error("Error loading comparison data:", err));
  }, []);

  if (!comparisonData) return null;

  // Filter to policies that have OBR data (regardless of dashboard selection)
  const filteredData = comparisonData.filter(
    (row) => row.obr_static !== null || row.obr_behavioural !== null,
  );

  if (filteredData.length === 0) return null;

  // Check if we have both static and behavioural data
  const hasBothTypes = filteredData.some(
    (row) => row.obr_static !== null && row.obr_behavioural !== null,
  );

  // Define the order of policies
  const policyOrder = [
    "policy_1",
    "policy_2",
    "policy_3",
  ];

  // Group by policy
  const policiesMap = {};
  filteredData.forEach((row) => {
    if (!policiesMap[row.reform_id]) {
      policiesMap[row.reform_id] = {
        name: row.reform_name,
        years: {},
      };
    }
    policiesMap[row.reform_id].years[row.year] = {
      policyengine: row.policyengine_value,
      obr_static: row.obr_static,
      obr_behavioural: row.obr_behavioural,
    };
  });

  const years = [2026, 2027, 2028, 2029, 2030];

  // Sort policies according to the defined order
  const policies = policyOrder
    .filter((id) => policiesMap[id])
    .map((id) => [id, policiesMap[id]]);

  const formatValue = (value) => {
    if (value === null || value === undefined || isNaN(value)) return "—";
    const sign = value >= 0 ? "" : "-";
    return `${sign}£${Math.abs(value).toFixed(0)}m`;
  };

  const getDifferenceClass = (pe, obr) => {
    if (pe === null || obr === null || isNaN(pe) || isNaN(obr)) return "";
    const diff = Math.abs(pe - obr);
    if (diff < 10) return "diff-small";
    if (diff < 30) return "diff-medium";
    return "diff-large";
  };

  const getObrValue = (yearData) => {
    if (showBehavioural && yearData.obr_behavioural !== null) {
      return yearData.obr_behavioural;
    }
    if (!showBehavioural && yearData.obr_static !== null) {
      return yearData.obr_static;
    }
    // Fallback to whichever is available
    return yearData.obr_behavioural ?? yearData.obr_static;
  };

  return (
    <div className="obr-comparison-section">
      <h3 className="section-title" style={{ fontSize: "1.4rem", fontWeight: 600, color: "#374151", borderBottom: "none", marginTop: 0, marginBottom: "12px", padding: 0 }}>PolicyEngine vs OBR comparison</h3>
      <p className="comparison-description">
        This table compares PolicyEngine's static microsimulation estimates with
        the Office for Budget Responsibility's official costings from the Spring Statement 2026.
        Values show annual budgetary impact in
        millions of pounds. Positive values indicate revenue for the Government;
        negative values indicate costs.
      </p>

      {hasBothTypes && (
        <div className="obr-toggle-container">
          <span className="toggle-label">
            Compare PolicyEngine (static) with OBR:
          </span>
          <div className="toggle-buttons">
            <button
              className={`toggle-btn ${!showBehavioural ? "active" : ""}`}
              onClick={() => setShowBehavioural(false)}
            >
              Static
            </button>
            <button
              className={`toggle-btn ${showBehavioural ? "active" : ""}`}
              onClick={() => setShowBehavioural(true)}
            >
              Post-behavioural
            </button>
          </div>
        </div>
      )}

      <div className="comparison-table-wrapper">
        <table className="comparison-table">
          <thead>
            <tr>
              <th rowSpan="2">Policy</th>
              {years.map((year) => (
                <th key={year} colSpan="2" className="year-header">
                  {year}-{(year + 1).toString().slice(-2)}
                </th>
              ))}
            </tr>
            <tr>
              {years.map((year) => (
                <React.Fragment key={year}>
                  <th className="source-header pe">PE</th>
                  <th className="source-header obr">OBR</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {policies.map(([policyId, policy]) => (
              <tr key={policyId}>
                <td className="policy-name-cell">{policy.name}</td>
                {years.map((year) => {
                  const yearData = policy.years[year] || {};
                  const pe = yearData.policyengine;
                  const obr = getObrValue(yearData);
                  return (
                    <React.Fragment key={year}>
                      <td
                        className={`value-cell pe ${getDifferenceClass(pe, obr)}`}
                      >
                        {formatValue(pe)}
                      </td>
                      <td
                        className={`value-cell obr ${getDifferenceClass(pe, obr)}`}
                      >
                        {formatValue(obr)}
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="comparison-legend">
        <span className="legend-item">
          <span className="legend-dot diff-small"></span>
          Difference &lt; £10m
        </span>
        <span className="legend-item">
          <span className="legend-dot diff-medium"></span>
          Difference £10-30m
        </span>
        <span className="legend-item">
          <span className="legend-dot diff-large"></span>
          Difference &gt; £30m
        </span>
      </div>

      <details className="comparison-note-details" style={{ marginTop: "12px" }}>
        <summary style={{ cursor: "pointer", color: "#2c6e49", fontWeight: "500" }}>Note</summary>
        <p className="comparison-note" style={{ marginTop: "8px" }}>
          PolicyEngine produces static microsimulation
          estimates that do not include behavioural responses.{" "}
          {showBehavioural
            ? "Post-behavioural costings include effects like tax avoidance, reduced consumption, and migration."
            : "Static costings assume no change in taxpayer behaviour."}{" "}
          Each provision is costed independently against baseline (not stacked).
        </p>
      </details>
      <details className="comparison-note-details" style={{ marginTop: "8px" }}>
        <summary style={{ cursor: "pointer", color: "#2c6e49", fontWeight: "500" }}>Data notes</summary>
        <p className="comparison-note" style={{ marginTop: "8px" }}>
          Data notes placeholder. See official OBR documentation for methodology.
        </p>
      </details>
    </div>
  );
}

export default OBRComparisonTable;
