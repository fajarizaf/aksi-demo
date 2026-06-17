const els = {
  fileInput: document.getElementById("fileInput"),
  loadSampleBtn: document.getElementById("loadSampleBtn"),
  datasetNameInput: document.getElementById("datasetNameInput"),
  sheetSelect: document.getElementById("sheetSelect"),
  saveBtn: document.getElementById("saveBtn"),
  datasetBody: document.getElementById("datasetBody"),
  recordBody: document.getElementById("recordBody"),
  filterKeyword: document.getElementById("filterKeyword"),
  filterWilayah: document.getElementById("filterWilayah"),
  filterTanggal: document.getElementById("filterTanggal"),
  filterBulan: document.getElementById("filterBulan"),
  filterTahun: document.getElementById("filterTahun"),
  clearFilterBtn: document.getElementById("clearFilterBtn"),
  recordSummary: document.getElementById("recordSummary"),
  prevPageBtn: document.getElementById("prevPageBtn"),
  nextPageBtn: document.getElementById("nextPageBtn"),
  pageInfo: document.getElementById("pageInfo"),
  logoutBtn: document.getElementById("logoutBtn"),
  toast: document.getElementById("toast"),
  importHint: document.getElementById("importHint"),
  activeDatasetName: document.getElementById("activeDatasetName"),
  refreshBtn: document.getElementById("refreshBtn"),
  manualForm: document.getElementById("manualForm"),
  manualHint: document.getElementById("manualHint"),
  mSubmit: document.getElementById("mSubmit"),
  mCancelEdit: document.getElementById("mCancelEdit"),
  mTanggal: document.getElementById("mTanggal"),
  mWaktu: document.getElementById("mWaktu"),
  mWilayah: document.getElementById("mWilayah"),
  mLokasi: document.getElementById("mLokasi"),
  mKelompokAksi: document.getElementById("mKelompokAksi"),
  mTuntutan: document.getElementById("mTuntutan"),
  mRingkasan: document.getElementById("mRingkasan"),
  mJumlahMassa: document.getElementById("mJumlahMassa"),
  mGoogleMaps: document.getElementById("mGoogleMaps"),
};

const XLSX_CDN_URLS = [
  "https://unpkg.com/xlsx@0.19.3/dist/xlsx.full.min.js",
  "https://cdn.jsdelivr.net/npm/xlsx@0.19.3/dist/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.19.3/xlsx.full.min.js",
];

let xlsxReadyPromise = null;

function toStr(v) {
  if (v == null) return "";
  return String(v).trim();
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.add("is-show");
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => els.toast.classList.remove("is-show"), 2200);
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
  if (window.XLSX) return window.XLSX;
  if (!xlsxReadyPromise) {
    xlsxReadyPromise = (async () => {
      for (const url of XLSX_CDN_URLS) {
        try {
          await loadScript(url);
          if (window.XLSX) return window.XLSX;
        } catch {
        }
      }
      throw new Error("Library XLSX gagal dimuat. Pastikan internet aktif.");
    })();
  }
  return xlsxReadyPromise;
}

