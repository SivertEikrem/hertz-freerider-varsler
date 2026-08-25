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

function formatDate(iso) {
  if (!iso) return "ukjent";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("nb-NO", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    .map((r, i) => `
      <div class="route-card">
        <div class="route-row">
          <span class="route-from">${escapeHtml(r.from)}</span>
          <span class="route-arrow">&#8594;</span>
          <span class="route-to">${escapeHtml(r.to)}</span>
        </div>
        <div class="route-meta">
          ${escapeHtml(r.car_model)}<br />
          Tilgjengelig fra ${formatDate(r.available_at)} &middot; hentefrist ${formatDate(r.expire_time)}
        </div>
      </div>
      ${i < routes.length - 1 ? '<div class="lane-divider"></div>' : ""}
    `)
    .join("");
}

async function load() {
  try {
    const resp = await fetch(`live-routes.json?t=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    allRoutes = data.routes || [];
    $("updatedLine").textContent = `${allRoutes.length} ledige biler - sist oppdatert ${timeAgo(data.updated_at)}`;
    applySortAndFilter();
  } catch (err) {
    $("updatedLine").textContent = "Kunne ikke laste listen.";
    $("liveList").innerHTML = `<div class="empty-state">Fant ikke live-routes.json ennå. Den opprettes av botten ved neste kjøring.</div>`;
  }
}

load();
