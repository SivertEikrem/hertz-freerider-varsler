/* Freerider-ruter: enkel klientside-app for å redigere config.json i repoet
 * ditt via GitHub sitt Contents API. Ingenting sendes til noen server unntatt
 * api.github.com - GitHub-tokenen krypteres med en selvvalgt kode og lagres
 * kun lokalt i denne nettleseren (localStorage). Koden lagres aldri noe sted.
 */

const LS_OWNER = "ffr_owner";
const LS_REPO = "ffr_repo";
const LS_ENC = "ffr_enc"; // kryptert token: {salt, iv, ciphertext}

let owner = localStorage.getItem(LS_OWNER) || "";
let repo = localStorage.getItem(LS_REPO) || "";
let pat = ""; // holdes kun i minnet, aldri lagret i klartekst

let watches = [];
let currentSha = null;
let stations = [];
let cities = [];
let fromMode = "station";
let toMode = "station";

const $ = (id) => document.getElementById(id);

function showStatus(message, kind) {
  const el = $("status");
  el.textContent = message;
  el.className = `status show ${kind}`;
}

function clearStatus() {
  $("status").className = "status";
}

/* ---------- base64 <-> UTF-8 / bytes ---------- */

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function bufferToBase64(buf) {
  let binary = "";
  buf.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function base64ToBuffer(b64) {
  const binary = atob(b64);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/* ---------- Kryptering av token (Web Crypto API: PBKDF2 + AES-GCM) ---------- */

async function deriveKey(code, saltBytes) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(code),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptToken(code, token) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(code, salt);
  const enc = new TextEncoder();
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(token)
  );
  return {
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    ciphertext: bufferToBase64(new Uint8Array(ciphertextBuf)),
  };
}

async function decryptToken(code, stored) {
  const salt = base64ToBuffer(stored.salt);
  const iv = base64ToBuffer(stored.iv);
  const ciphertext = base64ToBuffer(stored.ciphertext);
  const key = await deriveKey(code, salt);
  const plainBuf = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plainBuf);
}

function hasStoredToken() {
  return !!localStorage.getItem(LS_ENC);
}

function forgetEverything() {
  localStorage.removeItem(LS_OWNER);
  localStorage.removeItem(LS_REPO);
  localStorage.removeItem(LS_ENC);
  owner = repo = pat = "";
  $("routesPanel").style.display = "none";
  $("addPanel").style.display = "none";
  $("saveAllBtn").style.display = "none";
  $("unlockPanel").style.display = "none";
  showSettingsPanel(true);
  showStatus("Lagrede data er slettet fra denne nettleseren.", "info");
}

/* ---------- GitHub API ---------- */

async function githubRequest(path, options = {}) {
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...options,
    headers: {
      Authorization: `token ${pat}`,
      Accept: "application/vnd.github+json",
      ...(options.headers || {}),
    },
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(`GitHub svarte ${resp.status}: ${body.message || resp.statusText}`);
  }
  return resp.json();
}

async function loadConfig() {
  const data = await githubRequest("/contents/config.json");
  currentSha = data.sha;
  const parsed = JSON.parse(base64ToUtf8(data.content));
  watches = parsed.watches || [];
}

async function saveConfig() {
  const content = JSON.stringify({ watches }, null, 2);
  const body = {
    message: "Oppdater ruter via nettside",
    content: utf8ToBase64(content),
    sha: currentSha,
  };
  const data = await githubRequest("/contents/config.json", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  currentSha = data.content.sha;
}

/* ---------- Stasjonsdata (statisk fil, samme opphav) ---------- */

async function loadStations() {
  const resp = await fetch("stations.json");
  const data = await resp.json();
  stations = data.stations;
  cities = data.cities;
}

function populateSelect(select, mode) {
  const items = mode === "station" ? stations : cities;
  select.innerHTML = items
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

/* ---------- Rendering ---------- */

function describeWatch(watch) {
  const from = watch.from || `alle i ${watch.from_city}`;
  const to = watch.to || `alle i ${watch.to_city}`;
  return { from, to };
}

function renderRoutes() {
  const list = $("routeList");
  if (watches.length === 0) {
    list.innerHTML = `<div class="empty-state">Ingen ruter lagt til ennå. Bruk skjemaet under for å legge til den første.</div>`;
    return;
  }
  list.innerHTML = watches
    .map((watch, i) => {
      const { from, to } = describeWatch(watch);
      return `
        <div class="route-card">
          <div class="route-row">
            <span class="route-from">${escapeHtml(from)}</span>
            <span class="route-arrow">&#8594;</span>
            <span class="route-to">${escapeHtml(to)}</span>
          </div>
          <button class="remove-btn" data-index="${i}" type="button">Fjern denne ruten</button>
        </div>
        ${i < watches.length - 1 ? '<div class="lane-divider"></div>' : ""}
      `;
    })
    .join("");

  list.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index, 10);
      watches.splice(idx, 1);
      markDirty();
      renderRoutes();
    });
  });
}

function markDirty() {
  $("saveAllBtn").style.display = "block";
}

