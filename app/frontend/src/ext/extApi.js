// XL AI Studyo - ext API istemcisi. DD:YZ'nin api.js'i gibi goreli adres kullanir.

async function request(url, options) {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || `Istek basarisiz (HTTP ${res.status})`);
  }
  return data;
}

export const getExtHealth = () => request("/api/ext/health");

export const listJobs = () => request("/api/ext/jobs?limit=20");

export const submitJob = (module, task, params = {}) =>
  request("/api/ext/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ module, task, params }),
  });

export const getRegistry = ({ commercial } = {}) =>
  request(commercial === undefined ? "/api/ext/models/registry" : `/api/ext/models/registry?commercial=${commercial}`);
