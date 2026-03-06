"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { colors } from "@policyengine/design-system/tokens/colors";

const DECOMP_META = {
  market_income: { label: "Market income", color: colors.blue[600] },
  taxes: { label: "Taxes", color: colors.gray[400] },
  benefits: { label: "Benefits", color: colors.gray[600] },
  purchasing_power: { label: "Purchasing power", color: colors.blue[700] },
};

function shorten(group) {
  return group
    .replace("Single adult, no children", "Single adult")
    .replace("Couple, no children", "Couple")
    .replace("Couple with children", "Couple + kids")
    .replace("Single parent", "Single parent")
    .replace("Single pensioner", "Single pensioner")
    .replace("Pensioner couple", "Pensioner couple");
}

function formatCurrencyChange(v) {
  if (v == null) return "\u2014";
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}\u00a3${Math.abs(v).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

function formatDecomp(value) {
  const absVal = Math.abs(value);
  const formatted = `\u00a3${absVal.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (value < -0.5) return `\u2212${formatted}`;
  if (value > 0.5) return `+${formatted}`;
  return formatted;
}

function formatAbsolute(value) {
  if (value == null) return "\u2014";
  return `\u00a3${Math.abs(value).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function ChangeBarChart({ decompositionData, selectedYear }) {
  const chartData = decompositionData
    .filter((d) => d.year === selectedYear)
    .map((d) => ({
      group: shorten(d.group),
      change: Math.round(d.decomposition.total),
    }))
    .sort((a, b) => a.change - b.change);

  return (
    <div className="section-card">
      <h3 className="chart-title">
        Net change by household type
      </h3>
      <p className="chart-subtitle">
        Net change in mean household income by household type, comparing pre- and post-Spring Statement OBR forecasts (&pound;/year)
      </p>
      <div className="chart-container-tall">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 40, left: 10, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
            <XAxis
              type="number"
              tickFormatter={(v) =>
                `${v >= 0 ? "+" : "-"}\u00a3${Math.abs(v)}`
              }
              tick={{ fontSize: 12, fill: colors.gray[500] }}
            />
            <YAxis
              type="category"
              dataKey="group"
              width={130}
              tick={{ fontSize: 12, fill: colors.gray[500] }}
            />
            <ReferenceLine x={0} stroke={colors.gray[500]} strokeWidth={1} />
            <Tooltip
              contentStyle={{
                background: "#fff",
                border: `1px solid ${colors.border.light}`,
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                fontSize: "0.85rem",
              }}
              formatter={(value) => [
                formatCurrencyChange(value) + "/year",
                "Change",
              ]}
            />
            <Bar
              dataKey="change"
              fill={colors.primary[600]}
              barSize={24}
              radius={[0, 4, 4, 0]}
              name="Change"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function HouseholdDecompositionTable({ decompositionData, selectedYear }) {
  const groups = decompositionData
    .filter((d) => d.year === selectedYear)
    .map((d) => d.group);

  const [selectedGroup, setSelectedGroup] = useState(groups[0] || "");

  // Reset selection when year changes
  useEffect(() => {
    if (groups.length > 0 && !groups.includes(selectedGroup)) {
      setSelectedGroup(groups[0]);
    }
  }, [selectedYear]);

  const row = decompositionData.find(
    (d) => d.year === selectedYear && d.group === selectedGroup,
  );
  if (!row) return null;

  const decomposition = row.decomposition;
  const nominalChange =
    (decomposition.market_income || 0) +
    (decomposition.taxes || 0) +
    (decomposition.benefits || 0);

  return (
    <div className="decomp-breakdown">
      <h3 className="chart-title">
        Net change by household type
      </h3>
      <p className="chart-subtitle">
        Net change in mean household income for {(row.weighted_n / 1e6).toFixed(2)}m {selectedGroup.toLowerCase()} households, comparing pre- and post-Spring Statement OBR forecasts (&pound;/year)
      </p>
      <div style={{ marginBottom: 16 }}>
        <select
          value={selectedGroup}
          onChange={(e) => setSelectedGroup(e.target.value)}
          style={{
            padding: "8px 32px 8px 16px",
            borderRadius: 10,
            border: `1px solid ${colors.gray[200]}`,
            fontSize: "0.85rem",
            fontFamily: "inherit",
            background: colors.gray[50],
            color: colors.gray[700],
            cursor: "pointer",
            appearance: "none",
            WebkitAppearance: "none",
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%236B7280' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 12px center",
            fontWeight: 500,
          }}
        >
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
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
                  <span
                    className="decomp-color-dot"
                    style={{ backgroundColor: meta.color }}
                  />
                  {meta.label}
                </td>
                <td className="decomp-table-value">
                  {detail ? formatAbsolute(detail.baseline) : "\u2014"}
                </td>
                <td className="decomp-table-value">
                  {detail ? formatAbsolute(detail.reform) : "\u2014"}
                </td>
                <td
                  className={`decomp-table-change ${change > 0.005 ? "positive" : change < -0.005 ? "negative" : "zero"}`}
                >
                  {formatDecomp(change)}
                </td>
              </tr>
            );
          })}
          <tr className="decomp-table-net-row">
            <td className="decomp-table-label font-semibold">
              Net income (nominal)
            </td>
            <td className="decomp-table-value font-semibold">
              {decomposition.details?.net_income
                ? formatAbsolute(decomposition.details.net_income.baseline)
                : "\u2014"}
            </td>
            <td className="decomp-table-value font-semibold">
              {decomposition.details?.net_income
                ? formatAbsolute(decomposition.details.net_income.reform)
                : "\u2014"}
            </td>
            <td
              className={`decomp-table-change font-semibold ${nominalChange > 0.005 ? "positive" : nominalChange < -0.005 ? "negative" : "zero"}`}
            >
              {formatDecomp(nominalChange)}
            </td>
          </tr>
          <tr className="decomp-table-purchasing-row">
            <td className="decomp-table-label">
              <span
                className="decomp-color-dot"
                style={{
                  backgroundColor: DECOMP_META.purchasing_power.color,
                }}
              />
              {DECOMP_META.purchasing_power.label}
            </td>
            <td className="decomp-table-value"></td>
            <td className="decomp-table-value"></td>
            <td
              className={`decomp-table-change ${decomposition.purchasing_power > 0.005 ? "positive" : decomposition.purchasing_power < -0.005 ? "negative" : "zero"}`}
            >
              {formatDecomp(decomposition.purchasing_power)}
            </td>
          </tr>
          <tr className="decomp-table-total-row">
            <td className="decomp-table-label font-semibold">
              Net income (2026 £)
            </td>
            <td className="decomp-table-value"></td>
            <td className="decomp-table-value"></td>
            <td
              className={`decomp-table-change font-semibold ${decomposition.total > 0.005 ? "positive" : decomposition.total < -0.005 ? "negative" : "zero"}`}
            >
              {formatDecomp(decomposition.total)}
            </td>
          </tr>
        </tbody>
      </table>
      <details className="methodology-details mt-3">
        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
          How is this calculated?
        </summary>
        <ul className="text-xs text-gray-400 mt-2 leading-relaxed list-disc pl-4 space-y-1">
          <li>
            Values are means across all households in the selected
            group, simulated in PolicyEngine UK
          </li>
          <li>
            Market income, taxes, benefits, and net income (nominal) are shown
            in <strong>cash terms</strong> for that year
          </li>
          <li>
            Purchasing power captures the effect of different CPI forecasts on
            the purchasing power of post-Statement net income
          </li>
          <li>
            Purchasing power = post-Statement net income &times;
            (CPI<sub>pre</sub> / CPI<sub>post</sub> &minus; 1), where
            CPI<sub>pre</sub> and CPI<sub>post</sub> are the price level
            indices for that year under the pre- and post-Statement forecasts
          </li>
          <li>
            Net income (2026 £) = nominal net income change + purchasing
            power
          </li>
          <li>
            This is the impact of revised macroeconomic forecasts (earnings and
            CPI), not a direct estimate of policy changes
          </li>
        </ul>
      </details>
    </div>
  );
}

export default function HouseholdArchetypes({ selectedYear }) {
  const [allDecomposition, setAllDecomposition] = useState(null);

  useEffect(() => {
    fetch("/data/household_decomposition.json")
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(setAllDecomposition);
  }, []);

  if (!allDecomposition) return null;

  const hasYear = allDecomposition.some((d) => d.year === selectedYear);
  if (!hasYear) return null;

  return (
    <div className="mt-8">
      <HouseholdDecompositionTable
        decompositionData={allDecomposition}
        selectedYear={selectedYear}
      />

      <div className="mt-8">
        <ChangeBarChart
          decompositionData={allDecomposition}
          selectedYear={selectedYear}
        />
      </div>
    </div>
  );
}
