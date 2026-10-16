// Test yardimcilari: sahte istek (req) ve yaniti yakalayan sahte yanit (res).
const { Readable } = require("node:stream");

function fakeReq(method, url, body) {
  const chunks = body === undefined ? [] : [Buffer.isBuffer(body) ? body : Buffer.from(body)];
  const req = Readable.from(chunks);
  req.method = method;
  req.url = url;
  req.headers = {};
  return req;
}

function fakeRes() {
  const res = {
    statusCode: null,
    headers: null,
    body: "",
    ended: false,
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(data) {
      if (data) this.body += data;
      this.ended = true;
    },
    json() {
      return JSON.parse(this.body);
    },
  };
  return res;
}

module.exports = { fakeReq, fakeRes };
