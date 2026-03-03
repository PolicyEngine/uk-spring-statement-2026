import { useState, useEffect } from "react";
import ForecastTab from "./components/ForecastTab";
import PopulationTab from "./components/PopulationTab";
import PersonalTab from "./components/PersonalTab";
import "./App.css";

function App() {
  const [activeTab, setActiveTab] = useState("forecast");
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

  // URL state sync — read on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && ["forecast", "population", "personal"].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  // URL state sync — write on change
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (activeTab === "forecast") {
      params.delete("tab");
    } else {
      params.set("tab", activeTab);
    }
    const url = params.toString()
      ? `?${params.toString()}`
      : window.location.pathname;
    window.history.replaceState({}, "", url);
  }, [activeTab]);

  return (
    <div className="app">
      <header className="title-row">
        <div className="title-row-inner">
          <h1>UK Spring Statement 2026</h1>
        </div>
      </header>
      <main className="main-content">
        <p className="dashboard-intro">
          PolicyEngine analysis of the OBR's March 2026 economic forecast
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
              onClick={() => setActiveTab(tab.id)}
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

// Simple CSV parser
function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      const v = values[i];
      obj[h.trim()] =
        isNaN(v) || v === undefined || v.trim() === ""
          ? (v || "").trim()
          : parseFloat(v);
    });
    return obj;
  });
}

export default App;