/* ---------- Paneler ---------- */

function showSettingsPanel(show) {
  $("settingsPanel").style.display = show ? "block" : "none";
  $("settingsToggle").style.display = hasStoredToken() ? "inline-block" : "none";
}

function showUnlockPanel(show) {
  $("unlockPanel").style.display = show ? "block" : "none";
}

function showAppPanels(show) {
  $("routesPanel").style.display = show ? "block" : "none";
  $("addPanel").style.display = show ? "block" : "none";
}

/* ---------- Lås opp med kode ---------- */

$("unlockBtn").addEventListener("click", async () => {
  const code = $("unlockCodeInput").value;
  if (!code) {
    showStatus("Skriv inn koden din.", "error");
    return;
  }
  const btn = $("unlockBtn");
  btn.disabled = true;
  btn.textContent = "Låser opp...";
  try {
    const stored = JSON.parse(localStorage.getItem(LS_ENC));
    pat = await decryptToken(code, stored);
    showUnlockPanel(false);
    await startApp();
  } catch (err) {
    showStatus("Feil kode - prøv igjen.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Lås opp";
  }
});

$("unlockForgetBtn").addEventListener("click", () => {
  forgetEverything();
});

$("unlockCodeInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("unlockBtn").click();
});

/* ---------- Innstillinger (førstegangsoppsett / endring) ---------- */

$("settingsToggle").addEventListener("click", () => {
  const willShow = $("settingsPanel").style.display === "none";
  $("settingsPanel").style.display = willShow ? "block" : "none";
  if (willShow) {
    $("ownerInput").value = owner;
    $("repoInput").value = repo;
    $("patInput").value = "";
    $("codeInput").value = "";
  }
});

$("saveSettingsBtn").addEventListener("click", async () => {
  const newOwner = $("ownerInput").value.trim();
  const newRepo = $("repoInput").value.trim();
  const newPat = $("patInput").value.trim();
  const newCode = $("codeInput").value;

  if (!newOwner || !newRepo || !newPat || !newCode) {
    showStatus("Fyll ut alle feltene, inkludert en kode.", "error");
    return;
  }

  const btn = $("saveSettingsBtn");
  btn.disabled = true;
  btn.textContent = "Krypterer og lagrer...";
  try {
    const encrypted = await encryptToken(newCode, newPat);
    owner = newOwner;
    repo = newRepo;
    pat = newPat;
    localStorage.setItem(LS_OWNER, owner);
    localStorage.setItem(LS_REPO, repo);
    localStorage.setItem(LS_ENC, JSON.stringify(encrypted));

    $("settingsPanel").style.display = "none";
    $("settingsToggle").style.display = "inline-block";
    await startApp();
  } catch (err) {
    showStatus(`Noe gikk galt: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Lagre og koble til";
  }
});

$("forgetSettingsBtn").addEventListener("click", () => {
  forgetEverything();
});

/* ---------- Legg til rute ---------- */

function setupModeToggle(toggleEl, onChange) {
  toggleEl.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onChange(btn.dataset.mode);
    });
  });
}

setupModeToggle($("fromModeToggle"), (mode) => {
  fromMode = mode;
  populateSelect($("fromSelect"), fromMode);
});

setupModeToggle($("toModeToggle"), (mode) => {
  toMode = mode;
  populateSelect($("toSelect"), toMode);
});

$("addRouteBtn").addEventListener("click", () => {
  const fromValue = $("fromSelect").value;
  const toValue = $("toSelect").value;
  if (!fromValue || !toValue) {
    showStatus("Velg både fra og til før du legger til.", "error");
    return;
  }
  const watch = {};
  watch[fromMode === "station" ? "from" : "from_city"] = fromValue;
  watch[toMode === "station" ? "to" : "to_city"] = toValue;
  watches.push(watch);
  markDirty();
  renderRoutes();
  clearStatus();
});

$("saveAllBtn").addEventListener("click", async () => {
  const btn = $("saveAllBtn");
  btn.disabled = true;
  btn.textContent = "Lagrer...";
  try {
    await saveConfig();
    btn.style.display = "none";
    showStatus("Lagret! Endringene er nå på GitHub.", "success");
  } catch (err) {
    showStatus(`Kunne ikke lagre: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Lagre endringer til GitHub";
  }
});

/* ---------- Oppstart ---------- */

async function startApp() {
  showStatus("Henter data...", "info");
  try {
    await Promise.all([loadConfig(), loadStations()]);
    populateSelect($("fromSelect"), fromMode);
    populateSelect($("toSelect"), toMode);
    renderRoutes();
    showAppPanels(true);
    clearStatus();
  } catch (err) {
    showStatus(`Kunne ikke koble til: ${err.message}`, "error");
    showSettingsPanel(true);
  }
}

async function bootstrap() {
  if (hasStoredToken()) {
    $("settingsToggle").style.display = "inline-block";
    showUnlockPanel(true);
  } else {
    $("settingsToggle").style.display = "none";
    showSettingsPanel(true);
  }
}

bootstrap();
