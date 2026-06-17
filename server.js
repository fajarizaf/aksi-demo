import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import express from "express";
import multer from "multer";
import * as XLSX from "xlsx";

const PORT = Number(process.env.PORT || 5174);
const ROOT_DIR = path.resolve(process.cwd());
const DB_PATH = path.join(ROOT_DIR, "aksi-db.json");
const ADMIN_LOGIN_PATH = path.join(ROOT_DIR, "login.html");
const ADMIN_PAGE_PATH = path.join(ROOT_DIR, "admin.html");
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || "admin");
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "admin123");
const ADMIN_SESSION_COOKIE = "aksi_admin_session";
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const adminSessions = new Map();

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.disable("x-powered-by");
app.use(express.json({ limit: "2mb" }));

function parseCookies(cookieHeader) {
  const out = {};
  String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const idx = part.indexOf("=");
      if (idx < 0) return;
      const key = decodeURIComponent(part.slice(0, idx).trim());
      const value = decodeURIComponent(part.slice(idx + 1).trim());
      out[key] = value;
    });
  return out;
}

function setSessionCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(
      ADMIN_SESSION_TTL_MS / 1000
    )}`
  );
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", `${ADMIN_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function getSessionUser(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = String(cookies[ADMIN_SESSION_COOKIE] || "");
  if (!token) return null;
  const session = adminSessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    adminSessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
  return session;
}

function requireAdminAuth(req, res, next) {
  const session = getSessionUser(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  req.adminSession = session;
  next();
}

function nowIso() {
  return new Date().toISOString();
}

function safeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
}

async function readDb() {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const db = JSON.parse(raw);
    if (!db || typeof db !== "object") throw new Error("db invalid");
    db.activeDatasetId = String(db.activeDatasetId || "");
    db.datasets = Array.isArray(db.datasets) ? db.datasets : [];
    db.records = Array.isArray(db.records) ? db.records : [];
    return db;
  } catch (e) {
    if (e && e.code === "ENOENT") {
      return { activeDatasetId: "", datasets: [], records: [] };
    }
    throw e;
  }
}

