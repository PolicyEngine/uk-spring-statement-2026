"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import InequalityTable from "./InequalityTable";
import HouseholdArchetypes from "./HouseholdArchetypes";
import parseCSV from "../../lib/parseCSV";
import { colors } from "@policyengine/design-system/tokens/colors";


const YEARS = [2026, 2027, 2028, 2029, 2030];

const YEAR_OPTIONS = YEARS.map((y) => ({
  value: y,
  label: `${y}-${(y + 1).toString().slice(-2)}`,
}));

const COUNTRY_OPTIONS = [
  { value: "UK", label: "UK" },
  { value: "ENGLAND", label: "England" },
  { value: "SCOTLAND", label: "Scotland" },
  { value: "WALES", label: "Wales" },
  { value: "NORTHERN_IRELAND", label: "Northern Ireland" },
];

function ExpandableSelector({ options, selected, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const selectedOption = options.find((o) => o.value === selected);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!expanded) return;
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setExpanded(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [expanded]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className="year-selector-trigger"
        onClick={() => setExpanded(!expanded)}
      >
        {selectedOption?.label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            marginLeft: 8,
            opacity: 0.45,
            transition: "transform 0.2s",
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {expanded && (
        <div className="year-selector-dropdown">
          {options.map((opt) => (
            <button
              key={opt.value}
              className={selected === opt.value ? "active" : ""}
              onClick={() => {
                onSelect(opt.value);
                setExpanded(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DECILE_ORDER = [
  "1st", "2nd", "3rd", "4th", "5th",
  "6th", "7th", "8th", "9th", "10th",
];

function MetricsBar({ metrics, winnersLosers, distributional, year }) {
  const cards = [];

  if (distributional && distributional.length > 0) {
    const allRow = distributional.find(
      (d) => d.year === year && d.decile === "All",
    );
    if (allRow) {
      const absChange = allRow.absolute_change_real;
      cards.push({
        label: "Average household impact",
        value: `${absChange >= 0 ? "+" : ""}\u00a3${absChange.toFixed(0)}/year`,
      });
    }
  }

  if (winnersLosers && winnersLosers.length > 0) {
    const allRow = winnersLosers.find(
      (d) => d.year === year && d.decile === "All",
    );
    if (allRow) {
      cards.push({
        label: "Households gaining",
        value: `${allRow.pct_gaining.toFixed(1)}%`,
      });
      cards.push({
        label: "Households losing",
        value: `${allRow.pct_losing.toFixed(1)}%`,
      });
    }
  }

  if (metrics && metrics.length > 0) {
    const yearMetrics = metrics.filter((m) => m.year === year);
    const povertyChange = yearMetrics.find(
      (m) => m.metric === "abs_bhc_poverty_rate_change",
    );
    if (povertyChange) {
      cards.push({
        label: "Absolute poverty rate (BHC) change",
        value: `${povertyChange.value >= 0 ? "+" : ""}${povertyChange.value.toFixed(2)} pp`,
      });
    }
  }

  if (cards.length === 0) return null;

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-8 max-md:grid-cols-1">
      {cards.map((card) => (
        <div key={card.label} className="metric-card">
          <div className="text-xs font-medium text-gray-500 mb-1">
            {card.label}
          </div>
          <div className="text-2xl font-bold text-gray-800 tracking-tight">
            {card.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function WinnersLosersChart({ data, year }) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data
      .filter(
        (d) => d.year === year && d.decile !== "All" && d.decile !== "Overall",
      )
      .map((d) => {
        const gaining = d.pct_gaining;
        const losing = d.pct_losing ? -Math.abs(d.pct_losing) : 0;
        return {
          decile: d.decile,
          gaining,
          losing,
          net: gaining + losing,
        };
      })
      .sort(
        (a, b) =>
          DECILE_ORDER.indexOf(a.decile) - DECILE_ORDER.indexOf(b.decile),
      );
  }, [data, year]);

  if (chartData.length === 0) return null;

  return (
    <div className="section-card">
      <h3 className="text-base font-semibold text-gray-800 mb-2">
        Winners and losers by income decile
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Share of households seeing a net gain or loss in real income (2026 prices) under revised OBR forecasts, by income decile, {year}-
        {(year + 1).toString().slice(-2)}
      </p>
      <div className="w-full h-[380px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 24, left: 16, bottom: 32 }}
            stackOffset="sign"
          >
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.light} />
            <XAxis
              dataKey="decile"
              tick={{ fontSize: 12, fill: colors.gray[500] }}
              tickLine={false}
              label={{
                value: "Income decile",
                position: "insideBottom",
                offset: -16,
                style: { fill: colors.gray[700], fontSize: 12, fontWeight: 500 },
              }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: colors.gray[500] }}
              tickFormatter={(v) => `${v}%`}
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
              domain={[-80, 80]}
              ticks={[-80, -60, -40, -20, 0, 20, 40, 60, 80]}
            />
            <ReferenceLine y={0} stroke={colors.gray[500]} strokeWidth={1} />
            <Tooltip
              contentStyle={{
                background: colors.white,
                border: `1px solid ${colors.border.light}`,
                borderRadius: 8,
                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                fontSize: "0.85rem",
              }}
              formatter={(value, name) => {
                if (name === "net") return [`${value >= 0 ? "+" : ""}${value.toFixed(1)}%`, "Net"];
                return [
                  `${Math.abs(value).toFixed(1)}%`,
                  name === "gaining" ? "Gaining" : "Losing",
                ];
              }}
              labelFormatter={(label) => `${label} decile`}
            />
            <Bar
              dataKey="gaining"
              fill={colors.blue[700]}
              stackId="stack"
              name="gaining"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="losing"
              fill={colors.primary[600]}
              stackId="stack"
              name="losing"
              radius={[4, 4, 0, 0]}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function PopulationTab({ data }) {
  const [selectedYear, setSelectedYear] = useState(2029);
  const [selectedCountry, setSelectedCountry] = useState("UK");
  const [inequalityData, setInequalityData] = useState(null);

  useEffect(() => {
    fetch("/data/inequality.csv")
      .then((r) => (r.ok ? r.text() : null))
      .then((text) => {
        if (text) setInequalityData(parseCSV(text));
      })
      .catch(() => null);
  }, []);

  // Filter data by selected country
  const filteredData = useMemo(() => {
    if (!data) return data;
    const filterByCountry = (arr) => {
      if (!arr) return arr;
      // If data has no country column (old format), show all for UK only
      if (arr.length > 0 && !arr[0].country) {
        return selectedCountry === "UK" ? arr : [];
      }
      return arr.filter((d) => d.country === selectedCountry);
    };
    return {
      ...data,
      distributional: filterByCountry(data.distributional),
      metrics: filterByCountry(data.metrics),
      winnersLosers: filterByCountry(data.winnersLosers),
    };
  }, [data, selectedCountry]);

  const filteredInequality = useMemo(() => {
    if (!inequalityData) return inequalityData;
    if (inequalityData.length > 0 && !inequalityData[0].country) {
      return selectedCountry === "UK" ? inequalityData : [];
    }
    return inequalityData.filter((d) => d.country === selectedCountry);
  }, [inequalityData, selectedCountry]);

  const hasWinnersLosers =
    data?.winnersLosers && data.winnersLosers.length > 0;

  if (!hasWinnersLosers) {
    return (
      <div className="data-message">
        <p>
          Population impact data not yet generated. Run{" "}
          <code>uv run spring-statement-data generate</code> to generate
          microsimulation results.
        </p>
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeIn 0.3s ease-out" }}>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <ExpandableSelector
          options={YEAR_OPTIONS}
          selected={selectedYear}
          onSelect={setSelectedYear}
        />
        <ExpandableSelector
          options={COUNTRY_OPTIONS}
          selected={selectedCountry}
          onSelect={setSelectedCountry}
        />
      </div>

      <MetricsBar
        metrics={filteredData.metrics}
        winnersLosers={filteredData.winnersLosers}
        distributional={filteredData.distributional}
        year={selectedYear}
      />

      <HouseholdArchetypes selectedYear={selectedYear} selectedCountry={selectedCountry} />

      <div className="mt-8">
        {filteredData.winnersLosers && filteredData.winnersLosers.length > 0 && (
          <WinnersLosersChart
            data={filteredData.winnersLosers}
            year={selectedYear}
          />
        )}
      </div>

      <InequalityTable
        data={filteredInequality}
        selectedYear={selectedYear}
      />
    </div>
  );
}
