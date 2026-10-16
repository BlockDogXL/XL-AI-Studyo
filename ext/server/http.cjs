// XL AI Studyo - HTTP yardimcilari (yalnizca Node.js standart kutuphanesi).

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// DD:YZ'nin json() yardimcisiyla ayni basliklar.
function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(body);
}

function readJsonBody(req, { limitBytes = 1_000_000 } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on("data", (chunk) => {
      if (failed) return;
      size += chunk.length;
      if (size > limitBytes) {
        failed = true;
        reject(new HttpError(400, `Istek govdesi cok buyuk (en fazla ${limitBytes} bayt)`));
        return;
      }
      chunks.push(chunk);
    });
    req.on("error", (err) => {
      if (!failed) {
        failed = true;
        reject(err);
      }
    });
    req.on("end", () => {
      if (failed) return;
      const text = Buffer.concat(chunks).toString("utf8").trim();
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new HttpError(400, "Gecersiz JSON govdesi"));
      }
    });
  });
}

module.exports = { HttpError, sendJson, readJsonBody };
