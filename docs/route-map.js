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

/* Byer som er for tett pakket til å vises enkeltvis på Norges-kartet i
 * riktig skala (hele Oslofjord-regionen). Disse samles i én node på
 * hovedkartet, og vises i stedet enkeltvis i et eget, forstørret
 * detaljkart — samme prinsipp som store rutekart bruker for tette
 * storbyknutepunkter. */
const CLUSTER_ID = "OSLOFJORDEN";
const CLUSTER_LABEL = "OSLOFJORDEN";
const CLUSTER_MEMBERS = [
  "OSLO", "FORNEBU", "RUD", "BILLINGSTAD", "SKEDSMOKORSET", "SKI", "DRAMMEN",
  "ASKIM", "MOSS", "SARPSBORG", "FREDRIKSTAD", "HALDEN", "TØNSBERG",
  "SANDEFJORD", "LARVIK", "PORSGRUNN", "KONGSBERG", "HØNEFOSS", "KONGSVINGER",
];
const CLUSTER_ANCHOR = [178, 596]; // posisjon på hovedkartet

const MAP_REGION_LINES = [
  { y: 335.7, label: "NORD-NORGE" },
  { y: 457.1, label: "MIDT-NORGE" },
];
const MAP_VIEWBOX = { w: 620, h: 700, minY: 20, maxY: 700 };

// Forenklet, håndkalibrert silhuett av Norge i samme projeksjon som
// CITY_COORDS — kun ment som en svak visuell bakgrunn, ikke en presis
// kartgrense.
const NORWAY_OUTLINE_PATH =
  "M 101.2 675.7 C 96.4 668.4, 79.4 643.3, 72.6 632.0 C 65.8 620.7, 63.4 619.0, 60.4 607.7 " +
  "C 57.4 596.4, 56.3 581.0, 54.3 564.0 C 52.3 547.0, 45.5 522.3, 48.2 505.7 C 50.9 489.1, 60.1 476.1, 70.6 464.4 " +
  "C 81.1 452.7, 97.1 445.0, 111.4 435.3 C 125.7 425.6, 144.7 421.1, 156.3 406.1 C 167.9 391.1, 170.6 367.6, 180.8 345.4 " +
  "C 191.0 323.1, 207.3 292.8, 217.5 272.6 C 227.7 252.4, 240.0 239.4, 242.0 224.0 C 244.0 208.6, 222.6 194.1, 229.7 180.3 " +
  "C 236.8 166.5, 266.4 153.1, 284.8 141.4 C 303.2 129.7, 319.5 122.9, 339.9 109.9 C 360.3 97.0, 383.1 75.0, 407.2 63.7 " +
  "C 431.3 52.4, 466.0 41.9, 484.7 41.9 C 503.4 41.9, 505.4 54.4, 519.4 63.7 C 533.4 73.0, 559.6 90.4, 568.4 97.7 " +
  "C 577.2 105.0, 580.6 99.3, 572.4 107.4 C 564.2 115.5, 545.9 140.6, 519.4 146.3 C 492.9 152.0, 444.9 137.4, 413.3 141.4 " +
  "C 381.7 145.4, 355.5 141.4, 329.7 170.6 C 303.9 199.8, 278.4 275.8, 258.3 316.3 C 238.2 356.8, 218.5 385.1, 209.3 413.4 " +
  "C 200.1 441.7, 203.5 466.1, 203.2 486.3 C 202.9 506.6, 206.6 520.3, 207.3 534.9 C 208.0 549.5, 209.7 559.5, 207.3 573.7 " +
  "C 204.9 587.9, 198.1 611.0, 193.0 619.9 C 187.9 628.8, 182.1 624.7, 176.7 627.1 C 171.3 629.5, 169.6 627.5, 160.4 634.4 " +
  "C 151.2 641.3, 131.5 661.5, 121.6 668.4 C 111.7 675.3, 104.6 674.5, 101.2 675.7 Z";
