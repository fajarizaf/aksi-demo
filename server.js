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
const INTERNAL_MAP_PAGE_PATH = path.join(ROOT_DIR, "peta-internal.html");
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
  "PAPUA JAYA",
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
    "IRIAN JAYA": "PAPUA JAYA",
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
    status: findHeader(headers, ["status", "rencana", "yang berlangsung", "selesai", "realisasi", "plan", "actual"]),
    wilayah: findHeader(headers, ["wilayah", "provinsi", "province", "region"]),
    kotaKab: findHeader(headers, ["kota/kabupaten", "kota kabupaten", "kota", "kabupaten", "city"]),
    lokasi: findHeader(headers, ["lokasi", "tempat", "lokasi kegiatan", "lokasi (kegiatan)", "lokasi kegiatan/aksi"]),
    kegiatan: findHeader(headers, ["kegiatan", "aksi", "kegiatan / aliansi", "kegiatan/aliansi", "kelompok aksi"]),
    aliansi: findHeader(headers, ["aliansi", "organisasi", "kelompok", "aliansi/organisasi", "kelompok aksi"]),
    tanggal: findHeader(headers, ["tanggal aksi", "tanggal", "tgl", "date", "hari", "waktu"]),
    waktu: findHeader(headers, ["waktu aksi", "waktu", "jam", "pukul", "time"]),
    waktuMulai: findHeader(headers, ["waktu mulai", "jam mulai", "mulai", "start time"]),
    waktuSelesai: findHeader(headers, ["waktu selesai", "jam selesai", "selesai", "end time"]),
    lokasiAksi: findHeader(headers, ["lokasi aksi", "lokasi_aksi", "lokasi aksi (alamat)", "alamat lokasi aksi"]),
    tuntutan: findHeader(headers, ["tuntutan", "demand", "tuntutan/isu", "isu/tuntutan"]),
    ringkasan: findHeader(headers, ["ringkasan", "summary", "ringkasan tuntutan", "deskripsi singkat", "uraian singkat"]),
    kategoriDemo: findHeader(headers, ["kategori demo", "kategori", "pro kontra", "pro/kontra"]),
    halMenonjol: findHeader(headers, ["hal menonjol", "catatan menonjol", "highlight", "hal yang menonjol"]),
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

function canonicalStatus(v) {
  const s = toStr(v);
  if (!s) return "";
  const nk = normalizeKey(s);
  if (!nk) return "";
  if (nk.includes("rencana") || nk === "plan" || nk === "planning") return "Rencana";
  if (
    nk.includes("yangberlangsung") ||
    nk.includes("sedangberlangsung") ||
    nk.includes("berlangsung") ||
    nk === "ongoing" ||
    nk === "inprogress" ||
    nk === "progress"
  ) {
    return "Yang Berlangsung";
  }
  if (nk.includes("selesai") || nk.includes("realisasi") || nk === "actual" || nk === "realisasiaksi" || nk === "done") {
    return "Selesai";
  }
  return "";
}

