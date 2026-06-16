const els = {
  loginForm: document.getElementById("loginForm"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  toast: document.getElementById("toast"),
};

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

async function ensureSession() {
  const res = await fetch("/api/admin/auth/session");
  if (res.ok) {
    window.location.href = "/admin.html";
  }
}

els.loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = {
    username: toStr(els.usernameInput.value),
    password: String(els.passwordInput.value || ""),
  };
  try {
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Login gagal (${res.status})`);
    }
    window.location.href = "/admin.html";
  } catch (err) {
    toast(toStr(err?.message || err));
  }
});

ensureSession().catch(() => null);