async function writeDb(db) {
  const tmp = `${DB_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_PATH);
}

function normalizeKey(v) {
  return String(v ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const PROVINCE_OPTIONS = [
  "ACEH",
  "SUMATERA UTARA",
  "SUMATERA BARAT",
  "RIAU",
  "JAMBI",
  "SUMATERA SELATAN",
  "BENGKULU",
  "LAMPUNG",
  "KEPULAUAN BANGKA BELITUNG",
  "KEPULAUAN RIAU",
  "DKI JAKARTA",
  "JAWA BARAT",
  "JAWA TENGAH",
  "DI YOGYAKARTA",
  "JAWA TIMUR",
  "BANTEN",
  "BALI",
  "NUSA TENGGARA BARAT",
  "NUSA TENGGARA TIMUR",
  "KALIMANTAN BARAT",
  "KALIMANTAN TENGAH",
  "KALIMANTAN SELATAN",
  "KALIMANTAN TIMUR",
  "KALIMANTAN UTARA",
  "SULAWESI UTARA",
  "SULAWESI TENGAH",
  "SULAWESI SELATAN",
  "SULAWESI TENGGARA",
  "GORONTALO",
  "SULAWESI BARAT",
  "MALUKU",
  "MALUKU UTARA",
  "PAPUA",
  "PAPUA BARAT",
  "PAPUA BARAT DAYA",
  "PAPUA TENGAH",
  "PAPUA PEGUNUNGAN",
  "PAPUA SELATAN",
];
const PROVINCE_ALIASES = new Map(
  Object.entries({
    "NANGGROE ACEH DARUSSALAM": "ACEH",
    "BANGKA BELITUNG": "KEPULAUAN BANGKA BELITUNG",
    "KEP BANGKA BELITUNG": "KEPULAUAN BANGKA BELITUNG",
    "KEP. BANGKA BELITUNG": "KEPULAUAN BANGKA BELITUNG",
    "KEP RIAU": "KEPULAUAN RIAU",
    "KEP. RIAU": "KEPULAUAN RIAU",
    JAKARTA: "DKI JAKARTA",
    YOGYAKARTA: "DI YOGYAKARTA",
    DIY: "DI YOGYAKARTA",
    "DAERAH ISTIMEWA YOGYAKARTA": "DI YOGYAKARTA",
    "D I YOGYAKARTA": "DI YOGYAKARTA",
    "D.I YOGYAKARTA": "DI YOGYAKARTA",
    "D.I. YOGYAKARTA": "DI YOGYAKARTA",
  }).map(([key, value]) => [normalizeKey(key), value])
);
const VALID_PROVINCES = new Set(PROVINCE_OPTIONS);

function findHeader(headers, synonyms) {
  const map = new Map(headers.map((h) => [normalizeKey(h), h]));
  for (const s of synonyms) {
    const hit = map.get(normalizeKey(s));
    if (hit) return hit;
  }
  for (const h of headers) {
    const nk = normalizeKey(h);
    if (!nk) continue;
    for (const s of synonyms) {
      if (nk.includes(normalizeKey(s))) return h;
    }
  }
  return null;
}

function inferMappingFromHeaders(headers) {
  return {
    no: findHeader(headers, ["no", "nomor"]),
    wilayah: findHeader(headers, ["wilayah", "provinsi", "province", "region"]),
    kotaKab: findHeader(headers, ["kota/kabupaten", "kota kabupaten", "kota", "kabupaten", "city"]),
    lokasi: findHeader(headers, ["lokasi", "tempat", "lokasi kegiatan", "lokasi (kegiatan)", "lokasi kegiatan/aksi"]),
    kegiatan: findHeader(headers, ["kegiatan", "aksi", "kegiatan / aliansi", "kegiatan/aliansi", "kelompok aksi"]),
    aliansi: findHeader(headers, ["aliansi", "organisasi", "kelompok", "aliansi/organisasi", "kelompok aksi"]),
    waktu: findHeader(headers, ["waktu", "jam", "tanggal aksi", "tanggal", "hari", "time", "tgl"]),
    lokasiAksi: findHeader(headers, ["lokasi aksi", "lokasi_aksi", "lokasi aksi (alamat)", "alamat lokasi aksi"]),
    tuntutan: findHeader(headers, ["tuntutan", "demand", "tuntutan/isu", "isu/tuntutan"]),
    ringkasan: findHeader(headers, ["ringkasan", "summary", "ringkasan tuntutan", "deskripsi singkat", "uraian singkat"]),
    isu: findHeader(headers, ["isu dominan", "isu", "kategori", "tema", "issue"]),
    massa: findHeader(headers, ["estimasi massa", "massa", "estimasi", "jumlah massa", "jumlah peserta", "estimasi peserta"]),
    lat: findHeader(headers, ["lat", "latitude", "lintang"]),
    lng: findHeader(headers, ["lng", "lon", "long", "longitude", "bujur"]),
    koordinat: findHeader(headers, ["koordinat", "coordinate", "latlng", "lat lon"]),
    mapsUrl: findHeader(headers, [
      "google maps",
      "maps",
      "gmaps",
      "link maps",
      "tautan maps",
      "url maps",
      "lokasi maps",
      "link lokasi",
      "maps url",
      "map url",
    ]),
  };
}

function toStr(v) {
  if (v == null) return "";
  return String(v).trim();
}

function canonicalProvince(v) {
  const s = toStr(v);
  if (!s) return "";
  const normalized = s.replace(/\s+/g, " ").trim().toUpperCase();
  return PROVINCE_ALIASES.get(normalizeKey(normalized)) || normalized;
}

function findInvalidImportProvinceRows(rows) {
  const invalidRows = [];
  for (const row of rows) {
    const rawValue = toStr(row?.record?.WILAYAH);
    const wilayah = canonicalProvince(rawValue);
    if (!wilayah) {
      invalidRows.push({
        rowNumber: row.rowNumber,
        wilayah: rawValue,
        message: "WILAYAH wajib diisi dengan nama provinsi.",
      });
      continue;
    }
    if (!VALID_PROVINCES.has(wilayah)) {
      invalidRows.push({
        rowNumber: row.rowNumber,
        wilayah: rawValue,
        message: `WILAYAH "${rawValue}" tidak ada dalam daftar provinsi.`,
      });
    }
  }
  return invalidRows;
}

function parseMass(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const s = String(value).trim();
  if (!s) return null;
  const digits = s
    .replace(/orang/gi, "")
    .replace(/[+±≈~]/g, "")
    .replace(/\s+/g, "")
    .replace(/,/g, ".")
    .match(/[\d.]+/g);
  if (!digits || !digits.length) return null;
  const joined = digits.join("");
  const n = Number(joined.replace(/\./g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseDateParts(value) {
  const s = toStr(value);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    return {
      year: iso[1],
      month: String(iso[2]).padStart(2, "0"),
      day: String(iso[3]).padStart(2, "0"),
      iso: `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`,
    };
  }
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const year = slash[3];
    let month = a;
    let day = b;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    }
    return {
      year,
      month: String(month).padStart(2, "0"),
      day: String(day).padStart(2, "0"),
      iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }
  const slashShortYear = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashShortYear) {
    const year = Number(slashShortYear[3]);
    const fullYear = year >= 70 ? 1900 + year : 2000 + year;
    const a = Number(slashShortYear[1]);
    const b = Number(slashShortYear[2]);
    let month = a;
    let day = b;
    if (a > 12 && b <= 12) {
      day = a;
      month = b;
    }
    return {
      year: String(fullYear),
      month: String(month).padStart(2, "0"),
      day: String(day).padStart(2, "0"),
      iso: `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }
  return null;
}

