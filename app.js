const els = {
  datasetName: document.getElementById("datasetName"),
  sheetSelect: document.getElementById("sheetSelect"),
  wilayahFilter: document.getElementById("wilayahFilter"),
  tanggalFilter: document.getElementById("tanggalFilter"),
  bulanFilter: document.getElementById("bulanFilter"),
  tahunFilter: document.getElementById("tahunFilter"),
  searchInput: document.getElementById("searchInput"),
  titleDate: document.getElementById("titleDate"),
  sumTitik: document.getElementById("sumTitik"),
  sumWilayahCount: document.getElementById("sumWilayahCount"),
  sumMassa: document.getElementById("sumMassa"),
  sumWilayahDominan: document.getElementById("sumWilayahDominan"),
  sumPuncakHarian: document.getElementById("sumPuncakHarian"),
  sumIsuDominan: document.getElementById("sumIsuDominan"),
  rekapWilayahBody: document.getElementById("rekapWilayahBody"),
  massChart: document.getElementById("massChart"),
  issueRank: document.getElementById("issueRank"),
  analisaList: document.getElementById("analisaList"),
  rincianBody: document.getElementById("rincianBody"),
  rincianPagination: document.getElementById("rincianPagination"),
  rincianPrevBtn: document.getElementById("rincianPrevBtn"),
  rincianNextBtn: document.getElementById("rincianNextBtn"),
  rincianPageInfo: document.getElementById("rincianPageInfo"),
  toast: document.getElementById("toast"),
  realtimeClock: document.getElementById("realtimeClock"),
};

const PROVINCE_CENTROIDS = {
  ACEH: [4.6951, 96.7494],
  "SUMATERA UTARA": [2.1924, 99.3812],
  "SUMATERA BARAT": [-0.7399, 100.8000],
  RIAU: [0.2933, 101.7068],
  JAMBI: [-1.6101, 103.6131],
  "SUMATERA SELATAN": [-3.3194, 103.9144],
  BENGKULU: [-3.8004, 102.2655],
  LAMPUNG: [-4.5586, 105.4068],
  "KEPULAUAN BANGKA BELITUNG": [-2.7411, 106.4406],
  "KEPULAUAN RIAU": [0.9167, 104.4500],
  "DKI JAKARTA": [-6.2088, 106.8456],
  "JAWA BARAT": [-6.9039, 107.6186],
  "JAWA TENGAH": [-7.0051, 110.4381],
  "DI YOGYAKARTA": [-7.7956, 110.3695],
  "DAERAH ISTIMEWA YOGYAKARTA": [-7.7956, 110.3695],
  "JAWA TIMUR": [-7.2504, 112.7688],
  BANTEN: [-6.4058, 106.0640],
  BALI: [-8.3405, 115.0920],
  "NUSA TENGGARA BARAT": [-8.6529, 117.3616],
  "NUSA TENGGARA TIMUR": [-8.6574, 121.0794],
  KALIMANTAN_BARAT: [0.2788, 111.4753],
  "KALIMANTAN BARAT": [0.2788, 111.4753],
  "KALIMANTAN TENGAH": [-1.6815, 113.3823],
  "KALIMANTAN SELATAN": [-3.0926, 115.2838],
  "KALIMANTAN TIMUR": [0.5387, 116.4194],
  "KALIMANTAN UTARA": [2.8441, 117.3000],
  "SULAWESI UTARA": [1.4931, 124.8413],
  "SULAWESI TENGAH": [-1.4300, 121.4456],
  "SULAWESI SELATAN": [-3.6688, 119.9741],
  "SULAWESI TENGGARA": [-3.5491, 121.7270],
  GORONTALO: [0.6999, 122.4467],
  "SULAWESI BARAT": [-2.8441, 119.2321],
  MALUKU: [-3.2385, 130.1453],
  "MALUKU UTARA": [1.5700, 127.8086],
  PAPUA: [-4.2699, 138.0804],
  "PAPUA BARAT": [-1.3361, 133.1747],
  "PAPUA BARAT DAYA": [-0.8669, 131.2511],
  "PAPUA TENGAH": [-3.6000, 136.8000],
  "PAPUA PEGUNUNGAN": [-4.0000, 139.5000],
  "PAPUA SELATAN": [-6.6500, 140.3000],
  "PAPUA JAYA": [-2.5337, 140.7181],
};

const state = {
  workbook: null,
  sheetName: null,
  allRows: [],
  filteredRows: [],
  activeId: null,
  datasetLabel: "Belum dimuat",
  hasInitializedDateDefault: false,
  clusterPreviewRows: null,
  locationPreviewRows: null,
  activeProvinceKey: "",
  currentTablePage: 1,
};

const TABLE_PAGE_SIZE = 5;

const XLSX_CDN_URLS = [
  "https://unpkg.com/xlsx@0.19.3/dist/xlsx.full.min.js",
  "https://cdn.jsdelivr.net/npm/xlsx@0.19.3/dist/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.19.3/xlsx.full.min.js",
];

let xlsxReadyPromise = null;

function padTimePart(value) {
  return String(value).padStart(2, "0");
}

function renderRealtimeClock() {
  if (!els.realtimeClock) return;
  const now = new Date();
  const day = padTimePart(now.getDate());
  const month = now.toLocaleString("id-ID", { month: "short" }).toUpperCase();
  const year = now.getFullYear();
  const hours = padTimePart(now.getHours());
  const minutes = padTimePart(now.getMinutes());
  const seconds = padTimePart(now.getSeconds());
  els.realtimeClock.innerHTML = `
    <div class="mapPanel__clockLabel">Jam Realtime</div>
    <div class="mapPanel__clockValue">${hours}:${minutes}:${seconds} WIB</div>
    <div class="mapPanel__clockDate">${day} ${month} ${year}</div>
  `;
}

renderRealtimeClock();
if (els.realtimeClock) {
  window.setInterval(renderRealtimeClock, 1000);
}

