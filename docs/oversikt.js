/* Viser den ferskeste listen over ledige Freerider-biler, hentet fra
 * live-routes.json (som botten selv skriver hvert 15. minutt). Ingen
 * ekstern nettverkstrafikk herfra - alt leses fra samme nettsted.
 */

const $ = (id) => document.getElementById(id);

const LS_SORT_FIELD = "ffr_sort_field";
const LS_SORT_DIR = "ffr_sort_dir";

let allRoutes = [];
let sortField = localStorage.getItem(LS_SORT_FIELD) || "available_at";
let sortDir = localStorage.getItem(LS_SORT_DIR) || "asc"; // "asc" eller "desc"

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

const NORSKE_UKEDAGER = ["søn", "man", "tir", "ons", "tor", "fre", "lør"]; // JS: søndag=0
const NORSKE_MAANEDER = [
  "jan", "feb", "mar", "apr", "mai", "jun",
  "jul", "aug", "sep", "okt", "nov", "des",
];

function formatDate(iso) {
  if (!iso) return "ukjent";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const ukedag = NORSKE_UKEDAGER[d.getDay()];
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${ukedag} ${d.getDate()}. ${NORSKE_MAANEDER[d.getMonth()]} kl. ${hh}:${mm}`;
}

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return "akkurat nå";
  if (diffMin === 1) return "1 minutt siden";
  if (diffMin < 60) return `${diffMin} minutter siden`;
  const hours = Math.round(diffMin / 60);
  return `${hours} time${hours === 1 ? "" : "r"} siden`;
}

/** Returnerer {text, urgent} - en kort "om X timer/dager"-tekst, og om det haster (< 24t). */
function timeUntil(iso) {
  if (!iso) return { text: "", urgent: false };
  const diffMs = new Date(iso).getTime() - Date.now();
  if (isNaN(diffMs)) return { text: "", urgent: false };
  if (diffMs <= 0) return { text: "utløpt", urgent: true };

  const diffMin = Math.round(diffMs / 60000);
  const hours = Math.floor(diffMin / 60);
  const days = Math.floor(hours / 24);

  let text;
  if (days >= 1) {
    text = `om ${days} dag${days === 1 ? "" : "er"}`;
  } else if (hours >= 1) {
    text = `om ${hours} time${hours === 1 ? "" : "r"}`;
  } else {
    text = `om ${diffMin} min`;
  }
  return { text, urgent: hours < 24 };
}

/* ---------- Sortering ---------- */

function compareRoutes(a, b) {
  let result;
  if (sortField === "from" || sortField === "to" || sortField === "car_model") {
    result = (a[sortField] || "").localeCompare(b[sortField] || "", "nb");
  } else {
    // Datofelter: manglende dato havner alltid sist, uansett retning
    const va = a[sortField] ? new Date(a[sortField]).getTime() : Infinity;
    const vb = b[sortField] ? new Date(b[sortField]).getTime() : Infinity;
    result = va - vb;
  }
  return sortDir === "desc" ? -result : result;
}

function applySortAndFilter() {
  const q = $("filterInput").value.trim().toLowerCase();
  let list = allRoutes;
  if (q) {
    list = list.filter((r) =>
      [r.from, r.from_city, r.to, r.to_city].join(" ").toLowerCase().includes(q)
    );
  }
  list = [...list].sort(compareRoutes);
  render(list);
}

function updateSortDirButton() {
  $("sortDirBtn").innerHTML = sortDir === "asc" ? "&#9650;" : "&#9660;"; // ▲ / ▼
}

$("sortField").value = sortField;
updateSortDirButton();

$("sortField").addEventListener("change", () => {
  sortField = $("sortField").value;
  localStorage.setItem(LS_SORT_FIELD, sortField);
  applySortAndFilter();
});

$("sortDirBtn").addEventListener("click", () => {
  sortDir = sortDir === "asc" ? "desc" : "asc";
  localStorage.setItem(LS_SORT_DIR, sortDir);
  updateSortDirButton();
  applySortAndFilter();
});

$("filterInput").addEventListener("input", applySortAndFilter);

/* ---------- Rendering ---------- */

function render(routes) {
  const list = $("liveList");
  if (routes.length === 0) {
    list.innerHTML = `<div class="empty-state">Ingen treff.</div>`;
    return;
  }
  list.innerHTML = routes
    .map((r, i) => {
      const countdown = timeUntil(r.expire_time);
      return `
      <div class="route-card">
        <div class="route-row">
          <span class="route-from">${escapeHtml(r.from)}</span>
          <span class="route-arrow">&#8594;</span>
          <span class="route-to">${escapeHtml(r.to)}</span>
        </div>
        <div class="route-meta">
          ${escapeHtml(r.car_model)}<br />
          Tilgjengelig fra ${formatDate(r.available_at)}<br />
          <span class="${countdown.urgent ? "urgent" : ""}">Hentefrist ${formatDate(r.expire_time)}${
        countdown.text ? ` (${countdown.text})` : ""
      }</span>
        </div>
      </div>
      ${i < routes.length - 1 ? '<div class="lane-divider"></div>' : ""}
    `;
    })
    .join("");
}

let lastUpdatedAt = null;

async function load() {
  try {
    const resp = await fetch(`live-routes.json?t=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    allRoutes = data.routes || [];
    lastUpdatedAt = data.updated_at;
    updateUpdatedLine();
    applySortAndFilter();
    document.title = allRoutes.length > 0 ? `(${allRoutes.length}) Ledige biler` : "Ledige biler - Freerider";
  } catch (err) {
    $("updatedLine").textContent = "Kunne ikke laste listen.";
    $("liveList").innerHTML = `<div class="empty-state">Fant ikke live-routes.json ennå. Den opprettes av botten ved neste kjøring.</div>`;
  }
}

function updateUpdatedLine() {
  if (!lastUpdatedAt) return;
  $("updatedLine").textContent = `${allRoutes.length} ledige biler - sist oppdatert ${timeAgo(lastUpdatedAt)}`;
}

// Frisk opp "sist oppdatert for X minutter siden"-teksten jevnlig, uten å hente nye data
setInterval(updateUpdatedLine, 30 * 1000);

// Hent faktisk nye data hvert 3. minutt
setInterval(load, 3 * 60 * 1000);

load();