function normalizeDateKey(value) {
  return parseDateParts(value)?.iso || toStr(value);
}

function normalizeStoredDate(value) {
  const parsed = parseDateParts(value);
  if (!parsed) return toStr(value);
  return `${Number(parsed.month)}/${Number(parsed.day)}/${parsed.year.slice(-2)}`;
}

function buildImportMatchKey(record) {
  const tanggal = normalizeDateKey(record["TANGGAL AKSI"] ?? record.TANGGAL);
  const wilayah = canonicalProvince(record.WILAYAH);
  const lokasi = normalizeKey(record.LOKASI);
  const kelompokAksi = normalizeKey(record["KELOMPOK AKSI"]);
  if (!tanggal || !wilayah || !lokasi || !kelompokAksi) return "";
  return `${tanggal}__${normalizeKey(wilayah)}__${lokasi}__${kelompokAksi}`;
}

function parseLatLngFromCell(v) {
  const s = toStr(v);
  if (!s) return null;
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*[,; ]\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return [lat, lng];
}

function extractLatLngFromUrl(value) {
  const s = toStr(value);
  if (!s) return null;
  try {
    const u = new URL(s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`);
    const hay = `${u.pathname}${u.search}${u.hash}`;

    const mPb = hay.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (mPb) {
      const lat = Number(mPb[1]);
      const lng = Number(mPb[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    }

    const at = hay.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at) {
      const lat = Number(at[1]);
      const lng = Number(at[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    }

    const qp = ["q", "query", "ll", "center", "destination", "origin"]
      .map((k) => u.searchParams.get(k))
      .filter(Boolean)
      .join(" ");
    const m1 = qp.match(/(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/);
    if (m1) {
      const lat = Number(m1[1]);
      const lng = Number(m1[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    }

    const pb = u.searchParams.get("pb") || "";
    const m2 = pb.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (m2) {
      const lat = Number(m2[1]);
      const lng = Number(m2[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeGoogleMapsLink(value) {
  const s = toStr(value);
  if (!s) return "";
  const normalized = s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`;
  try {
    const u = new URL(normalized);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    const host = u.hostname.toLowerCase();
    const okHost = host === "maps.app.goo.gl" || host.endsWith(".goo.gl") || host.includes("google.");
    if (!okHost) return "";
    return u.toString();
  } catch {
    return "";
  }
}

function httpRequestFollow(url, { maxRedirects = 6, timeoutMs = 6000 } = {}) {
  return new Promise((resolve, reject) => {
    let current = url;
    let redirectsLeft = maxRedirects;

    const step = () => {
      let u;
      try {
        u = new URL(current);
      } catch (e) {
        reject(e);
        return;
      }
      const client = u.protocol === "http:" ? http : https;
      const req = client.request(
        current,
        {
          method: "GET",
          headers: {
            "User-Agent": "aksi-demo/1.0",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          },
        },
        (res) => {
          const code = Number(res.statusCode || 0);
          const loc = String(res.headers.location || "");
          res.resume();
          if (code >= 300 && code < 400 && loc) {
            if (redirectsLeft <= 0) {
              reject(new Error("redirect limit exceeded"));
              return;
            }
            redirectsLeft -= 1;
            current = new URL(loc, u).toString();
            step();
            return;
          }
          resolve(current);
        }
      );
      req.on("error", reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error("timeout"));
      });
      req.end();
    };

    step();
  });
}

async function resolveLatLngFromGoogleMapsLink(link) {
  const normalized = normalizeGoogleMapsLink(link);
  if (!normalized) return null;

  const direct = extractLatLngFromUrl(normalized);
  if (direct) return direct;
  let u;
  try {
    u = new URL(normalized);
  } catch {
    return null;
  }
  const host = u.hostname.toLowerCase();
  const isShort = host === "maps.app.goo.gl" || host.endsWith(".goo.gl");
  if (!isShort) return null;
  try {
    const finalUrl = await httpRequestFollow(u.toString());
    return extractLatLngFromUrl(finalUrl);
  } catch {
    return null;
  }
}