function canonicalDemoCategory(v) {
  const s = toStr(v);
  if (!s) return "";
  const nk = normalizeKey(s);
  if (!nk) return "";
  if (nk === "pro" || nk.includes("dukung") || nk.includes("setuju")) return "Pro";
  if (nk === "kontra" || nk.includes("tolak") || nk.includes("lawan")) return "Kontra";
  return "";
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

function looksLikeTimeValue(value) {
  const s = toStr(value);
  if (!s) return false;
  if (parseDateParts(s)) return false;
  return /(?:\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\.\d{2}\b|\bWIB\b|\bWITA\b|\bWIT\b|\bAM\b|\bPM\b)/i.test(s);
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
  const statusSource = toStr(input[mapping.status] ?? input["STATUS"] ?? input["Status"]);
  const status = canonicalStatus(statusSource) || "Selesai";
  const wilayah = canonicalProvince(input[mapping.wilayah] ?? input["Wilayah"] ?? input["Provinsi"]);
  const lokasi = toStr(input[mapping.lokasi] ?? input["Lokasi"] ?? input["Lokasi Kegiatan"] ?? input["Tempat"]);
  const no = toStr(input["NO"] ?? input["No"] ?? input.no);
  const tanggalSource = toStr(
    input["TANGGAL AKSI"] ?? input["Tanggal Aksi"] ?? input["TANGGAL"] ?? input["Tanggal"] ?? input[mapping.tanggal]
  );
  const tanggal = parseDateParts(tanggalSource) ? tanggalSource : "";
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
  const waktuMulaiSource = toStr(
    input["WAKTU MULAI"] ?? input["Waktu Mulai"] ?? input["Jam Mulai"] ?? input["WAKTU"] ?? input["Waktu"] ?? input["Jam"] ?? input[mapping.waktuMulai] ?? input[mapping.waktu]
  );
  const waktuMulai = looksLikeTimeValue(waktuMulaiSource) ? waktuMulaiSource : "";
  const waktuSelesaiSource = toStr(
    input["WAKTU SELESAI"] ?? input["Waktu Selesai"] ?? input["Jam Selesai"] ?? input[mapping.waktuSelesai]
  );
  const waktuSelesai = looksLikeTimeValue(waktuSelesaiSource) ? waktuSelesaiSource : "";
  const tuntutan = toStr(input[mapping.tuntutan] ?? input["Tuntutan"]);
  const ringkasan = toStr(input[mapping.ringkasan] ?? input["RINGKASAN"] ?? input["Ringkasan"] ?? input["Summary"]);
  const kategoriDemo = canonicalDemoCategory(
    input[mapping.kategoriDemo] ?? input["KATEGORI DEMO"] ?? input["Kategori Demo"] ?? input["Kategori"]
  );
  const halMenonjol = toStr(
    input[mapping.halMenonjol] ?? input["HAL MENONJOL"] ?? input["Hal Menonjol"] ?? input["Highlight"]
  );
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
    TANGGAL: normalizeStoredDate(tanggal),
    "WAKTU MULAI": waktuMulai,
    "WAKTU SELESAI": waktuSelesai,
    STATUS: status,
    WILAYAH: wilayah,
    "JUMLAH MASSA": estimasiMassa,
    LOKASI: lokasi,
    "KELOMPOK AKSI": kelompokAksi,
    "KATEGORI DEMO": kategoriDemo,
    TUNTUTAN: tuntutan,
    RINGKASAN: ringkasan,
    "HAL MENONJOL": halMenonjol,
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

// Cache duration for exchange rate data: 1 hour
const EXCHANGE_RATE_CACHE_MS = 60 * 60 * 1000;
// Cache duration for fuel price data: 1 hour
const FUEL_PRICE_CACHE_MS = 60 * 60 * 1000;
// Cache duration for commodity price data: 1 hour
const COMMODITY_PRICE_CACHE_MS = 60 * 60 * 1000;

// External exchange rate API (using free ExchangeRate-API)
// For production, replace with your own API key from https://www.exchangerate-api.com/
const EXCHANGE_RATE_API_URL = "https://api.exchangerate-api.com/v4/latest/USD";
const FUEL_PRICE_API_BASE_URL = "https://raw.githubusercontent.com/nasgunawann/bensin-api/main";
const FUEL_PRICE_API_REPO_URL = "https://github.com/nasgunawann/bensin-api";
const FUEL_PRICE_COMMITS_API_BASE = "https://api.github.com/repos/nasgunawann/bensin-api/commits";
const FUEL_PRICE_DEFAULT_PROVINCE_SLUG = String(process.env.FUEL_PRICE_PROVINCE_SLUG || "dki-jakarta");
const PIHPS_HOME_URL = "https://www.bi.go.id/hargapangan/WebSite";
const PIHPS_API_BASE_URL = "https://www.bi.go.id/hargapangan/Website/Home";
const PIHPS_COMMODITIES_TREE_URL = `${PIHPS_API_BASE_URL}/GetCommoditiesTree`;
const PIHPS_CHART_DATA_URL = `${PIHPS_API_BASE_URL}/GetChartData`;
const COMMODITY_TRACKED_CACHE_VERSION = 2;
const PIHPS_TRACKED_COMMODITIES = [
  {
    key: "rice-medium",
    label: "Beras Medium",
    aliases: ["Beras Kualitas Medium I", "Beras Kualitas Medium II"],
  },
  {
    key: "chicken-meat",
    label: "Daging Ayam",
    aliases: ["Daging Ayam Ras Segar"],
  },
  {
    key: "beef",
    label: "Daging Sapi",
    aliases: ["Daging Sapi Kualitas 1", "Daging Sapi Kualitas 2"],
  },
  {
    key: "eggs",
    label: "Telur Ayam",
    aliases: ["Telur Ayam Ras Segar"],
  },
  {
    key: "shallot",
    label: "Bawang Merah",
    aliases: ["Bawang Merah Ukuran Sedang", "Bawang Merah"],
  },
  {
    key: "garlic",
    label: "Bawang Putih",
    aliases: ["Bawang Putih Ukuran Sedang", "Bawang Putih"],
  },
  {
    key: "red-chili",
    label: "Cabe Merah",
    aliases: ["Cabai Merah Keriting", "Cabai Merah Besar", "Cabai Merah", "Cabe Merah"],
  },
  {
    key: "cooking-oil",
    label: "Minyak Goreng",
    aliases: ["Minyak Goreng Curah"],
  },
  {
    key: "sugar",
    label: "Gula Pasir",
    aliases: ["Gula Pasir Kualitas Premium", "Gula Pasir Lokal"],
  },
  {
    key: "soybean",
    label: "Kedelai",
    aliases: ["Kedelai Impor", "Kedelai Lokal", "Kedelai Biji Kering", "Kedelai"],
  },
];
const FUEL_PRODUCTS_TRACKED = [
  "PERTALITE",
  "PERTAMINA BIOSOLAR SUBSIDI",
  "PERTAMAX",
  "PERTAMAX GREEN 95",
  "PERTAMAX TURBO",
  "DEXLITE",
  "PERTAMINA DEX",
];

async function fetchExchangeRateData() {
  const db = await readDb();
  const cached = db.exchangeRateData;
  if (cached && Date.now() - cached.updatedAt < EXCHANGE_RATE_CACHE_MS) {
    return cached.data;
  }

  // Fetch new data from external API
  const response = await fetch(EXCHANGE_RATE_API_URL);
  if (!response.ok) {
    throw new Error("Failed to fetch exchange rate data");
  }
  const externalData = await response.json();
  const data = {
    base: externalData.base,
    rates: externalData.rates,
    lastUpdated: externalData.time_last_updated,
  };

  // Save to cache
  db.exchangeRateData = {
    data,
    updatedAt: Date.now(),
  };
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));

  return data;
}

