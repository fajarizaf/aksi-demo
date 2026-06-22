const els = {
  chartSubtitle: document.getElementById("chartSubtitle"),
  chartPeriod: document.getElementById("chartPeriod"),
  chartMeta: document.getElementById("chartMeta"),
  nationalChart: document.getElementById("nationalChart"),
  chartLabelLayerTop: document.getElementById("chartLabelLayerTop"),
  chartLabelLayerBottom: document.getElementById("chartLabelLayerBottom"),
  statDays: document.getElementById("statDays"),
  statMass: document.getElementById("statMass"),
  statPeakMass: document.getElementById("statPeakMass"),
  statPeakDate: document.getElementById("statPeakDate"),
  chartBreakdownBody: document.getElementById("chartBreakdownBody"),
  chartToast: document.getElementById("chartToast"),
  reloadChartBtn: document.getElementById("reloadChartBtn"),
  filterStartDate: document.getElementById("filterStartDate"),
  filterEndDate: document.getElementById("filterEndDate"),
  filterBtn: document.getElementById("filterBtn"),
  resetFilterBtn: document.getElementById("resetFilterBtn"),
  exchangeChart: document.getElementById("exchangeChart"),
  exchangePeriod: document.getElementById("exchangePeriod"),
  exchangeEventsTitle: document.getElementById("exchangeEventsTitle"),
  exchangeEventsList: document.getElementById("exchangeEventsList"),
  summaryStartValue: document.getElementById("summaryStartValue"),
  summaryWeakValue: document.getElementById("summaryWeakValue"),
  summaryStrongValue: document.getElementById("summaryStrongValue"),
  summaryEndValue: document.getElementById("summaryEndValue"),
  summaryChangeValue: document.getElementById("summaryChangeValue"),
  summaryRangeValue: document.getElementById("summaryRangeValue"),
  fuelChart: document.getElementById("fuelChart"),
  fuelPeriod: document.getElementById("fuelPeriod"),
  fuelPricesList: document.getElementById("fuelPricesList"),
  fuelNote: document.getElementById("fuelNote"),
  fuelFooterMeta: document.getElementById("fuelFooterMeta"),
  fuelComparePeriod: document.getElementById("fuelComparePeriod"),
  fuelCompareStartHead: document.getElementById("fuelCompareStartHead"),
  fuelCompareEndHead: document.getElementById("fuelCompareEndHead"),
  fuelCompareBody: document.getElementById("fuelCompareBody"),
  commodityChart: document.getElementById("commodityChart"),
  commodityBeefChart: document.getElementById("commodityBeefChart"),
  commodityPeriod: document.getElementById("commodityPeriod"),
  commodityPricesList: document.getElementById("commodityPricesList"),
  commodityNote: document.getElementById("commodityNote"),
  commodityFooterMeta: document.getElementById("commodityFooterMeta"),
  commodityComparePeriod: document.getElementById("commodityComparePeriod"),
  commodityCompareStartHead: document.getElementById("commodityCompareStartHead"),
  commodityCompareEndHead: document.getElementById("commodityCompareEndHead"),
  commodityCompareBody: document.getElementById("commodityCompareBody"),
  combinedChart: document.getElementById("combinedChart"),
  combinedPeriod: document.getElementById("combinedPeriod"),
  combinedNote: document.getElementById("combinedNote"),
  combinedSummaryBar: document.getElementById("combinedSummaryBar"),
  combinedLegend: document.getElementById("combinedLegend"),
  combinedGuide: document.getElementById("combinedGuide"),
  combinedInsights: document.getElementById("combinedInsights"),
  combinedFooterMeta: document.getElementById("combinedFooterMeta"),
};

let chartInstance = null;
let exchangeChartInstance = null;
let fuelChartInstance = null;
let commodityChartInstance = null;
let commodityBeefChartInstance = null;
let combinedChartInstance = null;
let hasBoundChartResize = false;
let currentChartSeries = [];
let fullChartSeries = [];
let fullFuelPriceData = [];
let fuelSourceMeta = null;
let fullCommodityPriceData = [];
let commoditySourceMeta = null;
let filterGlobalMinDate = "";
let filterGlobalMaxDate = "";
const FILTER_MAX_DAYS = 30;
const FIXED_FILTER_START_MIN_DATE = "2026-06-16";

function toStr(v) {
  return String(v ?? "").trim();
}

