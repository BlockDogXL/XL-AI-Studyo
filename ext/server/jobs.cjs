// XL AI Studyo - is kuyrugu.
// Isler tek tek, sirayla calisir (VRAM kurali: ayni anda tek agir is).
// Her durum degisikligi dataDir/jobs.jsonl dosyasina bir satir olarak eklenir.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { HttpError } = require("./http.cjs");

const builtinRunners = {
  system: async (task, params) => {
    if (task === "echo") return params;
    throw new Error(`Bilinmeyen system gorevi: ${task}`);
  },
};

function loadJobs(file) {
  const jobs = new Map();
  if (!fs.existsSync(file)) return jobs;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const job = JSON.parse(line);
      if (job && job.id) jobs.set(job.id, job);
    } catch {
      // Yarim yazilmis son satir (ani kapanma) atlanir.
    }
  }
  return jobs;
}

function createJobQueue({ dataDir, runners = {} }) {
  fs.mkdirSync(dataDir, { recursive: true });
  const file = path.join(dataDir, "jobs.jsonl");
  const allRunners = { ...builtinRunners, ...runners };
  const jobs = loadJobs(file);
  const pending = [];
  let active = null;
  let idleWaiters = [];

  const persist = (job) => fs.appendFileSync(file, JSON.stringify(job) + "\n");

  for (const job of jobs.values()) {
    if (job.status === "running" || job.status === "queued") {
      job.status = "failed";
      job.error = "interrupted";
      job.finishedAt = new Date().toISOString();
      persist(job);
    }
  }

  function settleIdle() {
    if (active || pending.length) return;
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  }

  async function runNext() {
    if (active || !pending.length) return settleIdle();
    const job = pending.shift();
    active = job;
    job.status = "running";
    job.startedAt = new Date().toISOString();
    persist(job);
    try {
      job.result = await allRunners[job.module](job.task, job.params, { jobId: job.id });
      job.status = "done";
    } catch (err) {
      job.status = "failed";
      job.error = err && err.message ? err.message : String(err);
    }
    job.finishedAt = new Date().toISOString();
    persist(job);
    active = null;
    setImmediate(runNext);
  }

  function submit(module, task, params = {}) {
    if (!allRunners[module]) throw new HttpError(400, `Bilinmeyen modul: ${module}`);
    const job = {
      id: crypto.randomUUID(),
      module,
      task,
      params,
      status: "queued",
      createdAt: new Date().toISOString(),
    };
    jobs.set(job.id, job);
    persist(job);
    pending.push(job);
    setImmediate(runNext);
    return job;
  }

  return {
    submit,
    get: (id) => jobs.get(id),
    list: ({ limit = 50 } = {}) => [...jobs.values()].reverse().slice(0, limit),
    idle: () =>
      new Promise((resolve) => {
        idleWaiters.push(resolve);
        setImmediate(settleIdle);
      }),
  };
}

module.exports = { createJobQueue, builtinRunners };