app.get("/api/exchange-rate", async (_req, res) => {
  try {
    const data = await fetchExchangeRateData();
    res.json(data);
  } catch (e) {
    console.error("Exchange rate fetch error:", e);
    res.status(500).json({ error: "failed to fetch exchange rate" });
  }
});

function normalizeFuelName(productName) {
  const raw = String(productName || "").trim().toUpperCase();
  return {
    PERTALITE: "Pertalite",
    "PERTAMINA BIOSOLAR SUBSIDI": "Biosolar Subsidi",
    PERTAMAX: "Pertamax",
    "PERTAMAX GREEN 95": "Pertamax Green 95",
    "PERTAMAX TURBO": "Pertamax Turbo",
    DEXLITE: "Dexlite",
    "PERTAMINA DEX": "Pertamina Dex",
  }[raw] || String(productName || "").trim();
}

function normalizeFuelProducts(products) {
  const map = new Map(
    (Array.isArray(products) ? products : []).map((item) => [String(item?.product || "").trim().toUpperCase(), item])
  );
  return FUEL_PRODUCTS_TRACKED.map((productKey) => {
    const item = map.get(productKey);
    return {
      product: productKey,
      name: normalizeFuelName(productKey),
      price: Number.isFinite(Number(item?.price_rupiah)) ? Number(item.price_rupiah) : null,
      availability: String(item?.availability || "unknown"),
    };
  }).filter((item) => item.price != null);
}