function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Gagal memuat script: ${url}`));
    document.head.appendChild(s);
  });
}

async function ensureXLSX() {
  if (window.XLSX) {
    if (!window.xlsx) window.xlsx = window.XLSX;
    return window.XLSX;
  }
  if (!xlsxReadyPromise) {
    xlsxReadyPromise = (async () => {
      for (const url of XLSX_CDN_URLS) {
        try {
          await loadScript(url);
          if (window.XLSX) {
            if (!window.xlsx) window.xlsx = window.XLSX;
            return window.XLSX;
          }
        } catch {
        }
      }
      throw new Error("Library XLSX gagal dimuat. Pastikan internet aktif atau gunakan CSV.");
    })();
  }
  return xlsxReadyPromise;
}

function setTitleDate(text) {
  els.titleDate.textContent = text;
}

function formatIndoDate(d) {
  const months = [
    "JANUARI",
    "FEBRUARI",
    "MARET",
    "APRIL",
    "MEI",
    "JUNI",
    "JULI",
    "AGUSTUS",
    "SEPTEMBER",
    "OKTOBER",
    "NOVEMBER",
    "DESEMBER",
  ];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatIndoDateFromIso(value) {
  const parsed = parseDateParts(value);
  if (!parsed) return "SEMUA TANGGAL";
  return formatIndoDate(new Date(Number(parsed.year), Number(parsed.month) - 1, Number(parsed.day)));
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("is-show");
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => els.toast.classList.remove("is-show"), 2200);
}

function normalizeKey(v) {
  return String(v ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

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

function formatNumberId(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("id-ID").format(n);
}

function formatMassa(n) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `±${formatNumberId(n)}`;
}

function toStr(v) {
  if (v == null) return "";
  const s = String(v).trim();
  return s;
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

function getYearValue(value) {
  return parseDateParts(value)?.year || "";
}

function toDateInputValue(value) {
  return parseDateParts(value)?.iso || "";
}

function formatDisplayDate(value) {
  const parsed = parseDateParts(value);
  if (!parsed) return toStr(value) || "—";
  return `${Number(parsed.day)} ${getMonthLabel(parsed.month)} ${parsed.year}`;
}

function getMonthValue(value) {
  return parseDateParts(value)?.month || "";
}

function getMonthLabel(month) {
  const labels = {
    "01": "Januari",
    "02": "Februari",
    "03": "Maret",
    "04": "April",
    "05": "Mei",
    "06": "Juni",
    "07": "Juli",
    "08": "Agustus",
    "09": "September",
    "10": "Oktober",
    "11": "November",
    "12": "Desember",
  };
  return labels[month] || month;
}

function looksLikeTimeValue(value) {
  const s = toStr(value);
  if (!s) return false;
  if (parseDateParts(s)) return false;
  return /(?:\b\d{1,2}[:.]\d{2}\b|\b\d{1,2}\.\d{2}\b|\bWIB\b|\bWITA\b|\bWIT\b|\bAM\b|\bPM\b)/i.test(s);
}

function getTodayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getLatestAvailableDate(rows) {
  const dates = uniq(rows.map((r) => toDateInputValue(r.tanggal)).filter(Boolean)).sort((a, b) => b.localeCompare(a));
  return dates[0] || "";
}

function buildTitleDateText() {
  const tanggal = toStr(els.tanggalFilter?.value);
  const bulan = toStr(els.bulanFilter?.value);
  const tahun = toStr(els.tahunFilter?.value);
  if (tanggal) return formatIndoDateFromIso(tanggal);
  if (bulan && tahun) return `${getMonthLabel(bulan).toUpperCase()} ${tahun}`;
  if (bulan) return `BULAN ${getMonthLabel(bulan).toUpperCase()}`;
  if (tahun) return `TAHUN ${tahun}`;
  return "SEMUA TANGGAL";
}

function syncTemporalFilters(source) {
  if (source === "tanggal" && toStr(els.tanggalFilter.value)) {
    els.bulanFilter.value = "";
    els.tahunFilter.value = "";
    return;
  }
  if ((source === "bulan" || source === "tahun") && (toStr(els.bulanFilter.value) || toStr(els.tahunFilter.value))) {
    els.tanggalFilter.value = "";
  }
}

function canonicalProvince(v) {
  const s = toStr(v);
  if (!s) return "";
  return s.replace(/\s+/g, " ").trim().toUpperCase();
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

function jitterLatLng([lat, lng], seed) {
  const a = (seed * 9301 + 49297) % 233280;
  const b = (seed * 233280 + 9301) % 49297;
  const j1 = (a / 233280 - 0.5) * 0.6;
  const j2 = (b / 49297 - 0.5) * 0.6;
  return [lat + j1 * 0.2, lng + j2 * 0.2];
}

function inferMappingFromHeaders(headers) {
  const mapping = {
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
  };
  return mapping;
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
  if (nk.includes("selesai") || nk.includes("realisasi") || nk === "actual" || nk === "done") return "Selesai";
  return "";
}

function canonicalDemoCategory(v) {
  const s = toStr(v);
  if (!s) return "";
  const nk = normalizeKey(s);
  if (!nk) return "";
  if (nk === "pro" || nk.includes("dukung") || nk.includes("setuju")) return "Pro";
  if (nk === "kontra" || nk.includes("tolak") || nk.includes("lawan")) return "Kontra";
  return s;
}

function getStatusPriority(status) {
  if (status === "Yang Berlangsung") return 3;
  if (status === "Selesai") return 2;
  if (status === "Rencana") return 1;
  return 0;
}

function getDominantStatus(rows) {
  return rows.reduce((best, row) => {
    const current = canonicalStatus(row?.status || row?.STATUS);
    return getStatusPriority(current) > getStatusPriority(best) ? current : best;
  }, "") || "Selesai";
}

function getStatusToneClass(status) {
  if (status === "Rencana") return " labelMarker--rencana";
  if (status === "Yang Berlangsung") return " labelMarker--berlangsung";
  if (status === "Selesai") return " labelMarker--selesai";
  return " labelMarker--selesai";
}

function getPointMarkerClass(status) {
  if (status === "Rencana") return " pointMarker--rencana";
  if (status === "Yang Berlangsung") return " pointMarker--berlangsung";
  if (status === "Selesai") return " pointMarker--selesai";
  return " pointMarker--selesai";
}

function buildRowsFromRecords(json) {
  if (!json.length) return { rows: [], mapping: null };
  const headerSet = new Set();
  json.slice(0, 50).forEach((r) => {
    Object.keys(r || {}).forEach((k) => headerSet.add(k));
  });
  const headers = Array.from(headerSet);
  const mapping = inferMappingFromHeaders(headers);
  const rows = json
    .map((r, idx) => {
      const no = toStr(r[mapping.no] ?? r["NO"] ?? r["No"]);
      const statusSource = toStr(r[mapping.status] ?? r["STATUS"] ?? r["Status"]);
      const status = canonicalStatus(statusSource) || "Selesai";
      const wilayah = canonicalProvince(r[mapping.wilayah] ?? r["Wilayah"] ?? r["Provinsi"]);
      const kotaKab = toStr(r[mapping.kotaKab] ?? r["Kota"] ?? r["Kabupaten"] ?? r["Kota/Kabupaten"]);
      const lokasi = toStr(r[mapping.lokasi] ?? r["Lokasi"] ?? r["Lokasi Kegiatan"] ?? r["Tempat"]);
      const kegiatan = toStr(r[mapping.kegiatan] ?? r["Kegiatan"] ?? r["Aksi"]);
      const aliansi = toStr(r[mapping.aliansi] ?? r["Aliansi"] ?? r["Organisasi"]);
      const tanggalSource = toStr(
        r["TANGGAL AKSI"] ?? r["Tanggal Aksi"] ?? r["TANGGAL"] ?? r["Tanggal"] ?? r[mapping.tanggal]
      );
      const tanggal = parseDateParts(tanggalSource) ? tanggalSource : "";
      const waktuMulaiSource = toStr(
        r["WAKTU MULAI"] ?? r["Waktu Mulai"] ?? r["Jam Mulai"] ?? r["WAKTU"] ?? r["Waktu"] ?? r["Jam"] ?? r[mapping.waktuMulai] ?? r[mapping.waktu]
      );
      const waktuMulai = looksLikeTimeValue(waktuMulaiSource) ? waktuMulaiSource : "";
      const waktuSelesaiSource = toStr(
        r["WAKTU SELESAI"] ?? r["Waktu Selesai"] ?? r["Jam Selesai"] ?? r[mapping.waktuSelesai]
      );
      const waktuSelesai = looksLikeTimeValue(waktuSelesaiSource) ? waktuSelesaiSource : "";
      const lokasiAksi = toStr(r[mapping.lokasiAksi] ?? r["Lokasi Aksi"]);
      const tuntutan = toStr(r[mapping.tuntutan] ?? r["Tuntutan"]);
      const ringkasan = toStr(r[mapping.ringkasan] ?? r["RINGKASAN"] ?? r["Ringkasan"] ?? r["Summary"]);
      const kategoriDemo = canonicalDemoCategory(
        r[mapping.kategoriDemo] ?? r["KATEGORI DEMO"] ?? r["Kategori Demo"] ?? r["Kategori"]
      );
      const halMenonjol = toStr(
        r[mapping.halMenonjol] ?? r["HAL MENONJOL"] ?? r["Hal Menonjol"] ?? r["Highlight"]
      );
      const isu = toStr(r[mapping.isu] ?? r["Isu"]);
      const estimasiMassa = parseMass(r[mapping.massa] ?? r["Estimasi Massa"] ?? r["Massa"]);

      let lat = null;
      let lng = null;
      const coordCell = r[mapping.koordinat];
      const pair = parseLatLngFromCell(coordCell);
      if (pair) [lat, lng] = pair;
      const latCell = r[mapping.lat];
      const lngCell = r[mapping.lng];
      if (lat == null && lng == null && latCell !== "" && lngCell !== "") {
        const a = Number(String(latCell).replace(",", "."));
        const b = Number(String(lngCell).replace(",", "."));
        if (Number.isFinite(a) && Number.isFinite(b)) {
          lat = a;
          lng = b;
        }
      }
      const locationLabel =
        [kotaKab, wilayah].filter(Boolean).join(", ") || lokasi || "Lokasi tidak diketahui";

      const id = `${idx + 1}-${normalizeKey(locationLabel)}-${normalizeKey(kegiatan || aliansi)}`;
      return {
        id,
        no,
        status,
        wilayah,
        kotaKab,
        lokasi,
        kegiatan,
        aliansi,
        tanggal,
        waktuMulai,
        waktuSelesai,
        lokasiAksi,
        kategoriDemo,
        tuntutan,
        ringkasan,
        halMenonjol,
        isu,
        estimasiMassa,
        lat,
        lng,
        locationLabel,
        _raw: r,
      };
    })
    .filter((r) => r.wilayah || r.kotaKab || r.lokasi || r.kegiatan || r.tuntutan || r.ringkasan || r.isu);
  return { rows, mapping };
}

function buildRowsFromSheet(sheet) {
  const XLSXRef = window.XLSX;
  if (!XLSXRef) {
    throw new Error("Library XLSX belum tersedia. Coba impor ulang atau gunakan CSV.");
  }
  const json = XLSXRef.utils.sheet_to_json(sheet, { defval: "", raw: false });
  return buildRowsFromRecords(json);
}

function uniq(arr) {
  return Array.from(new Set(arr.filter(Boolean)));
}

function groupBy(arr, keyFn) {
  const m = new Map();
  for (const item of arr) {
    const k = keyFn(item) ?? "";
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(item);
  }
  return m;
}

function computeStats(rows) {
  const titik = rows.length;
  const wilayahCount = uniq(rows.map((r) => (r.wilayah || "").trim().toUpperCase())).length;
  const massaSum = rows.reduce((a, r) => a + (Number.isFinite(r.estimasiMassa) ? r.estimasiMassa : 0), 0);

  const byWilayah = groupBy(rows, (r) => r.wilayah || "TIDAK DIKETAHUI");
  const wilayahAgg = Array.from(byWilayah.entries()).map(([wilayah, items]) => {
    const mass = items.reduce((a, r) => a + (Number.isFinite(r.estimasiMassa) ? r.estimasiMassa : 0), 0);
    return { wilayah, titik: items.length, mass };
  });
  wilayahAgg.sort((a, b) => b.titik - a.titik || b.mass - a.mass);

  const wilayahDominan = wilayahAgg[0]?.wilayah ?? "—";
  const byWilayahDay = groupBy(rows, (r) => {
    const tanggal = toDateInputValue(r.tanggal);
    const wilayah = r.wilayah || "TIDAK DIKETAHUI";
    return `${tanggal}__${wilayah}`;
  });
  const wilayahDayAgg = Array.from(byWilayahDay.entries())
    .map(([key, items]) => {
      const [tanggalIso, wilayah] = key.split("__");
      const mass = items.reduce((a, r) => a + (Number.isFinite(r.estimasiMassa) ? r.estimasiMassa : 0), 0);
      return {
        tanggalIso,
        tanggalLabel: formatDisplayDate(tanggalIso),
        wilayah: wilayah || "TIDAK DIKETAHUI",
        mass,
        count: items.length,
      };
    })
    .filter((item) => item.tanggalIso || item.wilayah)
    .sort((a, b) => b.mass - a.mass || b.count - a.count || a.wilayah.localeCompare(b.wilayah));
  const puncakHarian = wilayahDayAgg[0]
    ? `${wilayahDayAgg[0].wilayah} • ${wilayahDayAgg[0].tanggalLabel}`
    : "—";
  const byTuntutan = groupBy(rows, (r) => normalizeKey(r.tuntutan) || "__tanpa_tuntutan__");
  const issueAgg = Array.from(byTuntutan.entries())
    .map(([groupKey, items]) => {
      const mass = items.reduce((a, r) => a + (Number.isFinite(r.estimasiMassa) ? r.estimasiMassa : 0), 0);
      const primary = items.find((r) => toStr(r.tuntutan)) || items[0];
      const label = toStr(primary?.tuntutan) || "Tanpa Tuntutan";
      return {
        key: groupKey,
        label,
        count: items.length,
        mass,
      };
    })
    .sort((a, b) => b.count - a.count || b.mass - a.mass || a.label.localeCompare(b.label));
  const issueAggByCategory = {
    Pro: Array.from(
      groupBy(
        rows.filter((r) => canonicalDemoCategory(r.kategoriDemo) === "Pro"),
        (r) => normalizeKey(r.tuntutan) || "__tanpa_tuntutan__"
      ).entries()
    )
      .map(([groupKey, items]) => {
        const mass = items.reduce((a, r) => a + (Number.isFinite(r.estimasiMassa) ? r.estimasiMassa : 0), 0);
        const primary = items.find((r) => toStr(r.tuntutan)) || items[0];
        const label = toStr(primary?.tuntutan) || "Tanpa Tuntutan";
        return { key: groupKey, label, count: items.length, mass, kategori: "Pro" };
      })
      .sort((a, b) => b.count - a.count || b.mass - a.mass || a.label.localeCompare(b.label)),
    Kontra: Array.from(
      groupBy(
        rows.filter((r) => canonicalDemoCategory(r.kategoriDemo) === "Kontra"),
        (r) => normalizeKey(r.tuntutan) || "__tanpa_tuntutan__"
      ).entries()
    )
      .map(([groupKey, items]) => {
        const mass = items.reduce((a, r) => a + (Number.isFinite(r.estimasiMassa) ? r.estimasiMassa : 0), 0);
        const primary = items.find((r) => toStr(r.tuntutan)) || items[0];
        const label = toStr(primary?.tuntutan) || "Tanpa Tuntutan";
        return { key: groupKey, label, count: items.length, mass, kategori: "Kontra" };
      })
      .sort((a, b) => b.count - a.count || b.mass - a.mass || a.label.localeCompare(b.label)),
  };
  const isuDominan = issueAgg[0]
    ? `${issueAgg[0].label} • ${formatNumberId(issueAgg[0].count)} data`
    : "—";

  return {
    titik,
    wilayahCount,
    massaSum,
    wilayahAgg,
    wilayahDominan,
    wilayahDayAgg,
    puncakHarian,
    issueAgg,
    issueAggByCategory,
    isuDominan,
  };
}

let map;
let markerCluster;
let labelLayer;
let provinceSummaryLayer;
const markerIndex = new Map();
const labelIndex = new Map();
const provinceIndex = new Map();

function refreshVisibleLabels() {
  if (Array.isArray(state.locationPreviewRows) && state.locationPreviewRows.length) {
    renderLabelMarkers(state.locationPreviewRows, { mode: "location" });
    return;
  }
  if (Array.isArray(state.clusterPreviewRows) && state.clusterPreviewRows.length) {
    renderLabelMarkers(state.clusterPreviewRows, { mode: "location" });
    return;
  }
  labelLayer.clearLayers();
  labelIndex.clear();
}

function clearClusterPreview() {
  if (!state.clusterPreviewRows) return;
  state.clusterPreviewRows = null;
  refreshVisibleLabels();
}

function clearLocationPreview() {
  if (!state.locationPreviewRows) return;
  state.locationPreviewRows = null;
  refreshVisibleLabels();
}

function getProvinceCenter(items, wilayah) {
  const coordItems = items.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  if (coordItems.length) {
    return [
      coordItems.reduce((a, r) => a + r.lat, 0) / coordItems.length,
      coordItems.reduce((a, r) => a + r.lng, 0) / coordItems.length,
    ];
  }
  const provinceKey = toStr(wilayah).trim().toUpperCase();
  return PROVINCE_CENTROIDS[provinceKey] || null;
}

function getProvinceSummaryItems(rows) {
  const byProvince = groupBy(rows, (r) => toStr(r.wilayah || "TIDAK DIKETAHUI"));
  return Array.from(byProvince.entries())
    .map(([wilayah, items]) => {
      const center = getProvinceCenter(items, wilayah);
      if (!center) return null;
      const totalMass = items.reduce((a, r) => a + (Number.isFinite(r.estimasiMassa) ? r.estimasiMassa : 0), 0);
      const byActionGroup = groupBy(items, (r) => normalizeKey(r.kegiatan || r.aliansi || r.tuntutan || "lainnya"));
      const aksiList = Array.from(byActionGroup.entries())
        .map(([, groupItems]) => ({
          name: toStr(groupItems[0]?.kegiatan || groupItems[0]?.aliansi || groupItems[0]?.tuntutan || "Lainnya"),
          count: groupItems.length,
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
        .slice(0, 4);
      return {
        key: normalizeKey(wilayah),
        wilayah: wilayah || "TIDAK DIKETAHUI",
        items,
        totalMass,
        center,
        aksiList,
        statusMode: getDominantStatus(items),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.items.length - a.items.length || b.totalMass - a.totalMass || a.wilayah.localeCompare(b.wilayah));
}

function renderPointMarkers(rows) {
  markerCluster.clearLayers();
  markerIndex.clear();
  for (const loc of getLocationSummaryItems(rows)) {
    const marker = L.marker(loc.center, { icon: makePointIcon(loc.statusMode), title: loc.lokasi });
    marker.__rowData = loc.primary;
    marker.__locationRows = loc.items;
    marker.on("click", () => {
      clearClusterPreview();
      state.locationPreviewRows = loc.items;
      refreshVisibleLabels();
      setActiveRow(loc.primary.id, { scroll: false });
      marker.bindPopup(buildPopupHtml(loc.primary), { closeButton: true, maxWidth: 360 }).openPopup();
    });
    markerCluster.addLayer(marker);
    loc.items.forEach((item) => {
      markerIndex.set(item.id, marker);
    });
  }
}

function renderProvinceSummaryMarkers(rows) {
  provinceSummaryLayer.clearLayers();
  provinceIndex.clear();
  getProvinceSummaryItems(rows).forEach((province) => {
    const count = province.items.length;
    const size = count >= 50 ? 58 : count >= 10 ? 50 : 42;
    const html = `<div class="provinceSummaryMarkerWrap"><div class="clusterMarker" style="width:${size}px;height:${size}px;"><span>${escapeHtml(
      String(count)
    )}</span></div><div class="provinceSummaryMarker__label">${escapeHtml(province.wilayah)}</div></div>`;
    const marker = L.marker(province.center, {
      icon: L.divIcon({ className: "provinceSummaryMarkerIcon", html, iconSize: [0, 0], iconAnchor: [0, 0] }),
      title: province.wilayah,
      interactive: true,
    });
    marker.__provinceData = province;
    marker.on("click", () => {
      showProvinceDetail(province, { fitBounds: true });
    });
    provinceSummaryLayer.addLayer(marker);
    provinceIndex.set(province.key, marker);
  });
}

function fitMapToRows(rows, options = {}) {
  if (!map) return;
  const preferredZoom = Number.isFinite(options.preferredZoom) ? options.preferredZoom : 11;
  const points = (Array.isArray(rows) ? rows : [])
    .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng))
    .map((row) => [row.lat, row.lng]);
  if (points.length > 1) {
    map.fitBounds(points, { padding: [40, 40], maxZoom: preferredZoom });
  } else if (points.length === 1) {
    map.setView(points[0], preferredZoom);
  } else {
    map.setView([-2.3, 118.2], 5);
  }
}

function showProvinceSummary(rows, options = {}) {
  state.activeProvinceKey = "";
  state.clusterPreviewRows = null;
  state.locationPreviewRows = null;
  provinceSummaryLayer.clearLayers();
  provinceIndex.clear();
  renderPointMarkers(rows);
  refreshVisibleLabels();
  if (options.fitBounds !== false) {
    fitMapToRows(rows, { preferredZoom: 11 });
  }
}

function showProvinceDetail(province, options = {}) {
  if (!province) return;
  state.activeProvinceKey = province.key;
  state.clusterPreviewRows = province.items;
  state.locationPreviewRows = null;
  provinceSummaryLayer.clearLayers();
  renderPointMarkers(province.items);
  refreshVisibleLabels();
  if (options.fitBounds !== false) {
    const bounds = province.items
      .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lng))
      .map((row) => [row.lat, row.lng]);
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 11);
    } else if (province.center) {
      map.setView(province.center, 7);
    }
  }
}

function ensureProvinceDetailForRow(row) {
  const provinceKey = normalizeKey(row?.wilayah || "TIDAK DIKETAHUI");
  if (!provinceKey) return;
  if (state.activeProvinceKey === provinceKey && markerIndex.has(row.id)) return;
  const provinceMarker = provinceIndex.get(provinceKey);
  const province = provinceMarker?.__provinceData;
  if (province) {
    showProvinceDetail(province, { fitBounds: false });
    return;
  }
  const fallbackProvince = getProvinceSummaryItems(state.filteredRows).find((item) => item.key === provinceKey);
  if (fallbackProvince) showProvinceDetail(fallbackProvince, { fitBounds: false });
}

function getLabelLimitByZoom() {
  return 10;
}

function updateLabelMarkerScale() {
  if (!map) return;
  const zoom = map.getZoom();
  const clamped = Math.max(3, Math.min(10, zoom));
  const progress = (clamped - 3) / 7;
  const fullSizeThreshold = 0.72;
  const eased =
    progress >= fullSizeThreshold ? 1 : Math.pow(progress / fullSizeThreshold, 2.7);
  const scale = 0.0006 + eased * 0.9994;
  const minWidth = 5 + eased * 235;
  const padding = 0.1 + eased * 11.9;
  const radius = 0.6 + eased * 15.4;
  const titleSize = 0.8 + eased * 12.2;
  const titleGap = 0.1 + eased * 9.9;
  const summaryGap = 0.1 + eased * 7.9;
  const summaryMargin = 0.1 + eased * 9.9;
  const statPaddingY = 0.1 + eased * 7.9;
  const statPaddingX = 0.1 + eased * 8.9;
  const statGap = 0.1 + eased * 2.9;
  const statRadius = 0.6 + eased * 11.4;
  const statLabelSize = 0.6 + eased * 9.4;
  const statValueSize = 0.8 + eased * 12.2;
  const rowSize = 0.6 + eased * 11.4;
  const rowGap = 0.1 + eased * 9.9;
  const rowMargin = 0.1 + eased * 5.9;
  const rowPadding = 0.1 + eased * 5.9;
  const root = document.documentElement.style;
  root.setProperty("--label-marker-scale", scale.toFixed(3));
  root.setProperty("--label-marker-min-width", `${minWidth.toFixed(1)}px`);
  root.setProperty("--label-marker-padding", `${padding.toFixed(1)}px`);
  root.setProperty("--label-marker-radius", `${radius.toFixed(1)}px`);
  root.setProperty("--label-marker-title-size", `${titleSize.toFixed(1)}px`);
  root.setProperty("--label-marker-title-gap", `${titleGap.toFixed(1)}px`);
  root.setProperty("--label-marker-summary-gap", `${summaryGap.toFixed(1)}px`);
  root.setProperty("--label-marker-summary-margin", `${summaryMargin.toFixed(1)}px`);
  root.setProperty("--label-marker-stat-padding-y", `${statPaddingY.toFixed(1)}px`);
  root.setProperty("--label-marker-stat-padding-x", `${statPaddingX.toFixed(1)}px`);
  root.setProperty("--label-marker-stat-gap", `${statGap.toFixed(1)}px`);
  root.setProperty("--label-marker-stat-radius", `${statRadius.toFixed(1)}px`);
  root.setProperty("--label-marker-stat-label-size", `${statLabelSize.toFixed(1)}px`);
  root.setProperty("--label-marker-stat-value-size", `${statValueSize.toFixed(1)}px`);
  root.setProperty("--label-marker-row-size", `${rowSize.toFixed(1)}px`);
  root.setProperty("--label-marker-row-gap", `${rowGap.toFixed(1)}px`);
  root.setProperty("--label-marker-row-margin", `${rowMargin.toFixed(1)}px`);
  root.setProperty("--label-marker-row-padding", `${rowPadding.toFixed(1)}px`);
}

function updatePointMarkerScale() {
  if (!map) return;
  const zoom = map.getZoom();
  const clamped = Math.max(3, Math.min(10, zoom));
  const progress = (clamped - 3) / 7;
  const inverse = 1 - progress;
  const size = 10 + inverse * 16;
  const ring = 2 + inverse * 3;
  const glow = 10 + inverse * 18;
  const root = document.documentElement.style;
  root.setProperty("--point-marker-size", `${size.toFixed(1)}px`);
  root.setProperty("--point-marker-ring", `${ring.toFixed(1)}px`);
  root.setProperty("--point-marker-glow", `${glow.toFixed(1)}px`);
}

function initMap() {
  map = L.map("map", { zoomControl: true }).setView([-2.3, 118.2], 5);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
    subdomains: "abcd",
  }).addTo(map);
  markerCluster = L.layerGroup();
  labelLayer = L.layerGroup();
  provinceSummaryLayer = L.layerGroup();
  map.addLayer(markerCluster);
  map.addLayer(provinceSummaryLayer);
  map.addLayer(labelLayer);
  updateLabelMarkerScale();
  updatePointMarkerScale();
  map.on("zoom zoomend", () => {
    updateLabelMarkerScale();
    updatePointMarkerScale();
  });
  map.on("zoomend", () => {
    refreshVisibleLabels();
  });
  map.on("click", () => {
    clearClusterPreview();
    clearLocationPreview();
    refreshVisibleLabels();
  });
}

function buildPopupHtml(row) {
  const title = row.kotaKab || row.lokasi || "Titik Aksi";
  const ringkasan = toStr(row.ringkasan);
  const lines = [
    ["Status", row.status],
    ["Wilayah", row.wilayah],
    ["Lokasi", row.lokasi],
    ["Kegiatan", row.kegiatan || row.aliansi],
    ["Tanggal", formatDisplayDate(row.tanggal)],
    ["Waktu Mulai", row.waktuMulai],
    ["Waktu Selesai", row.waktuSelesai],
    ["Lokasi Aksi", row.lokasiAksi],
    ["Kategori Demo", row.kategoriDemo],
    ["Tuntutan", row.tuntutan],
    ["Hal Menonjol", row.halMenonjol],
    ["Isu", row.isu],
    ["Estimasi Massa", formatMassa(row.estimasiMassa)],
  ]
    .filter(([, v]) => toStr(v))
    .map(
      ([k, v]) =>
        `<div style="display:flex;gap:10px;justify-content:space-between;"><div style="color:rgba(255,255,255,.75);font-weight:800;">${escapeHtml(
          k
        )}</div><div style="text-align:right;font-weight:800;">${escapeHtml(String(v))}</div></div>`
    )
    .join("");
  const ringkasanHtml = ringkasan
    ? `<div class="popupRingkasan"><div class="popupRingkasan__title">Ringkasan</div><div class="popupRingkasan__text">${escapeHtml(
        ringkasan
      )}</div></div>`
    : "";
  return `<div class="mapPopup"><div class="mapPopup__title">${escapeHtml(
    title
  )}</div>${ringkasanHtml}<div class="mapPopup__lines">${lines}</div></div>`;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderKategoriDemoBadge(value) {
  const text = toStr(value);
  if (!text) return "—";
  const normalized = text.toLowerCase();
  const tone = normalized === "pro" ? "demoBadge--pro" : normalized === "kontra" ? "demoBadge--kontra" : "";
  return `<span class="demoBadge ${tone}">${escapeHtml(text)}</span>`;
}

function renderStatusBadge(value) {
  const text = toStr(value);
  if (!text) return "—";
  const normalized = text.toLowerCase();
  const tone =
    normalized === "rencana"
      ? "demoBadge--status-rencana"
      : normalized === "yang berlangsung"
        ? "demoBadge--status-berlangsung"
        : normalized === "selesai"
          ? "demoBadge--status-selesai"
          : "";
  return `<span class="demoBadge ${tone}">${escapeHtml(text)}</span>`;
}

function getLocationGroupKey(row) {
  const lokasi = toStr(row?.lokasi || row?.kotaKab || row?.locationLabel || "Titik Aksi");
  const wilayah = toStr(row?.wilayah || "TIDAK DIKETAHUI");
  return `${normalizeKey(wilayah)}__${normalizeKey(lokasi)}`;
}

function makePointIcon(status) {
  return L.divIcon({
    className: "pointMarkerIcon",
    html: `<div class="pointMarkerWrap"><div class="pointMarker${getPointMarkerClass(status)}"></div></div>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  });
}

