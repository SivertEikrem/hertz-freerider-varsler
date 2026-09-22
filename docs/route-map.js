const CITY_COORDS = {
  "LINDESNES": [101.2, 675.7],
  "LYNGDAL": [103.2, 668.4],
  "EGERSUND": [80.8, 653.9],
  "STAVANGER": [75.3, 628.6],
  "HAUGESUND": [65.9, 607.2],
  "STORD": [70.6, 589.3],
  "BERGEN": [66.9, 559.6],
  "LINDÅS": [66.5, 549.4],
  "SKULESTADMO": [89.8, 548.0],
  "FLORØ": [61.0, 500.9],
  "FØRDE": [77.7, 508.1],
  "KAUPANGER": [105.9, 520.8],
  "SOGNDAL": [103.2, 518.8],
  "STRYN": [95.5, 486.3],
  "GEIRANGER": [105.3, 476.6],
  "ÅNDALSNES": [115.1, 453.7],
  "ØRSTA": [83.5, 471.7],
  "FOSNAVÅG": [73.3, 464.4],
  "ÅLESUND": [83.9, 458.6],
  "MOLDE": [105.1, 445.5],
  "KRISTIANSUND": [116.1, 427.5],
  "SUNNDALSØRA": [133.2, 448.9],
  "ORKANGER": [159.3, 417.8],
  "TRONDHEIM": [170.6, 412.0],
  "STEINKJER": [193.0, 383.3],
  "NAMSOS": [193.0, 361.5],
  "RØRVIK": [187.7, 342.5],
  "MOSJØEN": [227.5, 294.9],
  "SANDNESSJØEN": [216.1, 286.2],
  "BRØNNØYSUND": [207.7, 312.9],
  "MO I RANA": [246.9, 272.1],
  "GLOMFJORD": [243.6, 247.8],
  "BODØ": [252.2, 225.0],
  "STAMSUND": [241.1, 183.7],
  "SVOLVÆR": [255.4, 178.8],
  "LEKNES": [236.0, 182.7],
  "STOKMARKNES": [262.4, 162.3],
  "SORTLAND": [273.0, 156.0],
  "ANDENES": [287.2, 125.9],
  "NARVIK": [314.0, 168.6],
  "LILAND": [297.0, 160.9],
  "HARSTAD": [295.8, 151.1],
  "FINNSNES": [325.2, 130.3],
  "BARDUFOSS": [336.6, 138.5],
  "TROMSØ": [345.2, 109.9],
  "ALTA": [433.1, 94.3],
  "LAKSELV": [467.8, 89.9],
  "HAMMERFEST": [441.5, 60.8],
  "KIRKENES": [571.4, 106.0],
  "VADSØ": [565.3, 89.5],
  "KRISTIANSAND": [121.6, 668.4],
  "GRIMSTAD": [133.8, 659.2],
  "ARENDAL": [137.3, 653.4],
  "LARVIK": [163.0, 624.7],
  "SANDEFJORD": [166.9, 620.8],
  "TØNSBERG": [170.8, 614.0],
  "PORSGRUNN": [155.5, 620.3],
  "HALDEN": [190.8, 620.8],
  "FREDRIKSTAD": [181.4, 616.5],
  "SARPSBORG": [185.0, 613.5],
  "MOSS": [175.9, 606.3],
  "ASKIM": [186.1, 599.0],
  "SKI": [179.5, 592.2],
  "DRAMMEN": [166.5, 591.2],
  "BILLINGSTAD": [172.0, 585.4],
  "FORNEBU": [175.0, 583.4],
  "RUD": [172.6, 583.4],
  "OSLO": [177.7, 582.9],
  "SKEDSMOKORSET": [183.4, 579.5],
  "KONGSVINGER": [203.2, 569.3],
  "ELVERUM": [194.2, 535.8],
  "HAMAR": [184.2, 540.2],
  "LILLEHAMMER": [172.0, 524.7],
  "GOL": [141.0, 544.6],
  "HØNEFOSS": [167.7, 570.3],
  "KONGSBERG": [155.3, 594.6],
  "HUNNDALEN": [176.3, 540.2],
  "FAGERNES": [147.9, 530.0],
  "OTTA": [153.0, 492.6],
};

/* Grenser mellom landsdeler, i samme projeksjon som CITY_COORDS
 * (kun til visuell inndeling — ingen presis fylkesgrense). */
const MAP_REGION_LINES = [
  { y: 335.7, label: "NORD-NORGE" },
  { y: 457.1, label: "MIDT-NORGE" },
];
const MAP_VIEWBOX = { w: 620, h: 700 };

function mapEscapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/**
 * Bygger og setter inn et interaktivt, skjematisk Norges-kart basert på
 * gjeldende ledige ruter. Ikke geografisk presist — en stilisert
 * rutediagram-fremstilling, i tradisjonen til flyselskapers rutekart.
 *
 * @param {HTMLElement} container - elementet kartet settes inn i
 * @param {Array} liveRoutes - rader fra live-routes.json (samme format som appen ellers bruker)
 * @param {Function} onSelect - kalles med bynavn (eller null ved fjernet valg) når brukeren klikker et punkt
 * @returns {Function} clearSelection - kall denne for å nullstille valgt by utenfra (f.eks. fra et "Vis alle"-lenke)
 */