async function enrichRowsWithGeoFromMaps(rows) {
  const targets = rows
    .map((item, idx) => ({ item, idx }))
    .filter(({ item }) => {
      const r = item?.record || {};
      const lat = Number(r.LAT);
      const lng = Number(r.LNG);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return false;
      const link = toStr(r["GOOGLE MAPS"] || r["MAPS"] || r["LINK MAPS"] || "");
      return Boolean(link);
    });

  const concurrency = 6;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, targets.length) }, async () => {
    while (cursor < targets.length) {
      const myIdx = cursor++;
      const { item } = targets[myIdx];
      const r = item.record;
      const link = toStr(r["GOOGLE MAPS"] || r["MAPS"] || r["LINK MAPS"] || "");
      const pair = await resolveLatLngFromGoogleMapsLink(link);
      if (pair) {
        r.LAT = pair[0];
        r.LNG = pair[1];
      }
    }
  });
  await Promise.all(workers);
}

function normalizeRecord(input, mapping) {
  const wilayah = canonicalProvince(input[mapping.wilayah] ?? input["Wilayah"] ?? input["Provinsi"]);
  const lokasi = toStr(input[mapping.lokasi] ?? input["Lokasi"] ?? input["Lokasi Kegiatan"] ?? input["Tempat"]);
  const no = toStr(input["NO"] ?? input["No"] ?? input.no);
  const tanggal = toStr(
    input["TANGGAL AKSI"] ?? input["Tanggal Aksi"] ?? input["TANGGAL"] ?? input["Tanggal"] ?? input[mapping.waktu] ?? input["Waktu"]
  );
  const kelompokAksi = toStr(
    input["KELOMPOK AKSI"] ??
      input["Kelompok Aksi"] ??
      input[mapping.kegiatan] ??
      input["Kegiatan"] ??
      input["Aksi"] ??
      input[mapping.aliansi] ??
      input["Aliansi"] ??
      input["Organisasi"]
  );
  const waktu = toStr(input[mapping.waktu] ?? input["Waktu"]);
  const tuntutan = toStr(input[mapping.tuntutan] ?? input["Tuntutan"]);
  const ringkasan = toStr(input[mapping.ringkasan] ?? input["RINGKASAN"] ?? input["Ringkasan"] ?? input["Summary"]);
  const estimasiMassa = parseMass(
    input["JUMLAH MASSA"] ?? input["Jumlah Massa"] ?? input[mapping.massa] ?? input["Estimasi Massa"] ?? input["Massa"]
  );
  const directMapsUrl = toStr(
    input[mapping.mapsUrl] ??
      input["GOOGLE MAPS"] ??
      input["Google Maps"] ??
      input["MAPS"] ??
      input["Maps"] ??
      input["LINK MAPS"] ??
      input["Link Maps"] ??
      input["URL MAPS"] ??
      input["Url Maps"] ??
      input["LINK LOKASI"] ??
      input["Link Lokasi"]
  );
  let mapsUrl = directMapsUrl;
  if (!mapsUrl) {
    for (const [, value] of Object.entries(input || {})) {
      const s = toStr(value);
      if (!s) continue;
      const lower = s.toLowerCase();
      const looksLikeMaps =
        lower.includes("maps.app.goo.gl") ||
        lower.includes("google.com/maps") ||
        lower.includes("www.google.com/maps") ||
        (lower.includes("google.") && lower.includes("/maps")) ||
        lower.includes("goo.gl/maps");
      if (looksLikeMaps) {
        mapsUrl = s;
        break;
      }
    }
  }

  let lat = null;
  let lng = null;
  const coordCell = input[mapping.koordinat];
  const pair = parseLatLngFromCell(coordCell);
  if (pair) [lat, lng] = pair;
  const latCell = input[mapping.lat];
  const lngCell = input[mapping.lng];
  if (lat == null && lng == null && latCell !== "" && lngCell !== "") {
    const a = Number(String(latCell).replace(",", "."));
    const b = Number(String(lngCell).replace(",", "."));
    if (Number.isFinite(a) && Number.isFinite(b)) {
      lat = a;
      lng = b;
    }
  }
  if (lat == null || lng == null) {
    const fromUrl = extractLatLngFromUrl(mapsUrl);
    if (fromUrl) [lat, lng] = fromUrl;
  }

  const record = {
    NO: no,
    TANGGAL: normalizeStoredDate(tanggal || waktu),
    WILAYAH: wilayah,
    "JUMLAH MASSA": estimasiMassa,
    LOKASI: lokasi,
    "KELOMPOK AKSI": kelompokAksi,
    TUNTUTAN: tuntutan,
    RINGKASAN: ringkasan,
  };
  if (mapsUrl) record["GOOGLE MAPS"] = mapsUrl;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    record.LAT = lat;
    record.LNG = lng;
  }
  return record;
}