function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeHref(url) {
  const raw = toStr(url);
  if (!raw) return "";
  try {
    const u = new URL(raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

function normalizeGoogleMapsUrl(url) {
  const raw = toStr(url);
  if (!raw) return "";
  const normalized = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
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

function isLikelyMass(value) {
  const s = toStr(value);
  if (!s) return false;
  return /\d/.test(s);
}

function formatMassDisplay(value) {
  if (value == null || value === "") return "—";
  return new Intl.NumberFormat("id-ID").format(Number(value));
}

function parseDateParts(value) {
  const s = toStr(value);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return { year: iso[1], month: iso[2], day: iso[3], iso: s };
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

function toDateInputValue(value) {
  return parseDateParts(value)?.iso || "";
}

function formatDisplayDate(value) {
  const parsed = parseDateParts(value);
  if (!parsed) return toStr(value) || "—";
  return `${Number(parsed.month)}/${Number(parsed.day)}/${parsed.year.slice(-2)}`;
}

function getYearValue(value) {
  return parseDateParts(value)?.year || "";
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

function setButtonLoading(button, isLoading, loadingText = "Loading...") {
  if (!button) return;
  if (isLoading) {
    if (!button.dataset.originalText) button.dataset.originalText = button.textContent || "";
    button.disabled = true;
    button.classList.add("is-loading");
    button.textContent = loadingText;
    return;
  }
  button.disabled = false;
  button.classList.remove("is-loading");
  if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
    delete button.dataset.originalText;
  }
}

async function runWithButtonLoading(button, task, loadingText = "Loading...") {
  const start = Date.now();
  setButtonLoading(button, true, loadingText);
  try {
    return await task();
  } finally {
    const elapsed = Date.now() - start;
    if (elapsed < 180) {
      await new Promise((resolve) => window.setTimeout(resolve, 180 - elapsed));
    }
    setButtonLoading(button, false);
  }
}

function resetManualForm() {
  state.editingRecordId = "";
  els.mTanggal.value = "";
  els.mWaktu.value = "";
  els.mWilayah.value = "";
  els.mJumlahMassa.value = "";
  els.mLokasi.value = "";
  els.mKelompokAksi.value = "";
  els.mTuntutan.value = "";
  els.mRingkasan.value = "";
  els.mGoogleMaps.value = "";
  els.mSubmit.textContent = "Tambah";
  els.mCancelEdit.hidden = true;
  els.manualHint.textContent = "Jika tidak ada dataset aktif, input manual akan membuat dataset “Manual” otomatis.";
}

function normalizeSearch(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, " ");
}

const state = {
  pending: null,
  editingRecordId: "",
  activeRecords: [],
  currentPage: 1,
  pageSize: 20,
  authChecked: false,
};

function resetPending() {
  state.pending = null;
  els.datasetNameInput.value = "";
  els.sheetSelect.innerHTML = "";
  els.sheetSelect.disabled = true;
  els.saveBtn.disabled = true;
  els.importHint.textContent = "Pilih file untuk mulai impor.";
}

function redirectToLogin() {
  window.location.href = "/login.html";
}

async function apiFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 401) {
    redirectToLogin();
    throw new Error("Sesi login berakhir. Silakan login kembali.");
  }
  return res;
}

async function ensureAdminSession() {
  const res = await fetch("/api/admin/auth/session");
  if (res.status === 401) {
    redirectToLogin();
    throw new Error("Silakan login terlebih dahulu.");
  }
  if (!res.ok) throw new Error(`Gagal memeriksa sesi (${res.status})`);
  state.authChecked = true;
  return res.json();
}

async function logout() {
  await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => null);
  redirectToLogin();
}

function populateSheets(sheetNames) {
  els.sheetSelect.innerHTML = "";
  sheetNames.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    els.sheetSelect.appendChild(opt);
  });
  els.sheetSelect.disabled = sheetNames.length <= 1;
}

async function prepareFromFile(file) {
  if (!file) return;
  const name = file.name || "dataset";
  const ext = (name.split(".").pop() || "").toLowerCase();
  els.datasetNameInput.value = name.replace(/\.(xlsx|xls|csv)$/i, "");

  if (ext === "csv") {
    state.pending = { type: "csv", file, sheetName: null };
    els.sheetSelect.innerHTML = "";
    els.sheetSelect.disabled = true;
    els.saveBtn.disabled = false;
    els.importHint.textContent = "CSV siap diunggah ke database.";
    return;
  }

  const XLSXRef = await ensureXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSXRef.read(buf, { type: "array" });
  const sheetNames = wb.SheetNames || [];
  const sheetName = sheetNames[0] || "";
  const sheet = sheetName ? wb.Sheets[sheetName] : null;
  const rowCount = sheet ? XLSXRef.utils.sheet_to_json(sheet, { defval: "", raw: false }).length : 0;
  state.pending = { type: "xlsx", file, workbook: wb, sheetNames, sheetName, rowCount };
  populateSheets(sheetNames);
  if (sheetName) els.sheetSelect.value = sheetName;
  els.saveBtn.disabled = false;
  els.importHint.textContent = `Excel siap diunggah: ${sheetNames.length} sheet, ${rowCount} baris (sheet: ${sheetName || "—"}).`;
}

async function prepareSample() {
  const res = await fetch("./Data Aksi dan Tuntutan Wilayah.xlsx");
  if (!res.ok) throw new Error(`Gagal mengambil file contoh (${res.status})`);
  const buf = await res.arrayBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const fakeFile = new File([blob], "Data Aksi dan Tuntutan Wilayah.xlsx", { type: blob.type });
  await prepareFromFile(fakeFile);
  els.datasetNameInput.value = "Data Aksi dan Tuntutan Wilayah";
}