function getLocationSummaryItems(rows) {
  const byLocation = groupBy(rows, (r) => getLocationGroupKey(r));
  return Array.from(byLocation.entries())
    .map(([key, items]) => {
      const sortedItems = items.slice().sort((a, b) => (b.estimasiMassa || 0) - (a.estimasiMassa || 0));
      const primary = sortedItems[0];
      const coordItems = sortedItems.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
      if (!primary || !coordItems.length) return null;
      const totalMass = sortedItems.reduce((a, r) => a + (Number.isFinite(r.estimasiMassa) ? r.estimasiMassa : 0), 0);
      const center = [
        coordItems.reduce((a, r) => a + r.lat, 0) / coordItems.length,
        coordItems.reduce((a, r) => a + r.lng, 0) / coordItems.length,
      ];
      return {
        key,
        items: sortedItems,
        primary,
        lokasi: toStr(primary.lokasi || primary.kotaKab || primary.locationLabel || "Titik Aksi"),
        wilayah: toStr(primary.wilayah || "—"),
        totalMass,
        center,
        statusMode: getDominantStatus(sortedItems),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.items.length - a.items.length || b.totalMass - a.totalMass || a.lokasi.localeCompare(b.lokasi));
}

function renderLabelMarkers(rows, options = {}) {
  labelLayer.clearLayers();
  labelIndex.clear();
  const labelLimit = getLabelLimitByZoom();
  if (labelLimit <= 0) return;
  const mode = options.mode === "province" ? "province" : "location";
  if (mode === "province") {
    const provinceAgg = getProvinceSummaryItems(rows).slice(0, Math.max(6, labelLimit));

    for (const province of provinceAgg) {
      const statusClass = getStatusToneClass(province.statusMode);
      const aksiHtml = province.aksiList.length
        ? `<div class="labelMarker__block"><div class="labelMarker__blockTitle">Daftar Aksi</div>${province.aksiList
            .map(
              (aksi) =>
                `<div class="labelMarker__actionItem"><span class="labelMarker__label">${escapeHtml(
                  aksi.name
                )}</span><span class="labelMarker__value">${escapeHtml(`${aksi.count} aksi`)}</span></div>`
            )
            .join("")}</div>`
        : "";
      const html = `<div class="labelMarkerWrap"><div class="labelMarker${statusClass}"><div class="labelMarker__title">${escapeHtml(
        province.wilayah
      )}</div><div class="labelMarker__summary"><div class="labelMarker__stat"><span class="labelMarker__statLabel">Titik Aksi</span><span class="labelMarker__statValue">${escapeHtml(
        String(province.items.length)
      )}</span></div><div class="labelMarker__stat"><span class="labelMarker__statLabel">Total Massa</span><span class="labelMarker__statValue">${escapeHtml(
        formatMassa(province.totalMass)
      )}</span></div></div>${aksiHtml}</div></div>`;
      const labelMarker = L.marker(province.center, {
        icon: L.divIcon({ className: "labelMarkerIcon", html, iconSize: [0, 0], iconAnchor: [0, 0] }),
        interactive: true,
      });
      labelMarker.on("click", () => {
        clearClusterPreview();
        clearLocationPreview();
        els.wilayahFilter.value = province.wilayah;
        applyFiltersAndRender();
      });
      labelLayer.addLayer(labelMarker);
      labelIndex.set(province.key, labelMarker);
    }
    return;
  }
  const locationAgg = getLocationSummaryItems(rows).slice(0, labelLimit);

  for (const loc of locationAgg) {
    const statusClass = getStatusToneClass(loc.statusMode);
    const byActionGroup = groupBy(loc.items, (r) => normalizeKey(r.kegiatan || r.aliansi || r.tuntutan || "lainnya"));
    const topGroups = Array.from(byActionGroup.entries())
      .map(([, groupItems]) => {
        const name = toStr(groupItems[0]?.kegiatan || groupItems[0]?.aliansi || groupItems[0]?.tuntutan || "Lainnya");
        const count = groupItems.length;
        return { name, count };
      })
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 2);
    const htmlRows = [
      `<div class="labelMarker__row"><span class="labelMarker__label">Wilayah</span><span class="labelMarker__value">${escapeHtml(
        loc.wilayah || "—"
      )}</span></div>`,
      ...topGroups.map(
        (group) =>
          `<div class="labelMarker__row"><span class="labelMarker__label">${escapeHtml(
            group.name
          )}</span><span class="labelMarker__value">${escapeHtml(`${group.count} aksi`)}</span></div>`
      ),
    ].join("");
    const html = `<div class="labelMarkerWrap"><div class="labelMarker${statusClass}"><div class="labelMarker__title">${escapeHtml(
      loc.lokasi
    )}</div><div class="labelMarker__summary"><div class="labelMarker__stat"><span class="labelMarker__statLabel">Titik Aksi</span><span class="labelMarker__statValue">${escapeHtml(
      String(loc.items.length)
    )}</span></div><div class="labelMarker__stat"><span class="labelMarker__statLabel">Total Massa</span><span class="labelMarker__statValue">${escapeHtml(
      formatMassa(loc.totalMass)
    )}</span></div></div>${htmlRows}</div></div>`;
    const labelMarker = L.marker(loc.center, {
      icon: L.divIcon({ className: "labelMarkerIcon", html, iconSize: [0, 0], iconAnchor: [0, 0] }),
      interactive: true,
    });
    labelMarker.on("click", () => {
      clearClusterPreview();
      const primaryMarker = markerIndex.get(loc.primary.id);
      map.setView(loc.center, Math.max(map.getZoom(), 8));
      if (primaryMarker) primaryMarker.fire("click");
    });
    labelLayer.addLayer(labelMarker);
    labelIndex.set(loc.key, labelMarker);
  }
}

function focusMapToLabels(rows, options = {}) {
  if (!map || !Array.isArray(rows) || !rows.length) return;
  const markers = [];
  const seen = new Set();
  rows.forEach((row) => {
    const key = getLocationGroupKey(row);
    if (!key || seen.has(key)) return;
    const labelMarker = labelIndex.get(key);
    if (!labelMarker) return;
    seen.add(key);
    markers.push(labelMarker);
  });
  if (!markers.length) return;

  const preferredZoom = Number.isFinite(options.preferredZoom) ? options.preferredZoom : 9;
  if (markers.length === 1) {
    map.setView(markers[0].getLatLng(), Math.max(map.getZoom(), preferredZoom));
    return;
  }

  const bounds = markers.map((marker) => marker.getLatLng());
  map.fitBounds(bounds, { padding: [50, 50], maxZoom: preferredZoom });
}

function updateMapWithRows(rows) {
  showProvinceSummary(rows);
}

function getTableTotalPages(rows) {
  return Math.max(1, Math.ceil((Array.isArray(rows) ? rows.length : 0) / TABLE_PAGE_SIZE));
}

function getPaginatedTableRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const totalPages = getTableTotalPages(list);
  if (state.currentTablePage > totalPages) state.currentTablePage = totalPages;
  if (state.currentTablePage < 1) state.currentTablePage = 1;
  const start = (state.currentTablePage - 1) * TABLE_PAGE_SIZE;
  return list.slice(start, start + TABLE_PAGE_SIZE);
}