function parseWorkbook(buffer, ext, sheetName) {
  let wb;
  if (ext === "csv") {
    const text = buffer.toString("utf8");
    wb = XLSX.read(text, { type: "string" });
  } else {
    wb = XLSX.read(buffer, { type: "buffer" });
  }
  const sn = sheetName && wb.SheetNames.includes(sheetName) ? sheetName : wb.SheetNames[0];
  const sheet = wb.Sheets[sn];
  const records = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false }) : [];
  const headers = Object.keys(records[0] || {});
  const mapping = inferMappingFromHeaders(headers);
  const normalizedRows = records
    .map((r, idx) => ({ rowNumber: idx + 2, record: normalizeRecord(r, mapping) }))
    .filter(({ record }) => record.WILAYAH || record.LOKASI || record["KELOMPOK AKSI"] || record.TUNTUTAN || record.RINGKASAN);
  return {
    sheetName: sn || null,
    rows: normalizedRows,
    records: normalizedRows.map((item) => item.record),
    rowCount: normalizedRows.length,
  };
}

function getNextRecordNo(records, datasetId) {
  const used = records
    .filter((r) => r.datasetId === datasetId)
    .map((r) => Number.parseInt(String(r.NO || "").trim(), 10))
    .filter((n) => Number.isFinite(n));
  const max = used.length ? Math.max(...used) : 0;
  return String(max + 1);
}

function resequenceDatasetRecords(records, datasetId) {
  const target = records
    .filter((r) => r.datasetId === datasetId)
    .sort((a, b) => {
      const an = Number.parseInt(String(a.NO || "").trim(), 10);
      const bn = Number.parseInt(String(b.NO || "").trim(), 10);
      if (Number.isFinite(an) && Number.isFinite(bn) && an !== bn) return an - bn;
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    });
  target.forEach((r, idx) => {
    r.NO = String(idx + 1);
  });
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/login.html", (req, res) => {
  const session = getSessionUser(req);
  if (session) return res.redirect("/admin.html");
  res.sendFile(ADMIN_LOGIN_PATH);
});

app.get("/admin.html", (req, res) => {
  const session = getSessionUser(req);
  if (!session) return res.redirect("/login.html");
  res.sendFile(ADMIN_PAGE_PATH);
});

app.get("/api/admin/auth/session", (req, res) => {
  const session = getSessionUser(req);
  if (!session) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, username: session.username });
});

app.post("/api/admin/auth/login", (req, res) => {
  const username = String(req.body?.username || "").trim();
  const password = String(req.body?.password || "");
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    clearSessionCookie(res);
    return res.status(401).json({ error: "Username atau password salah." });
  }
  const token = safeId();
  adminSessions.set(token, { token, username, expiresAt: Date.now() + ADMIN_SESSION_TTL_MS });
  setSessionCookie(res, token);
  res.json({ ok: true, username });
});

app.post("/api/admin/auth/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const token = String(cookies[ADMIN_SESSION_COOKIE] || "");
  if (token) adminSessions.delete(token);
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/api/datasets", requireAdminAuth, async (_req, res) => {
  const db = await readDb();
  const list = db.datasets
    .slice()
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    .map((d) => ({ ...d, isActive: d.id === db.activeDatasetId }));
  res.json({ activeDatasetId: db.activeDatasetId, datasets: list });
});

