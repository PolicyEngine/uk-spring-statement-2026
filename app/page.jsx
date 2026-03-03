"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ForecastTab from "../src/components/ForecastTab";
import PopulationTab from "../src/components/PopulationTab";
import PersonalTab from "../src/components/PersonalTab";
import parseCSV from "../lib/parseCSV";
import "./App.css";

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
    <div className="app">
      <header className="title-row">
        <div className="title-row-inner">
          <h1>Spring Statement 2026 analysis</h1>
        </div>
      </header>
      <main className="main-content">
        <p className="dashboard-intro">
          PolicyEngine analysis of the OBR&apos;s March 2026 economic forecast
          revisions and their projected impact on UK household incomes. The
          Spring Statement contained no new policy measures — all changes result
          from updated economic assumptions.
        </p>

        <div className="tab-navigation">
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

        {error && <p className="loading">Error: {error}</p>}
        {loading && !error && <p className="loading">Loading data...</p>}

        {!loading && !error && (
          <>
            {activeTab === "forecast" && <ForecastTab data={data} />}
            {activeTab === "population" && <PopulationTab data={data} />}
            {activeTab === "personal" && <PersonalTab />}
          </>
        )}

        <footer className="footer">
          <p>
            Built by{" "}
            <a
              href="https://policyengine.org"
              target="_blank"
              rel="noreferrer"
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
    <Suspense fallback={<p className="loading">Loading...</p>}>
      <Dashboard />
    </Suspense>
  );
}
