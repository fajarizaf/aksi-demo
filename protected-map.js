const protectedMapEls = {
  realtimeClock: document.getElementById("realtimeClock"),
  protectedLogoutBtn: document.getElementById("protectedLogoutBtn"),
};

function padTimePart(value) {
  return String(value).padStart(2, "0");
}

function renderRealtimeClock() {
  if (!protectedMapEls.realtimeClock) return;
  const now = new Date();
  const day = padTimePart(now.getDate());
  const month = now.toLocaleString("id-ID", { month: "short" }).toUpperCase();
  const year = now.getFullYear();
  const hours = padTimePart(now.getHours());
  const minutes = padTimePart(now.getMinutes());
  const seconds = padTimePart(now.getSeconds());
  protectedMapEls.realtimeClock.innerHTML = `
    <div class="mapPanel__clockLabel">Jam Realtime</div>
    <div class="mapPanel__clockValue">${hours}:${minutes}:${seconds} WIB</div>
    <div class="mapPanel__clockDate">${day} ${month} ${year}</div>
  `;
}

function redirectProtectedMapToLogin() {
  window.location.href = "/login.html";
}

async function ensureProtectedMapSession() {
  const res = await fetch("/api/admin/auth/session");
  if (res.status === 401) {
    redirectProtectedMapToLogin();
    throw new Error("Silakan login terlebih dahulu.");
  }
  if (!res.ok) throw new Error(`Gagal memeriksa sesi (${res.status})`);
  return res.json().catch(() => ({}));
}

async function logoutProtectedMap() {
  await fetch("/api/admin/auth/logout", { method: "POST" }).catch(() => null);
  redirectProtectedMapToLogin();
}

protectedMapEls.protectedLogoutBtn?.addEventListener("click", async () => {
  await logoutProtectedMap();
});

renderRealtimeClock();
window.setInterval(renderRealtimeClock, 1000);
ensureProtectedMapSession().catch(() => null);