app.post("/api/datasets/import", requireAdminAuth, upload.single("file"), async (req, res) => {
  const file = req.file;
  const name = String(req.body?.name || "").trim() || (file?.originalname ? file.originalname.replace(/\.(xlsx|xls|csv)$/i, "") : "Dataset");
  const sheetName = String(req.body?.sheetName || "").trim() || null;
  if (!file) return res.status(400).json({ error: "file wajib" });

  const ext = String(file.originalname.split(".").pop() || "").toLowerCase();
  if (!["xlsx", "xls", "csv"].includes(ext)) return res.status(400).json({ error: "format harus .xlsx/.xls/.csv" });

  const parsed = parseWorkbook(file.buffer, ext, sheetName);
  const invalidProvinceRows = findInvalidImportProvinceRows(parsed.rows);
  if (invalidProvinceRows.length) {
    const preview = invalidProvinceRows
      .slice(0, 8)
      .map((item) => `baris ${item.rowNumber}: ${item.message}`)
      .join(" ");
    const moreCount = invalidProvinceRows.length - Math.min(invalidProvinceRows.length, 8);
    return res.status(400).json({
      error: `Impor dibatalkan. Kolom WILAYAH harus berisi nama provinsi yang valid. ${preview}${
        moreCount > 0 ? ` Dan ${moreCount} baris lainnya.` : ""
      }`,
      invalidProvinceRows,
      allowedProvinces: PROVINCE_OPTIONS,
    });
  }

  await enrichRowsWithGeoFromMaps(parsed.rows);

  const db = await readDb();
  let datasetId = db.activeDatasetId;
  let ds = datasetId ? db.datasets.find((d) => d.id === datasetId) : null;
  if (!ds) {
    datasetId = safeId();
    ds = {
      id: datasetId,
      name,
      type: ext === "csv" ? "csv" : "xlsx",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      sheetName: parsed.sheetName,
      rowCount: 0,
    };
    db.datasets.push(ds);
    db.activeDatasetId = datasetId;
  }

  const otherDatasetRecords = db.records.filter((r) => r.datasetId !== datasetId);
  const datasetRecords = db.records.filter((r) => r.datasetId === datasetId).map((r) => ({ ...r }));
  const existingByKey = new Map();
  datasetRecords.forEach((record) => {
    const key = buildImportMatchKey(record);
    if (!key) return;
    const bucket = existingByKey.get(key) || [];
    bucket.push(record);
    existingByKey.set(key, bucket);
  });

  let insertedCount = 0;
  let updatedCount = 0;
  const beforeCount = datasetRecords.length;
  for (const item of parsed.rows) {
    const r = item.record;
    const key = buildImportMatchKey(r);
    const bucket = key ? existingByKey.get(key) || [] : [];
    const existing = bucket.length ? bucket.shift() : null;
    if (existing) {
      existing.TANGGAL = r.TANGGAL;
      existing.WILAYAH = r.WILAYAH;
      existing["JUMLAH MASSA"] = r["JUMLAH MASSA"];
      existing.LOKASI = r.LOKASI;
      existing["KELOMPOK AKSI"] = r["KELOMPOK AKSI"];
      existing.TUNTUTAN = r.TUNTUTAN;
      existing.RINGKASAN = r.RINGKASAN;
      const mapsUrl = toStr(r["GOOGLE MAPS"]);
      if (mapsUrl) existing["GOOGLE MAPS"] = mapsUrl;
      const lat = Number(r.LAT);
      const lng = Number(r.LNG);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        existing.LAT = lat;
        existing.LNG = lng;
      }
      existing.updatedAt = nowIso();
      updatedCount += 1;
      continue;
    }

    const created = {
      id: safeId(),
      datasetId,
      ...r,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    datasetRecords.push(created);
    insertedCount += 1;
  }
  resequenceDatasetRecords(datasetRecords, datasetId);
  db.records = [...otherDatasetRecords, ...datasetRecords];
  ds.name = name || ds.name;
  ds.type = ext === "csv" ? "csv" : "xlsx";
  ds.sheetName = parsed.sheetName;
  ds.rowCount = datasetRecords.length;
  ds.updatedAt = nowIso();
  db.activeDatasetId = datasetId;
  await writeDb(db);
  res.json({
    dataset: ds,
    activeDatasetId: db.activeDatasetId,
    beforeCount,
    afterCount: datasetRecords.length,
    insertedCount,
    updatedCount,
    importedCount: parsed.records.length,
  });
});

app.post("/api/datasets/:id/activate", requireAdminAuth, async (req, res) => {
  const id = String(req.params.id || "");
  const db = await readDb();
  const exists = db.datasets.some((d) => d.id === id);
  if (!exists) return res.status(404).json({ error: "dataset tidak ditemukan" });
  db.activeDatasetId = id;
  await writeDb(db);
  res.json({ activeDatasetId: id });
});

app.put("/api/datasets/:id", requireAdminAuth, async (req, res) => {
  const id = String(req.params.id || "");
  const name = String(req.body?.name || "").trim();
  if (!name) return res.status(400).json({ error: "name wajib" });
  const db = await readDb();
  const ds = db.datasets.find((d) => d.id === id);
  if (!ds) return res.status(404).json({ error: "dataset tidak ditemukan" });
  ds.name = name;
  ds.updatedAt = nowIso();
  await writeDb(db);
  res.json({ dataset: ds });
});

app.delete("/api/datasets/:id", requireAdminAuth, async (req, res) => {
  const id = String(req.params.id || "");
  const db = await readDb();
  const before = db.datasets.length;
  db.datasets = db.datasets.filter((d) => d.id !== id);
  db.records = db.records.filter((r) => r.datasetId !== id);
  if (db.activeDatasetId === id) db.activeDatasetId = "";
  if (db.datasets.length === before) return res.status(404).json({ error: "dataset tidak ditemukan" });
  await writeDb(db);
  res.json({ ok: true, activeDatasetId: db.activeDatasetId });
});

app.get("/api/active", async (_req, res) => {
  const db = await readDb();
  const ds = db.datasets.find((d) => d.id === db.activeDatasetId) || null;
  res.json({ activeDatasetId: db.activeDatasetId, dataset: ds });
});

