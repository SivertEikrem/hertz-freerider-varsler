/* Freerider-ruter: enkel klientside-app for å redigere config.json i repoet
 * ditt via GitHub sitt Contents API.
 *
 * Selve GitHub-tokenen lagres kryptert INNE I REPOET (docs/token.enc.json),
 * låst med en kode du selv velger. Det betyr at du kun trenger å skrive inn
 * den ekte tokenen ÉN gang (ved førstegangsoppsett) - alle enheter/nettlesere
 * deretter trenger bare koden, siden den krypterte filen hentes fra repoet.
 * REPO_OWNER/REPO_NAME kommer fra config.js.
 */

const TOKEN_FILE_PATH = "docs/token.enc.json"; // sti i selve repoet (Contents API)
const TOKEN_FILE_URL = "token.enc.json"; // relativ sti når GitHub Pages serverer den

let pat = ""; // holdes kun i minnet denne økten, aldri lagret i klartekst
let encryptedTokenSha = null; // trengs for å OPPDATERE token.enc.json senere

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

/* ---------- GitHub API ---------- */

async function githubRequest(path, options = {}) {
  const resp = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}${path}`,
    {
      ...options,
      headers: {
        Authorization: `token ${pat}`,
        Accept: "application/vnd.github+json",
        ...(options.headers || {}),
      },
    }
  );
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

/** Henter den krypterte token-filen direkte fra nettsiden (offentlig, ingen
 * auth nødvendig - samme opphav). Returnerer null hvis den ikke finnes ennå. */
async function fetchEncryptedTokenBlob() {
  const resp = await fetch(`${TOKEN_FILE_URL}?t=${Date.now()}`);
  if (resp.status === 404) return null;
  if (!resp.ok) throw new Error(`Kunne ikke hente token-fil (HTTP ${resp.status})`);
  return resp.json();
}

/** Skriver/oppdaterer den krypterte token-filen i repoet via GitHub API.
 * Krever at 'pat' allerede er satt (fra input eller fra en tidligere opplåsing). */
async function writeEncryptedTokenBlob(encryptedObj) {
  // Finn eksisterende sha først, hvis filen allerede finnes (trengs for å oppdatere).
  let sha = null;
  try {
    const existing = await githubRequest(`/contents/${TOKEN_FILE_PATH}`);
    sha = existing.sha;
  } catch (e) {
    // Finnes ikke ennå - helt greit, da opprettes den for første gang.
  }
  const body = {
    message: "Oppdater kryptert token",
    content: utf8ToBase64(JSON.stringify(encryptedObj)),
    ...(sha ? { sha } : {}),
  };
  await githubRequest(`/contents/${TOKEN_FILE_PATH}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  if (show) {
    $("patInput").value = "";
    $("codeInput").value = "";
  }
}

function showUnlockPanel(show) {
  $("unlockPanel").style.display = show ? "block" : "none";
}

function showAppPanels(show) {
  $("routesPanel").style.display = show ? "block" : "none";
  $("addPanel").style.display = show ? "block" : "none";
  $("settingsToggle").style.display = show ? "inline-block" : "none";
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
    const blob = await fetchEncryptedTokenBlob();
    pat = await decryptToken(code, blob);
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
  showUnlockPanel(false);
  showSettingsPanel(true);
  showStatus(
    "Sett opp på nytt: lim inn en (gjerne ny) token og velg en ny kode.",
    "info"
  );
});

$("unlockCodeInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") $("unlockBtn").click();
});

/* ---------- Førstegangsoppsett / endre token og kode ---------- */

$("settingsToggle").addEventListener("click", () => {
  showSettingsPanel($("settingsPanel").style.display === "none");
});

$("saveSettingsBtn").addEventListener("click", async () => {
  const newPat = $("patInput").value.trim();
  const newCode = $("codeInput").value;

  if (!newPat || !newCode) {
    showStatus("Fyll ut både token og en kode.", "error");
    return;
  }

  const btn = $("saveSettingsBtn");
  btn.disabled = true;
  btn.textContent = "Krypterer og lagrer...";
  try {
    pat = newPat; // brukes med det samme til å skrive selve token-filen
    const encrypted = await encryptToken(newCode, newPat);
    await writeEncryptedTokenBlob(encrypted);

    $("settingsPanel").style.display = "none";
    showStatus("Token lagret og kryptert i repoet.", "success");
    await startApp();
  } catch (err) {
    showStatus(`Noe gikk galt: ${err.message}`, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Krypter og lagre";
  }
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
  }
}

async function bootstrap() {
  showStatus("Sjekker oppsett...", "info");
  try {
    const blob = await fetchEncryptedTokenBlob();
    if (blob) {
      clearStatus();
      showUnlockPanel(true);
    } else {
      clearStatus();
      showSettingsPanel(true);
    }
  } catch (err) {
    showStatus(`Kunne ikke sjekke oppsett: ${err.message}`, "error");
    showSettingsPanel(true);
  }
}

bootstrap();