const MIN_CROP_HEIGHT = 260;
const CROP_PADDING = 70;

function mapEscapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/** Slår sammen etiketter som havner for nær hverandre vertikalt, ved å
 * dytte de nederste litt lenger ned. Jobber separat på venstre- og
 * høyre-ankrede etiketter, siden de ikke kan kollidere med hverandre. */
function resolveLabelOverlap(items, minGap) {
  const bySide = { left: [], right: [] };
  items.forEach((it) => bySide[it.anchor === "end" ? "left" : "right"].push(it));
  Object.values(bySide).forEach((group) => {
    group.sort((a, b) => a.labelY - b.labelY);
    for (let i = 1; i < group.length; i++) {
      const prev = group[i - 1];
      const cur = group[i];
      if (cur.labelY - prev.labelY < minGap) {
        cur.labelY = prev.labelY + minGap;
      }
    }
  });
  return items;
}

/**
 * Bygger og setter inn et interaktivt, skjematisk Norges-kart basert på
 * gjeldende ledige ruter. Ikke geografisk presist — en stilisert
 * rutediagram-fremstilling, i tradisjonen til flyselskapers rutekart.
 * Oslofjord-regionen (for tett til å vises enkeltvis i denne skalaen)
 * samles i én node på hovedkartet, med reelt bynavn bevart for filtrering
 * av listen under.
 *
 * @param {HTMLElement} container - elementet kartet settes inn i
 * @param {Array} liveRoutes - rader fra live-routes.json (samme format som appen ellers bruker)
 * @param {Function} onSelect - kalles med (cityNames: string[], displayLabel: string) eller (null, null) ved fjernet valg
 * @returns {Function} clearSelection - kall denne for å nullstille valgt by utenfra
 */
