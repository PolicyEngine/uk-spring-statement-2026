"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ForecastTab from "../src/components/ForecastTab";
import PopulationTab from "../src/components/PopulationTab";
import PersonalTab from "../src/components/PersonalTab";
import parseCSV from "../lib/parseCSV";

const VALID_TABS = ["forecast", "population", "personal"];

function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam && VALID_TABS.includes(tabParam) ? tabParam : "forecast";

  const [activeTab, setActiveTab] = useState(initialTab);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load data on mount
  useEffect(() => {
    Promise.all([
      fetch("/data/economic_forecast.json").then((r) => {
        if (!r.ok) throw new Error("economic_forecast.json not found");
        return r.json();
      }),
      fetch("/data/distributional_impact.csv").then((r) => {
        if (!r.ok) throw new Error("distributional_impact.csv not found");
        return r.text();
      }),
      fetch("/data/metrics.csv").then((r) => {
        if (!r.ok) throw new Error("metrics.csv not found");
        return r.text();
      }),
      fetch("/data/winners_losers.csv")
        .then((r) => {
          if (!r.ok) return null;
          return r.text();
        })
        .catch(() => null),
    ])
      .then(([forecast, distributional, metrics, winnersLosers]) => {
        setData({
          forecast,
          distributional: parseCSV(distributional),
          metrics: parseCSV(metrics),
          winnersLosers: winnersLosers ? parseCSV(winnersLosers) : null,
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // URL state sync — write on tab change
  const handleTabChange = useCallback(
    (tab) => {
      setActiveTab(tab);
      if (tab === "forecast") {
        router.replace("/", { scroll: false });
      } else {
        router.replace(`/?tab=${tab}`, { scroll: false });
      }
    },
    [router],
  );

  return (
    <div className="app min-h-screen bg-gradient-to-br from-gray-50 via-[#f0f4f5] to-gray-50 relative">
      <header className="title-row">
        <div className="max-w-[1400px] mx-auto px-8 flex justify-between items-center">
          <h1>Spring Statement 2026 analysis</h1>
        </div>
      </header>
      <main className="max-w-[1400px] mx-auto px-8 py-12 relative z-[1]">
        <p className="text-[1.05rem] leading-relaxed text-gray-600 mb-8 animate-[fadeIn_0.4s_ease-out]">
          PolicyEngine analysis of the{" "}
          <a
            href="https://obr.uk/economic-and-fiscal-outlooks/"
            target="_blank"
            rel="noreferrer"
          >
            OBR&apos;s March 2026 economic forecast
          </a>{" "}
          revisions and their projected impact on UK household incomes. The
          Spring Statement contained no new policy measures — all changes result
          from updated economic assumptions.
        </p>

        <div className="flex mb-8 border-b-2 border-gray-200 w-fit">
          {[
            { id: "forecast", label: "Forecast changes" },
            { id: "population", label: "Population impact" },
            { id: "personal", label: "Personal calculator" },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => handleTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-center p-12 text-gray-500">Error: {error}</p>
        )}
        {loading && !error && (
          <p className="text-center p-12 text-gray-500">Loading data...</p>
        )}

        {!loading && !error && (
          <>
            {activeTab === "forecast" && <ForecastTab data={data} />}
            {activeTab === "population" && <PopulationTab data={data} />}
            {activeTab === "personal" && <PersonalTab />}
          </>
        )}

        <footer className="text-center pt-12 pb-6 text-gray-500 text-sm border-t border-gray-200 mt-12">
          <p>
            Built by{" "}
            <a
              href="https://policyengine.org"
              target="_blank"
              rel="noreferrer"
              className="font-semibold"
            >
              PolicyEngine
            </a>{" "}
            using the Enhanced Family Resources Survey and PolicyEngine UK
            microsimulation model.
          </p>
        </footer>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <p className="text-center p-12 text-gray-500">Loading...</p>
      }
    >
      <Dashboard />
    </Suspense>
  );
}
