/* Freerider-ruter: enkel klientside-app for å redigere config.json i repoet
 * ditt via GitHub sitt Contents API. Ingenting sendes til noen server unntatt
 * api.github.com - token og repo-info lagres kun lokalt i denne nettleseren.
 */

const LS_OWNER = "ffr_owner";
const LS_REPO = "ffr_repo";
const LS_PAT = "ffr_pat";

let owner = localStorage.getItem(LS_OWNER) || "";
let repo = localStorage.getItem(LS_REPO) || "";
let pat = localStorage.getItem(LS_PAT) || "";

let watches = [];
let currentSha = null;
let stations = [];
let cities = [];
let fromMode = "station";
let toMode = "station";
let dirty = false;

const $ = (id) => document.getElementById(id);

function showStatus(message, kind) {
  const el = $("status");
  el.textContent = message;
  el.className = `status show ${kind}`;
}

function clearStatus() {
  const el = $("status");
  el.className = "status";
}

/* ---------- base64 <-> UTF-8 ---------- */

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
    throw new Error(
      `GitHub svarte ${resp.status}: ${body.message || resp.statusText}`
    );
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
  dirty = true;
  $("saveAllBtn").style.display = "block";
}

/* ---------- Oppsett / innstillinger ---------- */

function showSettingsPanel(show) {
  $("settingsPanel").style.display = show ? "block" : "none";
}

function hasSettings() {
  return owner && repo && pat;
}

$("settingsToggle").addEventListener("click", () => {
  const panel = $("settingsPanel");
  const willShow = panel.style.display === "none";
  showSettingsPanel(willShow);
  if (willShow) {
    $("ownerInput").value = owner;
    $("repoInput").value = repo;
    $("patInput").value = pat;
  }
});

$("saveSettingsBtn").addEventListener("click", async () => {
  owner = $("ownerInput").value.trim();
  repo = $("repoInput").value.trim();
  pat = $("patInput").value.trim();

  if (!owner || !repo || !pat) {
    showStatus("Fyll ut brukernavn, repo-navn og token.", "error");
    return;
  }

  localStorage.setItem(LS_OWNER, owner);
  localStorage.setItem(LS_REPO, repo);
  localStorage.setItem(LS_PAT, pat);

  showSettingsPanel(false);
  await bootstrap();
});

$("forgetSettingsBtn").addEventListener("click", () => {
  localStorage.removeItem(LS_OWNER);
  localStorage.removeItem(LS_REPO);
  localStorage.removeItem(LS_PAT);
  owner = repo = pat = "";
  $("routesPanel").style.display = "none";
  $("addPanel").style.display = "none";
  $("saveAllBtn").style.display = "none";
  showSettingsPanel(true);
  showStatus("Lagrede data er slettet fra denne nettleseren.", "info");
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
    dirty = false;
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

async function bootstrap() {
  if (!hasSettings()) {
    showSettingsPanel(true);
    return;
  }

  showStatus("Henter data...", "info");
  try {
    await Promise.all([loadConfig(), loadStations()]);
    populateSelect($("fromSelect"), fromMode);
    populateSelect($("toSelect"), toMode);
    renderRoutes();
    $("routesPanel").style.display = "block";
    $("addPanel").style.display = "block";
    clearStatus();
  } catch (err) {
    showStatus(`Kunne ikke koble til: ${err.message}`, "error");
    showSettingsPanel(true);
  }
}

bootstrap();