async function savePending() {
  if (!state.pending) return;
  const name = toStr(els.datasetNameInput.value) || "Dataset";
  const pending = state.pending;
  const form = new FormData();
  form.append("file", pending.file);
  form.append("name", name);
  if (pending.type === "xlsx" && pending.sheetName) form.append("sheetName", pending.sheetName);
  const res = await apiFetch("/api/datasets/import", { method: "POST", body: form });
  if (!res.ok) {
    if (res.status === 501) {
      throw new Error("Server API belum aktif. Jalankan `npm run dev` lalu akses Admin lewat http://localhost:5174/admin.html (bukan via python http.server).");
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gagal impor (${res.status})`);
  }
  const out = await res.json();
  toast(`Impor selesai: ${out.importedCount || 0} baris, tambah ${out.insertedCount || 0}, update ${out.updatedCount || 0}.`);
  resetPending();
  await renderAll();
}

async function renderDatasets() {
  const res = await apiFetch("/api/datasets");
  if (!res.ok) throw new Error(`Gagal memuat dataset (${res.status})`);
  const payload = await res.json();
  const list = Array.isArray(payload.datasets) ? payload.datasets : [];
  const activeId = String(payload.activeDatasetId || "");
  const active = list.find((d) => d.id === activeId);
  els.activeDatasetName.textContent = active ? active.name : "—";

  els.datasetBody.innerHTML = "";
  list.forEach((ds) => {
    const tr = document.createElement("tr");
    const isActive = ds.id === activeId;
    const nameCell = `${escapeHtml(ds.name || "Dataset")}${isActive ? " (Aktif)" : ""}`;
    const sheet = escapeHtml(ds.sheetName || "—");
    tr.innerHTML = `<td>${nameCell}</td><td>${escapeHtml(String(ds.type || "—").toUpperCase())}</td><td>${sheet}</td><td class="num">${ds.rowCount ?? "—"}</td><td>${escapeHtml(
      formatDateTime(ds.updatedAt || ds.createdAt)
    )}</td><td class="adminActions">
      <button class="btn btn--ghost" data-action="activate" data-id="${escapeHtml(ds.id)}">Aktifkan</button>
      <button class="btn btn--ghost" data-action="rename" data-id="${escapeHtml(ds.id)}" data-name="${escapeHtml(ds.name || "Dataset")}">Rename</button>
      <button class="btn btn--ghost" data-action="delete" data-id="${escapeHtml(ds.id)}">Hapus</button>
    </td>`;
    els.datasetBody.appendChild(tr);
  });
}

function populateRecordFilter(rows) {
  const wilayahs = Array.from(new Set(rows.map((row) => toStr(row.WILAYAH)).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  const years = Array.from(
    new Set(rows.map((row) => getYearValue(row["TANGGAL AKSI"] || row.TANGGAL)).filter(Boolean))
  ).sort((a, b) => b.localeCompare(a));
  const current = els.filterWilayah.value;
  const currentMonth = els.filterBulan.value;
  const currentYear = els.filterTahun.value;
  els.filterWilayah.innerHTML = `<option value="">Semua Wilayah</option>`;
  wilayahs.forEach((wilayah) => {
    const opt = document.createElement("option");
    opt.value = wilayah;
    opt.textContent = wilayah;
    els.filterWilayah.appendChild(opt);
  });
  if (wilayahs.includes(current)) els.filterWilayah.value = current;

  els.filterBulan.innerHTML = `<option value="">Semua Bulan</option>`;
  months.forEach((month) => {
    const opt = document.createElement("option");
    opt.value = month;
    opt.textContent = getMonthLabel(month);
    els.filterBulan.appendChild(opt);
  });
  if (months.includes(currentMonth)) els.filterBulan.value = currentMonth;

  els.filterTahun.innerHTML = `<option value="">Semua Tahun</option>`;
  years.forEach((year) => {
    const opt = document.createElement("option");
    opt.value = year;
    opt.textContent = year;
    els.filterTahun.appendChild(opt);
  });
  if (years.includes(currentYear)) els.filterTahun.value = currentYear;
}

function getFilteredRecords() {
  const keyword = normalizeSearch(els.filterKeyword.value);
  const wilayah = toStr(els.filterWilayah.value);
  const tanggal = toStr(els.filterTanggal.value);
  const bulan = toStr(els.filterBulan.value);
  const tahun = toStr(els.filterTahun.value);
  return state.activeRecords.filter((row) => {
    if (wilayah && toStr(row.WILAYAH) !== wilayah) return false;
    const rowDate = toDateInputValue(row["TANGGAL AKSI"] || row.TANGGAL);
    const rowMonth = getMonthValue(row["TANGGAL AKSI"] || row.TANGGAL);
    const rowYear = getYearValue(row["TANGGAL AKSI"] || row.TANGGAL);
    if (tanggal && rowDate !== tanggal) return false;
    if (bulan && rowMonth !== bulan) return false;
    if (tahun && rowYear !== tahun) return false;
    if (!keyword) return true;
    const hay = normalizeSearch(
      [
        row.NO,
        row["TANGGAL AKSI"],
        row.TANGGAL,
        row.WAKTU,
        row.WILAYAH,
        row.LOKASI,
        row["KELOMPOK AKSI"],
        row.TUNTUTAN,
        row.RINGKASAN,
        row["GOOGLE MAPS"],
      ].join(" ")
    );
    return hay.includes(keyword);
  });
}

function renderRecordRows(rows) {
  els.recordBody.innerHTML = "";
  if (!rows.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="8" style="text-align:center;">Tidak ada data yang sesuai.</td>`;
    els.recordBody.appendChild(tr);
    return;
  }
  rows.forEach((row) => {
    const mapsUrl = safeHref(row["GOOGLE MAPS"]);
    const mapsCell = mapsUrl
      ? `<a class="btn btn--ghost" href="${escapeHtml(mapsUrl)}" target="_blank" rel="noreferrer">Buka</a>`
      : "—";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(formatDisplayDate(row["TANGGAL AKSI"] || row.TANGGAL))}</td><td>${escapeHtml(
      row.WILAYAH || "—"
    )}</td><td class="num">${escapeHtml(
      formatMassDisplay(row["JUMLAH MASSA"])
    )}</td><td>${escapeHtml(row.LOKASI || "—")}</td><td>${escapeHtml(
      row["KELOMPOK AKSI"] || "—"
    )}</td><td>${escapeHtml(row.TUNTUTAN || "—")}</td><td>${mapsCell}</td><td class="adminActions">
      <button class="btn btn--ghost" data-record-action="edit" data-id="${escapeHtml(row.id)}">Update</button>
      <button class="btn btn--ghost" data-record-action="delete" data-id="${escapeHtml(row.id)}">Hapus</button>
    </td>`;
    els.recordBody.appendChild(tr);
  });
}

function updatePagination(totalRecords, pageRecords) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / state.pageSize));
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  const start = totalRecords ? (state.currentPage - 1) * state.pageSize + 1 : 0;
  const end = totalRecords ? start + pageRecords.length - 1 : 0;
  els.recordSummary.textContent = `Menampilkan ${start}-${end} dari ${totalRecords} data`;
  els.pageInfo.textContent = `Halaman ${state.currentPage} dari ${totalPages}`;
  els.prevPageBtn.disabled = state.currentPage <= 1;
  els.nextPageBtn.disabled = state.currentPage >= totalPages;
}

function applyRecordFilters() {
  const filtered = getFilteredRecords();
  const totalPages = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  const startIndex = (state.currentPage - 1) * state.pageSize;
  const pageRows = filtered.slice(startIndex, startIndex + state.pageSize);
  renderRecordRows(pageRows);
  updatePagination(filtered.length, pageRows);
}

async function renderRecords() {
  const res = await apiFetch("/api/active/records");
  if (!res.ok) throw new Error(`Gagal memuat data (${res.status})`);
  const payload = await res.json();
  state.activeRecords = Array.isArray(payload.records) ? payload.records : [];
  state.currentPage = 1;
  populateRecordFilter(state.activeRecords);
  applyRecordFilters();
}

async function renderAll() {
  await Promise.all([renderDatasets(), renderRecords()]);
}

async function activateDataset(id) {
  const res = await apiFetch(`/api/datasets/${encodeURIComponent(id)}/activate`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gagal aktivasi (${res.status})`);
  }
  await renderAll();
  toast("Dataset aktif diperbarui.");
}