function renderRouteMap(container, liveRoutes, onSelect) {
  const now = Date.now();
  const URGENT_MS = 24 * 60 * 60 * 1000;
  const memberOf = {};
  CLUSTER_MEMBERS.forEach((m) => { memberOf[m] = CLUSTER_ID; });
  const mapKey = (city) => memberOf[city] || city;
  const mapCoord = (key) => (key === CLUSTER_ID ? CLUSTER_ANCHOR : CITY_COORDS[key]);
  const mapLabel = (key) => (key === CLUSTER_ID ? CLUSTER_LABEL : key);

  // --- Aggreger per (klynge-bevisst) nodenøkkel og per rute-par ---
  const nodeCounts = new Map(); // nodeKey -> antall treff (inn + ut)
  const pairs = new Map(); // "NØKKEL_A→NØKKEL_B" -> { a, b, count, urgent }
  const realCitiesForNode = new Map(); // nodeKey -> Set(reelle bynavn) — for filtrering

  liveRoutes.forEach((r) => {
    const from = r.from_city, to = r.to_city;
    if (!CITY_COORDS[from] || !CITY_COORDS[to]) return; // ukjent by (f.eks. Sverige), hopp trygt over

    [from, to].forEach((city) => {
      const key = mapKey(city);
      nodeCounts.set(key, (nodeCounts.get(key) || 0) + 1);
      if (!realCitiesForNode.has(key)) realCitiesForNode.set(key, new Set());
      realCitiesForNode.get(key).add(city);
    });

    const isUrgent = r.expire_time && new Date(r.expire_time).getTime() - now < URGENT_MS;
    const ka = mapKey(from), kb = mapKey(to);
    if (ka === kb) return; // begge ender i samme klynge — ingen synlig bue å tegne
    const key = `${ka}\u2192${kb}`;
    const existing = pairs.get(key);
    if (existing) {
      existing.count += 1;
      existing.urgent = existing.urgent || isUrgent;
    } else {
      pairs.set(key, { a: ka, b: kb, count: 1, urgent: isUrgent });
    }
  });

  const activeKeys = new Set(nodeCounts.keys());
  const clusterActive = activeKeys.has(CLUSTER_ID);

  // --- Bakgrunnspunkter (alle byer utenom klyngemedlemmer, svakt) ---
  let dimNodes = "";
  Object.keys(CITY_COORDS).forEach((name) => {
    if (activeKeys.has(name) || memberOf[name]) return;
    const [x, y] = CITY_COORDS[name];
    dimNodes += `<circle class="map-node-dim" cx="${x}" cy="${y}" r="2.2"></circle>`;
  });
  if (!clusterActive) {
    const [cx, cy] = CLUSTER_ANCHOR;
    dimNodes += `<circle class="map-node-dim" cx="${cx}" cy="${cy}" r="2.6"></circle>`;
  }

  // --- Automatisk beskjæring nord/sør, basert på aktive noder ---
  const activeYs = [...activeKeys].map((k) => mapCoord(k)[1]);
  let cropMinY = MAP_VIEWBOX.minY, cropMaxY = MAP_VIEWBOX.maxY, canCrop = false;
  if (activeYs.length > 0) {
    let lo = Math.max(MAP_VIEWBOX.minY, Math.min(...activeYs) - CROP_PADDING);
    let hi = Math.min(MAP_VIEWBOX.maxY, Math.max(...activeYs) + CROP_PADDING);
    if (hi - lo < MIN_CROP_HEIGHT) {
      const deficit = MIN_CROP_HEIGHT - (hi - lo);
      lo = Math.max(MAP_VIEWBOX.minY, lo - deficit / 2);
      hi = Math.min(MAP_VIEWBOX.maxY, hi + deficit / 2);
      if (hi - lo < MIN_CROP_HEIGHT) {
        // Én side traff kartkanten — legg resten av mangelen til den andre siden.
        const stillNeeded = MIN_CROP_HEIGHT - (hi - lo);
        if (lo <= MAP_VIEWBOX.minY) {
          hi = Math.min(MAP_VIEWBOX.maxY, hi + stillNeeded);
        } else {
          lo = Math.max(MAP_VIEWBOX.minY, lo - stillNeeded);
        }
      }
    }
    if (hi - lo < (MAP_VIEWBOX.maxY - MAP_VIEWBOX.minY) * 0.82) {
      cropMinY = lo; cropMaxY = hi; canCrop = true;
    }
  }

  // --- Regionlinjer ---
  let regionLines = "";
  MAP_REGION_LINES.forEach(({ y, label }) => {
    regionLines += `
      <line x1="20" y1="${y}" x2="${MAP_VIEWBOX.w - 20}" y2="${y}" stroke="var(--line)" stroke-width="1" stroke-dasharray="1 6" />
      <text class="map-region-label" x="${MAP_VIEWBOX.w - 24}" y="${y - 8}" text-anchor="end">${label}</text>
    `;
  });

  // --- Buer mellom noder med ledige ruter ---
  let arcs = "";
  pairs.forEach((pair) => {
    const [x1, y1] = mapCoord(pair.a);
    const [x2, y2] = mapCoord(pair.b);
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const bow = Math.min(dist * 0.18, 40);
    const cx = mx + (-dy / dist) * bow;
    const cy = my + (dx / dist) * bow;
    arcs += `<path class="map-arc${pair.urgent ? " urgent" : ""}" data-a="${mapEscapeHtml(pair.a)}" data-b="${mapEscapeHtml(pair.b)}" d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}"></path>`;
  });

  // --- Aktive noder + labels, med kollisjonsjustering ---
  const items = [];
  activeKeys.forEach((key) => {
    const [x, y] = mapCoord(key);
    const count = nodeCounts.get(key);
    const r = Math.min(5 + count * 1.4, 13);
    const anchorEnd = x >= 500;
    items.push({ key, x, y, r, count, anchor: anchorEnd ? "end" : "start", labelY: y + 3.5 });
  });
  resolveLabelOverlap(items, 13);

  let nodes = "";
  items.forEach(({ key, x, y, r, count, anchor, labelY }) => {
    const lx = anchor === "end" ? x - r - 6 : x + r + 6;
    const label = mapLabel(key);
    nodes += `
      <circle class="map-node-ring" cx="${x}" cy="${y}" r="${r + 5}"></circle>
      <circle class="map-node${key === CLUSTER_ID ? " map-node-cluster" : ""}" data-key="${mapEscapeHtml(key)}" cx="${x}" cy="${y}" r="${r}"></circle>
      <text class="map-label" data-key="${mapEscapeHtml(key)}" x="${lx}" y="${labelY}" text-anchor="${anchor}">${mapEscapeHtml(label)}${count > 1 ? ` (${count})` : ""}</text>
    `;
    if (Math.abs(labelY - (y + 3.5)) > 5) {
      nodes += `<line x1="${x}" y1="${y}" x2="${lx - (anchor === "end" ? -3 : 3)}" y2="${labelY - 3.5}" stroke="var(--line)" stroke-width="1" />`;
    }
  });

  const fullViewBox = `0 ${MAP_VIEWBOX.minY} ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.maxY - MAP_VIEWBOX.minY}`;
  const croppedViewBox = `0 ${cropMinY} ${MAP_VIEWBOX.w} ${cropMaxY - cropMinY}`;
  let expanded = !canCrop;

  container.innerHTML = `
    <svg id="mainMapSvg" viewBox="${expanded ? fullViewBox : croppedViewBox}" role="img" aria-label="Skjematisk kart over ledige Freerider-ruter i Norge">
      <path class="map-outline" d="${NORWAY_OUTLINE_PATH}"></path>
      ${regionLines}
      ${dimNodes}
      ${arcs}
      ${nodes}
    </svg>
    ${canCrop ? `<button type="button" class="map-expand-btn" id="mapExpandBtn">Vis hele Norge</button>` : ""}
  `;

  if (canCrop) {
    container.querySelector("#mapExpandBtn").addEventListener("click", () => {
      expanded = !expanded;
      container.querySelector("#mainMapSvg").setAttribute("viewBox", expanded ? fullViewBox : croppedViewBox);
      container.querySelector("#mapExpandBtn").textContent = expanded ? "Vis kun aktivt område" : "Vis hele Norge";
    });
  }

  let selectedKey = null;

  function applySelection() {
    container.querySelectorAll(".map-arc").forEach((el) => {
      el.classList.remove("active", "dimmed");
      if (!selectedKey) return;
      const touches = el.dataset.a === selectedKey || el.dataset.b === selectedKey;
      el.classList.add(touches ? "active" : "dimmed");
    });
    container.querySelectorAll(".map-node[data-key], .map-label[data-key]").forEach((el) => {
      const key = el.dataset.key;
      el.classList.remove("active", "dimmed");
      if (!selectedKey) return;
      if (key === selectedKey) {
        el.classList.add("active");
      } else {
        const connected = [...pairs.values()].some(
          (p) => (p.a === selectedKey && p.b === key) || (p.b === selectedKey && p.a === key)
        );
        if (!connected) el.classList.add("dimmed");
      }
    });
  }

  function selectKey(key, realCities, label) {
    if (selectedKey === key) {
      selectedKey = null;
      applySelection();
      if (onSelect) onSelect(null, null);
      return;
    }
    selectedKey = key;
    applySelection();
    if (onSelect) onSelect(realCities, label);
  }

  container.querySelectorAll(".map-node[data-key], .map-label[data-key]").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      const key = el.dataset.key;
      const realCities = [...(realCitiesForNode.get(key) || [key])];
      selectKey(key, realCities, mapLabel(key));
    });
  });

  return function clearSelection() {
    selectedKey = null;
    applySelection();
  };
}
