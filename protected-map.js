const protectedMapEls = {
  protectedLogoutBtn: document.getElementById("protectedLogoutBtn"),
};

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

ensureProtectedMapSession().catch(() => null);