function renderRouteMap(container, liveRoutes, onSelect) {
  const now = Date.now();
  const URGENT_MS = 24 * 60 * 60 * 1000;

  // --- Aggreger per by og per rute-par ---
  const cityCounts = new Map(); // city -> antall treff (inn + ut)
  const pairs = new Map(); // "FRA→TIL" -> { from, to, count, urgent }

  liveRoutes.forEach((r) => {
    const from = r.from_city, to = r.to_city;
    if (!CITY_COORDS[from] || !CITY_COORDS[to]) return; // ukjent by, hopp over trygt

    cityCounts.set(from, (cityCounts.get(from) || 0) + 1);
    cityCounts.set(to, (cityCounts.get(to) || 0) + 1);

    const isUrgent = r.expire_time && new Date(r.expire_time).getTime() - now < URGENT_MS;
    const key = `${from}\u2192${to}`;
    const existing = pairs.get(key);
    if (existing) {
      existing.count += 1;
      existing.urgent = existing.urgent || isUrgent;
    } else {
      pairs.set(key, { from, to, count: 1, urgent: isUrgent });
    }
  });

  const activeCities = new Set(cityCounts.keys());

  // --- Bakgrunnspunkter (alle byer, svakt) ---
  let dimNodes = "";
  Object.keys(CITY_COORDS).forEach((name) => {
    if (activeCities.has(name)) return;
    const [x, y] = CITY_COORDS[name];
    dimNodes += `<circle class="map-node-dim" cx="${x}" cy="${y}" r="2.2"></circle>`;
  });

  // --- Regionlinjer ---
  let regionLines = "";
  MAP_REGION_LINES.forEach(({ y, label }) => {
    regionLines += `
      <line x1="20" y1="${y}" x2="${MAP_VIEWBOX.w - 20}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="1 6" />
      <text class="map-region-label" x="${MAP_VIEWBOX.w - 24}" y="${y - 8}" text-anchor="end">${label}</text>
    `;
  });

  // --- Buer mellom byer med ledige ruter ---
  let arcs = "";
  pairs.forEach((pair, key) => {
    const [x1, y1] = CITY_COORDS[pair.from];
    const [x2, y2] = CITY_COORDS[pair.to];
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    // Kontrollpunkt forskjøvet vinkelrett på linjen, alltid samme retning
    const bow = Math.min(dist * 0.18, 40);
    const cx = mx + (-dy / dist) * bow;
    const cy = my + (dx / dist) * bow;
    arcs += `<path class="map-arc${pair.urgent ? " urgent" : ""}" data-a="${mapEscapeHtml(pair.from)}" data-b="${mapEscapeHtml(pair.to)}" d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}"></path>`;
  });

  // --- Aktive bynoder + labels ---
  let nodes = "";
  activeCities.forEach((name) => {
    const [x, y] = CITY_COORDS[name];
    const count = cityCounts.get(name);
    const r = Math.min(5 + count * 1.4, 13);
    const labelRight = x < 500;
    const lx = labelRight ? x + r + 6 : x - r - 6;
    const anchor = labelRight ? "start" : "end";
    nodes += `
      <circle class="map-node-ring" cx="${x}" cy="${y}" r="${r + 5}"></circle>
      <circle class="map-node" data-city="${mapEscapeHtml(name)}" cx="${x}" cy="${y}" r="${r}"></circle>
      <text class="map-label" data-city="${mapEscapeHtml(name)}" x="${lx}" y="${y + 3.5}" text-anchor="${anchor}">${mapEscapeHtml(name)}${count > 1 ? ` (${count})` : ""}</text>
    `;
  });

  container.innerHTML = `
    <svg viewBox="0 0 ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.h}" role="img" aria-label="Skjematisk kart over ledige Freerider-ruter i Norge">
      ${regionLines}
      ${dimNodes}
      ${arcs}
      ${nodes}
    </svg>
  `;

  let selectedCity = null;

  function applySelection() {
    container.querySelectorAll(".map-arc").forEach((el) => {
      el.classList.remove("active", "dimmed");
      if (!selectedCity) return;
      const touches = el.dataset.a === selectedCity || el.dataset.b === selectedCity;
      el.classList.add(touches ? "active" : "dimmed");
    });
    container.querySelectorAll(".map-node, .map-label").forEach((el) => {
      const city = el.dataset.city;
      el.classList.remove("active", "dimmed");
      if (!selectedCity) return;
      if (city === selectedCity) {
        el.classList.add("active");
      } else {
        const connected = [...pairs.values()].some(
          (p) => (p.from === selectedCity && p.to === city) || (p.to === selectedCity && p.from === city)
        );
        if (!connected) el.classList.add("dimmed");
      }
    });
  }

  function selectCity(name) {
    selectedCity = selectedCity === name ? null : name;
    applySelection();
    if (onSelect) onSelect(selectedCity);
  }

  container.querySelectorAll(".map-node, .map-label").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => selectCity(el.dataset.city));
  });

  return function clearSelection() {
    selectedCity = null;
    applySelection();
  };
}
