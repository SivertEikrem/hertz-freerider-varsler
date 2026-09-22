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

// Håndplassert lokalt diagram for detaljkartet — ikke geografisk avledet,
// bare gitt nok innbyrdes avstand til at etiketter ikke kolliderer.
const CLUSTER_LOCAL = {
  "HØNEFOSS": [68, 68], "SKEDSMOKORSET": [185, 82], "KONGSVINGER": [235, 62],
  "DRAMMEN": [62, 148], "RUD": [88, 128], "FORNEBU": [108, 120], "OSLO": [150, 110],
  "BILLINGSTAD": [100, 140], "SKI": [168, 155], "ASKIM": [222, 148],
  "KONGSBERG": [30, 182], "MOSS": [138, 195], "SARPSBORG": [218, 188],
  "FREDRIKSTAD": [192, 208], "HALDEN": [238, 222],
  "TØNSBERG": [108, 228], "SANDEFJORD": [96, 250], "LARVIK": [84, 268], "PORSGRUNN": [48, 252],
};
const CLUSTER_VIEWBOX = { w: 268, h: 290 };

const MAP_REGION_LINES = [
  { y: 335.7, label: "NORD-NORGE" },
  { y: 457.1, label: "MIDT-NORGE" },
];
const MAP_VIEWBOX = { w: 620, h: 700, minY: 20, maxY: 700 };
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

function buildLocalDiagram(memberCounts) {
  let dots = "", labels = "";
  const items = [];
  Object.keys(memberCounts).forEach((name) => {
    const pos = CLUSTER_LOCAL[name];
    if (!pos) return;
    const [x, y] = pos;
    const count = memberCounts[name];
    const r = Math.min(5 + count * 1.3, 12);
    const anchorEnd = x > CLUSTER_VIEWBOX.w * 0.62;
    items.push({ name, x, y, r, count, anchor: anchorEnd ? "end" : "start", labelY: y + 3.5 });
  });
  resolveLabelOverlap(items, 12);
  items.forEach(({ name, x, y, r, count, anchor, labelY }) => {
    const lx = anchor === "end" ? x - r - 6 : x + r + 6;
    dots += `<circle class="map-node-ring" cx="${x}" cy="${y}" r="${r + 4}"></circle>
      <circle class="map-node" data-cluster-member="${mapEscapeHtml(name)}" cx="${x}" cy="${y}" r="${r}"></circle>`;
    labels += `<text class="map-label" data-cluster-member="${mapEscapeHtml(name)}" x="${lx}" y="${labelY}" text-anchor="${anchor}">${mapEscapeHtml(name)}${count > 1 ? ` (${count})` : ""}</text>`;
    if (Math.abs(labelY - (y + 3.5)) > 5) {
      labels += `<line x1="${x}" y1="${y}" x2="${lx - (anchor === "end" ? -3 : 3)}" y2="${labelY - 3.5}" stroke="var(--line)" stroke-width="1" />`;
    }
  });
  return `<div class="board-map-wrap"><svg viewBox="0 0 ${CLUSTER_VIEWBOX.w} ${CLUSTER_VIEWBOX.h}" role="img" aria-label="Detaljkart over Oslofjord-området">${dots}${labels}</svg></div>`;
}

/**
 * Bygger og setter inn et interaktivt, skjematisk Norges-kart basert på
 * gjeldende ledige ruter. Ikke geografisk presist — en stilisert
 * rutediagram-fremstilling, i tradisjonen til flyselskapers rutekart.
 * Oslofjord-regionen (for tett til å vises enkeltvis i denne skalaen)
 * samles i én node på hovedkartet, med et eget forstørret detaljkart
 * som vises under når minst én av byene der har en ledig rute.
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
  const clusterMemberCounts = {}; // reelt bynavn -> antall (for detaljkartet)
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
      if (memberOf[city]) clusterMemberCounts[city] = (clusterMemberCounts[city] || 0) + 1;
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
      ${regionLines}
      ${dimNodes}
      ${arcs}
      ${nodes}
    </svg>
    ${canCrop ? `<button type="button" class="map-expand-btn" id="mapExpandBtn">Vis hele Norge</button>` : ""}
    <div id="clusterInset" style="${clusterActive ? "" : "display:none;"} margin-top:10px;">
      <p class="board-map-hint" style="margin-top:0;">Oslofjorden — forstørret</p>
      ${clusterActive ? buildLocalDiagram(clusterMemberCounts) : ""}
    </div>
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
    container.querySelectorAll(".map-node[data-cluster-member], .map-label[data-cluster-member]").forEach((el) => {
      el.classList.remove("active");
      if (selectedKey === CLUSTER_ID) return; // hele klyngen valgt via hoved-noden — ikke fremhev enkeltmedlem
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

  container.querySelectorAll(".map-node[data-cluster-member], .map-label[data-cluster-member]").forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", () => {
      const name = el.dataset.clusterMember;
      selectKey(`member:${name}`, [name], name);
    });
  });

  return function clearSelection() {
    selectedKey = null;
    applySelection();
  };
}