async function renameDataset(id, nextName) {
  if (!nextName) return;
  const res = await apiFetch(`/api/datasets/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: nextName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gagal rename (${res.status})`);
  }
  await renderAll();
  toast("Nama dataset diperbarui.");
}

async function deleteDataset(id) {
  const res = await apiFetch(`/api/datasets/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gagal hapus (${res.status})`);
  }
  await renderAll();
  toast("Dataset dihapus.");
}

async function submitManual() {
  const tanggal = toStr(els.mTanggal.value);
  const waktu = toStr(els.mWaktu.value);
  const wilayah = toStr(els.mWilayah.value);
  const lokasi = toStr(els.mLokasi.value);
  const kelompokAksi = toStr(els.mKelompokAksi.value);
  const tuntutan = toStr(els.mTuntutan.value);
  const ringkasan = toStr(els.mRingkasan.value);
  const estimasiMassa = toStr(els.mJumlahMassa.value);
  const googleMaps = normalizeGoogleMapsUrl(els.mGoogleMaps.value);

  if (!tanggal) throw new Error("TANGGAL wajib diisi.");
  if (!waktu) throw new Error("WAKTU wajib diisi.");
  if (!wilayah) throw new Error("WILAYAH wajib dipilih.");
  if (!isLikelyMass(estimasiMassa)) throw new Error("JUMLAH MASSA wajib diisi angka.");
  if (!lokasi) throw new Error("LOKASI wajib diisi.");
  if (!kelompokAksi) throw new Error("KELOMPOK AKSI wajib diisi.");
  if (!tuntutan) throw new Error("TUNTUTAN wajib diisi.");
  if (!ringkasan) throw new Error("RINGKASAN wajib diisi.");
  if (!googleMaps) throw new Error("GOOGLE MAPS wajib diisi dengan link Google Maps yang valid.");

  const payload = { tanggal, waktu, wilayah, lokasi, kelompokAksi, tuntutan, ringkasan, estimasiMassa, googleMaps };
  const isEdit = Boolean(state.editingRecordId);
  const url = isEdit ? `/api/records/${encodeURIComponent(state.editingRecordId)}` : "/api/records";
  const res = await apiFetch(url, {
    method: isEdit ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gagal simpan (${res.status})`);
  }
  const out = await res.json();
  resetManualForm();
  toast(isEdit ? "Data berhasil diperbarui." : out.mode === "updated" ? "Data lama ditemukan dan berhasil diperbarui." : "Data tersimpan di database.");
  await renderAll();
}

async function startEditRecord(id) {
  const res = await apiFetch("/api/active/records");
  if (!res.ok) throw new Error(`Gagal memuat data (${res.status})`);
  const payload = await res.json();
  const rows = Array.isArray(payload.records) ? payload.records : [];
  const row = rows.find((item) => item.id === id);
  if (!row) throw new Error("Record tidak ditemukan");
  state.editingRecordId = id;
  els.mTanggal.value = toDateInputValue(row["TANGGAL AKSI"] || row.TANGGAL);
  els.mWaktu.value = row.WAKTU || row["Waktu"] || "";
  els.mWilayah.value = row.WILAYAH || "";
  els.mJumlahMassa.value = row["JUMLAH MASSA"] == null ? "" : String(row["JUMLAH MASSA"]);
  els.mLokasi.value = row.LOKASI || "";
  els.mKelompokAksi.value = row["KELOMPOK AKSI"] || "";
  els.mTuntutan.value = row.TUNTUTAN || "";
  els.mRingkasan.value = row.RINGKASAN || "";
  els.mGoogleMaps.value = row["GOOGLE MAPS"] || "";
  els.mSubmit.textContent = "Simpan Perubahan";
  els.mCancelEdit.hidden = false;
  els.manualHint.textContent = `Mode edit data NO ${row.NO || "—"}.`;
  window.scrollTo({ top: 0, behavior: "smooth" });
  window.setTimeout(() => els.mTanggal.focus(), 250);
}

async function deleteRecord(id) {
  const res = await apiFetch(`/api/records/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Gagal hapus data (${res.status})`);
  }
  if (state.editingRecordId === id) resetManualForm();
  toast("Data berhasil dihapus.");
  await renderAll();
}

function wireEvents() {
  els.fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    try {
      await prepareFromFile(file);
    } catch (err) {
      toast(toStr(err?.message || err));
    }
  });

  els.loadSampleBtn.addEventListener("click", async () => {
    try {
      await runWithButtonLoading(els.loadSampleBtn, () => prepareSample(), "Memuat...");
    } catch (err) {
      toast(toStr(err?.message || err));
    }
  });

  els.sheetSelect.addEventListener("change", async () => {
    if (!state.pending || state.pending.type !== "xlsx") return;
    const wb = state.pending.workbook;
    const sheetName = els.sheetSelect.value;
    const XLSXRef = await ensureXLSX();
    const sheet = wb.Sheets[sheetName];
    const rowCount = sheet ? XLSXRef.utils.sheet_to_json(sheet, { defval: "", raw: false }).length : 0;
    state.pending.sheetName = sheetName;
    state.pending.rowCount = rowCount;
    els.importHint.textContent = `Excel siap diunggah: ${state.pending.sheetNames.length} sheet, ${rowCount} baris (sheet: ${sheetName || "—"}).`;
  });

  els.saveBtn.addEventListener("click", async () => {
    try {
      await runWithButtonLoading(els.saveBtn, () => savePending(), "Menyimpan...");
    } catch (err) {
      toast(toStr(err?.message || err));
    }
  });

  els.refreshBtn.addEventListener("click", async () => {
    try {
      await runWithButtonLoading(els.refreshBtn, () => renderAll(), "Memuat...");
      toast("Data admin diperbarui.");
    } catch (err) {
      toast(toStr(err?.message || err));
    }
  });
  els.logoutBtn.addEventListener("click", async () => {
    await runWithButtonLoading(els.logoutBtn, () => logout(), "Keluar...");
  });

  els.datasetBody.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("[data-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const id = btn.getAttribute("data-id");
    if (!id) return;
    try {
      if (action === "activate") {
        await runWithButtonLoading(btn, () => activateDataset(id), "Memuat...");
      }
      if (action === "rename") {
        const nextName = toStr(window.prompt("Nama dataset baru:", btn.getAttribute("data-name") || "Dataset"));
        if (!nextName) return;
        await runWithButtonLoading(btn, () => renameDataset(id, nextName), "Menyimpan...");
      }
      if (action === "delete") {
        const ok = window.confirm("Hapus dataset ini?");
        if (!ok) return;
        await runWithButtonLoading(btn, () => deleteDataset(id), "Menghapus...");
      }
    } catch (err) {
      toast(toStr(err?.message || err));
    }
  });

  els.recordBody.addEventListener("click", async (e) => {
    const btn = e.target?.closest?.("[data-record-action]");
    if (!btn) return;
    const action = btn.getAttribute("data-record-action");
    const id = btn.getAttribute("data-id");
    if (!id) return;
    try {
      if (action === "edit") {
        await runWithButtonLoading(btn, () => startEditRecord(id), "Memuat...");
      }
      if (action === "delete") {
        const ok = window.confirm("Hapus data ini?");
        if (!ok) return;
        await runWithButtonLoading(btn, () => deleteRecord(id), "Menghapus...");
      }
    } catch (err) {
      toast(toStr(err?.message || err));
    }
  });

  els.manualForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await runWithButtonLoading(els.mSubmit, () => submitManual(), state.editingRecordId ? "Menyimpan..." : "Menambah...");
    } catch (err) {
      toast(toStr(err?.message || err));
    }
  });

  els.mCancelEdit.addEventListener("click", async () => {
    await runWithButtonLoading(els.mCancelEdit, () => {
      resetManualForm();
    }, "Memuat...");
  });
  const handleFilterChange = () => {
    state.currentPage = 1;
    applyRecordFilters();
  };
  els.filterKeyword.addEventListener("input", handleFilterChange);
  els.filterWilayah.addEventListener("change", handleFilterChange);
  els.filterTanggal.addEventListener("change", handleFilterChange);
  els.filterBulan.addEventListener("change", handleFilterChange);
  els.filterTahun.addEventListener("change", handleFilterChange);
  els.clearFilterBtn.addEventListener("click", async () => {
    await runWithButtonLoading(els.clearFilterBtn, () => {
      els.filterKeyword.value = "";
      els.filterWilayah.value = "";
      els.filterTanggal.value = "";
      els.filterBulan.value = "";
      els.filterTahun.value = "";
      state.currentPage = 1;
      applyRecordFilters();
    }, "Memuat...");
  });
  els.prevPageBtn.addEventListener("click", async () => {
    if (state.currentPage <= 1) return;
    await runWithButtonLoading(els.prevPageBtn, () => {
      state.currentPage -= 1;
      applyRecordFilters();
    }, "Memuat...");
  });
  els.nextPageBtn.addEventListener("click", async () => {
    const totalPages = Math.max(1, Math.ceil(getFilteredRecords().length / state.pageSize));
    if (state.currentPage >= totalPages) return;
    await runWithButtonLoading(els.nextPageBtn, () => {
      state.currentPage += 1;
      applyRecordFilters();
    }, "Memuat...");
  });
}

wireEvents();
resetManualForm();
ensureAdminSession()
  .then(() => renderAll())
  .catch((e) => {
    if (!state.authChecked) return;
    toast(toStr(e?.message || e));
  });