function normalizeDateOnly(value) {
  const raw = String(value || "").trim();
  const plainIsoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (plainIsoMatch) return raw;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toLocalIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalIsoDate(iso) {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function buildDateRange(startIso, endIso) {
  const start = parseLocalIsoDate(startIso);
  const end = parseLocalIsoDate(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const dates = [];
  const cursor = new Date(start);
  const last = new Date(end);
  while (cursor <= last) {
    dates.push(toLocalIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function getRequestedFuelDates(req) {
  return getRequestedDateList(req, 30);
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "aksi-demo/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.json();
}

function getRequestedDateList(req, fallbackDays = 30) {
  const datesParam = String(req.query?.dates || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const normalized = Array.from(
    new Set(
      datesParam
        .map((item) => normalizeDateOnly(item))
        .filter(Boolean)
    )
  ).sort();
  if (normalized.length) {
    const todayIso = toLocalIsoDate(new Date());
    return normalized
      .filter((date) => date <= todayIso)
      .slice(-Math.max(1, fallbackDays));
  }

  const start = normalizeDateOnly(req.query?.start);
  const end = normalizeDateOnly(req.query?.end);
  if (start && end) return buildDateRange(start, end);

  const today = new Date();
  const endDate = toLocalIsoDate(today);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - Math.max(0, fallbackDays - 1));
  return buildDateRange(toLocalIsoDate(startDate), endDate);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "aksi-demo/1.0",
    },
  });
  if (!response.ok) {
    throw new Error(`Request failed (${response.status}) for ${url}`);
  }
  return response.text();
}

function getRequestedCommodityDates(req) {
  return getRequestedDateList(req, 30);
}

function resolveTrackedCommodityName(availableNames, aliases) {
  const names = Array.isArray(availableNames) ? availableNames : [];
  const normalizedMap = new Map(names.map((name) => [normalizeKey(name), name]));
  for (const alias of aliases) {
    const exact = normalizedMap.get(normalizeKey(alias));
    if (exact) return exact;
  }
  for (const alias of aliases) {
    const aliasKey = normalizeKey(alias);
    const fuzzy = names.find((name) => normalizeKey(name).includes(aliasKey) || aliasKey.includes(normalizeKey(name)));
    if (fuzzy) return fuzzy;
  }
  return "";
}

function normalizeCommodityChartData(points) {
  return (Array.isArray(points) ? points : [])
    .map((item) => {
      const date = normalizeDateOnly(item?.date);
      const price = Number(item?.nominal);
      if (!date || !Number.isFinite(price)) return null;
      const changeAmount = Number(item?.harga);
      const changePercent = Number(item?.fluc);
      return {
        date,
        price,
        denomination: String(item?.denomination || "").trim(),
        changeAmount: Number.isFinite(changeAmount) ? changeAmount : null,
        changePercent: Number.isFinite(changePercent) ? changePercent : null,
        isMin: Boolean(Number(item?.isMin)),
        isMax: Boolean(Number(item?.isMax)),
        isStable: Boolean(Number(item?.isTetap)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function buildFuelDailySeries(targetDates, snapshots) {
  if (!targetDates.length || !snapshots.length) return [];
  const sortedSnapshots = snapshots
    .slice()
    .sort((a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate)));
  const firstActualDate = String(sortedSnapshots[0]?.effectiveDate || "");
  return targetDates
    .filter((date) => !firstActualDate || date >= firstActualDate)
    .map((date) => {
      let selected = null;
      for (const snapshot of sortedSnapshots) {
        if (snapshot.effectiveDate <= date) {
          selected = snapshot;
        } else {
          break;
        }
      }
      if (!selected) return null;
      return {
        date,
        fullDate: new Date(`${date}T00:00:00.000Z`),
        sourceUpdatedAt: selected.updatedAt,
        fuels: selected.fuels.map((fuel) => ({
          name: fuel.name,
          price: fuel.price,
          availability: fuel.availability,
        })),
      };
    })
    .filter(Boolean);
}

function buildCommodityDailySeries(targetDates, commodities) {
  if (!targetDates.length || !commodities.length) return [];
  const allActualDates = commodities
    .flatMap((commodity) => (Array.isArray(commodity?.points) ? commodity.points : []).map((point) => point?.date))
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));
  const firstActualDate = String(allActualDates[0] || "");
  return targetDates
    .filter((date) => !firstActualDate || date >= firstActualDate)
    .map((date) => {
      const items = commodities
        .map((commodity) => {
          let selected = null;
          for (const point of commodity.points) {
            if (point.date <= date) {
              selected = point;
            } else {
              break;
            }
          }
          if (!selected) return null;
          return {
            key: commodity.key,
            label: commodity.label,
            name: commodity.name,
            price: selected.price,
            denomination: selected.denomination || commodity.denomination || "",
            sourceDate: selected.date,
            changeAmount: selected.changeAmount,
            changePercent: selected.changePercent,
            isCarriedForward: selected.date !== date,
          };
        })
        .filter(Boolean);
      if (!items.length) return null;
      return {
        date,
        fullDate: new Date(`${date}T00:00:00.000Z`),
        commodities: items,
      };
    })
    .filter(Boolean);
}

function hasUsableCommodityData(data) {
  return Boolean(
    data &&
    Array.isArray(data.commodities) &&
    data.commodities.length >= 4 &&
    data.commodities.some((commodity) => Array.isArray(commodity?.points) && commodity.points.length)
  );
}

function enrichCommodityMetadata(data) {
  if (!hasUsableCommodityData(data)) return data;
  const allDates = data.commodities
    .flatMap((commodity) => (Array.isArray(commodity?.points) ? commodity.points : []).map((point) => point.date))
    .filter(Boolean)
    .sort((a, b) => String(a).localeCompare(String(b)));
  return {
    ...data,
    earliestActualDate: data.earliestActualDate || allDates[0] || "",
    latestActualDate: data.latestActualDate || allDates[allDates.length - 1] || "",
  };
}

function hasUsableFuelSnapshots(data) {
  return Boolean(
    data &&
    Array.isArray(data.snapshots) &&
    data.snapshots.length &&
    data.snapshots.some((snapshot) => Array.isArray(snapshot?.fuels) && snapshot.fuels.length)
  );
}

function mergeFuelSnapshots(primarySnapshots, fallbackSnapshots) {
  const merged = new Map();
  for (const snapshot of Array.isArray(fallbackSnapshots) ? fallbackSnapshots : []) {
    if (!snapshot?.effectiveDate || !Array.isArray(snapshot?.fuels) || !snapshot.fuels.length) continue;
    merged.set(String(snapshot.effectiveDate), snapshot);
  }
  for (const snapshot of Array.isArray(primarySnapshots) ? primarySnapshots : []) {
    if (!snapshot?.effectiveDate || !Array.isArray(snapshot?.fuels) || !snapshot.fuels.length) continue;
    merged.set(String(snapshot.effectiveDate), snapshot);
  }
  return Array.from(merged.values()).sort((a, b) => String(a.effectiveDate).localeCompare(String(b.effectiveDate)));
}

async function fetchFuelPriceSourceData() {
  const db = await readDb();
  const cached = db.fuelPriceData;
  const cachedFuelData = hasUsableFuelSnapshots(cached?.data) ? cached.data : null;
  if (cachedFuelData && Date.now() - cached.updatedAt < FUEL_PRICE_CACHE_MS) {
    return cachedFuelData;
  }

  const indexData = await fetchJson(`${FUEL_PRICE_API_BASE_URL}/v1/index.json`);
  const provinceMeta = indexData?.provinsi?.[FUEL_PRICE_DEFAULT_PROVINCE_SLUG];
  if (!provinceMeta?.path) {
    throw new Error("Fuel price province source not found.");
  }

  const provincePath = String(provinceMeta.path).replace(/^\//, "");
  const currentSnapshot = await fetchJson(`${FUEL_PRICE_API_BASE_URL}/${provincePath}`);
  let commits = [];
  let historyWarning = "";
  try {
    commits = await fetchJson(
      `${FUEL_PRICE_COMMITS_API_BASE}?path=${encodeURIComponent(provincePath)}&per_page=100`
    );
  } catch (error) {
    historyWarning = error?.message || "Unable to refresh historical fuel snapshots.";
  }
  const snapshots = [];
  const seenEffectiveDates = new Set();

  const candidateCommits = Array.isArray(commits) ? commits : [];
  for (const commit of candidateCommits) {
    const sha = String(commit?.sha || "").trim();
    if (!sha) continue;
    try {
      const snapshot = await fetchJson(
        `https://raw.githubusercontent.com/nasgunawann/bensin-api/${sha}/${provincePath}`
      );
      const effectiveDate = normalizeDateOnly(snapshot?.pertamina_updated_at || commit?.commit?.author?.date);
      if (!effectiveDate || seenEffectiveDates.has(effectiveDate)) continue;
      const fuels = normalizeFuelProducts(snapshot?.products);
      if (!fuels.length) continue;
      seenEffectiveDates.add(effectiveDate);
      snapshots.push({
        effectiveDate,
        updatedAt: String(snapshot?.pertamina_updated_at || commit?.commit?.author?.date || ""),
        fuels,
        commitSha: sha,
      });
      if (snapshots.length >= 16) break;
    } catch (_error) {
      // Skip broken historical snapshot fetches and continue with available entries.
    }
  }

  const currentEffectiveDate = normalizeDateOnly(currentSnapshot?.pertamina_updated_at || indexData?.pertamina_updated_at);
  if (currentEffectiveDate && !seenEffectiveDates.has(currentEffectiveDate)) {
    snapshots.push({
      effectiveDate: currentEffectiveDate,
      updatedAt: String(currentSnapshot?.pertamina_updated_at || ""),
      fuels: normalizeFuelProducts(currentSnapshot?.products),
      commitSha: null,
    });
  }

  const mergedSnapshots = mergeFuelSnapshots(snapshots, cachedFuelData?.snapshots || []);
  const finalSnapshots = mergedSnapshots.length ? mergedSnapshots : snapshots;
  if (!finalSnapshots.length && cachedFuelData) {
    return {
      ...cachedFuelData,
      warning: historyWarning || cachedFuelData.warning || "",
      historySource: cachedFuelData.historySource || "cached-snapshots",
    };
  }
  if (!finalSnapshots.length) {
    throw new Error("Fuel price history source returned no usable snapshots.");
  }

  const data = {
    provider: "bensin-api",
    repository: FUEL_PRICE_API_REPO_URL,
    province: String(currentSnapshot?.province || provinceMeta?.name || FUEL_PRICE_DEFAULT_PROVINCE_SLUG),
    provinceSlug: String(currentSnapshot?.province_slug || FUEL_PRICE_DEFAULT_PROVINCE_SLUG),
    sourceIndexUpdatedAt: String(indexData?.pertamina_updated_at || ""),
    syncedAt: String(indexData?.synced_at || ""),
    latestUpdatedAt: String(currentSnapshot?.pertamina_updated_at || ""),
    warning: historyWarning,
    historySource: historyWarning ? (cachedFuelData ? "current-plus-cache" : "current-only") : "current-plus-commits",
    snapshots: finalSnapshots,
  };

  // Save to cache
  db.fuelPriceData = {
    data,
    updatedAt: Date.now(),
  };
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));

  return data;
}

async function fetchCommodityPriceSourceData() {
  const db = await readDb();
  const cached = db.commodityPriceData;
  const cachedCommodityData = hasUsableCommodityData(cached?.data) ? enrichCommodityMetadata(cached.data) : null;
  const isCommodityCacheVersionCurrent =
    Number(cached?.data?.trackedCommodityCacheVersion || 0) === COMMODITY_TRACKED_CACHE_VERSION;
  if (cachedCommodityData && isCommodityCacheVersionCurrent && Date.now() - cached.updatedAt < COMMODITY_PRICE_CACHE_MS) {
    return cachedCommodityData;
  }
  try {
    const homeHtml = await fetchText(PIHPS_HOME_URL);
    const tempIdMatch = homeHtml.match(/id="temp_id"[^>]*value="([^"]+)"/i);
    const tempId = String(tempIdMatch?.[1] || "").trim();
    if (!tempId) {
      throw new Error("PIHPS temp id not found.");
    }

    const treeData = await fetchJson(PIHPS_COMMODITIES_TREE_URL);
    const availableNames = (Array.isArray(treeData?.data) ? treeData.data : [])
      .filter((item) => String(item?.ParentID || "").trim())
      .map((item) => String(item?.TreeName || "").trim())
      .filter(Boolean);

    const selectedCommodities = PIHPS_TRACKED_COMMODITIES.map((item) => {
      const resolvedName = resolveTrackedCommodityName(availableNames, item.aliases);
      return resolvedName
        ? {
            key: item.key,
            label: item.label,
            name: resolvedName,
          }
        : null;
    }).filter(Boolean);

    const commodities = [];
    for (const commodity of selectedCommodities) {
      try {
        const params = new URLSearchParams({
          tempId,
          comName: commodity.name,
        });
        const chartData = await fetchJson(`${PIHPS_CHART_DATA_URL}?${params.toString()}`);
        const points = normalizeCommodityChartData(chartData?.data);
        if (!points.length) {
          throw new Error(`PIHPS returned no usable points for ${commodity.name}`);
        }
        commodities.push({
          key: commodity.key,
          label: commodity.label,
          name: commodity.name,
          denomination: points.find((point) => point.denomination)?.denomination || "",
          points,
        });
      } catch (_error) {
        // Skip temporarily unavailable commodity series and keep usable ones.
      }
    }
    if (!commodities.length) {
      throw new Error("Commodity price source returned no usable series.");
    }

    const availableCommodityKeys = new Set(commodities.map((commodity) => commodity.key));
    const missingCommodityLabels = PIHPS_TRACKED_COMMODITIES
      .filter((commodity) => !availableCommodityKeys.has(commodity.key))
      .map((commodity) => commodity.label);

    const data = enrichCommodityMetadata({
      provider: "PIHPS Nasional Bank Indonesia",
      sourceUrl: PIHPS_HOME_URL,
      tempId,
      trackedCommodityCacheVersion: COMMODITY_TRACKED_CACHE_VERSION,
      missingCommodityLabels,
      commodities,
    });

    db.commodityPriceData = {
      data,
      updatedAt: Date.now(),
    };
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));

    return data;
  } catch (error) {
    if (cachedCommodityData) {
      return {
        ...cachedCommodityData,
        warning: error?.message || "Menggunakan cache sembako terakhir karena sumber PIHPS sedang gagal diakses.",
      };
    }
    throw error;
  }
}

app.get("/api/fuel-prices", async (req, res) => {
  try {
    const sourceData = await fetchFuelPriceSourceData();
    const targetDates = getRequestedFuelDates(req);
    const prices = buildFuelDailySeries(targetDates, sourceData.snapshots);
    const latest = prices[prices.length - 1] || null;
    res.json({
      provider: sourceData.provider,
      repository: sourceData.repository,
      province: sourceData.province,
      provinceSlug: sourceData.provinceSlug,
      latestUpdatedAt: sourceData.latestUpdatedAt,
      syncedAt: sourceData.syncedAt,
      snapshots: sourceData.snapshots.map((item) => ({
        effectiveDate: item.effectiveDate,
        updatedAt: item.updatedAt,
      })),
      prices,
      latest,
    });
  } catch (e) {
    console.error("Fuel price fetch error:", e);
    res.status(500).json({ error: "failed to fetch fuel prices" });
  }
});

app.get("/api/sembako-prices", async (req, res) => {
  try {
    const sourceData = await fetchCommodityPriceSourceData();
    const targetDates = getRequestedCommodityDates(req);
    const prices = buildCommodityDailySeries(targetDates, sourceData.commodities);
    const latest = prices[prices.length - 1] || null;
    res.json({
      provider: sourceData.provider,
      sourceUrl: sourceData.sourceUrl,
      earliestActualDate: sourceData.earliestActualDate,
      latestActualDate: sourceData.latestActualDate,
      missingCommodityLabels: sourceData.missingCommodityLabels || [],
      commodities: sourceData.commodities.map((commodity) => {
        const earliestPoint = commodity.points[0] || null;
        const latestPoint = commodity.points[commodity.points.length - 1] || null;
        return {
          key: commodity.key,
          label: commodity.label,
          name: commodity.name,
          denomination: commodity.denomination,
          earliestDate: earliestPoint?.date || "",
          latestDate: latestPoint?.date || "",
          latestPrice: latestPoint?.price ?? null,
          pointCount: commodity.points.length,
        };
      }),
      prices,
      latest,
    });
  } catch (e) {
    console.error("Commodity price fetch error:", e);
    res.status(500).json({ error: "failed to fetch commodity prices" });
  }
});

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

app.get("/peta-internal.html", (req, res) => {
  const session = getSessionUser(req);
  if (!session) return res.redirect("/login.html");
  res.sendFile(INTERNAL_MAP_PAGE_PATH);
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
      existing["WAKTU MULAI"] = r["WAKTU MULAI"] || r.WAKTU || "";
      existing["WAKTU SELESAI"] = r["WAKTU SELESAI"] || "";
      existing.STATUS = r.STATUS || "Selesai";
      existing.WILAYAH = r.WILAYAH;
      existing["JUMLAH MASSA"] = r["JUMLAH MASSA"];
      existing.LOKASI = r.LOKASI;
      existing["KELOMPOK AKSI"] = r["KELOMPOK AKSI"];
      existing["KATEGORI DEMO"] = r["KATEGORI DEMO"] || "";
      existing.TUNTUTAN = r.TUNTUTAN;
      existing.RINGKASAN = r.RINGKASAN;
      existing["HAL MENONJOL"] = r["HAL MENONJOL"] || "";
      delete existing.WAKTU;
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
  const waktuMulaiValue = toStr(body.waktuMulai ?? body.waktu);
  const statusValue = canonicalStatus(body.status ?? body.STATUS ?? body.Status);
  const wilayahValue = canonicalProvince(body.wilayah);
  const massaValue = parseMass(body.estimasiMassa);
  const lokasiValue = toStr(body.lokasi);
  const kelompokValue = toStr(body.kelompokAksi);
  const waktuSelesaiValue = toStr(body.waktuSelesai);
  const kategoriDemoValue = canonicalDemoCategory(body.kategoriDemo);
  const tuntutanValue = toStr(body.tuntutan);
  const ringkasanValue = toStr(body.ringkasan);
  const halMenonjolValue = toStr(body.halMenonjol);
  const mapsUrlValue = normalizeGoogleMapsLink(body.googleMaps);

  if (!tanggalValue) return res.status(400).json({ error: "TANGGAL wajib diisi." });
  if (!statusValue) {
    return res.status(400).json({ error: "STATUS wajib dipilih (Rencana / Yang Berlangsung / Selesai)." });
  }
  if (!wilayahValue) return res.status(400).json({ error: "WILAYAH wajib diisi." });
  if (!VALID_PROVINCES.has(wilayahValue)) return res.status(400).json({ error: "WILAYAH harus berupa nama provinsi yang valid." });
  if (massaValue == null) return res.status(400).json({ error: "JUMLAH MASSA wajib diisi angka." });
  if (!lokasiValue) return res.status(400).json({ error: "LOKASI wajib diisi." });
  if (!kelompokValue) return res.status(400).json({ error: "KELOMPOK AKSI wajib diisi." });
  if (!waktuMulaiValue) return res.status(400).json({ error: "WAKTU MULAI wajib diisi." });
  if (!waktuSelesaiValue) return res.status(400).json({ error: "WAKTU SELESAI wajib diisi." });
  if (!kategoriDemoValue) return res.status(400).json({ error: "KATEGORI DEMO wajib dipilih (Pro / Kontra)." });
  if (!tuntutanValue) return res.status(400).json({ error: "TUNTUTAN wajib diisi." });
  if (!ringkasanValue) return res.status(400).json({ error: "RINGKASAN wajib diisi." });
  if (!halMenonjolValue) return res.status(400).json({ error: "HAL MENONJOL wajib diisi." });
  if (!mapsUrlValue) return res.status(400).json({ error: "GOOGLE MAPS wajib diisi dengan link Google Maps yang valid." });

  const mapsPair = await resolveLatLngFromGoogleMapsLink(mapsUrlValue);
  if (!mapsPair) {
    return res
      .status(400)
      .json({ error: "Tidak bisa mengambil koordinat dari link Google Maps. Pastikan link valid dan internet aktif." });
  }

  const recordPayload = {
    TANGGAL: normalizeStoredDate(tanggalValue),
    "WAKTU MULAI": waktuMulaiValue,
    "WAKTU SELESAI": waktuSelesaiValue,
    STATUS: statusValue,
    WILAYAH: wilayahValue,
    "JUMLAH MASSA": massaValue,
    LOKASI: lokasiValue,
    "KELOMPOK AKSI": kelompokValue,
    "KATEGORI DEMO": kategoriDemoValue,
    TUNTUTAN: tuntutanValue,
    RINGKASAN: ringkasanValue,
    "HAL MENONJOL": halMenonjolValue,
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
    existing["WAKTU MULAI"] = recordPayload["WAKTU MULAI"];
    existing["WAKTU SELESAI"] = recordPayload["WAKTU SELESAI"];
    existing.STATUS = recordPayload.STATUS;
    existing.WILAYAH = recordPayload.WILAYAH;
    existing["JUMLAH MASSA"] = recordPayload["JUMLAH MASSA"];
    existing.LOKASI = recordPayload.LOKASI;
    existing["KELOMPOK AKSI"] = recordPayload["KELOMPOK AKSI"];
    existing["KATEGORI DEMO"] = recordPayload["KATEGORI DEMO"];
    existing.TUNTUTAN = recordPayload.TUNTUTAN;
    existing.RINGKASAN = recordPayload.RINGKASAN;
    existing["HAL MENONJOL"] = recordPayload["HAL MENONJOL"];
    delete existing.WAKTU;
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
  const waktuMulaiValue = toStr(body.waktuMulai ?? body.waktu);
  const statusValue = canonicalStatus(body.status ?? body.STATUS ?? body.Status);
  const wilayahValue = canonicalProvince(body.wilayah);
  const massaValue = parseMass(body.estimasiMassa);
  const lokasiValue = toStr(body.lokasi);
  const kelompokValue = toStr(body.kelompokAksi);
  const waktuSelesaiValue = toStr(body.waktuSelesai);
  const kategoriDemoValue = canonicalDemoCategory(body.kategoriDemo);
  const tuntutanValue = toStr(body.tuntutan);
  const ringkasanValue = toStr(body.ringkasan);
  const halMenonjolValue = toStr(body.halMenonjol);
  const mapsUrlValue = normalizeGoogleMapsLink(body.googleMaps);

  if (!tanggalValue) return res.status(400).json({ error: "TANGGAL wajib diisi." });
  if (!statusValue) {
    return res.status(400).json({ error: "STATUS wajib dipilih (Rencana / Yang Berlangsung / Selesai)." });
  }
  if (!wilayahValue) return res.status(400).json({ error: "WILAYAH wajib diisi." });
  if (!VALID_PROVINCES.has(wilayahValue)) return res.status(400).json({ error: "WILAYAH harus berupa nama provinsi yang valid." });
  if (massaValue == null) return res.status(400).json({ error: "JUMLAH MASSA wajib diisi angka." });
  if (!lokasiValue) return res.status(400).json({ error: "LOKASI wajib diisi." });
  if (!kelompokValue) return res.status(400).json({ error: "KELOMPOK AKSI wajib diisi." });
  if (!waktuMulaiValue) return res.status(400).json({ error: "WAKTU MULAI wajib diisi." });
  if (!waktuSelesaiValue) return res.status(400).json({ error: "WAKTU SELESAI wajib diisi." });
  if (!kategoriDemoValue) return res.status(400).json({ error: "KATEGORI DEMO wajib dipilih (Pro / Kontra)." });
  if (!tuntutanValue) return res.status(400).json({ error: "TUNTUTAN wajib diisi." });
  if (!ringkasanValue) return res.status(400).json({ error: "RINGKASAN wajib diisi." });
  if (!halMenonjolValue) return res.status(400).json({ error: "HAL MENONJOL wajib diisi." });
  if (!mapsUrlValue) return res.status(400).json({ error: "GOOGLE MAPS wajib diisi dengan link Google Maps yang valid." });

  const mapsPair = await resolveLatLngFromGoogleMapsLink(mapsUrlValue);
  if (!mapsPair) {
    return res
      .status(400)
      .json({ error: "Tidak bisa mengambil koordinat dari link Google Maps. Pastikan link valid dan internet aktif." });
  }

  rec.TANGGAL = normalizeStoredDate(tanggalValue);
  rec["WAKTU MULAI"] = waktuMulaiValue;
  rec["WAKTU SELESAI"] = waktuSelesaiValue;
  rec.STATUS = statusValue;
  rec.WILAYAH = wilayahValue;
  rec["JUMLAH MASSA"] = massaValue;
  rec.LOKASI = lokasiValue;
  rec["KELOMPOK AKSI"] = kelompokValue;
  rec["KATEGORI DEMO"] = kategoriDemoValue;
  rec.TUNTUTAN = tuntutanValue;
  rec.RINGKASAN = ringkasanValue;
  rec["HAL MENONJOL"] = halMenonjolValue;
  rec["GOOGLE MAPS"] = mapsUrlValue;
  delete rec.WAKTU;
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
