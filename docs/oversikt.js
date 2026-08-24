/* Viser den ferskeste listen over ledige Freerider-biler, hentet fra
 * live-routes.json (som botten selv skriver hvert 15. minutt). Ingen
 * ekstern nettverkstrafikk herfra - alt leses fra samme nettsted.
 */

const $ = (id) => document.getElementById(id);

let allRoutes = [];

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
          Hentes fra ${formatDate(r.available_at)} &middot; senest levert ${formatDate(r.latest_return)}
        </div>
      </div>
      ${i < routes.length - 1 ? '<div class="lane-divider"></div>' : ""}
    `)
    .join("");
}

function applyFilter() {
  const q = $("filterInput").value.trim().toLowerCase();
  if (!q) {
    render(allRoutes);
    return;
  }
  const filtered = allRoutes.filter((r) =>
    [r.from, r.from_city, r.to, r.to_city]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
  render(filtered);
}

$("filterInput").addEventListener("input", applyFilter);

async function load() {
  try {
    const resp = await fetch(`live-routes.json?t=${Date.now()}`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    allRoutes = data.routes || [];
    $("updatedLine").textContent = `${allRoutes.length} ledige biler - sist oppdatert ${timeAgo(data.updated_at)}`;
    render(allRoutes);
  } catch (err) {
    $("updatedLine").textContent = "Kunne ikke laste listen.";
    $("liveList").innerHTML = `<div class="empty-state">Fant ikke live-routes.json ennå. Den opprettes av botten ved neste kjøring.</div>`;
  }
}

load();