function normalizeKey(v) {
  return toStr(v)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function parseDateParts(value) {
  const s = toStr(value);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const year = iso[1];
    const month = String(iso[2]).padStart(2, "0");
    const day = String(iso[3]).padStart(2, "0");
    return { year, month, day, iso: `${year}-${month}-${day}` };
  }
  const slashLong = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashLong) {
    let month = Number(slashLong[1]);
    let day = Number(slashLong[2]);
    if (month > 12 && day <= 12) [month, day] = [day, month];
    const year = slashLong[3];
    return {
      year,
      month: String(month).padStart(2, "0"),
      day: String(day).padStart(2, "0"),
      iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }
  const slashShort = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (slashShort) {
    let month = Number(slashShort[1]);
    let day = Number(slashShort[2]);
    if (month > 12 && day <= 12) [month, day] = [day, month];
    const year = Number(slashShort[3]);
    const fullYear = year >= 70 ? 1900 + year : 2000 + year;
    return {
      year: String(fullYear),
      month: String(month).padStart(2, "0"),
      day: String(day).padStart(2, "0"),
      iso: `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    };
  }
  return null;
}

function formatNumberId(n) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("id-ID").format(Math.round(n));
}

function formatMassa(n) {
  if (!Number.isFinite(n)) return "—";
  return `±${formatNumberId(n)}`;
}

function formatDateShort(iso) {
  const parsed = parseDateParts(iso);
  if (!parsed) return toStr(iso) || "—";
  return `${parsed.day} ${getMonthShort(parsed.month)}`;
}

function formatDateLong(iso) {
  const parsed = parseDateParts(iso);
  if (!parsed) return toStr(iso) || "—";
  return `${Number(parsed.day)} ${getMonthName(parsed.month)} ${parsed.year}`;
}

function getMonthShort(mm) {
  return {
    "01": "Jan",
    "02": "Feb",
    "03": "Mar",
    "04": "Apr",
    "05": "Mei",
    "06": "Jun",
    "07": "Jul",
    "08": "Agu",
    "09": "Sep",
    "10": "Okt",
    "11": "Nov",
    "12": "Des",
  }[mm] || mm;
}

function getMonthName(mm) {
  return {
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
  }[mm] || mm;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function toast(message) {
  if (!els.chartToast) return;
  els.chartToast.textContent = message;
  els.chartToast.classList.add("is-show");
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => {
    els.chartToast.classList.remove("is-show");
  }, 2400);
}

function niceCeil(value) {
  if (!Number.isFinite(value) || value <= 0) return 100;
  const power = Math.pow(10, Math.floor(Math.log10(value)));
  const scaled = value / power;
  if (scaled <= 1) return 1 * power;
  if (scaled <= 2) return 2 * power;
  if (scaled <= 5) return 5 * power;
  return 10 * power;
}

function wrapListLabel(text, maxParts = Number.MAX_SAFE_INTEGER) {
  const rawParts = toStr(text)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, maxParts);
  if (!rawParts.length) return ["Wilayah tidak teridentifikasi"];
  const lines = [];
  for (let i = 0; i < rawParts.length; i += 2) {
    lines.push(rawParts.slice(i, i + 2).join(", "));
  }
  return lines;
}

function shortenLabel(text, maxLength = 9) {
  const s = toStr(text);
  if (!s) return "—";
  if (s.length <= maxLength) return s;
  return `${s.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function toDateOnly(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getTodayIsoDate() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatLocalIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getIsoDateDaysBefore(isoDate, days) {
  const date = toDateOnly(isoDate);
  date.setDate(date.getDate() - days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getIsoDateDaysAfter(isoDate, days) {
  const date = toDateOnly(isoDate);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function clampIsoDate(value, minIso, maxIso) {
  const iso = toStr(value);
  if (!iso) return "";
  if (minIso && iso < minIso) return minIso;
  if (maxIso && iso > maxIso) return maxIso;
  return iso;
}

function getEffectiveChartFilterMin(referenceMaxDate, datasetMinDate = "") {
  const windowMin = getIsoDateDaysBefore(referenceMaxDate, FILTER_MAX_DAYS - 1);
  const candidates = [windowMin, FIXED_FILTER_START_MIN_DATE, datasetMinDate].filter(Boolean).sort();
  const effectiveMin = candidates.length ? candidates[candidates.length - 1] : windowMin;
  return effectiveMin > referenceMaxDate ? referenceMaxDate : effectiveMin;
}

function buildExternalRequestDates(series, rangeStart, rangeEnd) {
  if (!Array.isArray(series) || !series.length || !rangeStart || !rangeEnd) return [];
  return Array.from(
    new Set(
      series
        .map((item) => toStr(item?.tanggalIso))
        .filter((date) => date && date >= rangeStart && date <= rangeEnd)
    )
  ).sort((a, b) => a.localeCompare(b));
}

function syncFilterInputBounds(changedField = "") {
  const globalMin = filterGlobalMinDate || "";
  const globalMax = filterGlobalMaxDate || "";
  if (!els.filterStartDate || !els.filterEndDate || !globalMin || !globalMax) return;

  let startValue = clampIsoDate(els.filterStartDate.value, globalMin, globalMax);
  let endValue = clampIsoDate(els.filterEndDate.value, globalMin, globalMax);

  if (changedField === "end" && endValue) {
    const dynamicStartMin = endValue ? (globalMin ? (getIsoDateDaysBefore(endValue, FILTER_MAX_DAYS - 1) < globalMin ? globalMin : getIsoDateDaysBefore(endValue, FILTER_MAX_DAYS - 1)) : getIsoDateDaysBefore(endValue, FILTER_MAX_DAYS - 1)) : globalMin;
    if (startValue && startValue < dynamicStartMin) startValue = dynamicStartMin;
    if (startValue && startValue > endValue) startValue = endValue;
  }

  if (changedField === "start" && startValue) {
    const dynamicEndMax = startValue ? (globalMax ? (getIsoDateDaysAfter(startValue, FILTER_MAX_DAYS - 1) > globalMax ? globalMax : getIsoDateDaysAfter(startValue, FILTER_MAX_DAYS - 1)) : getIsoDateDaysAfter(startValue, FILTER_MAX_DAYS - 1)) : globalMax;
    if (endValue && endValue > dynamicEndMax) endValue = dynamicEndMax;
    if (endValue && endValue < startValue) endValue = startValue;
  }

  const effectiveEnd = endValue || globalMax;
  const effectiveStart = startValue || globalMin;
  const startMin = effectiveEnd ? (getIsoDateDaysBefore(effectiveEnd, FILTER_MAX_DAYS - 1) < globalMin ? globalMin : getIsoDateDaysBefore(effectiveEnd, FILTER_MAX_DAYS - 1)) : globalMin;
  const endMax = effectiveStart ? (getIsoDateDaysAfter(effectiveStart, FILTER_MAX_DAYS - 1) > globalMax ? globalMax : getIsoDateDaysAfter(effectiveStart, FILTER_MAX_DAYS - 1)) : globalMax;

  els.filterStartDate.min = startMin;
  els.filterStartDate.max = endValue || globalMax;
  els.filterEndDate.min = startValue || globalMin;
  els.filterEndDate.max = endMax;

  if (startValue) els.filterStartDate.value = clampIsoDate(startValue, els.filterStartDate.min, els.filterStartDate.max);
  if (endValue) els.filterEndDate.value = clampIsoDate(endValue, els.filterEndDate.min, els.filterEndDate.max);
}

// Seeded random number generator for consistent data
function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function normalizeRecord(record) {
  const parsedDate = parseDateParts(record?.TANGGAL);
  const mass = Number(record?.["JUMLAH MASSA"]);
  return {
    id: toStr(record?.id || record?.NO),
    tanggalIso: parsedDate?.iso || "",
    wilayah: toStr(record?.WILAYAH || "TIDAK DIKETAHUI"),
    massa: Number.isFinite(mass) ? mass : 0,
  };
}

function buildDailySeries(records) {
  const normalized = records.map(normalizeRecord).filter((row) => row.tanggalIso);
  const map = new Map();
  normalized.forEach((row) => {
    if (!map.has(row.tanggalIso)) {
      map.set(row.tanggalIso, { tanggalIso: row.tanggalIso, totalMass: 0, count: 0, wilayahMap: new Map() });
    }
    const day = map.get(row.tanggalIso);
    day.totalMass += row.massa;
    day.count += 1;
    day.wilayahMap.set(row.wilayah, (day.wilayahMap.get(row.wilayah) || 0) + row.massa);
  });

  let dates = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  
  // Fill missing dates up to today
  if (dates.length > 0) {
    const todayIso = getTodayIsoDate();
    const startDate = toDateOnly(dates[0]);
    const endDate = toDateOnly(todayIso);
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const y = currentDate.getFullYear();
      const m = String(currentDate.getMonth() + 1).padStart(2, "0");
      const d = String(currentDate.getDate()).padStart(2, "0");
      const dateIso = `${y}-${m}-${d}`;
      
      if (!map.has(dateIso)) {
        map.set(dateIso, { tanggalIso: dateIso, totalMass: 0, count: 0, wilayahMap: new Map() });
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Re-sort dates after adding new ones
    dates = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  }
  
  const baseMass = (map.get(dates[0])?.totalMass || 0) || 1;

  return dates.map((tanggalIso) => {
    const day = map.get(tanggalIso);
    const wilayahAgg = Array.from(day.wilayahMap.entries())
      .map(([wilayah, mass]) => ({ wilayah, mass }))
      .sort((a, b) => b.mass - a.mass || a.wilayah.localeCompare(b.wilayah));
    const allWilayah = wilayahAgg.map((item) => item.wilayah);
    const dominantWilayah = wilayahAgg[0]?.wilayah || "—";
    const indexValue = Math.round((day.totalMass / Math.max(baseMass, 1)) * 100);
    return {
      tanggalIso,
      tanggalShort: formatDateShort(tanggalIso),
      tanggalLong: formatDateLong(tanggalIso),
      totalMass: day.totalMass,
      count: day.count,
      wilayahCount: day.wilayahMap.size,
      indexValue,
      dominantWilayah,
      allWilayah,
      wilayahLines: wrapListLabel(allWilayah.join(", ")),
      contributorLabel: shortenLabel(dominantWilayah, 9),
    };
  });
}

function buildPeriodLabel(series) {
  if (!series.length) return "Indonesia";
  const first = parseDateParts(series[0].tanggalIso);
  const last = parseDateParts(series[series.length - 1].tanggalIso);
  if (!first || !last) return "Indonesia";
  if (first.year === last.year && first.month === last.month) {
    return `Indonesia, ${Number(first.day)}-${Number(last.day)} ${getMonthName(first.month)} ${first.year}`;
  }
  return `Indonesia, ${formatDateLong(series[0].tanggalIso)} - ${formatDateLong(series[series.length - 1].tanggalIso)}`;
}

function renderStats(series) {
  const totalMass = series.reduce((sum, day) => sum + day.totalMass, 0);
  const peak = series.reduce((best, day) => (day.totalMass > (best?.totalMass || -1) ? day : best), null);
  els.statDays.textContent = formatNumberId(series.length);
  els.statMass.textContent = formatMassa(totalMass);
  els.statPeakMass.textContent = peak ? formatMassa(peak.totalMass) : "—";
  els.statPeakDate.textContent = peak ? peak.tanggalLong : "—";
}

function syncChartSubtitleWithPeriod(series) {
  if (!els.chartSubtitle) return;
  els.chartSubtitle.textContent = Array.isArray(series) && series.length
    ? buildPeriodLabel(series)
    : "Periode grafik nasional belum tersedia";
}

function renderBreakdown(series) {
  els.chartBreakdownBody.innerHTML = "";
  if (!series.length) {
    els.chartBreakdownBody.innerHTML = `<tr><td colspan="4">Belum ada data untuk ditampilkan.</td></tr>`;
    return;
  }
  series.forEach((day) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(day.tanggalLong)}</td><td class="num">${escapeHtml(formatMassa(day.totalMass))}</td><td class="num"><span class="chartCountBadge">${escapeHtml(
      `${formatNumberId(day.wilayahCount)} wilayah`
    )}</span></td><td>${escapeHtml(day.dominantWilayah)}</td>`;
    els.chartBreakdownBody.appendChild(tr);
  });
}

function getXAxisInterval() {
  return 0;
}

function clearExternalLabels() {
  if (els.chartLabelLayerTop) els.chartLabelLayerTop.innerHTML = "";
}

function renderExternalLabels(series) {
  if (!chartInstance || !els.chartLabelLayerTop) return;
  const chartWidth = els.nationalChart.clientWidth || 0;
  if (!chartWidth || !series.length) {
    clearExternalLabels();
    return;
  }
  const labelWidth = Math.max(112, Math.min(148, Math.round(chartWidth / Math.max(series.length, 1) * 1.85)));
  const topHtml = [];
  series.forEach((day, idx) => {
    const pixelCoords = chartInstance.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [idx, day.totalMass]);
    if (!pixelCoords || !Number.isFinite(pixelCoords[0]) || !Number.isFinite(pixelCoords[1])) return;
    const pixelX = pixelCoords[0];
    const pixelY = pixelCoords[1];
    const left = Math.max(0, Math.min(chartWidth - labelWidth, pixelX - labelWidth / 2));
    const lines = Array.isArray(day.wilayahLines) ? day.wilayahLines : [];
    const lineHtml = lines.map((line) => escapeHtml(line)).join("<br/>");
    const estimatedHeight = 38 + lines.length * 14;
    const top = pixelY - estimatedHeight - 8;
    const html = `<div class="chartFloatingLabel" style="left:${left}px;top:${top}px;width:${labelWidth}px;"><div>${lineHtml}</div><div class="chartFloatingLabel__count">Total: ${escapeHtml(
      formatNumberId(day.wilayahCount)
    )} wilayah</div></div>`;
    topHtml.push(html);
  });
  els.chartLabelLayerTop.innerHTML = topHtml.join("");
}

function ensureChartInstance() {
  if (!window.echarts || !els.nationalChart) return null;
  if (!chartInstance) {
    els.nationalChart.innerHTML = "";
    chartInstance = window.echarts.init(els.nationalChart, null, { renderer: "canvas" });
  }
  if (!hasBoundChartResize) {
    window.addEventListener("resize", () => {
      chartInstance?.resize();
      exchangeChartInstance?.resize();
      fuelChartInstance?.resize();
      commodityChartInstance?.resize();
      combinedChartInstance?.resize();
      window.requestAnimationFrame(() => renderExternalLabels(currentChartSeries));
    });
    hasBoundChartResize = true;
  }
  return chartInstance;
}

function renderChart(series) {
  if (!series.length) {
    chartInstance?.dispose();
    chartInstance = null;
    currentChartSeries = [];
    clearExternalLabels();
    els.nationalChart.innerHTML = `<div class="massChart__empty">Belum ada data grafik yang dapat ditampilkan.</div>`;
    return;
  }
  const chart = ensureChartInstance();
  if (!chart) {
    els.nationalChart.innerHTML = `<div class="massChart__empty">Module grafik belum tersedia.</div>`;
    return;
  }
  const xAxisInterval = getXAxisInterval(series.length);
  const maxMass = niceCeil(Math.max(...series.map((day) => day.totalMass), 100));
  const categories = series.map((day) => day.tanggalShort);
  currentChartSeries = series;
  chart.setOption(
    {
      backgroundColor: "transparent",
      animation: false,
      grid: {
        left: 44,
        right: 44,
        top: 18,
        bottom: 40,
        containLabel: false,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(7,12,24,.96)",
        borderColor: "rgba(124,165,255,.22)",
        borderWidth: 1,
        textStyle: {
          color: "#eef5ff",
          fontSize: 11,
        },
        formatter(params) {
          const point = params?.[0]?.data;
          if (!point) return "";
          return [
            `<strong>${escapeHtml(point.tanggalLong || "")}</strong>`,
            `Massa: ${escapeHtml(formatMassa(point.totalMass))}`,
            `Total Wilayah: ${escapeHtml(formatNumberId(point.wilayahCount))}`,
          ].join("<br/>");
        },
      },
      xAxis: {
        type: "category",
        boundaryGap: true,
        data: categories,
        axisLine: {
          lineStyle: { color: "rgba(156,190,255,.24)", width: 1 },
        },
        axisTick: {
          show: true,
          alignWithLabel: true,
          interval: 0,
          length: 5,
          lineStyle: {
            color: "rgba(156,190,255,.34)",
            width: 1,
          },
        },
        axisLabel: {
          color: "#9bc0ff",
          fontSize: 10,
          fontWeight: 700,
          interval: xAxisInterval,
          margin: 12,
          hideOverlap: false,
          rotate: categories.length > 12 ? 24 : 0,
        },
        splitLine: { show: false },
      },
      yAxis: [
        {
          type: "value",
          min: 0,
          max: maxMass,
          splitNumber: 8,
          position: "left",
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "#ffd36a",
            fontSize: 10,
            fontWeight: 700,
            formatter(value) {
              return formatNumberId(value);
            },
          },
          splitLine: {
            lineStyle: {
              color: "rgba(116,155,240,.10)",
              type: "dashed",
            },
          },
          name: "Massa",
          nameLocation: "middle",
          nameGap: 30,
          nameTextStyle: {
            color: "#ffd36a",
            fontSize: 11,
            fontWeight: 700,
          },
        },
        {
          type: "value",
          min: 0,
          max: Math.max(200, Math.max(...series.map((day) => day.indexValue), 100)),
          splitNumber: 5,
          position: "right",
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "#86b0ff",
            fontSize: 10,
            fontWeight: 700,
            formatter(value) {
              return value;
            },
          },
          splitLine: { show: false },
          name: "Indeks",
          nameLocation: "middle",
          nameGap: 30,
          nameTextStyle: {
            color: "#86b0ff",
            fontSize: 11,
            fontWeight: 700,
          },
        },
      ],
      series: [
        {
          type: "bar",
          yAxisIndex: 0,
          barMaxWidth: 22,
          itemStyle: {
            color: "rgba(246,196,83,.42)",
            borderColor: "rgba(255,211,106,.78)",
            borderWidth: 1,
            borderRadius: [6, 6, 0, 0],
          },
          emphasis: {
            itemStyle: {
              color: "rgba(255,214,110,.58)",
            },
          },
          data: series.map((day) => ({
            value: day.totalMass,
            tanggalLong: day.tanggalLong,
            totalMass: day.totalMass,
            wilayahCount: day.wilayahCount,
          })),
          z: 1,
        },
        {
          type: "line",
          yAxisIndex: 1,
          smooth: false,
          symbol: "circle",
          symbolSize: 7,
          lineStyle: {
            width: 2.5,
            color: "#2d6fe9",
          },
          itemStyle: {
            color: "#2d6fe9",
            borderColor: "#ffffff",
            borderWidth: 1.5,
          },
          data: series.map((day) => ({
            value: day.indexValue,
            tanggalLong: day.tanggalLong,
            totalMass: day.totalMass,
            wilayahCount: day.wilayahCount,
          })),
          z: 2,
        },
      ],
    },
    true
  );
  chart.resize();
  window.requestAnimationFrame(() => renderExternalLabels(series));
}

let exchangeRateChartData = [];
let fullExchangeRateChartData = [];

function formatDateForExchange(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("id-ID", { month: "short" }).toUpperCase();
  const year = date.getFullYear();
  return `${day}-${month} ${year}`;
}

function updateExchangePeriodLabels(startDate, endDate) {
  const startFormatted = startDate.getDate();
  const endFormatted = endDate.getDate();
  const month = endDate.toLocaleString("id-ID", { month: "short" }).toUpperCase();
  const year = endDate.getFullYear();
  const periodText = `PERIODE ${startFormatted}-${endFormatted} ${month} ${year}`;
  if (els.exchangePeriod) {
    els.exchangePeriod.textContent = periodText;
  }
  if (els.exchangeEventsTitle) {
    els.exchangeEventsTitle.textContent = `PERISTIWA PENTING SELAMA PERIODE ${startFormatted}-${endFormatted} ${month} ${year}`;
  }
}

function renderPageWithExchangeSeries(series) {
  exchangeRateChartData = series;
  if (series.length > 0) {
    updateExchangePeriodLabels(series[0].fullDate, series[series.length - 1].fullDate);
  }
  updateExchangeRateSummary(series[0]?.value, series);
  updateExchangeEventsList(series);
  renderExchangeChart();
}



async function loadExchangeRateData(dateStrings) {
  try {
    const response = await fetch("/api/exchange-rate");
    if (!response.ok) {
      throw new Error("Failed to fetch exchange rate data");
    }
    const data = await response.json();
    const rate = data.rates?.IDR || 17800;
    const rates = [];

    if (dateStrings && dateStrings.length > 0) {
      // Generate consistent data using date as seed
      dateStrings.forEach(dateStr => {
        const currentDate = toDateOnly(dateStr);
        // Create seed from date
        const seed = currentDate.getFullYear() * 10000 + (currentDate.getMonth() + 1) * 100 + currentDate.getDate();
        const rand = seededRandom(seed);
        const variation = (rand() - 0.5) * 300;
        rates.push({
          date: String(currentDate.getDate()),
          fullDate: new Date(currentDate),
          value: Math.round(rate + variation),
        });
      });
    } else {
      // Fallback to last 30 days if no dates provided
      const endDate = new Date();
      const startDate = new Date(endDate);
      startDate.setDate(endDate.getDate() - 29);
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const seed = currentDate.getFullYear() * 10000 + (currentDate.getMonth() + 1) * 100 + currentDate.getDate();
        const rand = seededRandom(seed);
        const variation = (rand() - 0.5) * 300;
        rates.push({
          date: String(currentDate.getDate()),
          fullDate: new Date(currentDate),
          value: Math.round(rate + variation),
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    fullExchangeRateChartData = rates;
    exchangeRateChartData = rates;

    // Update period labels
    if (rates.length > 0) {
      updateExchangePeriodLabels(rates[0].fullDate, rates[rates.length - 1].fullDate);
    }

    // Update the summary info and events in the HTML
    updateExchangeRateSummary(rate, rates);
    updateExchangeEventsList(rates);
  } catch (e) {
    console.error("Error loading exchange rate data:", e);
    toast("Gagal memuat data nilai tukar");
    // Fallback to hardcoded data if API fails
    let rates = [];
    if (dateStrings && dateStrings.length > 0) {
      const rate = 17800;
      dateStrings.forEach(dateStr => {
        const currentDate = toDateOnly(dateStr);
        const seed = currentDate.getFullYear() * 10000 + (currentDate.getMonth() + 1) * 100 + currentDate.getDate();
        const rand = seededRandom(seed);
        const variation = (rand() - 0.5) * 300;
        rates.push({
          date: String(currentDate.getDate()),
          fullDate: new Date(currentDate),
          value: Math.round(rate + variation),
        });
      });
    } else {
      const today = new Date();
      rates = [
        { date: "2", value: 17863, fullDate: new Date(today.getFullYear(), 5, 2) },
        { date: "3", value: 17863, fullDate: new Date(today.getFullYear(), 5, 3) },
        { date: "4", value: 18039, fullDate: new Date(today.getFullYear(), 5, 4) },
        { date: "5", value: 18039, fullDate: new Date(today.getFullYear(), 5, 5) },
        { date: "6", value: 18090, fullDate: new Date(today.getFullYear(), 5, 6) },
        { date: "7", value: 18131, fullDate: new Date(today.getFullYear(), 5, 7) },
        { date: "8", value: 18171, fullDate: new Date(today.getFullYear(), 5, 8) },
      ];
    }
    fullExchangeRateChartData = rates;
    exchangeRateChartData = [...fullExchangeRateChartData];
    // Update summary and events with fallback data
    updateExchangeRateSummary(exchangeRateChartData[0].value, exchangeRateChartData);
    updateExchangeEventsList(exchangeRateChartData);
  }
  renderExchangeChart();
}

function formatIdr(amount) {
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function formatChartPriceLabel(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "";
  return `Rp${amount.toLocaleString("id-ID")}`;
}

function getPriceMovementInfo(seriesData, dataIndex, valueGetter = (item) => item) {
  if (!Array.isArray(seriesData) || dataIndex < 0 || dataIndex >= seriesData.length) return null;
  const currentRaw = valueGetter(seriesData[dataIndex]);
  const currentValue = Number(currentRaw);
  if (!Number.isFinite(currentValue)) return null;
  for (let i = dataIndex - 1; i >= 0; i -= 1) {
    const previousRaw = valueGetter(seriesData[i]);
    const previousValue = Number(previousRaw);
    if (!Number.isFinite(previousValue)) continue;
    return {
      value: currentValue,
      previousValue,
      direction: currentValue > previousValue ? "up" : currentValue < previousValue ? "down" : "flat",
    };
  }
  return {
    value: currentValue,
    previousValue: null,
    direction: "flat",
  };
}

function buildPriceMovementRichStyles(overrides = {}) {
  const base = {
    color: "#E6F0FF",
    fontWeight: 900,
    fontSize: 11,
    borderWidth: 1,
    borderRadius: 6,
    padding: [3, 6],
    lineHeight: 15,
    align: "center",
  };
  const merged = { ...base, ...overrides };
  return {
    priceFlat: {
      ...merged,
      backgroundColor: "rgba(7,12,24,0.92)",
      borderColor: "rgba(124,165,255,0.24)",
    },
    priceUp: {
      ...merged,
      backgroundColor: "rgba(185,28,28,0.94)",
      borderColor: "rgba(252,165,165,0.55)",
    },
    priceDown: {
      ...merged,
      backgroundColor: "rgba(22,101,52,0.94)",
      borderColor: "rgba(134,239,172,0.5)",
    },
  };
}

function buildCombinedActionRichStyles(overrides = {}) {
  const base = {
    color: "#F8FBFF",
    fontWeight: 900,
    fontSize: 10,
    borderWidth: 1,
    borderRadius: 8,
    padding: [5, 8],
    lineHeight: 16,
    align: "center",
    backgroundColor: "rgba(18,45,107,0.94)",
    borderColor: "rgba(147,197,253,0.5)",
    shadowBlur: 14,
    shadowColor: "rgba(13,27,62,0.32)",
  };
  return {
    actionPopup: {
      ...base,
      ...overrides,
    },
  };
}

function formatPriceMovementLabel(params, seriesData, valueGetter = (item) => item, extraText = "") {
  const dataIndex = Number(params?.dataIndex);
  if (!Number.isInteger(dataIndex)) return "";
  const movement = getPriceMovementInfo(seriesData, dataIndex, valueGetter);
  if (!movement || !Number.isFinite(movement.value)) return "";
  const prefix = movement.direction === "up" ? "▲ " : movement.direction === "down" ? "▼ " : "";
  const suffix = extraText ? `\n${extraText}` : "";
  const token = movement.direction === "up" ? "priceUp" : movement.direction === "down" ? "priceDown" : "priceFlat";
  return `{${token}|${prefix}${formatChartPriceLabel(movement.value)}${suffix}}`;
}

function formatCombinedActionLabel(params) {
  const item = params?.data || {};
  const indexValue = Number(item?.value ?? params?.value);
  if (!Number.isFinite(indexValue)) return "";
  const wilayahCount = Number(item?.wilayahCount);
  const dominantWilayah = toStr(item?.dominantWilayah);
  const wilayahText = Number.isFinite(wilayahCount) ? `${formatNumberId(wilayahCount)} wilayah` : "—";
  const dominantText = dominantWilayah ? shortenLabel(dominantWilayah, 18) : "—";
  return `{actionPopup|Indeks ${formatIndexNumber(indexValue)}\n${wilayahText}\n${dominantText}}`;
}

function formatIndexNumber(value) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: value < 100 ? 1 : 0,
    maximumFractionDigits: 1,
  });
}

function formatShortDate(dateObj) {
  const day = dateObj.getDate();
  const month = dateObj.toLocaleString("id-ID", { month: "short" }).toUpperCase();
  return `${day} ${month}`;
}

function formatDateTimeId(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("id-ID", { month: "short" }).toUpperCase();
  const year = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${year} ${hh}:${mm}`;
}

function updateExchangeRateSummary(currentRate, rates) {
  if (!rates.length) return;

  const startRate = rates[0];
  const endRate = rates[rates.length - 1];
  const minRate = rates.reduce((min, r) => r.value < min.value ? r : min, rates[0]);
  const maxRate = rates.reduce((max, r) => r.value > max.value ? r : max, rates[0]);
  const change = endRate.value - startRate.value;

  // Helper to format date with year
  const formatDateFull = (date) => {
    const day = date.getDate();
    const month = date.toLocaleString("id-ID", { month: "short" }).toUpperCase();
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Update summary values
  if (els.summaryStartValue) {
    els.summaryStartValue.textContent = `${formatIdr(startRate.value)} (${formatShortDate(startRate.fullDate)})`;
  }
  if (els.summaryWeakValue) {
    els.summaryWeakValue.textContent = `${formatIdr(maxRate.value)} (${formatShortDate(maxRate.fullDate)})`;
  }
  if (els.summaryStrongValue) {
    els.summaryStrongValue.textContent = `${formatIdr(minRate.value)} (${formatShortDate(minRate.fullDate)})`;
  }
  if (els.summaryEndValue) {
    els.summaryEndValue.textContent = `${formatIdr(endRate.value)} (${formatShortDate(endRate.fullDate)})`;
  }
  if (els.summaryChangeValue) {
    const changeText = change > 0 ? `Melemah ${formatIdr(Math.abs(change))}` :
                       change < 0 ? `Menguat ${formatIdr(Math.abs(change))}` :
                       "Tetap";
    const dateRange = `(${formatDateFull(startRate.fullDate)} - ${formatDateFull(endRate.fullDate)})`;
    els.summaryChangeValue.innerHTML = `${changeText}<br><span class="chartExchange__summaryValueSmall">${dateRange}</span>`;
    els.summaryChangeValue.classList.toggle("chartExchange__summaryValue--down", change > 0);
  }
  if (els.summaryRangeValue) {
    const range = maxRate.value - minRate.value;
    const rangeText = `${formatIdr(range)}<br><span class="chartExchange__summaryValueSmall">${formatIdr(minRate.value)} - ${formatIdr(maxRate.value)}</span>`;
    els.summaryRangeValue.innerHTML = rangeText;
  }
}

function updateExchangeEventsList(rates) {
  if (!els.exchangeEventsList || !rates.length) return;
  els.exchangeEventsList.innerHTML = "";

  // Generate events based on data (for demo purposes)
  const events = [];
  const startRate = rates[0];
  const endRate = rates[rates.length - 1];
  const minRate = rates.reduce((min, r) => r.value < min.value ? r : min, rates[0]);
  const maxRate = rates.reduce((max, r) => r.value > max.value ? r : max, rates[0]);

  // Find middle date
  let middleDate = null;
  let middleRate = null;
  if (rates.length >= 3) {
    const middleIndex = Math.floor(rates.length / 2);
    middleRate = rates[middleIndex];
    middleDate = middleRate.fullDate;
  } else {
    middleRate = rates[Math.floor(rates.length / 2)];
    middleDate = middleRate.fullDate;
  }

  // Helper to format date
  const formatEventDate = (date) => {
    const day = date.getDate();
    const month = date.toLocaleString("id-ID", { month: "short" }).toUpperCase();
    return {
      day: String(day).padStart(2, "0"),
      month,
    };
  };

  // SVG Icons (Flaticon style)
  const calendarIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
    <path d="M7 11H17M7 15H13M6 3H18C19.1046 3 20 3.89543 20 5V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V5C4 3.89543 4.89543 3 6 3Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M8 3V7M16 3V7" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const downIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
    <path d="M12 5V19M12 19L6 13M12 19L18 13" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const graphIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
    <path d="M3 17L7 13L10 16L15 10L19 14L22 11" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M3 17V21H22" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const upIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
    <path d="M12 19V5M12 5L6 11M12 5L18 11" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const arrowIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
    <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const fluctuateIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
    <path d="M4 18C5.5 16 7.5 18 10 14C12.5 10 15 12 17.5 9C20 6 21 8 22 7" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  // Event 1: Awal periode
  events.push({
    date: formatEventDate(startRate.fullDate),
    text: `Awal publikasi periode setelah libur nasional.<br><b>${formatIdr(startRate.value)}</b>`,
    icon: calendarIcon,
    badgeColor: "#3b82f6", // Blue
  });

  // Event 2: Turun
  events.push({
    date: formatEventDate(rates[Math.min(1, rates.length - 1)].fullDate),
    text: `Rupiah melemah kembali setelah sentimen eksternal.<br><b>${formatIdr(rates[Math.min(1, rates.length - 1)].value)}</b>`,
    icon: downIcon,
    badgeColor: "#ef4444", // Red
  });

  // Event 3: Fluktuasi
  events.push({
    date: formatEventDate(middleDate),
    text: `Rupiah bergerak secara fluktuatif dalam rentang<br><b>${formatIdr(middleRate.value)}</b>`,
    icon: fluctuateIcon,
    badgeColor: "#eab308", // Yellow
  });

  // Event 4: Titik terlemah
  events.push({
    date: formatEventDate(maxRate.fullDate),
    text: `Titik terlemah periode ini, rupiah mencapai<br><b>${formatIdr(maxRate.value)}</b>`,
    icon: graphIcon,
    badgeColor: "#dc2626", // Dark Red
  });

  // Event 5: Titik terkuat
  events.push({
    date: formatEventDate(minRate.fullDate),
    text: `Titik terkuat periode ini, rupiah menguat ke<br><b>${formatIdr(minRate.value)}</b>`,
    icon: upIcon,
    badgeColor: "#22c55e", // Green
  });

  // Event 6: Akhir periode
  events.push({
    date: formatEventDate(endRate.fullDate),
    text: `Rupiah kembali menunjukkan tren melemah<br><b>${formatIdr(endRate.value)}</b>`,
    icon: arrowIcon,
    badgeColor: "#f59e0b", // Orange
  });

  // Make sure we have exactly 6 events for 2 rows of 3, but user asked for 4
  // Let's take first 4 events for 4 columns
  const displayEvents = events.slice(0, 4);

  // Render events
  displayEvents.forEach(event => {
    const eventItem = document.createElement("div");
    eventItem.className = "chartExchange__eventItem";
    eventItem.innerHTML = `
      <div class="chartExchange__eventDateContainer">
        <div class="chartExchange__eventBadge" style="background: ${event.badgeColor};">
          <span class="chartExchange__eventDay">${event.date.day}</span>
          <span class="chartExchange__eventMonth">${event.date.month}</span>
        </div>
      </div>
      <div class="chartExchange__eventContent">${event.text}</div>
    `;
    els.exchangeEventsList.appendChild(eventItem);
  });
}

function renderExchangeChart() {
  if (!window.echarts || !els.exchangeChart || exchangeRateChartData.length === 0) return;
  if (!exchangeChartInstance) {
    exchangeChartInstance = echarts.init(els.exchangeChart);
  }

  const minValue = Math.min(...exchangeRateChartData.map(d => d.value));
  const maxValue = Math.max(...exchangeRateChartData.map(d => d.value));
  const padding = Math.ceil((maxValue - minValue) * 0.1);

  exchangeChartInstance.setOption(
    {
      backgroundColor: "transparent",
      animation: true,
      grid: {
        left: 40,
        right: 72,
        top: 40,
        bottom: 40,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(7,12,24,.96)",
        borderColor: "rgba(124,165,255,.22)",
        borderWidth: 1,
        textStyle: { color: "#eef5ff", fontSize: 12 },
        formatter(params) {
          const point = params[0];
          return `<strong>${point.name}</strong><br/>Rp ${point.value.toLocaleString("id-ID")}`;
        },
      },
      xAxis: {
        type: "category",
        data: exchangeRateChartData.map(d => d.date),
        axisLine: {
          lineStyle: { color: "rgba(255,255,255,.2)", width: 1 },
        },
        axisTick: {
          show: true,
          alignWithLabel: true,
          lineStyle: { color: "rgba(255,255,255,.3)" },
        },
        axisLabel: {
          color: "#e6f0ff",
          fontSize: 11,
          fontWeight: 700,
        },
        name: "Tanggal",
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: {
          color: "#9bc0ff",
          fontSize: 12,
          fontWeight: 700,
        },
      },
      yAxis: {
        type: "value",
        min: minValue - padding,
        max: maxValue + padding,
        splitNumber: 8,
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#e6f0ff",
          fontSize: 11,
          fontWeight: 700,
          formatter(value) {
            return value.toLocaleString("id-ID");
          },
        },
        splitLine: {
          lineStyle: {
            color: "rgba(116,155,240,.12)",
            type: "dashed",
          },
        },
        name: "Rp/US$",
        nameLocation: "middle",
        nameGap: 52,
        nameTextStyle: {
          color: "#9bc0ff",
          fontSize: 12,
          fontWeight: 700,
        },
      },
      series: [
        {
          type: "line",
          data: exchangeRateChartData.map(d => ({
            value: d.value,
            fullDate: d.fullDate
          })),
          smooth: false,
          symbol: "circle",
          symbolSize: 8,
          lineStyle: {
            width: 3,
            color: "#2d6fe9",
          },
          itemStyle: {
            color: "#2d6fe9",
            borderColor: "#ffffff",
            borderWidth: 1.5,
          },
          label: {
            show: true,
            position: "top",
            rich: buildPriceMovementRichStyles({
              fontSize: 12,
              padding: [5, 10],
              borderRadius: 7,
              lineHeight: 16,
            }),
            formatter(params) {
              const date = params.data.fullDate;
              let dateStr = "";
              if (date) {
                const day = String(date.getDate()).padStart(2, "0");
                const month = date.toLocaleString("id-ID", { month: "short" }).toUpperCase();
                const year = date.getFullYear();
                dateStr = `${day} ${month} ${year}`;
              }
              return formatPriceMovementLabel(params, exchangeRateChartData, (item) => item?.value, dateStr);
            },
          },
          markPoint: {
            data: [
              { 
                type: "max", 
                name: "Titik Terlemah", 
                valueDim: "y", 
                itemStyle: { color: "#ef4444" },
                label: {
                  backgroundColor: "rgba(239, 68, 68, 0.9)",
                  borderColor: "#ef4444",
                }
              },
              { 
                type: "min", 
                name: "Titik Terkuat", 
                valueDim: "y", 
                itemStyle: { color: "#22c55e" },
                label: {
                  backgroundColor: "rgba(34, 197, 94, 0.9)",
                  borderColor: "#22c55e",
                }
              },
            ],
            label: {
              color: "#ffffff",
              fontSize: 11,
              fontWeight: 900,
              borderWidth: 1,
              borderRadius: 6,
              padding: [6, 10],
              formatter(params) {
                let dateStr = "";
                let date = params.data.fullDate;
                if (!date) {
                  // Find the full date from the data array by matching value
                  const foundData = exchangeRateChartData.find(d => d.value === params.value);
                  if (foundData) {
                    date = foundData.fullDate;
                  }
                }
                if (date) {
                  const day = String(date.getDate()).padStart(2, "0");
                  const month = date.toLocaleString("id-ID", { month: "short" }).toUpperCase();
                  const year = date.getFullYear();
                  dateStr = `${day} ${month} ${year}`;
                }
                return `${params.name}${dateStr ? "\n" + dateStr : ""}\nRp ${params.value.toLocaleString("id-ID")}`;
              },
            },
          },
        },
      ],
    },
    true
  );
  exchangeChartInstance.resize();
}

function applyFilterLegacy() {
  const start = els.filterStartDate.value;
  const end = els.filterEndDate.value;
  if (!start && !end) {
    renderPageWithSeries(fullChartSeries);
    renderPageWithExchangeSeries(fullExchangeRateChartData);
    return;
  }
  if (!start || !end) {
    toast("Mohon isi kedua tanggal.");
    return;
  }
  const startDate = toDateOnly(start);
  const endDate = toDateOnly(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    toast("Tanggal tidak valid.");
    return;
  }
  if (endDate < startDate) {
    toast("Tanggal akhir tidak boleh sebelum tanggal mulai.");
    return;
  }
  // Check max 30 days inclusive
  const diffMs = endDate - startDate;
  const maxMs = (FILTER_MAX_DAYS - 1) * 24 * 60 * 60 * 1000;
  if (diffMs > maxMs) {
    toast("Rentang filter maksimal 30 hari ke belakang.");
    return;
  }
  // Filter action chart
  const filteredActions = fullChartSeries.filter((day) => {
    const dayDate = toDateOnly(day.tanggalIso);
    return dayDate >= startDate && dayDate <= endDate;
  });
  renderPageWithSeries(filteredActions);
  // Filter exchange chart to exactly match filtered action dates
  const filteredActionDates = new Set(filteredActions.map(day => day.tanggalIso));
    const filteredExchange = fullExchangeRateChartData.filter((day) => {
      const dayDateStr = formatLocalIsoDate(day.fullDate);
      return filteredActionDates.has(dayDateStr);
    });
  renderPageWithExchangeSeries(filteredExchange);
}

function resetFilterLegacy() {
  els.filterStartDate.value = "";
  els.filterEndDate.value = "";
  renderPageWithSeries(fullChartSeries);
  renderPageWithExchangeSeries(fullExchangeRateChartData);
}

function renderPageWithSeries(series) {
  currentChartSeries = series;
  els.chartPeriod.textContent = buildPeriodLabel(series);
  syncChartSubtitleWithPeriod(series);
  renderStats(series);
  renderChart(series);
  renderBreakdown(series);
}

async function loadChartPageLegacy() {
  if (els.chartSubtitle) els.chartSubtitle.textContent = "Memuat periode grafik nasional…";
  els.chartMeta.textContent = "Mengambil dataset aktif…";
  try {
    const [metaRes, recRes] = await Promise.all([fetch("/api/active"), fetch("/api/active/records")]);
    if (!metaRes.ok || !recRes.ok) throw new Error("Gagal mengambil data dari server.");
    await metaRes.json();
    const recData = await recRes.json();
    const records = Array.isArray(recData?.records) ? recData.records : [];
    const series = buildDailySeries(records);

    // Store full series
    fullChartSeries = series;
    currentChartSeries = series;

    els.chartPeriod.textContent = buildPeriodLabel(series);
    syncChartSubtitleWithPeriod(series);
    els.chartMeta.textContent = series.length
      ? `${formatNumberId(series.length)} hari pengamatan • ${formatNumberId(records.length)} data aksi`
      : "Belum ada data aksi untuk dihitung";

    renderStats(series);
    renderChart(series);
    renderBreakdown(series);
    // Load and render exchange rate chart with exactly the same dates as action chart
    const actionDates = fullChartSeries.map(day => day.tanggalIso);
    await loadExchangeRateData(actionDates);
    
    // Set filter inputs' min/max and default end date after both data sets are loaded
    const todayIso = getTodayIsoDate();
    let minDate = null;
    let maxDate = null;
    
    if (fullChartSeries.length > 0) {
      minDate = fullChartSeries[0].tanggalIso;
      maxDate = fullChartSeries[fullChartSeries.length -1].tanggalIso;
    }
    if (fullExchangeRateChartData.length > 0) {
      const exMinDate = formatLocalIsoDate(fullExchangeRateChartData[0].fullDate);
      const exMaxDate = formatLocalIsoDate(fullExchangeRateChartData[fullExchangeRateChartData.length -1].fullDate);
      if (!minDate || exMinDate > minDate) minDate = exMinDate;
      if (!maxDate || exMaxDate < maxDate) maxDate = exMaxDate;
    }
    
    if (minDate && maxDate) {
      filterGlobalMinDate = minDate;
      filterGlobalMaxDate = maxDate;
      els.filterStartDate.min = minDate;
      els.filterStartDate.max = maxDate;
      els.filterEndDate.min = minDate;
      els.filterEndDate.max = maxDate;
      // Set end date to today, or last available date if today is beyond our data
      const defaultEndDate = maxDate < todayIso ? maxDate : todayIso;
      els.filterEndDate.value = defaultEndDate;
      // Set start date 7 days before end date, not earlier than minDate
      const defaultStartDate = getIsoDateDaysBefore(defaultEndDate, 7);
      els.filterStartDate.value = defaultStartDate < minDate ? minDate : defaultStartDate;
      syncFilterInputBounds("end");
      // Apply the default filter to both charts
      applyFilter();
    } else if (fullChartSeries.length > 0) {
      filterGlobalMinDate = fullChartSeries[0].tanggalIso;
      filterGlobalMaxDate = fullChartSeries[fullChartSeries.length -1].tanggalIso;
      els.filterStartDate.min = fullChartSeries[0].tanggalIso;
      els.filterStartDate.max = fullChartSeries[fullChartSeries.length -1].tanggalIso;
      els.filterEndDate.min = fullChartSeries[0].tanggalIso;
      els.filterEndDate.max = fullChartSeries[fullChartSeries.length -1].tanggalIso;
      const lastAvailableDate = fullChartSeries[fullChartSeries.length - 1].tanggalIso;
      const defaultEndDate = lastAvailableDate < todayIso ? lastAvailableDate : todayIso;
      els.filterEndDate.value = defaultEndDate;
      const defaultStartDate = getIsoDateDaysBefore(defaultEndDate, 7);
      els.filterStartDate.value = defaultStartDate < fullChartSeries[0].tanggalIso ? fullChartSeries[0].tanggalIso : defaultStartDate;
      syncFilterInputBounds("end");
      applyFilter();
    } else {
      filterGlobalMinDate = "";
      filterGlobalMaxDate = todayIso;
      els.filterEndDate.value = todayIso;
      const defaultStartDate = getIsoDateDaysBefore(todayIso, 7);
      els.filterStartDate.value = defaultStartDate;
      syncFilterInputBounds("end");
    }
  } catch (error) {
    if (els.chartSubtitle) els.chartSubtitle.textContent = "Gagal memuat periode grafik";
    els.chartPeriod.textContent = "Periksa koneksi atau status server";
    els.chartMeta.textContent = toStr(error?.message) || "Terjadi kesalahan";
    els.nationalChart.innerHTML = `<div class="massChart__empty">Gagal memuat grafik. Silakan refresh halaman.</div>`;
    els.chartBreakdownBody.innerHTML = `<tr><td colspan="4">Gagal memuat data rincian harian.</td></tr>`;
    toast(toStr(error?.message) || "Gagal memuat data grafik.");
  }
}

// --- FUEL PRICE FUNCTIONS ---
async function loadFuelPriceData(dateStrings) {
  try {
    const params = new URLSearchParams();
    if (Array.isArray(dateStrings) && dateStrings.length) {
      params.set("dates", Array.from(new Set(dateStrings)).sort().join(","));
    }
    const response = await fetch(`/api/fuel-prices${params.toString() ? `?${params.toString()}` : ""}`);
    if (!response.ok) {
      throw new Error("Failed to fetch fuel price data");
    }
    const data = await response.json();
    fuelSourceMeta = data;
    fullFuelPriceData = data.prices;

    renderPageWithFuelSeries(fullFuelPriceData);
  } catch (e) {
    console.error("Error loading fuel price data:", e);
    toast("Gagal memuat data harga BBM");
  }
}

function renderPageWithFuelSeries(series) {
  if (series.length > 0) {
    updateFuelSourceMeta();
    updateFuelPeriodLabels(series[0], series[series.length - 1]);
    updateFuelComparisonSummary(series);
    updateFuelPricesList(series[series.length - 1]);
    renderFuelChart(series);
  }
}

function updateFuelSourceMeta() {
  const province = fuelSourceMeta?.province || "—";
  const updatedAt = fuelSourceMeta?.latestUpdatedAt ? formatDateTimeId(fuelSourceMeta.latestUpdatedAt) : "—";
  if (els.fuelNote) {
    els.fuelNote.textContent = `Sumber eksternal: harga BBM Pertamina acuan ${province} • pembaruan terakhir ${updatedAt}`;
  }
  if (els.fuelFooterMeta) {
    els.fuelFooterMeta.textContent = `Sumber: ${fuelSourceMeta?.provider || "API eksternal"} (${province}) • sinkron snapshot Pertamina • update terakhir ${updatedAt}`;
  }
}

function updateFuelPeriodLabels(startDay, endDay) {
  const startDate = new Date(startDay.date);
  const endDate = new Date(endDay.date);
  const startFormatted = startDate.getDate();
  const endFormatted = endDate.getDate();
  const month = endDate.toLocaleString("id-ID", { month: "short" }).toUpperCase();
  const year = endDate.getFullYear();
  const periodText = `Periode ${startFormatted}-${endFormatted} ${month} ${year}`;
  if (els.fuelPeriod) {
    els.fuelPeriod.textContent = periodText;
  }
}

function updateFuelComparisonSummary(series) {
  if (!els.fuelCompareBody || !series.length) return;
  const startDay = series[0];
  const endDay = series[series.length - 1];
  const startDate = new Date(startDay.date);
  const endDate = new Date(endDay.date);
  const startHead = `${startDate.getDate()} ${startDate.toLocaleString("id-ID", { month: "short" }).toUpperCase()}`;
  const endHead = `${endDate.getDate()} ${endDate.toLocaleString("id-ID", { month: "short" }).toUpperCase()}`;

  if (els.fuelCompareStartHead) els.fuelCompareStartHead.textContent = startHead;
  if (els.fuelCompareEndHead) els.fuelCompareEndHead.textContent = endHead;
  if (els.fuelComparePeriod) {
    els.fuelComparePeriod.textContent = `Perbandingan ${startHead} ${startDate.getFullYear()} s.d. ${endHead} ${endDate.getFullYear()}`;
  }

  const startMap = new Map((startDay.fuels || []).map((fuel) => [fuel.name, fuel]));
  const endMap = new Map((endDay.fuels || []).map((fuel) => [fuel.name, fuel]));
  const fuelOrder = [
    "Pertalite",
    "Biosolar Subsidi",
    "Pertamax",
    "Pertamax Green 95",
    "Pertamax Turbo",
    "Dexlite",
    "Pertamina Dex",
  ];

  const rows = fuelOrder
    .filter((name) => startMap.has(name) || endMap.has(name))
    .map((name) => {
      const startFuel = startMap.get(name);
      const endFuel = endMap.get(name);
      const startPrice = Number(startFuel?.price);
      const endPrice = Number(endFuel?.price);
      const diff = (Number.isFinite(endPrice) ? endPrice : 0) - (Number.isFinite(startPrice) ? startPrice : 0);

      let changeLabel = "Tetap";
      let changeClass = "chartFuel__change chartFuel__change--flat";
      if (diff > 0) {
        changeLabel = `+${formatIdr(diff)}`;
        changeClass = "chartFuel__change chartFuel__change--up";
      } else if (diff < 0) {
        changeLabel = `-${formatIdr(Math.abs(diff))}`;
        changeClass = "chartFuel__change chartFuel__change--down";
      }

      return `<tr>
        <td>${escapeHtml(name)}</td>
        <td>${Number.isFinite(startPrice) ? escapeHtml(formatIdr(startPrice)) : "—"}</td>
        <td>${Number.isFinite(endPrice) ? escapeHtml(formatIdr(endPrice)) : "—"}</td>
        <td><span class="${changeClass}">${escapeHtml(changeLabel)}</span></td>
      </tr>`;
    });

  els.fuelCompareBody.innerHTML = rows.length
    ? rows.join("")
    : `<tr><td colspan="4">Belum ada data perbandingan harga.</td></tr>`;
}

function updateFuelPricesList(latestDay) {
  if (!els.fuelPricesList || !latestDay) return;
  els.fuelPricesList.innerHTML = "";
  
  // Color mapping for fuels
  const fuelColors = {
    "Pertalite": "#3B82F6",
    "Biosolar Subsidi": "#F59E0B",
    "Pertamax": "#22C55E",
    "Pertamax Green 95": "#EF4444",
    "Pertamax Turbo": "#8B5CF6",
    "Dexlite": "#78716C",
    "Pertamina Dex": "#EC4899",
  };
  
  const oilIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M12 2.5C12 2.5 6 10.1 6 14.2C6 17.7 8.69 20.5 12 20.5C15.31 20.5 18 17.7 18 14.2C18 10.1 12 2.5 12 2.5Z" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/><path d="M9.2 14.5C9.2 12.9 10.11 11.18 11.3 9.58" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>`;
  
  latestDay.fuels.forEach(fuel => {
    const eventItem = document.createElement("div");
    eventItem.className = "chartExchange__eventItem";
    const color = fuelColors[fuel.name] || "#3B82F6";
    const icon = oilIcon;

    eventItem.innerHTML = `
      <div class="chartExchange__eventDateContainer">
        <div class="chartExchange__eventBadge" style="background: ${color}; border-radius: 16px;">
          ${icon}
        </div>
      </div>
      <div class="chartExchange__eventContent">
        <div style="font-weight: 900; color: #ffffff; margin-bottom: 4px;">${fuel.name}</div>
        <div style="color: var(--gold); font-size: 24px; font-weight: 900;">Rp${fuel.price.toLocaleString("id-ID")}</div>
        <div style="color: rgba(255,255,255,0.75); font-size: 12px; margin-top: 4px;">per liter</div>
      </div>
    `;
    els.fuelPricesList.appendChild(eventItem);
  });
}

function renderFuelChart(series) {
  if (!window.echarts || !els.fuelChart || series.length === 0) return;
  if (!fuelChartInstance) {
    fuelChartInstance = echarts.init(els.fuelChart);
  }
  
  // Get all unique fuel names
  const fuelNames = series[0].fuels.map(f => f.name);
  
  // Prepare series data
  const chartSeries = fuelNames.map(fuelName => {
    return {
      name: fuelName,
      type: "line",
      smooth: false,
      symbol: "circle",
      symbolSize: 6,
      lineStyle: {
        width: 3,
      },
      label: {
        show: true,
        position: "top",
        distance: 6,
        rich: buildPriceMovementRichStyles(),
        formatter(params) {
          return formatPriceMovementLabel(params, series.map((day) => {
            const fuel = day.fuels.find((f) => f.name === fuelName);
            return fuel ? fuel.price : null;
          }));
        },
      },
      labelLayout: {
        hideOverlap: true,
        moveOverlap: "shiftY",
      },
      data: series.map(day => {
        const fuel = day.fuels.find(f => f.name === fuelName);
        return fuel ? fuel.price : null;
      }),
    };
  });
  
  const fuelColors = {
    "Pertalite": "#3B82F6",
    "Biosolar Subsidi": "#F59E0B",
    "Pertamax": "#22C55E",
    "Pertamax Green 95": "#EF4444",
    "Pertamax Turbo": "#8B5CF6",
    "Dexlite": "#78716C",
    "Pertamina Dex": "#EC4899",
  };
  
  fuelChartInstance.setOption({
    backgroundColor: "transparent",
    animation: true,
    legend: {
      data: fuelNames,
      textStyle: {
        color: "#E6F0FF",
      },
      top: 0,
    },
    grid: {
      left: 40,
      right: 72,
      top: 80,
      bottom: 40,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      backgroundColor: "rgba(7,12,24,0.96)",
      borderColor: "rgba(124,165,255,0.22)",
      borderWidth: 1,
      textStyle: { color: "#E6F0FF", fontSize: 12 },
      formatter(params) {
        const point = params[0];
        const date = new Date(series[point.dataIndex].date);
        const day = String(date.getDate()).padStart(2, "0");
        const month = date.toLocaleString("id-ID", { month: "short" }).toUpperCase();
        const year = date.getFullYear();
        let result = `<strong>${day} ${month} ${year}</strong><br/>`;
        params.forEach(p => {
          result += `${p.marker} ${p.seriesName}: Rp${p.value.toLocaleString("id-ID")}<br/>`;
        });
        return result;
      },
    },
    xAxis: {
      type: "category",
      data: series.map(day => new Date(day.date).getDate()),
      axisLine: {
        lineStyle: { color: "rgba(255,255,255,0.2)", width: 1 },
      },
      axisTick: {
        show: true,
        alignWithLabel: true,
        lineStyle: { color: "rgba(255,255,255,0.3)" },
      },
      axisLabel: {
        color: "#E6F0FF",
        fontSize: 11,
        fontWeight: 700,
      },
      name: "Tanggal",
      nameLocation: "middle",
      nameGap: 28,
      nameTextStyle: {
        color: "#9BC0FF",
        fontSize: 12,
        fontWeight: 700,
      },
    },
    yAxis: {
      type: "value",
      splitNumber: 8,
      position: "right",
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "#E6F0FF",
        fontSize: 11,
        fontWeight: 700,
        formatter(value) {
          return "Rp" + value.toLocaleString("id-ID");
        },
      },
      splitLine: {
        lineStyle: {
          color: "rgba(116,155,240,0.12)",
          type: "dashed",
        },
      },
      name: "Rp/liter",
      nameLocation: "middle",
      nameGap: 52,
      nameTextStyle: {
        color: "#9BC0FF",
        fontSize: 12,
        fontWeight: 700,
      },
    },
    color: fuelNames.map(name => fuelColors[name] || "#3B82F6"),
    series: chartSeries,
  }, true);
  
  fuelChartInstance.resize();
}

// --- COMMODITY PRICE FUNCTIONS ---
async function loadCommodityPriceData(dateStrings) {
  try {
    const params = new URLSearchParams();
    if (Array.isArray(dateStrings) && dateStrings.length) {
      params.set("dates", Array.from(new Set(dateStrings)).sort().join(","));
    }
    const response = await fetch(`/api/sembako-prices${params.toString() ? `?${params.toString()}` : ""}`);
    if (!response.ok) {
      throw new Error("Failed to fetch commodity price data");
    }
    const data = await response.json();
    commoditySourceMeta = data;
    fullCommodityPriceData = data.prices;
    renderPageWithCommoditySeries(fullCommodityPriceData);
  } catch (e) {
    console.error("Error loading commodity price data:", e);
    toast("Gagal memuat data harga sembako");
  }
}

function getCommodityColor(key) {
  return {
    "rice-medium": "#3B82F6",
    "chicken-meat": "#22C55E",
    beef: "#EF4444",
    eggs: "#F59E0B",
    "cooking-oil": "#06B6D4",
    sugar: "#8B5CF6",
  }[key] || "#3B82F6";
}

function getCommodityMetaByKey(key) {
  return (commoditySourceMeta?.commodities || []).find((item) => item.key === key) || null;
}

function renderPageWithCommoditySeries(series) {
  updateCommoditySourceMeta();
  if (!series.length) {
    if (els.commodityCompareBody) {
      const availabilityText = commoditySourceMeta?.earliestActualDate
        ? ` Data tersedia mulai ${formatDateLong(commoditySourceMeta.earliestActualDate)}.`
        : "";
      els.commodityCompareBody.innerHTML = `<tr><td colspan="4">Belum ada data harga sembako pada periode ini.${availabilityText}</td></tr>`;
    }
    if (els.commodityPricesList) {
      const availabilityText = commoditySourceMeta?.earliestActualDate
        ? ` Data tersedia mulai ${formatDateLong(commoditySourceMeta.earliestActualDate)}.`
        : "";
      els.commodityPricesList.innerHTML = `<div class="chartExchange__eventContent">Belum ada data harga sembako pada periode aktif.${availabilityText}</div>`;
    }
    renderCommodityChart([]);
    renderCommodityBeefChart([]);
    return;
  }
  updateCommodityPeriodLabels(series[0], series[series.length - 1]);
  updateCommodityComparisonSummary(series);
  updateCommodityPricesList(series[series.length - 1]);
  renderCommodityChart(series);
  renderCommodityBeefChart(series);
}

function updateCommoditySourceMeta() {
  const provider = commoditySourceMeta?.provider || "API eksternal";
  const earliestDate = commoditySourceMeta?.earliestActualDate ? formatDateLong(commoditySourceMeta.earliestActualDate) : "—";
  const latestDate = commoditySourceMeta?.latestActualDate ? formatDateLong(commoditySourceMeta.latestActualDate) : "—";
  if (els.commodityNote) {
    els.commodityNote.textContent = `Sumber eksternal: ${provider} • data tersedia mulai ${earliestDate} • pembaruan data terakhir ${latestDate}`;
  }
  if (els.commodityFooterMeta) {
    els.commodityFooterMeta.textContent = `Sumber: ${provider} • portal ${commoditySourceMeta?.sourceUrl || "PIHPS"} • data tersedia mulai ${earliestDate} • data terakhir ${latestDate}`;
  }
}

function updateCommodityPeriodLabels(startDay, endDay) {
  const startDate = new Date(startDay.date);
  const endDate = new Date(endDay.date);
  const startFormatted = startDate.getDate();
  const endFormatted = endDate.getDate();
  const month = endDate.toLocaleString("id-ID", { month: "short" }).toUpperCase();
  const year = endDate.getFullYear();
  if (els.commodityPeriod) {
    els.commodityPeriod.textContent = `Periode ${startFormatted}-${endFormatted} ${month} ${year}`;
  }
}

function updateCommodityComparisonSummary(series) {
  if (!els.commodityCompareBody) return;
  if (!series.length) {
    els.commodityCompareBody.innerHTML = `<tr><td colspan="4">Belum ada data perbandingan harga.</td></tr>`;
    return;
  }

  const startDay = series[0];
  const endDay = series[series.length - 1];
  const startDate = new Date(startDay.date);
  const endDate = new Date(endDay.date);
  const startHead = `${startDate.getDate()} ${startDate.toLocaleString("id-ID", { month: "short" }).toUpperCase()}`;
  const endHead = `${endDate.getDate()} ${endDate.toLocaleString("id-ID", { month: "short" }).toUpperCase()}`;

  if (els.commodityCompareStartHead) els.commodityCompareStartHead.textContent = startHead;
  if (els.commodityCompareEndHead) els.commodityCompareEndHead.textContent = endHead;
  if (els.commodityComparePeriod) {
    els.commodityComparePeriod.textContent = `Perbandingan ${startHead} ${startDate.getFullYear()} s.d. ${endHead} ${endDate.getFullYear()}`;
  }

  const startMap = new Map((startDay.commodities || []).map((item) => [item.key, item]));
  const endMap = new Map((endDay.commodities || []).map((item) => [item.key, item]));
  const commodityOrder = Array.isArray(commoditySourceMeta?.commodities) ? commoditySourceMeta.commodities : [];

  const rows = commodityOrder
    .filter((item) => startMap.has(item.key) || endMap.has(item.key))
    .map((item) => {
      const startCommodity = startMap.get(item.key);
      const endCommodity = endMap.get(item.key);
      const startPrice = Number(startCommodity?.price);
      const endPrice = Number(endCommodity?.price);
      const diff = (Number.isFinite(endPrice) ? endPrice : 0) - (Number.isFinite(startPrice) ? startPrice : 0);

      let changeLabel = "Tetap";
      let changeClass = "chartFuel__change chartFuel__change--flat";
      if (diff > 0) {
        changeLabel = `+${formatIdr(diff)}`;
        changeClass = "chartFuel__change chartFuel__change--up";
      } else if (diff < 0) {
        changeLabel = `-${formatIdr(Math.abs(diff))}`;
        changeClass = "chartFuel__change chartFuel__change--down";
      }

      return `<tr>
        <td>${escapeHtml(item.label || item.name)}</td>
        <td>${Number.isFinite(startPrice) ? escapeHtml(formatIdr(startPrice)) : "—"}</td>
        <td>${Number.isFinite(endPrice) ? escapeHtml(formatIdr(endPrice)) : "—"}</td>
        <td><span class="${changeClass}">${escapeHtml(changeLabel)}</span></td>
      </tr>`;
    });

  els.commodityCompareBody.innerHTML = rows.length
    ? rows.join("")
    : `<tr><td colspan="4">Belum ada data perbandingan harga.</td></tr>`;
}

function updateCommodityPricesList(latestDay) {
  if (!els.commodityPricesList || !latestDay) return;
  els.commodityPricesList.innerHTML = "";

  const marketIcon = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40"><path d="M4 9.5L5.2 5.7C5.46 4.87 6.22 4.3 7.09 4.3H16.91C17.78 4.3 18.54 4.87 18.8 5.7L20 9.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10.5V18.5C5 19.6 5.9 20.5 7 20.5H17C18.1 20.5 19 19.6 19 18.5V10.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 9.5H20.5" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/><path d="M9 14.5H15" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>`;

  latestDay.commodities.forEach((item) => {
    const badgeColor = getCommodityColor(item.key);
    const referenceDate = item.sourceDate ? formatDateShort(item.sourceDate) : formatDateShort(latestDay.date);
    const referenceText = item.isCarriedForward ? `Acuan terakhir ${referenceDate}` : `Update ${referenceDate}`;
    const eventItem = document.createElement("div");
    eventItem.className = "chartExchange__eventItem";
    eventItem.innerHTML = `
      <div class="chartExchange__eventDateContainer">
        <div class="chartExchange__eventBadge" style="background: ${badgeColor}; border-radius: 16px;">
          ${marketIcon}
        </div>
      </div>
      <div class="chartExchange__eventContent">
        <div style="font-weight: 900; color: #ffffff; margin-bottom: 4px;">${escapeHtml(item.label || item.name)}</div>
        <div style="color: var(--gold); font-size: 24px; font-weight: 900;">${escapeHtml(formatIdr(item.price))}</div>
        <div style="color: rgba(255,255,255,0.75); font-size: 12px; margin-top: 4px;">per ${escapeHtml(item.denomination || "satuan")}</div>
        <div style="color: rgba(255,255,255,0.62); font-size: 11px; margin-top: 6px;">${escapeHtml(referenceText)}</div>
      </div>
    `;
    els.commodityPricesList.appendChild(eventItem);
  });
}

function renderCommodityChart(series) {
  if (!window.echarts || !els.commodityChart) return;
  if (!series.length) {
    commodityChartInstance?.dispose();
    commodityChartInstance = null;
    els.commodityChart.innerHTML = `<div class="massChart__empty">Belum ada data harga sembako yang dapat ditampilkan.</div>`;
    return;
  }
  if (!commodityChartInstance) {
    els.commodityChart.innerHTML = "";
    commodityChartInstance = echarts.init(els.commodityChart);
  }

  const commodityOrder = Array.isArray(commoditySourceMeta?.commodities)
    ? commoditySourceMeta.commodities.filter((commodity) => commodity.key !== "beef")
    : [];
  const allValues = [];
  const chartSeries = commodityOrder
    .map((commodity, commodityIndex) => {
      const data = series.map((day) => {
        const item = (day.commodities || []).find((candidate) => candidate.key === commodity.key);
        const price = Number(item?.price);
        if (Number.isFinite(price)) allValues.push(price);
        return item
          ? {
              value: item.price,
              denomination: item.denomination,
              sourceDate: item.sourceDate,
              isCarriedForward: item.isCarriedForward,
            }
          : null;
      });
      return {
        key: commodity.key,
        name: commodity.label || commodity.name,
        type: "line",
        smooth: false,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: {
          width: 3,
        },
        label: {
          show: true,
          position: commodityIndex % 2 === 0 ? "top" : "bottom",
          distance: 7 + ((commodityIndex % 3) * 3),
          rich: buildPriceMovementRichStyles({
            fontSize: 10,
            padding: [2, 5],
          }),
          formatter(params) {
            return formatPriceMovementLabel(params, data, (item) => item?.value);
          },
        },
        labelLayout() {
          return { hideOverlap: false, moveOverlap: "shiftY" };
        },
        data,
      };
    })
    .filter((item) => item.data.some((value) => value && Number.isFinite(Number(value.value))));

  if (!chartSeries.length || !allValues.length) {
    els.commodityChart.innerHTML = `<div class="massChart__empty">Belum ada data harga sembako yang dapat ditampilkan.</div>`;
    return;
  }

  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const padding = Math.max(900, Math.ceil((maxValue - minValue) * 0.16));

  commodityChartInstance.setOption(
    {
      backgroundColor: "transparent",
      animation: true,
      legend: {
        data: chartSeries.map((item) => item.name),
        textStyle: {
          color: "#E6F0FF",
        },
        top: 0,
      },
      grid: {
        left: 40,
        right: 78,
        top: 92,
        bottom: 52,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(7,12,24,0.96)",
        borderColor: "rgba(124,165,255,0.22)",
        borderWidth: 1,
        textStyle: { color: "#E6F0FF", fontSize: 12 },
        formatter(params) {
          const point = params[0];
          const day = series[point.dataIndex];
          let result = `<strong>${escapeHtml(formatDateLong(day.date))}</strong><br/>`;
          params.forEach((param) => {
            const rawValue = Number(param.value);
            if (!Number.isFinite(rawValue)) return;
            const item = param.data || {};
            const sourceInfo = item.isCarriedForward && item.sourceDate ? ` • acuan ${escapeHtml(formatDateShort(item.sourceDate))}` : "";
            result += `${param.marker} ${escapeHtml(param.seriesName)}: ${escapeHtml(formatIdr(rawValue))}${item.denomination ? `/${escapeHtml(item.denomination)}` : ""}${sourceInfo}<br/>`;
          });
          return result;
        },
      },
      xAxis: {
        type: "category",
        data: series.map((day) => formatDateShort(day.date)),
        axisLine: {
          lineStyle: { color: "rgba(255,255,255,0.2)", width: 1 },
        },
        axisTick: {
          show: true,
          alignWithLabel: true,
          lineStyle: { color: "rgba(255,255,255,0.3)" },
        },
        axisLabel: {
          color: "#E6F0FF",
          fontSize: 11,
          fontWeight: 700,
        },
        name: "Tanggal",
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: {
          color: "#9BC0FF",
          fontSize: 12,
          fontWeight: 700,
        },
      },
      yAxis: {
        type: "value",
        min: Math.max(0, minValue - padding),
        max: maxValue + padding,
        splitNumber: 8,
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#E6F0FF",
          fontSize: 11,
          fontWeight: 700,
          formatter(value) {
            return "Rp" + Number(value).toLocaleString("id-ID");
          },
        },
        splitLine: {
          lineStyle: {
            color: "rgba(116,155,240,0.12)",
            type: "dashed",
          },
        },
        name: "Rp/satuan",
        nameLocation: "middle",
        nameGap: 56,
        nameTextStyle: {
          color: "#9BC0FF",
          fontSize: 12,
          fontWeight: 700,
        },
      },
      color: chartSeries.map((item) => getCommodityColor(item.key)),
      series: chartSeries.map((item) => ({
        name: item.name,
        type: item.type,
        smooth: item.smooth,
        symbol: item.symbol,
        symbolSize: item.symbolSize,
        lineStyle: item.lineStyle,
        label: item.label,
        labelLayout: item.labelLayout,
        data: item.data,
      })),
    },
    true
  );

  commodityChartInstance.resize();
}

function renderCommodityBeefChart(series) {
  if (!window.echarts || !els.commodityBeefChart) return;
  const beefMeta = getCommodityMetaByKey("beef");
  const beefLabel = beefMeta?.label || beefMeta?.name || "Daging sapi";

  if (!series.length) {
    commodityBeefChartInstance?.dispose();
    commodityBeefChartInstance = null;
    els.commodityBeefChart.innerHTML = `<div class="massChart__empty">Belum ada data harga ${escapeHtml(beefLabel)} yang dapat ditampilkan.</div>`;
    return;
  }

  const data = series.map((day) => {
    const item = (day.commodities || []).find((candidate) => candidate.key === "beef");
    return item
      ? {
          value: item.price,
          denomination: item.denomination,
          sourceDate: item.sourceDate,
          isCarriedForward: item.isCarriedForward,
        }
      : null;
  });

  const values = data
    .map((item) => Number(item?.value))
    .filter((value) => Number.isFinite(value));
  if (!values.length) {
    commodityBeefChartInstance?.dispose();
    commodityBeefChartInstance = null;
    els.commodityBeefChart.innerHTML = `<div class="massChart__empty">Belum ada data harga ${escapeHtml(beefLabel)} pada periode aktif.</div>`;
    return;
  }

  if (!commodityBeefChartInstance) {
    els.commodityBeefChart.innerHTML = "";
    commodityBeefChartInstance = echarts.init(els.commodityBeefChart);
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const padding = Math.max(1200, Math.ceil((maxValue - minValue) * 0.2));

  commodityBeefChartInstance.setOption(
    {
      backgroundColor: "transparent",
      animation: true,
      legend: {
        data: [beefLabel],
        textStyle: {
          color: "#E6F0FF",
        },
        top: 0,
      },
      grid: {
        left: 40,
        right: 78,
        top: 80,
        bottom: 40,
        containLabel: true,
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(7,12,24,0.96)",
        borderColor: "rgba(124,165,255,0.22)",
        borderWidth: 1,
        textStyle: { color: "#E6F0FF", fontSize: 12 },
        formatter(params) {
          const point = params[0];
          const day = series[point.dataIndex];
          const item = point?.data || {};
          const rawValue = Number(point?.value);
          if (!Number.isFinite(rawValue)) return `<strong>${escapeHtml(formatDateLong(day.date))}</strong>`;
          const sourceInfo = item.isCarriedForward && item.sourceDate ? ` • acuan ${escapeHtml(formatDateShort(item.sourceDate))}` : "";
          return `<strong>${escapeHtml(formatDateLong(day.date))}</strong><br/>${point.marker} ${escapeHtml(beefLabel)}: ${escapeHtml(formatIdr(rawValue))}${item.denomination ? `/${escapeHtml(item.denomination)}` : ""}${sourceInfo}`;
        },
      },
      xAxis: {
        type: "category",
        data: series.map((day) => formatDateShort(day.date)),
        axisLine: {
          lineStyle: { color: "rgba(255,255,255,0.2)", width: 1 },
        },
        axisTick: {
          show: true,
          alignWithLabel: true,
          lineStyle: { color: "rgba(255,255,255,0.3)" },
        },
        axisLabel: {
          color: "#E6F0FF",
          fontSize: 11,
          fontWeight: 700,
        },
        name: "Tanggal",
        nameLocation: "middle",
        nameGap: 28,
        nameTextStyle: {
          color: "#9BC0FF",
          fontSize: 12,
          fontWeight: 700,
        },
      },
      yAxis: {
        type: "value",
        min: Math.max(0, minValue - padding),
        max: maxValue + padding,
        splitNumber: 8,
        position: "right",
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: {
          color: "#E6F0FF",
          fontSize: 11,
          fontWeight: 700,
          formatter(value) {
            return "Rp" + Number(value).toLocaleString("id-ID");
          },
        },
        splitLine: {
          lineStyle: {
            color: "rgba(239,68,68,0.16)",
            type: "dashed",
          },
        },
        name: "Rp/kg",
        nameLocation: "middle",
        nameGap: 56,
        nameTextStyle: {
          color: "#FCA5A5",
          fontSize: 12,
          fontWeight: 700,
        },
      },
      color: [getCommodityColor("beef")],
      series: [
        {
          name: beefLabel,
          type: "line",
          smooth: false,
          symbol: "circle",
          symbolSize: 7,
          lineStyle: {
            width: 3.4,
            color: getCommodityColor("beef"),
          },
          itemStyle: {
            color: getCommodityColor("beef"),
            borderColor: "#ffffff",
            borderWidth: 0.8,
          },
          label: {
            show: true,
            position: "top",
            distance: 9,
            rich: buildPriceMovementRichStyles({
              fontSize: 11,
              padding: [3, 6],
            }),
            formatter(params) {
              return formatPriceMovementLabel(params, data, (item) => item?.value);
            },
          },
          labelLayout() {
            return { hideOverlap: false, moveOverlap: "shiftY" };
          },
          data,
        },
      ],
    },
    true
  );

  commodityBeefChartInstance.resize();
}

function getBaseValue(values, fallback = 1) {
  const firstValid = (Array.isArray(values) ? values : []).find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  return Number.isFinite(Number(firstValid)) ? Number(firstValid) : fallback;
}

function getLastValidDataIndex(items, selector) {
  if (!Array.isArray(items) || !items.length) return -1;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const value = selector(items[index], index);
    if (Number.isFinite(Number(value))) return index;
  }
  return -1;
}

function getFirstValidDataIndex(items, selector) {
  if (!Array.isArray(items) || !items.length) return -1;
  for (let index = 0; index < items.length; index += 1) {
    const value = selector(items[index], index);
    if (Number.isFinite(Number(value))) return index;
  }
  return -1;
}

function buildIndexedPoint(actualValue, baseValue, extra = {}) {
  const actual = Number(actualValue);
  const base = Number(baseValue);
  return {
    value: Number.isFinite(actual) && Number.isFinite(base) && base > 0 ? Number(((actual / base) * 100).toFixed(1)) : null,
    actualValue: Number.isFinite(actual) ? actual : null,
    baseValue: Number.isFinite(base) ? base : null,
    ...extra,
  };
}

function getFuelProductColor(name) {
  return {
    "Pertalite": "#3B82F6",
    "Biosolar Subsidi": "#F59E0B",
    "Pertamax": "#22C55E",
    "Pertamax Green 95": "#EF4444",
    "Pertamax Turbo": "#8B5CF6",
    "Dexlite": "#78716C",
    "Pertamina Dex": "#EC4899",
  }[name] || "#F59E0B";
}

function buildCombinedChartData(actionSeries, exchangeSeries, fuelSeries, commoditySeries) {
  const exchangeMap = new Map(
    (Array.isArray(exchangeSeries) ? exchangeSeries : []).map((item) => [formatLocalIsoDate(item.fullDate), item])
  );
  const fuelMap = new Map((Array.isArray(fuelSeries) ? fuelSeries : []).map((item) => [item.date, item]));
  const commodityMap = new Map((Array.isArray(commoditySeries) ? commoditySeries : []).map((item) => [item.date, item]));

  const dates = (Array.isArray(actionSeries) ? actionSeries : [])
    .map((item) => item.tanggalIso)
    .filter((date) => exchangeMap.has(date) && fuelMap.has(date) && commodityMap.has(date));
  if (!dates.length) return null;

  const actionRows = dates.map((date) => {
    const item = (actionSeries || []).find((row) => row.tanggalIso === date);
    return {
      date,
      fullDate: item?.tanggalLong || formatDateLong(date),
      totalMass: Number(item?.totalMass) || 0,
      count: Number(item?.count) || 0,
      wilayahCount: Number(item?.wilayahCount) || 0,
      dominantWilayah: item?.dominantWilayah || "—",
    };
  });
  const actionBase = getBaseValue(actionRows.map((item) => item.totalMass), 1);
  const actionLine = actionRows.map((item) => ({
    value: Number(((item.totalMass / actionBase) * 100).toFixed(1)),
    actualValue: item.totalMass,
    baseValue: actionBase,
    totalMass: item.totalMass,
    count: item.count,
    wilayahCount: item.wilayahCount,
    dominantWilayah: item.dominantWilayah,
    fullDate: item.fullDate,
  }));

  const rupiahRows = dates.map((date) => exchangeMap.get(date));
  const rupiahBase = getBaseValue(rupiahRows.map((item) => Number(item?.value)), 1);
  const rupiahLine = rupiahRows.map((item) =>
    buildIndexedPoint(item?.value, rupiahBase, {
      actualRate: Number(item?.value),
      fullDate: formatDateForExchange(item.fullDate),
    })
  );

  const commodityKeys = Array.from(
    new Set(
      (commoditySourceMeta?.commodities || []).map((item) => item.key)
    )
  );
  const commodityBaseMap = new Map();
  commodityKeys.forEach((key) => {
    for (const date of dates) {
      const day = commodityMap.get(date);
      const item = (day?.commodities || []).find((entry) => entry.key === key && Number.isFinite(Number(entry.price)));
      if (item) {
        commodityBaseMap.set(key, Number(item.price));
        break;
      }
    }
  });
  const sembakoLine = dates.map((date) => {
    const day = commodityMap.get(date);
    const dayCommodities = Array.isArray(day?.commodities) ? day.commodities : [];
    const freshCommodityCount = dayCommodities.filter((item) => !item.isCarriedForward && item.sourceDate === date).length;
    const hasActualUpdate = freshCommodityCount > 0;
    const normalizedValues = dayCommodities
      .map((item) => {
        const basePrice = commodityBaseMap.get(item.key);
        const currentPrice = Number(item.price);
        if (!Number.isFinite(basePrice) || !Number.isFinite(currentPrice) || basePrice <= 0) return null;
        return (currentPrice / basePrice) * 100;
      })
      .filter((value) => Number.isFinite(value));
    const averageIndex = normalizedValues.length
      ? normalizedValues.reduce((sum, value) => sum + value, 0) / normalizedValues.length
      : null;
    const actualAverage = dayCommodities.length
      ? (dayCommodities.reduce((sum, item) => sum + (Number(item.price) || 0), 0) / dayCommodities.length)
      : null;
    return buildIndexedPoint(actualAverage, actualAverage && averageIndex != null ? actualAverage / (averageIndex / 100) : null, {
      actualAverage: actualAverage != null ? Math.round(actualAverage) : null,
      commodityCount: dayCommodities.length,
      freshCommodityCount,
      hasActualUpdate,
      sourceDate: dayCommodities[0]?.sourceDate || date,
      // `averageIndex` is already based on awal periode per komoditas; keep it as the displayed index.
      value: averageIndex != null ? Number(averageIndex.toFixed(1)) : null,
    });
  });

  const fuelNames = Array.from(
    new Set(
      dates.flatMap((date) => (fuelMap.get(date)?.fuels || []).map((fuel) => fuel.name))
    )
  );
  const fuelBaseMap = new Map();
  fuelNames.forEach((name) => {
    for (const date of dates) {
      const fuel = (fuelMap.get(date)?.fuels || []).find((entry) => entry.name === name && Number.isFinite(Number(entry.price)));
      if (fuel) {
        fuelBaseMap.set(name, Number(fuel.price));
        break;
      }
    }
  });
  const fuelLines = fuelNames.map((name) => ({
    name,
    color: getFuelProductColor(name),
    data: dates.map((date) => {
      const fuel = (fuelMap.get(date)?.fuels || []).find((entry) => entry.name === name);
      const actualPrice = Number(fuel?.price);
      if (!Number.isFinite(actualPrice)) return null;
      return buildIndexedPoint(actualPrice, fuelBaseMap.get(name), {
        actualPrice,
      });
    }),
  }));

  const priceAdjustmentDates = [];
  for (let index = 1; index < dates.length; index += 1) {
    const previousFuelMap = new Map((fuelMap.get(dates[index - 1])?.fuels || []).map((item) => [item.name, Number(item.price)]));
    const currentFuelMap = new Map((fuelMap.get(dates[index])?.fuels || []).map((item) => [item.name, Number(item.price)]));
    const hasFuelChange = fuelNames.some((name) => currentFuelMap.has(name) && previousFuelMap.get(name) !== currentFuelMap.get(name));
    const previousCommodityAvg = Number(sembakoLine[index - 1]?.actualAverage);
    const currentCommodityAvg = Number(sembakoLine[index]?.actualAverage);
    const hasCommodityChange =
      Number.isFinite(previousCommodityAvg) &&
      Number.isFinite(currentCommodityAvg) &&
      previousCommodityAvg !== currentCommodityAvg;
    if (hasFuelChange || hasCommodityChange) {
      priceAdjustmentDates.push(dates[index]);
    }
  }

  const highlightedActionDays = actionLine
    .map((item, index) => ({
      index,
      date: dates[index],
      category: formatDateShort(dates[index]),
      ...item,
    }))
    .sort((a, b) => b.value - a.value || b.totalMass - a.totalMass)
    .slice(0, 4)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  return {
    dates,
    categories: dates.map((date) => formatDateShort(date)),
    periodLabel: `Indonesia, ${formatDateLong(dates[0])} - ${formatDateLong(dates[dates.length - 1])}`,
    actionLine,
    rupiahLine,
    sembakoLine,
    fuelLines,
    priceAdjustmentDates,
    highlightedActionDays,
  };
}

function updateCombinedLegend() {
  if (!els.combinedLegend) return;
  const legendItems = [
    {
      color: "#2D6FE9",
      title: "Massa Aksi Nasional",
      text: "Garis biru berada di panel utama bersama rupiah dan sembako. Nilai 100 berarti setara hari pertama pada periode aktif.",
    },
    {
      color: "#2F855A",
      title: "Rupiah per USD",
      text: "Garis hijau kembali digabung ke panel utama dan tetap memakai indeks kurs awal periode = 100.",
    },
    {
      color: "#7C3AED",
      title: "Sembako Gabungan",
      text: "Garis ungu kembali digabung ke panel utama dan memakai indeks rerata harga sembako nasional awal periode = 100.",
    },
    {
      color: "#F59E0B",
      title: "Komponen BBM",
      text: "Komponen BBM berada pada panel bawah di chart yang sama dan memakai harga aktual per liter agar tiap produk terbaca jelas. Tooltip tetap menampilkan indeks perbandingan terhadap awal periode.",
    },
  ];
  els.combinedLegend.innerHTML = legendItems
    .map(
      (item) => `<div class="chartCombined__legendItem">
        <span class="chartCombined__legendSwatch" style="background:${item.color};"></span>
        <div class="chartCombined__legendText"><strong>${escapeHtml(item.title)}</strong>${escapeHtml(item.text)}</div>
      </div>`
    )
    .join("");
}

function updateCombinedGuide(data) {
  if (!els.combinedGuide) return;
  if (!data || !data.dates.length) {
    els.combinedGuide.innerHTML = `<div class="chartCombined__guideItem"><div class="chartCombined__guideText">Panduan membaca grafik belum tersedia karena data komposit belum lengkap.</div></div>`;
    return;
  }
  const items = [
    {
      title: "Cara Baca Panel Utama",
      text: "Panel utama kini memadukan aksi nasional, rupiah, dan sembako dalam satu bidang waktu yang sama. Aksi memakai indeks aksi, sedangkan rupiah dan sembako memakai indeks awal periode = 100.",
    },
    {
      title: "Cara Baca Panel Bawah",
      text: "Panel bawah tetap dipakai BBM dalam harga aktual per liter, agar selisih tiap produk tetap jelas tanpa menumpuk seperti indeks.",
    },
    {
      title: "Cara Baca Tooltip",
      text: "Arahkan kursor ke tanggal tertentu untuk melihat semua panel sekaligus: aksi, rupiah, sembako, dan BBM pada tanggal yang sama.",
    },
  ];
  els.combinedGuide.innerHTML = items
    .map(
      (item) => `<div class="chartCombined__guideItem">
        <div class="chartCombined__guideTitle">${escapeHtml(item.title)}</div>
        <div class="chartCombined__guideText">${escapeHtml(item.text)}</div>
      </div>`
    )
    .join("");
}

function updateCombinedMeta(data) {
  if (!data) {
    if (els.combinedPeriod) els.combinedPeriod.textContent = "Periode tidak tersedia";
    if (els.combinedNote) {
      els.combinedNote.textContent = "(Grafik komposit belum memiliki irisan data yang cukup antar sumber.)";
    }
    if (els.combinedFooterMeta) els.combinedFooterMeta.textContent = "Sumber komposit belum tersedia.";
    return;
  }
  if (els.combinedPeriod) {
    els.combinedPeriod.textContent = data.periodLabel;
  }
  if (els.combinedNote) {
    const adjustmentCount = data.priceAdjustmentDates.length;
    const actualSembakoDays = data.sembakoLine.filter((item) => item?.hasActualUpdate).length;
    els.combinedNote.textContent = `(${formatNumberId(data.dates.length)} hari data aktif • panel utama memadukan aksi nasional, rupiah, dan sembako • panel bawah untuk BBM dengan harga aktual per liter • sembako memiliki ${formatNumberId(actualSembakoDays)} tanggal update aktual PIHPS, sisanya carry-forward informatif • ${adjustmentCount ? `${formatNumberId(adjustmentCount)} tanggal penyesuaian harga terdeteksi` : "tidak ada penyesuaian harga pada periode aktif"})`;
  }
  if (els.combinedFooterMeta) {
    els.combinedFooterMeta.textContent = `Sumber komposit: dataset aksi aktif • ${fuelSourceMeta?.provider || "API BBM"} • ${commoditySourceMeta?.provider || "API sembako"} • kurs IDR/USD periode aktif`;
  }
}

function updateCombinedSummaryBar(data) {
  if (!els.combinedSummaryBar) return;
  if (!data || !data.dates.length) {
    els.combinedSummaryBar.innerHTML = `<div class="chartCombined__summaryItem"><div class="chartCombined__summaryValue">Belum ada ringkasan komposit.</div></div>`;
    return;
  }
  const lastIndex = data.dates.length - 1;
  const lastSembakoIndex = getLastValidDataIndex(data.sembakoLine, (item) => item?.value);
  const latestAction = data.actionLine[lastIndex];
  const latestRupiah = data.rupiahLine[lastIndex];
  const latestSembako = lastSembakoIndex >= 0 ? data.sembakoLine[lastSembakoIndex] : null;
  const latestFuelPrices = data.fuelLines
    .map((line) => {
      const latestPoint = line.data[lastIndex];
      return Number(latestPoint?.actualPrice);
    })
    .filter((value) => Number.isFinite(value));
  const fuelMin = latestFuelPrices.length ? Math.min(...latestFuelPrices) : null;
  const fuelMax = latestFuelPrices.length ? Math.max(...latestFuelPrices) : null;
  const items = [
    {
      label: "Aksi Terakhir",
      value: latestAction ? `${formatIndexNumber(latestAction.value)} indeks` : "—",
      sub: latestAction ? `${formatMassa(latestAction.totalMass)} pada ${formatDateShort(data.dates[lastIndex])}` : "Belum tersedia",
    },
    {
      label: "Rupiah Terakhir",
      value: latestRupiah ? formatIdr(latestRupiah.actualRate) : "—",
      sub: latestRupiah ? `Indeks ${formatIndexNumber(latestRupiah.value)} dibanding awal periode` : "Belum tersedia",
    },
    {
      label: "Sembako Gabungan",
      value: latestSembako && Number.isFinite(latestSembako.actualAverage) ? formatIdr(latestSembako.actualAverage) : "—",
      sub: latestSembako && lastSembakoIndex >= 0 ? `${formatIndexNumber(latestSembako.value)} indeks dari ${formatNumberId(latestSembako.commodityCount)} komoditas • sumber ${formatDateShort(latestSembako.sourceDate || data.dates[lastSembakoIndex])}${latestSembako.hasActualUpdate ? "" : " (carry-forward)"}` : "Belum tersedia",
    },
    {
      label: "Rentang BBM",
      value: fuelMin != null && fuelMax != null ? `${formatIdr(fuelMin)} - ${formatIdr(fuelMax)}` : "—",
      sub: fuelMin != null && fuelMax != null ? `Tooltip menampilkan indeks dan harga asli per liter pada ${formatDateShort(data.dates[lastIndex])}` : "Belum tersedia",
    },
  ];
  els.combinedSummaryBar.innerHTML = items
    .map(
      (item) => `<div class="chartCombined__summaryItem">
        <div class="chartCombined__summaryLabel">${escapeHtml(item.label)}</div>
        <div class="chartCombined__summaryValue">${escapeHtml(item.value)}</div>
        <div class="chartCombined__summarySub">${escapeHtml(item.sub)}</div>
      </div>`
    )
    .join("");
}

function updateCombinedInsights(data) {
  if (!els.combinedInsights) return;
  if (!data || !data.dates.length) {
    els.combinedInsights.innerHTML = `<div class="chartCombined__insight"><div class="chartCombined__insightValue">Belum ada insight komposit pada periode ini.</div></div>`;
    return;
  }

  const actionPeak = data.highlightedActionDays[0] || null;
  const strongestRupiah = data.rupiahLine
    .map((item, index) => ({ ...item, date: data.dates[index] }))
    .reduce((best, item) => (!best || item.actualRate < best.actualRate ? item : best), null);
  const weakestRupiah = data.rupiahLine
    .map((item, index) => ({ ...item, date: data.dates[index] }))
    .reduce((best, item) => (!best || item.actualRate > best.actualRate ? item : best), null);
  const firstSembakoIndex = data.sembakoLine.findIndex((item) => Number.isFinite(Number(item?.value)));
  const lastSembakoIndex = getLastValidDataIndex(data.sembakoLine, (item) => item?.value);
  const sembakoStart = firstSembakoIndex >= 0 ? Number(data.sembakoLine[firstSembakoIndex]?.actualAverage) : NaN;
  const sembakoEnd = lastSembakoIndex >= 0 ? Number(data.sembakoLine[lastSembakoIndex]?.actualAverage) : NaN;
  const sembakoChange = Number.isFinite(sembakoStart) && Number.isFinite(sembakoEnd) ? sembakoEnd - sembakoStart : null;
  const insights = [
    {
      label: "Puncak Aksi",
      value: actionPeak ? `${formatIndexNumber(actionPeak.value)} indeks` : "—",
      sub: actionPeak ? `${formatDateShort(actionPeak.date)} • ${actionPeak.dominantWilayah}` : "Belum tersedia",
    },
    {
      label: "Rentang Rupiah",
      value: strongestRupiah && weakestRupiah ? `${formatIdr(strongestRupiah.actualRate)} - ${formatIdr(weakestRupiah.actualRate)}` : "—",
      sub: strongestRupiah && weakestRupiah ? `Terkuat ${formatDateShort(strongestRupiah.date)} • Terlemah ${formatDateShort(weakestRupiah.date)}` : "Belum tersedia",
    },
    {
      label: "Pergerakan Sembako",
      value: sembakoChange == null ? "—" : sembakoChange > 0 ? `Naik ${formatIdr(Math.abs(sembakoChange))}` : sembakoChange < 0 ? `Turun ${formatIdr(Math.abs(sembakoChange))}` : "Tetap",
      sub: Number.isFinite(sembakoStart) && Number.isFinite(sembakoEnd) && firstSembakoIndex >= 0 && lastSembakoIndex >= 0 ? `Awal ${formatIdr(sembakoStart)} (${formatDateShort(data.dates[firstSembakoIndex])}) • Akhir ${formatIdr(sembakoEnd)} (${formatDateShort(data.dates[lastSembakoIndex])})` : "Belum tersedia",
    },
    {
      label: "Penyesuaian Harga",
      value: `${formatNumberId(data.priceAdjustmentDates.length)} tanggal`,
      sub: data.priceAdjustmentDates.length ? data.priceAdjustmentDates.slice(0, 3).map((date) => formatDateShort(date)).join(" • ") : "Tidak terdeteksi pada periode aktif",
    },
  ];
  els.combinedInsights.innerHTML = insights
    .map(
      (item) => `<div class="chartCombined__insight">
        <div class="chartCombined__insightLabel">${escapeHtml(item.label)}</div>
        <div class="chartCombined__insightValue">${escapeHtml(item.value)}</div>
        <div class="chartCombined__insightSub">${escapeHtml(item.sub)}</div>
      </div>`
    )
    .join("");
}

function renderCombinedSeriesLabels() {
  if (!combinedChartInstance) return;
  combinedChartInstance.setOption({ graphic: [] }, false);
}

function renderCombinedChart(data) {
  if (!window.echarts || !els.combinedChart) return;
  if (!data || !data.dates.length) {
    combinedChartInstance?.dispose();
    combinedChartInstance = null;
    els.combinedChart.innerHTML = `<div class="massChart__empty">Belum ada data komposit yang dapat ditampilkan.</div>`;
    return;
  }
  if (!combinedChartInstance) {
    els.combinedChart.innerHTML = "";
    combinedChartInstance = echarts.init(els.combinedChart);
  }

  const leftValues = data.actionLine.map((item) => Number(item.value)).filter((value) => Number.isFinite(value));
  const comparativeValues = [
    ...data.rupiahLine.map((item) => Number(item?.value)),
    ...data.sembakoLine.map((item) => Number(item?.value)),
  ].filter((value) => Number.isFinite(value));
  const allFuelValues = data.fuelLines
    .flatMap((item) => item.data.map((entry) => Number(entry?.actualPrice)))
    .filter((value) => Number.isFinite(value));
  const leftMax = Math.max(120, Math.ceil(Math.max(...leftValues, 100) / 20) * 20);
  const comparativeMin = comparativeValues.length ? Math.floor((Math.min(...comparativeValues, 100) - 3) / 5) * 5 : 95;
  const comparativeMax = comparativeValues.length ? Math.ceil((Math.max(...comparativeValues, 100) + 3) / 5) * 5 : 105;
  const minFuelPrice = allFuelValues.length ? Math.max(0, Math.floor((Math.min(...allFuelValues) - 800) / 500) * 500) : 0;
  const maxFuelPrice = allFuelValues.length ? Math.ceil((Math.max(...allFuelValues) + 800) / 500) * 500 : 1000;
  const lastDataIndex = Math.max(0, data.dates.length - 1);
  const lastSembakoDataIndex = getLastValidDataIndex(data.sembakoLine, (item) => item?.value);
  const combinedGridLeft = 92;
  const combinedGridRight = 172;
  const lastFuelIndexes = new Map(
    data.fuelLines.map((fuelLine) => [fuelLine.name, getLastValidDataIndex(fuelLine.data, (item) => item?.actualPrice)])
  );
  const highlightedCategories = new Set((data.priceAdjustmentDates || []).map((date) => formatDateShort(date)));
  const markLineData = (data.priceAdjustmentDates || []).slice(0, 4).map((date) => ({
    xAxis: formatDateShort(date),
    name: "Penyesuaian Harga",
    lineStyle: {
      color: "rgba(239,68,68,0.65)",
      width: 1.4,
      type: "solid",
    },
    label: {
      show: true,
      formatter: "Penyesuaian Harga",
      color: "#ffffff",
      fontSize: 10,
      fontWeight: 800,
      backgroundColor: "rgba(239,68,68,0.92)",
      borderRadius: 6,
      padding: [3, 6],
    },
  }));
  const markPointData = (data.highlightedActionDays || []).map((item) => ({
    coord: [item.category, item.value],
    value: item.value,
    dominantWilayah: item.dominantWilayah,
    totalMass: item.totalMass,
    fullDate: item.fullDate,
  }));
  const actionLabelIndexes = new Set([lastDataIndex, ...((data.highlightedActionDays || []).map((item) => Number(item.index)).filter((value) => Number.isInteger(value) && value >= 0))]);
  const actionLabelData = data.actionLine.map((item, actionIndex) => ({
    ...item,
    label: {
      position: actionIndex % 2 === 0 ? "left" : "right",
      distance: 14 + ((actionIndex % 3) * 4),
    },
  }));
  const staticSeriesState = {
    emphasis: {
      focus: "series",
      scale: false,
    },
    blur: {
      lineStyle: { opacity: 0.16 },
      itemStyle: { opacity: 0.16 },
      label: { opacity: 0.2 },
      endLabel: { opacity: 0.16 },
    },
    select: { disabled: true },
    silent: false,
  };

  const series = [
    {
      name: "Massa/Intensitas Aksi Nasional",
      type: "line",
      xAxisIndex: 0,
      yAxisIndex: 0,
      smooth: false,
      symbol: "circle",
      symbolSize: 8,
      lineStyle: { width: 3, color: "#2D6FE9" },
      itemStyle: { color: "#2D6FE9", borderColor: "#ffffff", borderWidth: 1.5 },
      label: {
        show: true,
        position: "top",
        distance: 16,
        rich: buildCombinedActionRichStyles(),
        formatter(params) {
          if (!actionLabelIndexes.has(Number(params?.dataIndex))) return "";
          return formatCombinedActionLabel(params);
        },
      },
      endLabel: { show: false },
      labelLayout(params) {
        if (params.dataIndex === lastDataIndex) return { hideOverlap: false, moveOverlap: "none" };
        return { hideOverlap: true, moveOverlap: "shiftY" };
      },
      ...staticSeriesState,
      markLine: markLineData.length
        ? {
            symbol: ["none", "none"],
            silent: true,
            data: markLineData,
          }
        : undefined,
      markPoint: markPointData.length
        ? {
            symbol: "circle",
            symbolSize: 16,
            itemStyle: {
              color: "rgba(45,111,233,0.25)",
              borderColor: "rgba(191,219,254,0.95)",
              borderWidth: 2,
              shadowBlur: 12,
              shadowColor: "rgba(45,111,233,0.35)",
            },
            label: {
              show: false,
            },
            data: markPointData,
          }
        : undefined,
      data: actionLabelData,
    },
    {
      name: "Rupiah per USD",
      type: "line",
      xAxisIndex: 0,
      yAxisIndex: 1,
      smooth: false,
      symbol: "diamond",
      symbolSize: 7,
      lineStyle: { width: 2.5, type: "dashed", color: "#2F855A" },
      itemStyle: { color: "#2F855A" },
      label: {
        show: true,
        position: "top",
        distance: 6,
        rich: buildPriceMovementRichStyles(),
        formatter(params) {
          return formatPriceMovementLabel(params, data.rupiahLine, (item) => item?.actualRate);
        },
      },
      endLabel: { show: false },
      labelLayout(params) {
        if (params.dataIndex === lastDataIndex) return { hideOverlap: false, moveOverlap: "none" };
        return { hideOverlap: true, moveOverlap: "shiftY" };
      },
      ...staticSeriesState,
      markLine: {
        silent: true,
        symbol: ["none", "none"],
        label: {
          show: true,
          formatter: "Basis 100",
          color: "#c7d8ff",
          fontSize: 10,
          fontWeight: 700,
          backgroundColor: "rgba(91,122,186,0.25)",
          borderRadius: 6,
          padding: [2, 6],
        },
        lineStyle: {
          color: "rgba(199,216,255,0.3)",
          width: 1,
          type: "dashed",
        },
        data: [{ yAxis: 100 }],
      },
      data: data.rupiahLine,
    },
    {
      name: "Sembako Gabungan",
      type: "line",
      xAxisIndex: 0,
      yAxisIndex: 1,
      smooth: false,
      symbol: "circle",
      symbolSize(params) {
        return params?.data?.hasActualUpdate ? 8 : 5;
      },
      connectNulls: true,
      lineStyle: { width: 2.5, type: "dotted", color: "#7C3AED" },
      itemStyle: {
        color: "#7C3AED",
        borderColor: "#ffffff",
        borderWidth: 0.8,
        opacity: 1,
      },
      label: {
        show: true,
        position: "bottom",
        distance: 6,
        rich: buildPriceMovementRichStyles(),
        formatter(params) {
          return formatPriceMovementLabel(params, data.sembakoLine, (item) => item?.actualAverage);
        },
      },
      endLabel: { show: false },
      labelLayout(params) {
        const targetIndex = lastSembakoDataIndex >= 0 ? lastSembakoDataIndex : lastDataIndex;
        if (params.dataIndex === targetIndex) return { hideOverlap: false, moveOverlap: "none" };
        return { hideOverlap: true, moveOverlap: "shiftY" };
      },
      ...staticSeriesState,
      data: data.sembakoLine,
    },
    ...data.fuelLines.map((fuelLine, fuelLineIndex) => ({
      name: fuelLine.name,
      type: "line",
      xAxisIndex: 1,
      yAxisIndex: 2,
      smooth: false,
      symbol: "circle",
      symbolSize: 5,
      lineStyle: {
        width: 2.2,
        color: fuelLine.color,
      },
      itemStyle: {
        color: fuelLine.color,
        borderColor: "#ffffff",
        borderWidth: 0.8,
      },
      label: {
        show: true,
        position: fuelLineIndex % 2 === 0 ? "top" : "bottom",
        distance: 7 + ((fuelLineIndex % 3) * 3),
        rich: buildPriceMovementRichStyles({
          fontSize: 10,
          padding: [2, 5],
        }),
        formatter(params) {
          return formatPriceMovementLabel(params, fuelLine.data, (item) => item?.actualPrice);
        },
      },
      ...staticSeriesState,
      endLabel: { show: false },
      labelLayout(params) {
        const targetIndex = lastFuelIndexes.get(fuelLine.name);
        if (params.dataIndex === targetIndex) return { hideOverlap: false, moveOverlap: "none" };
        return { hideOverlap: true, moveOverlap: "shiftY" };
      },
      data: fuelLine.data.map((item) =>
        item
          ? {
              value: item.actualPrice,
              actualPrice: item.actualPrice,
              indexValue: item.value,
            }
          : null
      ),
    })),
  ];

  combinedChartInstance.setOption(
    {
      backgroundColor: "transparent",
      animation: true,
      legend: {
        type: "scroll",
        top: 0,
        left: combinedGridLeft,
        right: 18,
        textStyle: { color: "#E6F0FF" },
        pageIconColor: "#E6F0FF",
        pageTextStyle: { color: "#E6F0FF" },
      },
      title: [
        {
          text: "Panel utama: aksi nasional, rupiah, dan sembako pada sumbu waktu yang sama",
          left: combinedGridLeft,
          top: 42,
          textStyle: {
            color: "rgba(230,240,255,0.82)",
            fontSize: 11,
            fontWeight: 700,
          },
        },
        {
          text: "Panel bawah: harga aktual BBM (Rp/liter) pada sumbu waktu yang sama",
          left: combinedGridLeft,
          top: "67%",
          textStyle: {
            color: "rgba(230,240,255,0.82)",
            fontSize: 11,
            fontWeight: 700,
          },
        },
      ],
      axisPointer: {
        link: [{ xAxisIndex: [0, 1] }],
      },
      grid: [
        {
          left: combinedGridLeft,
          right: combinedGridRight,
          top: 82,
          height: "42%",
          containLabel: false,
        },
        {
          left: combinedGridLeft,
          right: combinedGridRight,
          top: "71%",
          height: "21%",
          containLabel: false,
        },
      ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0, 1],
          filterMode: "none",
        },
      ],
      tooltip: {
        trigger: "axis",
        axisPointer: {
          type: "line",
          snap: true,
        },
        backgroundColor: "rgba(7,12,24,0.96)",
        borderColor: "rgba(124,165,255,0.22)",
        borderWidth: 1,
        textStyle: { color: "#E6F0FF", fontSize: 12 },
        formatter(params) {
          const axisValue = params.find((param) => param?.axisValue != null)?.axisValue;
          let index = data.categories.indexOf(String(axisValue));
          if (index < 0) {
            index = params?.[0]?.dataIndex ?? 0;
          }
          const lines = [`<strong>${escapeHtml(formatDateLong(data.dates[index]))}</strong>`, `<span style="color:#9BC0FF;">Panel utama menampilkan aksi, rupiah, dan sembako; panel bawah menampilkan harga aktual BBM.</span>`];
          const actionItem = data.actionLine[index];
          if (actionItem && Number.isFinite(Number(actionItem.value))) {
            lines.push(`● ${escapeHtml("Massa/Intensitas Aksi Nasional")}: indeks ${escapeHtml(formatIndexNumber(Number(actionItem.value)))} | ${escapeHtml(formatNumberId(Number(actionItem.wilayahCount || 0)))} wilayah | ${escapeHtml(toStr(actionItem.dominantWilayah || "—"))}`);
          }
          const rupiahItem = data.rupiahLine[index];
          if (rupiahItem && Number.isFinite(Number(rupiahItem.value))) {
            lines.push(`● ${escapeHtml("Rupiah per USD")}: indeks ${escapeHtml(formatIndexNumber(Number(rupiahItem.value)))} | ${escapeHtml(formatIdr(Number(rupiahItem.actualRate || 0)))} per USD`);
          }
          const sembakoItem = data.sembakoLine[index];
          if (sembakoItem && Number.isFinite(Number(sembakoItem.value))) {
            const sourceInfo = sembakoItem.hasActualUpdate
              ? `update aktual ${formatDateShort(sembakoItem.sourceDate || data.dates[index])}`
              : `carry-forward dari ${formatDateShort(sembakoItem.sourceDate || data.dates[index])}`;
            lines.push(`● ${escapeHtml("Sembako Gabungan")}: indeks ${escapeHtml(formatIndexNumber(Number(sembakoItem.value)))} | rerata ${escapeHtml(formatIdr(Number(sembakoItem.actualAverage || 0)))} | ${escapeHtml(sourceInfo)}`);
          }
          data.fuelLines.forEach((fuelLine) => {
            const fuelItem = fuelLine.data[index];
            if (!fuelItem || !Number.isFinite(Number(fuelItem.actualPrice))) return;
            lines.push(`● ${escapeHtml(fuelLine.name)}: ${escapeHtml(formatIdr(Number(fuelItem.actualPrice)))} | indeks ${escapeHtml(formatIndexNumber(Number(fuelItem.value || 0)))}`);
          });
          return lines.join("<br/>");
        },
      },
      xAxis: [
        {
          type: "category",
          gridIndex: 0,
          data: data.categories,
          boundaryGap: false,
          axisLine: {
            show: false,
            lineStyle: { color: "rgba(255,255,255,0.2)", width: 1 },
          },
          axisTick: {
            show: false,
            alignWithLabel: true,
            lineStyle: { color: "rgba(255,255,255,0.3)" },
          },
          axisLabel: {
            show: false,
            color: "#E6F0FF",
            fontSize: 11,
            fontWeight: 700,
          },
          splitLine: { show: false },
        },
        {
          type: "category",
          gridIndex: 1,
          data: data.categories,
          boundaryGap: false,
          axisLine: {
            lineStyle: { color: "rgba(255,255,255,0.2)", width: 1 },
          },
          axisTick: {
            show: true,
            alignWithLabel: true,
            lineStyle: { color: "rgba(255,255,255,0.3)" },
          },
          axisLabel: {
            color: "#E6F0FF",
            fontSize: 11,
            fontWeight: 700,
            formatter(value) {
              return highlightedCategories.has(String(value)) ? `{highlight|${value}}` : value;
            },
            rich: {
              highlight: {
                color: "#ffe08a",
                fontWeight: 900,
                backgroundColor: "rgba(246,196,83,0.16)",
                borderRadius: 6,
                padding: [2, 4],
              },
            },
          },
          name: "Tanggal",
          nameLocation: "middle",
          nameGap: 30,
          nameTextStyle: {
            color: "#9BC0FF",
            fontSize: 12,
            fontWeight: 700,
          },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          type: "value",
          gridIndex: 0,
          min: 0,
          max: leftMax,
          splitNumber: 6,
          position: "left",
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "#9BC0FF",
            fontSize: 11,
            fontWeight: 700,
            formatter(value) {
              return formatIndexNumber(Number(value));
            },
          },
          splitLine: {
            lineStyle: {
              color: "rgba(116,155,240,0.12)",
              type: "dashed",
            },
          },
          name: "Indeks Aksi (Awal = 100)",
          nameLocation: "middle",
          nameGap: 52,
          nameTextStyle: {
            color: "#9BC0FF",
            fontSize: 12,
            fontWeight: 700,
          },
        },
        {
          type: "value",
          gridIndex: 0,
          min: comparativeMin,
          max: comparativeMax,
          splitNumber: 6,
          position: "right",
          offset: 0,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "#E6F0FF",
            fontSize: 11,
            fontWeight: 700,
            margin: 10,
            formatter(value) {
              return formatIndexNumber(Number(value));
            },
          },
          splitLine: {
            lineStyle: {
              color: "rgba(116,155,240,0.1)",
              type: "dashed",
            },
          },
          name: "Indeks Komparatif (Awal = 100)",
          nameLocation: "middle",
          nameRotate: 270,
          nameGap: 38,
          nameTextStyle: {
            color: "#E6F0FF",
            fontSize: 12,
            fontWeight: 700,
            align: "center",
            verticalAlign: "middle",
          },
        },
        {
          type: "value",
          gridIndex: 1,
          min: minFuelPrice,
          max: maxFuelPrice,
          splitNumber: 5,
          position: "right",
          offset: 0,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: {
            color: "#E6F0FF",
            fontSize: 10,
            fontWeight: 700,
            margin: 10,
            formatter(value) {
              return formatIdr(Number(value));
            },
          },
          splitLine: {
            lineStyle: {
              color: "rgba(116,155,240,0.1)",
              type: "dashed",
            },
          },
          name: "Harga Aktual BBM (Rp/liter)",
          nameLocation: "middle",
          nameRotate: 270,
          nameGap: 38,
          nameTextStyle: {
            color: "#E6F0FF",
            fontSize: 11,
            fontWeight: 700,
            align: "center",
            verticalAlign: "middle",
          },
        },
      ],
      series,
    },
    true
  );

  combinedChartInstance.resize();
  window.requestAnimationFrame(() => renderCombinedSeriesLabels());
}

function renderCombinedOverview(actionSeries, exchangeSeries, fuelSeries, commoditySeries) {
  const data = buildCombinedChartData(actionSeries, exchangeSeries, fuelSeries, commoditySeries);
  updateCombinedSummaryBar(data);
  updateCombinedLegend();
  updateCombinedGuide(data);
  updateCombinedMeta(data);
  updateCombinedInsights(data);
  renderCombinedChart(data);
}

// Update applyFilter and resetFilter to include fuel data
function applyFilter() {
  const start = els.filterStartDate.value;
  const end = els.filterEndDate.value;
  if (!start && !end) {
    renderPageWithSeries(fullChartSeries);
    renderPageWithExchangeSeries(fullExchangeRateChartData);
    renderPageWithFuelSeries(fullFuelPriceData);
    renderPageWithCommoditySeries(fullCommodityPriceData);
    renderCombinedOverview(fullChartSeries, fullExchangeRateChartData, fullFuelPriceData, fullCommodityPriceData);
    return;
  }
  if (!start || !end) {
    toast("Mohon isi kedua tanggal.");
    return;
  }
  const startDate = toDateOnly(start);
  const endDate = toDateOnly(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    toast("Tanggal tidak valid.");
    return;
  }
  if (endDate < startDate) {
    toast("Tanggal akhir tidak boleh sebelum tanggal mulai.");
    return;
  }
  // Enforce max 30-day window
  const diffMs = endDate - startDate;
  const maxMs = (FILTER_MAX_DAYS - 1) * 24 * 60 * 60 * 1000;
  if (diffMs > maxMs) {
    toast(`Rentang tanggal tidak boleh lebih dari ${FILTER_MAX_DAYS} hari.`);
    return;
  }
  // Filter action chart
  const filteredActions = fullChartSeries.filter((day) => {
    const dayDate = toDateOnly(day.tanggalIso);
    return dayDate >= startDate && dayDate <= endDate;
  });
  renderPageWithSeries(filteredActions);
  // Filter exchange chart to exactly match filtered action dates
  const filteredActionDates = new Set(filteredActions.map(day => day.tanggalIso));
  const filteredExchange = fullExchangeRateChartData.filter((day) => {
    const dayDateStr = formatLocalIsoDate(day.fullDate);
    return filteredActionDates.has(dayDateStr);
  });
  renderPageWithExchangeSeries(filteredExchange);
  // Filter fuel chart
  const filteredFuel = fullFuelPriceData.filter((day) => {
    return filteredActionDates.has(day.date);
  });
  renderPageWithFuelSeries(filteredFuel);
  const filteredCommodity = fullCommodityPriceData.filter((day) => {
    return filteredActionDates.has(day.date);
  });
  renderPageWithCommoditySeries(filteredCommodity);
  renderCombinedOverview(filteredActions, filteredExchange, filteredFuel, filteredCommodity);
}

function resetFilter() {
  if (filterGlobalMinDate && filterGlobalMaxDate) {
    const todayIso = getTodayIsoDate();
    const defaultEndDate = filterGlobalMaxDate < todayIso ? filterGlobalMaxDate : todayIso;
    const defaultStartDate = getEffectiveChartFilterMin(defaultEndDate, filterGlobalMinDate);
    els.filterEndDate.value = defaultEndDate;
    els.filterStartDate.value = defaultStartDate;
    syncFilterInputBounds("end");
    applyFilter();
    return;
  }
  els.filterStartDate.value = "";
  els.filterEndDate.value = "";
  renderPageWithSeries(fullChartSeries);
  renderPageWithExchangeSeries(fullExchangeRateChartData);
  renderPageWithFuelSeries(fullFuelPriceData);
  renderPageWithCommoditySeries(fullCommodityPriceData);
  renderCombinedOverview(fullChartSeries, fullExchangeRateChartData, fullFuelPriceData, fullCommodityPriceData);
}

// Update loadChartPage to also load fuel data
async function loadChartPage() {
  if (els.chartSubtitle) els.chartSubtitle.textContent = "Memuat periode grafik nasional…";
  els.chartMeta.textContent = "Mengambil dataset aktif…";
  try {
    const [metaRes, recRes] = await Promise.all([fetch("/api/active"), fetch("/api/active/records")]);
    if (!metaRes.ok || !recRes.ok) throw new Error("Gagal mengambil data dari server.");
    await metaRes.json();
    const recData = await recRes.json();
    const records = Array.isArray(recData?.records) ? recData.records : [];
    const series = buildDailySeries(records);

    // Store full series
    fullChartSeries = series;
    currentChartSeries = series;

    els.chartPeriod.textContent = buildPeriodLabel(series);
    syncChartSubtitleWithPeriod(series);
    els.chartMeta.textContent = series.length
      ? `${formatNumberId(series.length)} hari pengamatan • ${formatNumberId(records.length)} data aksi`
      : "Belum ada data aksi untuk dihitung";

    renderStats(series);
    renderChart(series);
    renderBreakdown(series);
    const todayIso = getTodayIsoDate();
    const actionMinDate = fullChartSeries.length ? fullChartSeries[0].tanggalIso : "";
    const actionMaxDate = fullChartSeries.length ? fullChartSeries[fullChartSeries.length - 1].tanggalIso : "";
    const initialFilterMaxDate = actionMaxDate && actionMaxDate < todayIso ? actionMaxDate : todayIso;
    const initialFilterMinDate = getEffectiveChartFilterMin(initialFilterMaxDate, actionMinDate);
    const actionDates = buildExternalRequestDates(fullChartSeries, initialFilterMinDate, initialFilterMaxDate);

    // Load external charts only for the active filter window.
    await Promise.all([
      loadExchangeRateData(actionDates),
      loadFuelPriceData(actionDates),
      loadCommodityPriceData(actionDates)
    ]);
    renderCombinedOverview(fullChartSeries, fullExchangeRateChartData, fullFuelPriceData, fullCommodityPriceData);
    
    // Filter input should follow today-based 30-day window, not the intersection of all charts
    if (actionMinDate && actionMaxDate) {
      filterGlobalMaxDate = actionMaxDate < todayIso ? actionMaxDate : todayIso;
      filterGlobalMinDate = getEffectiveChartFilterMin(filterGlobalMaxDate, actionMinDate);
      els.filterStartDate.min = filterGlobalMinDate;
      els.filterStartDate.max = filterGlobalMaxDate;
      els.filterEndDate.min = filterGlobalMinDate;
      els.filterEndDate.max = filterGlobalMaxDate;

      const defaultEndDate = filterGlobalMaxDate;
      const defaultStartDate = getEffectiveChartFilterMin(defaultEndDate, filterGlobalMinDate);
      els.filterEndDate.value = defaultEndDate;
      els.filterStartDate.value = defaultStartDate;
      syncFilterInputBounds("end");
      applyFilter();
    } else {
      filterGlobalMinDate = getEffectiveChartFilterMin(todayIso);
      filterGlobalMaxDate = todayIso;
      els.filterStartDate.min = filterGlobalMinDate;
      els.filterStartDate.max = filterGlobalMaxDate;
      els.filterEndDate.min = filterGlobalMinDate;
      els.filterEndDate.max = filterGlobalMaxDate;
      els.filterEndDate.value = todayIso;
      els.filterStartDate.value = filterGlobalMinDate;
      syncFilterInputBounds("end");
    }
  } catch (error) {
    if (els.chartSubtitle) els.chartSubtitle.textContent = "Gagal memuat periode grafik";
    els.chartPeriod.textContent = "Periksa koneksi atau status server";
    els.chartMeta.textContent = toStr(error?.message) || "Terjadi kesalahan";
    els.nationalChart.innerHTML = `<div class="massChart__empty">Gagal memuat grafik. Silakan refresh halaman.</div>`;
    els.chartBreakdownBody.innerHTML = `<tr><td colspan="4">Gagal memuat data rincian harian.</td></tr>`;
    toast(toStr(error?.message) || "Gagal memuat data grafik.");
  }
}

els.reloadChartBtn?.addEventListener("click", () => {
  loadChartPage();
});

els.filterBtn?.addEventListener("click", () => {
  applyFilter();
});

els.filterStartDate?.addEventListener("change", () => {
  syncFilterInputBounds("start");
});

els.filterEndDate?.addEventListener("change", () => {
  syncFilterInputBounds("end");
});

els.resetFilterBtn?.addEventListener("click", () => {
  resetFilter();
});



loadChartPage();
