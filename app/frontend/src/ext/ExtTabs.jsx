import React, { useCallback, useEffect, useState } from "react";
import { getExtHealth, getRegistry, listJobs, submitJob } from "./extApi";

// XL AI Studyo sekme icerikleri. App.jsx'e tek DDYZ-FORK satiriyla baglanir.

const STATUS_LABELS = { queued: "Sirada", running: "Calisiyor", done: "Bitti", failed: "Hata" };
const STATUS_COLORS = { queued: "#8a8f98", running: "#3b82f6", done: "#22c55e", failed: "#ef4444" };

function StatusBadge({ status }) {
  return (
    <span
      className="settings-value-badge"
      style={{ background: STATUS_COLORS[status] || "#8a8f98", color: "#fff", minWidth: 70, textAlign: "center" }}
    >
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function XlStudioPanel({ visible }) {
  const [health, setHealth] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [models, setModels] = useState([]);
  const [commercialOnly, setCommercialOnly] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      const [h, j, r] = await Promise.all([
        getExtHealth(),
        listJobs(),
        getRegistry(commercialOnly ? { commercial: true } : {}),
      ]);
      setHealth(h);
      setJobs(j.jobs);
      setModels(r.models);
      setError("");
    } catch (err) {
      setHealth(null);
      setError(err.message);
    }
  }, [commercialOnly]);

  useEffect(() => {
    if (!visible) return undefined;
    refresh();
    const timer = setInterval(refresh, 2000);
    return () => clearInterval(timer);
  }, [visible, refresh]);

  const sendTestJob = async () => {
    try {
      await submitJob("system", "echo", { mesaj: "Merhaba XL AI Studyo", zaman: new Date().toISOString() });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="workspace-area" style={{ overflowY: "auto" }}>
      <div className="workspace-title-section">
        <h2 className="workspace-title">XL Studyo</h2>
        <p className="workspace-subtitle">
          XL AI Studyo modullerinin durumu, is kuyrugu ve model lisans kaydi.
        </p>
      </div>

      <div className="settings-subsection">
        <div className="settings-subsection-title">Durum</div>
        {health ? (
          <p className="settings-option-desc">
            {health.name} eklenti katmani calisiyor (surum {health.extVersion}).
          </p>
        ) : (
          <p className="settings-option-desc">Eklenti katmanina ulasilamadi{error ? `: ${error}` : "."}</p>
        )}
      </div>

      <div className="settings-subsection">
        <div className="settings-subsection-title">Is kuyrugu</div>
        <p className="settings-option-desc">
          Agir isler sirayla calisir; ayni anda ekran kartinda tek buyuk model tutulur.
        </p>
        <button className="m3-btn m3-btn-tonal" onClick={sendTestJob} disabled={!health}>
          Test isi gonder
        </button>
        {error && health && <p className="settings-option-desc" style={{ color: "#ef4444" }}>{error}</p>}
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {jobs.length === 0 && <p className="settings-option-desc">Henuz is yok.</p>}
          {jobs.map((job) => (
            <div key={job.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <StatusBadge status={job.status} />
              <code>
                {job.module}/{job.task}
              </code>
              <span className="settings-option-desc" style={{ margin: 0 }}>
                {new Date(job.createdAt).toLocaleTimeString()}
                {job.error ? ` - ${job.error}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="settings-subsection">
        <div className="settings-subsection-title">Model lisans kaydi</div>
        <label className="settings-option-desc" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={commercialOnly} onChange={(e) => setCommercialOnly(e.target.checked)} />
          Yalnizca ticari kullanima uygun
        </label>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th>Model</th>
              <th>Alan</th>
              <th>Lisans</th>
              <th>Ticari</th>
            </tr>
          </thead>
          <tbody>
            {models.map((m) => (
              <tr key={m.id}>
                <td>{m.source || m.id}</td>
                <td>{m.module}</td>
                <td>{m.license}</td>
                <td>{m.commercial ? "Evet" : "Hayir"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ExtTabs({ activeTab }) {
  const visible = activeTab === "xl-studio";
  return (
    <div style={{ display: visible ? "flex" : "none", flex: 1, flexDirection: "column", overflow: "hidden" }}>
      <XlStudioPanel visible={visible} />
    </div>
  );
}