app.get("/api/active/records", async (_req, res) => {
  const db = await readDb();
  const id = db.activeDatasetId;
  if (!id) return res.json({ datasetId: "", records: [] });
  const records = db.records
    .filter((r) => r.datasetId === id)
    .sort((a, b) => Number.parseInt(a.NO || "0", 10) - Number.parseInt(b.NO || "0", 10));
  res.json({ datasetId: id, records });
});

app.post("/api/records", requireAdminAuth, async (req, res) => {
  const body = req.body || {};
  const db = await readDb();
  let datasetId = String(body.datasetId || "").trim();
  if (!datasetId) datasetId = db.activeDatasetId;
  if (!datasetId) {
    const id = safeId();
    const ds = {
      id,
      name: "Manual",
      type: "manual",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      sheetName: null,
      rowCount: 0,
    };
    db.datasets.push(ds);
    db.activeDatasetId = id;
    datasetId = id;
  }
  const ds = db.datasets.find((d) => d.id === datasetId);
  if (!ds) return res.status(404).json({ error: "dataset tidak ditemukan" });

  const tanggalValue = toStr(body.tanggal);
  const wilayahValue = canonicalProvince(body.wilayah);
  const massaValue = parseMass(body.estimasiMassa);
  const lokasiValue = toStr(body.lokasi);
  const kelompokValue = toStr(body.kelompokAksi);
  const tuntutanValue = toStr(body.tuntutan);
  const ringkasanValue = toStr(body.ringkasan);
  const mapsUrlValue = normalizeGoogleMapsLink(body.googleMaps);

  if (!tanggalValue) return res.status(400).json({ error: "TANGGAL wajib diisi." });
  if (!wilayahValue) return res.status(400).json({ error: "WILAYAH wajib diisi." });
  if (!VALID_PROVINCES.has(wilayahValue)) return res.status(400).json({ error: "WILAYAH harus berupa nama provinsi yang valid." });
  if (massaValue == null) return res.status(400).json({ error: "JUMLAH MASSA wajib diisi angka." });
  if (!lokasiValue) return res.status(400).json({ error: "LOKASI wajib diisi." });
  if (!kelompokValue) return res.status(400).json({ error: "KELOMPOK AKSI wajib diisi." });
  if (!tuntutanValue) return res.status(400).json({ error: "TUNTUTAN wajib diisi." });
  if (!ringkasanValue) return res.status(400).json({ error: "RINGKASAN wajib diisi." });
  if (!mapsUrlValue) return res.status(400).json({ error: "GOOGLE MAPS wajib diisi dengan link Google Maps yang valid." });

  const mapsPair = await resolveLatLngFromGoogleMapsLink(mapsUrlValue);
  if (!mapsPair) {
    return res
      .status(400)
      .json({ error: "Tidak bisa mengambil koordinat dari link Google Maps. Pastikan link valid dan internet aktif." });
  }

  const recordPayload = {
    TANGGAL: normalizeStoredDate(tanggalValue),
    WILAYAH: wilayahValue,
    "JUMLAH MASSA": massaValue,
    LOKASI: lokasiValue,
    "KELOMPOK AKSI": kelompokValue,
    TUNTUTAN: tuntutanValue,
    RINGKASAN: ringkasanValue,
    "GOOGLE MAPS": mapsUrlValue,
    LAT: mapsPair[0],
    LNG: mapsPair[1],
  };

  const matchKey = buildImportMatchKey(recordPayload);
  const existing = matchKey
    ? db.records.find((r) => r.datasetId === datasetId && buildImportMatchKey(r) === matchKey)
    : null;

  let record;
  let mode = "created";
  if (existing) {
    existing.TANGGAL = recordPayload.TANGGAL;
    existing.WILAYAH = recordPayload.WILAYAH;
    existing["JUMLAH MASSA"] = recordPayload["JUMLAH MASSA"];
    existing.LOKASI = recordPayload.LOKASI;
    existing["KELOMPOK AKSI"] = recordPayload["KELOMPOK AKSI"];
    existing.TUNTUTAN = recordPayload.TUNTUTAN;
    existing.RINGKASAN = recordPayload.RINGKASAN;
    if (recordPayload["GOOGLE MAPS"]) existing["GOOGLE MAPS"] = recordPayload["GOOGLE MAPS"];
    if (Number.isFinite(recordPayload.LAT) && Number.isFinite(recordPayload.LNG)) {
      existing.LAT = recordPayload.LAT;
      existing.LNG = recordPayload.LNG;
    }
    existing.updatedAt = nowIso();
    record = existing;
    mode = "updated";
  } else {
    const nextNo = getNextRecordNo(db.records, datasetId);
    record = {
      id: safeId(),
      datasetId,
      NO: nextNo,
      ...recordPayload,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.records.push(record);
  }

  resequenceDatasetRecords(db.records, datasetId);
  ds.rowCount = db.records.filter((r) => r.datasetId === datasetId).length;
  ds.updatedAt = nowIso();
  await writeDb(db);
  res.json({ record, mode, dataset: ds, activeDatasetId: db.activeDatasetId });
});

app.put("/api/records/:id", requireAdminAuth, async (req, res) => {
  const id = String(req.params.id || "");
  const body = req.body || {};
  const db = await readDb();
  const rec = db.records.find((r) => r.id === id);
  if (!rec) return res.status(404).json({ error: "record tidak ditemukan" });

  const tanggalValue = toStr(body.tanggal);
  const wilayahValue = canonicalProvince(body.wilayah);
  const massaValue = parseMass(body.estimasiMassa);
  const lokasiValue = toStr(body.lokasi);
  const kelompokValue = toStr(body.kelompokAksi);
  const tuntutanValue = toStr(body.tuntutan);
  const ringkasanValue = toStr(body.ringkasan);
  const mapsUrlValue = normalizeGoogleMapsLink(body.googleMaps);

  if (!tanggalValue) return res.status(400).json({ error: "TANGGAL wajib diisi." });
  if (!wilayahValue) return res.status(400).json({ error: "WILAYAH wajib diisi." });
  if (!VALID_PROVINCES.has(wilayahValue)) return res.status(400).json({ error: "WILAYAH harus berupa nama provinsi yang valid." });
  if (massaValue == null) return res.status(400).json({ error: "JUMLAH MASSA wajib diisi angka." });
  if (!lokasiValue) return res.status(400).json({ error: "LOKASI wajib diisi." });
  if (!kelompokValue) return res.status(400).json({ error: "KELOMPOK AKSI wajib diisi." });
  if (!tuntutanValue) return res.status(400).json({ error: "TUNTUTAN wajib diisi." });
  if (!ringkasanValue) return res.status(400).json({ error: "RINGKASAN wajib diisi." });
  if (!mapsUrlValue) return res.status(400).json({ error: "GOOGLE MAPS wajib diisi dengan link Google Maps yang valid." });

  const mapsPair = await resolveLatLngFromGoogleMapsLink(mapsUrlValue);
  if (!mapsPair) {
    return res
      .status(400)
      .json({ error: "Tidak bisa mengambil koordinat dari link Google Maps. Pastikan link valid dan internet aktif." });
  }

  rec.TANGGAL = normalizeStoredDate(tanggalValue);
  rec.WILAYAH = wilayahValue;
  rec["JUMLAH MASSA"] = massaValue;
  rec.LOKASI = lokasiValue;
  rec["KELOMPOK AKSI"] = kelompokValue;
  rec.TUNTUTAN = tuntutanValue;
  rec.RINGKASAN = ringkasanValue;
  rec["GOOGLE MAPS"] = mapsUrlValue;
  rec.LAT = mapsPair[0];
  rec.LNG = mapsPair[1];
  rec.updatedAt = nowIso();
  const ds = db.datasets.find((d) => d.id === rec.datasetId);
  if (ds) ds.updatedAt = nowIso();
  await writeDb(db);
  res.json({ record: rec });
});

app.get("/api/datasets/:id/records", requireAdminAuth, async (req, res) => {
  const id = String(req.params.id || "");
  const db = await readDb();
  const ds = db.datasets.find((d) => d.id === id);
  if (!ds) return res.status(404).json({ error: "dataset tidak ditemukan" });
  const records = db.records
    .filter((r) => r.datasetId === id)
    .sort((a, b) => Number.parseInt(a.NO || "0", 10) - Number.parseInt(b.NO || "0", 10));
  res.json({ datasetId: id, records });
});

app.delete("/api/records/:id", requireAdminAuth, async (req, res) => {
  const id = String(req.params.id || "");
  const db = await readDb();
  const rec = db.records.find((r) => r.id === id);
  if (!rec) return res.status(404).json({ error: "record tidak ditemukan" });
  db.records = db.records.filter((r) => r.id !== id);
  const ds = db.datasets.find((d) => d.id === rec.datasetId);
  if (ds) {
    resequenceDatasetRecords(db.records, ds.id);
    ds.rowCount = db.records.filter((r) => r.datasetId === ds.id).length;
    ds.updatedAt = nowIso();
  }
  await writeDb(db);
  res.json({ ok: true });
});

app.use(express.static(ROOT_DIR));

app.listen(PORT, () => {
  process.stdout.write(`Server running: http://localhost:${PORT}/\n`);
});