function updateTablePagination(rows) {
  if (!els.rincianPagination || !els.rincianPageInfo || !els.rincianPrevBtn || !els.rincianNextBtn) return;
  const totalItems = Array.isArray(rows) ? rows.length : 0;
  const totalPages = getTableTotalPages(rows);
  const currentPage = Math.min(Math.max(state.currentTablePage, 1), totalPages);
  state.currentTablePage = currentPage;
  els.rincianPageInfo.textContent = totalItems
    ? `Halaman ${currentPage} dari ${totalPages} • ${formatNumberId(totalItems)} data`
    : "Halaman 1 dari 1 • 0 data";
  els.rincianPrevBtn.disabled = currentPage <= 1 || totalItems === 0;
  els.rincianNextBtn.disabled = currentPage >= totalPages || totalItems === 0;
}

function syncTablePageToActiveRow(rows, activeId) {
  const list = Array.isArray(rows) ? rows : [];
  const targetId = toStr(activeId);
  if (!targetId) return;
  const rowIndex = list.findIndex((row) => row?.id === targetId);
  if (rowIndex < 0) return;
  state.currentTablePage = Math.floor(rowIndex / TABLE_PAGE_SIZE) + 1;
}

function setActiveRow(id, options = {}) {
  state.activeId = id;
  syncTablePageToActiveRow(state.filteredRows, id);
  renderTable(state.filteredRows);
  if (options.scroll === false) return;
  const el = document.querySelector(`[data-row-id="${CSS.escape(id)}"]`);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderSummary(stats) {
  els.sumTitik.textContent = formatNumberId(stats.titik);
  els.sumWilayahCount.textContent = formatNumberId(stats.wilayahCount);
  els.sumMassa.textContent = stats.massaSum ? `${formatMassa(stats.massaSum)} ORANG` : "—";
  els.sumWilayahDominan.textContent = stats.wilayahDominan || "—";
  els.sumPuncakHarian.textContent = stats.puncakHarian || "—";
  els.sumIsuDominan.textContent = stats.isuDominan || "—";

  els.rekapWilayahBody.innerHTML = "";
  for (const r of stats.wilayahAgg.slice(0, 12)) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(r.wilayah)}</td><td class="num">${formatNumberId(
      r.titik
    )}</td><td class="num">${formatMassa(r.mass)}</td>`;
    tr.addEventListener("click", () => {
      if (r.wilayah && r.wilayah !== "TIDAK DIKETAHUI") {
        els.wilayahFilter.value = r.wilayah;
        applyFiltersAndRender();
      }
    });
    els.rekapWilayahBody.appendChild(tr);
  }

  renderMassChart(stats.wilayahDayAgg);
  renderIssueRank(stats.issueAggByCategory);

  const analisa = buildAnalisa(stats);
  els.analisaList.innerHTML = "";
  for (const t of analisa) {
    const li = document.createElement("li");
    li.textContent = t;
    els.analisaList.appendChild(li);
  }
}

function buildAnalisa(stats) {
  const lines = [];
  if (stats.wilayahAgg.length) {
    const top = stats.wilayahAgg[0];
    const p = stats.titik ? Math.round((top.titik / stats.titik) * 100) : 0;
    lines.push(`Wilayah dominan ${top.wilayah} dengan ${top.titik} titik (${p}%).`);
  }
  if (stats.wilayahDayAgg.length) {
    const topDay = stats.wilayahDayAgg[0];
    lines.push(`Puncak massa harian berada di ${topDay.wilayah} pada ${topDay.tanggalLabel} dengan total ${formatMassa(topDay.mass)}.`);
  }
  if (stats.issueAgg.length) {
    const topIssue = stats.issueAgg[0];
    lines.push(`Tuntutan dominan "${topIssue.label}" muncul pada ${formatNumberId(topIssue.count)} data dengan estimasi massa ${formatMassa(topIssue.mass)}.`);
  }
  if (stats.massaSum) {
    lines.push(`Total estimasi massa nasional sekitar ${formatMassa(stats.massaSum)} orang.`);
  }
  const wilayahTakDiketahui = stats.wilayahAgg.find((x) => x.wilayah === "TIDAK DIKETAHUI");
  if (wilayahTakDiketahui && wilayahTakDiketahui.titik) {
    lines.push(
      `Terdapat ${wilayahTakDiketahui.titik} baris tanpa wilayah yang terdeteksi; lengkapi kolom wilayah/koordinat untuk pemetaan yang lebih akurat.`
    );
  }
  return lines.slice(0, 5);
}

function renderMassChart(items) {
  els.massChart.innerHTML = "";
  if (!Array.isArray(items) || !items.length) {
    els.massChart.innerHTML = `<div class="massChart__empty">Belum ada data massa untuk ditampilkan.</div>`;
    return;
  }
  const topItems = items.slice(0, 8);
  const maxMass = Math.max(...topItems.map((item) => item.mass), 1);
  topItems.forEach((item) => {
    const row = document.createElement("div");
    row.className = "massChart__row";
    const width = Math.max(8, Math.round((item.mass / maxMass) * 100));
    row.innerHTML = `<div class="massChart__head"><div class="massChart__title">${escapeHtml(
      item.wilayah
    )}</div><div class="massChart__meta">${escapeHtml(item.tanggalLabel)}</div></div><div class="massChart__barTrack"><div class="massChart__bar" style="width:${width}%"></div></div><div class="massChart__value">${escapeHtml(
      `${formatNumberId(item.mass)} orang`
    )}</div>`;
    els.massChart.appendChild(row);
  });
}

function renderIssueRank(itemsByCategory) {
  els.issueRank.innerHTML = "";
  const proItems = Array.isArray(itemsByCategory?.Pro) ? itemsByCategory.Pro.slice(0, 3) : [];
  const kontraItems = Array.isArray(itemsByCategory?.Kontra) ? itemsByCategory.Kontra.slice(0, 3) : [];
  if (!proItems.length && !kontraItems.length) {
    els.issueRank.innerHTML = `<div class="issueRank__empty">Belum ada tuntutan yang dapat diidentifikasi.</div>`;
    return;
  }
  [
    { title: "Kontra", tone: "kontra", items: kontraItems },
    { title: "Pro", tone: "pro", items: proItems },
  ].forEach((section) => {
    const wrapper = document.createElement("div");
    wrapper.className = "issueRank__section";
    const rowsHtml = section.items.length
      ? section.items
          .map(
            (item) =>
              `<div class="issueRank__row"><div class="issueRank__title">${escapeHtml(item.label)}</div></div>`
          )
          .join("")
      : `<div class="issueRank__empty issueRank__empty--section">Belum ada data kategori ${escapeHtml(section.title)}.</div>`;
    wrapper.innerHTML = `<div class="issueRank__sectionTitle"><span class="demoBadge demoBadge--${section.tone}">${escapeHtml(
      section.title
    )}</span></div>${rowsHtml}`;
    els.issueRank.appendChild(wrapper);
  });
}

function renderTable(rows) {
  els.rincianBody.innerHTML = "";
  const pagedRows = getPaginatedTableRows(rows);
  const startIndex = (state.currentTablePage - 1) * TABLE_PAGE_SIZE;
  pagedRows.forEach((r, idx) => {
    const tr = document.createElement("tr");
    tr.dataset.rowId = r.id;
    if (state.activeId === r.id) tr.classList.add("is-active");
    const noCell = toStr(r.no) || String(startIndex + idx + 1);
    const tanggalCell = formatDisplayDate(r.tanggal);
    const waktuMulaiCell = r.waktuMulai || "—";
    const waktuSelesaiCell = r.waktuSelesai || "—";
    const statusCell = r.status || "Selesai";
    const wilayahCell = r.wilayah || "—";
    const massaCell = formatMassa(r.estimasiMassa);
    const lokasiCell = r.lokasi || "—";
    const kelompokCell = r.aliansi || r.kegiatan || "—";
    const kategoriDemoCell = r.kategoriDemo || "—";
    const tuntutanCell = r.tuntutan || r.isu || "—";
    const ringkasanCell = r.ringkasan || "—";
    const halMenonjolCell = r.halMenonjol || "—";
    tr.innerHTML = `<td class="num">${escapeHtml(noCell)}</td><td>${escapeHtml(
      tanggalCell
    )}</td><td>${escapeHtml(
      waktuMulaiCell
    )}</td><td>${escapeHtml(
      waktuSelesaiCell
    )}</td><td>${renderStatusBadge(statusCell)}</td><td>${escapeHtml(
      wilayahCell
    )}</td><td class="num">${escapeHtml(
      massaCell
    )}</td><td>${escapeHtml(lokasiCell)}</td><td>${escapeHtml(
      kelompokCell
    )}</td><td>${renderKategoriDemoBadge(kategoriDemoCell)}</td><td>${escapeHtml(
      tuntutanCell
    )}</td><td>${escapeHtml(ringkasanCell)}</td><td>${escapeHtml(halMenonjolCell)}</td>`;
    tr.addEventListener("click", () => {
      setActiveRow(r.id);
      focusMapToLabels([r], { preferredZoom: 11 });
      const marker = markerIndex.get(r.id);
      if (marker) marker.fire("click");
    });
    els.rincianBody.appendChild(tr);
  });
  updateTablePagination(rows);
}

function applyFiltersAndRender() {
  const wilayah = toStr(els.wilayahFilter.value);
  const tanggal = toStr(els.tanggalFilter.value);
  const bulan = toStr(els.bulanFilter.value);
  const tahun = toStr(els.tahunFilter.value);
  const q = normalizeKey(els.searchInput.value);
  state.filteredRows = state.allRows.filter((r) => {
    const okWilayah = !wilayah || r.wilayah === wilayah;
    if (!okWilayah) return false;
    const rowDate = toDateInputValue(r.tanggal);
    const rowMonth = getMonthValue(r.tanggal);
    const rowYear = getYearValue(r.tanggal);
    const okTanggal = !tanggal || rowDate === tanggal;
    const okBulan = !bulan || rowMonth === bulan;
    const okTahun = !tahun || rowYear === tahun;
    if (!okTanggal || !okBulan || !okTahun) return false;
    if (!q) return true;
    const hay = normalizeKey(
      [
        r.no,
        r.tanggal,
        r.waktuMulai,
        r.waktuSelesai,
        r.status,
        r.wilayah,
        r.kotaKab,
        r.lokasi,
        r.kegiatan,
        r.aliansi,
        r.lokasiAksi,
        r.kategoriDemo,
        r.tuntutan,
        r.ringkasan,
        r.halMenonjol,
        r.isu,
      ].join(" ")
    );
    return hay.includes(q);
  });

  state.currentTablePage = 1;
  setTitleDate(buildTitleDateText());
  const stats = computeStats(state.filteredRows);
  renderSummary(stats);
  renderTable(state.filteredRows);
  updateMapWithRows(state.filteredRows);
  if (wilayah || q) {
    focusMapToLabels(state.filteredRows, { preferredZoom: q ? 11 : 9 });
  }
}

els.rincianPrevBtn?.addEventListener("click", () => {
  if (state.currentTablePage <= 1) return;
  state.currentTablePage -= 1;
  renderTable(state.filteredRows);
});

els.rincianNextBtn?.addEventListener("click", () => {
  const totalPages = getTableTotalPages(state.filteredRows);
  if (state.currentTablePage >= totalPages) return;
  state.currentTablePage += 1;
  renderTable(state.filteredRows);
});

function populateFilters(rows) {
  const selectedWilayah = toStr(els.wilayahFilter.value);
  const selectedTanggal = toStr(els.tanggalFilter.value);
  const selectedBulan = toStr(els.bulanFilter.value);
  const selectedTahun = toStr(els.tahunFilter.value);
  const wilayahs = uniq(rows.map((r) => r.wilayah).filter(Boolean)).sort((a, b) => a.localeCompare(b));
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  const years = uniq(rows.map((r) => getYearValue(r.tanggal)).filter(Boolean)).sort((a, b) => b.localeCompare(a));

  els.wilayahFilter.innerHTML = "";
  const base = document.createElement("option");
  base.value = "";
  base.textContent = "Semua Wilayah";
  els.wilayahFilter.appendChild(base);
  wilayahs.forEach((w) => {
    const opt = document.createElement("option");
    opt.value = w;
    opt.textContent = w;
    els.wilayahFilter.appendChild(opt);
  });

  els.bulanFilter.innerHTML = "";
  const monthBase = document.createElement("option");
  monthBase.value = "";
  monthBase.textContent = "Semua Bulan";
  els.bulanFilter.appendChild(monthBase);
  months.forEach((month) => {
    const opt = document.createElement("option");
    opt.value = month;
    opt.textContent = getMonthLabel(month);
    els.bulanFilter.appendChild(opt);
  });

  els.tahunFilter.innerHTML = "";
  const yearBase = document.createElement("option");
  yearBase.value = "";
  yearBase.textContent = "Semua Tahun";
  els.tahunFilter.appendChild(yearBase);
  years.forEach((year) => {
    const opt = document.createElement("option");
    opt.value = year;
    opt.textContent = year;
    els.tahunFilter.appendChild(opt);
  });

  els.wilayahFilter.value = wilayahs.includes(selectedWilayah) ? selectedWilayah : "";
  els.bulanFilter.value = months.includes(selectedBulan) ? selectedBulan : "";
  els.tahunFilter.value = years.includes(selectedTahun) ? selectedTahun : "";
  if (selectedTanggal) {
    els.tanggalFilter.value = selectedTanggal;
  } else if (!state.hasInitializedDateDefault && !els.bulanFilter.value && !els.tahunFilter.value) {
    const todayValue = getTodayDateInputValue();
    const latestAvailableDate = getLatestAvailableDate(rows);
    els.tanggalFilter.value = rows.some((row) => toDateInputValue(row.tanggal) === todayValue)
      ? todayValue
      : latestAvailableDate;
    state.hasInitializedDateDefault = true;
  } else {
    els.tanggalFilter.value = "";
  }
  els.wilayahFilter.disabled = false;
  els.tanggalFilter.disabled = false;
  els.bulanFilter.disabled = false;
  els.tahunFilter.disabled = years.length === 0;
  els.searchInput.disabled = false;
}

function populateSheets(wb) {
  els.sheetSelect.innerHTML = "";
  wb.SheetNames.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    els.sheetSelect.appendChild(opt);
  });
  els.sheetSelect.disabled = wb.SheetNames.length <= 1 ? true : false;
}

function loadWorkbook(wb, datasetLabel) {
  state.workbook = wb;
  state.datasetLabel = datasetLabel;
  if (els.datasetName) els.datasetName.textContent = datasetLabel;
  populateSheets(wb);
  const sheetName = state.sheetName && wb.SheetNames.includes(state.sheetName) ? state.sheetName : wb.SheetNames[0];
  state.sheetName = sheetName;
  els.sheetSelect.value = sheetName;
  const sheet = wb.Sheets[sheetName];
  const { rows } = buildRowsFromSheet(sheet);
  state.allRows = rows;
  state.activeId = null;
  populateFilters(rows);
  applyFiltersAndRender();
  toast(`Data dimuat: ${rows.length} baris`);
}

function loadRows(rows, datasetLabel) {
  state.workbook = null;
  state.sheetName = null;
  state.datasetLabel = datasetLabel;
  if (els.datasetName) els.datasetName.textContent = datasetLabel;
  els.sheetSelect.innerHTML = "";
  els.sheetSelect.disabled = true;
  state.allRows = rows;
  state.activeId = null;
  populateFilters(rows);
  applyFiltersAndRender();
  toast(`Data dimuat: ${rows.length} baris`);
}

function parseCsvToRecords(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cur);
      cur = "";
      continue;
    }
    if (ch === "\n") {
      row.push(cur);
      cur = "";
      rows.push(row);
      row = [];
      continue;
    }
    if (ch === "\r") continue;
    cur += ch;
  }
  row.push(cur);
  rows.push(row);

  const trimmed = rows
    .map((r) => r.map((c) => String(c ?? "").trim()))
    .filter((r) => r.some((c) => c !== ""));
  if (!trimmed.length) return [];
  const headers = trimmed[0].map((h, idx) => (h ? h : `kolom_${idx + 1}`));
  const records = [];
  for (const r of trimmed.slice(1)) {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] ?? "";
    });
    records.push(obj);
  }
  return records;
}

async function loadSample() {
  return;
}

function handleFile(_file) {
  return;
}

function wireEvents() {
  els.sheetSelect.addEventListener("change", () => {
    if (!state.workbook) return;
    state.sheetName = els.sheetSelect.value;
    loadWorkbook(state.workbook, state.datasetLabel);
  });
  els.wilayahFilter.addEventListener("change", () => applyFiltersAndRender());
  els.tanggalFilter.addEventListener("change", () => {
    syncTemporalFilters("tanggal");
    applyFiltersAndRender();
  });
  els.bulanFilter.addEventListener("change", () => {
    syncTemporalFilters("bulan");
    applyFiltersAndRender();
  });
  els.tahunFilter.addEventListener("change", () => {
    syncTemporalFilters("tahun");
    applyFiltersAndRender();
  });
  els.searchInput.addEventListener("input", () => applyFiltersAndRender());
}

async function loadActiveDatasetOnStart() {
  try {
    const [metaRes, recRes] = await Promise.all([fetch("/api/active"), fetch("/api/active/records")]);
    if (!metaRes.ok) throw new Error(`Gagal memuat metadata (${metaRes.status})`);
    if (!recRes.ok) throw new Error(`Gagal memuat data (${recRes.status})`);
    const meta = await metaRes.json();
    const data = await recRes.json();
    const records = Array.isArray(data.records) ? data.records : [];
    if (!records.length) {
      toast("Belum ada dataset aktif. Buka Admin Data untuk impor atau input manual.");
      return;
    }
    const out = buildRowsFromRecords(records);
    loadRows(out.rows, meta?.dataset?.name || "Dataset Aktif");
  } catch (e) {
    toast(toStr(e.message || e));
  }
}

initMap();
wireEvents();
setTitleDate(formatIndoDate(new Date()));
loadActiveDatasetOnStart();
