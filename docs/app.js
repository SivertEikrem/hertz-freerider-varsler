/* Freerider-ruter — dashbord for innloggede brukere.
 * Ruter lagres nå i Supabase (tabellen `routes`, én rad per overvåket rute,
 * beskyttet av Row Level Security slik at brukere kun ser sine egne).
 * Selve "hva er ledig nå"-dataen (live-routes.json) er fortsatt en offentlig,
 * anonym fil generert av GitHub Actions-jobben — ingen grunn til å flytte
 * den bak innlogging.
 */

// Brukernavnet på Telegram-boten din, UTEN @. Sett denne når boten er opprettet.
const TELEGRAM_BOT_USERNAME = "Gratis_tur_bot";

const $ = (id) => document.getElementById(id);

let session = null;
let stations = [];
let cities = [];
let liveRoutes = [];
let routes = []; // rader fra Supabase: {id, from_station, from_city, to_station, to_city}
let fromMode = "station";
let toMode = "station";
let telegramPollTimer = null;
let selectedCities = null;
let clearMapSelection = null;

function showStatus(message, kind) {
  const el = $("status");
  el.textContent = message;
  el.className = `status show ${kind}`;
}
function clearStatus() {
  $("status").className = "status";
}

function normalize(value) {
  return (value || "").trim().toUpperCase();
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function describeWatch(w) {
  return {
    from: w.from_station || `alle i ${w.from_city}`,
    to: w.to_station || `alle i ${w.to_city}`,
  };
}

function matchesWatch(route, w) {
  if (w.from_station) {
    if (normalize(route.from) !== normalize(w.from_station)) return false;
  } else if (w.from_city) {
    if (normalize(route.from_city) !== normalize(w.from_city)) return false;
  }
  if (w.to_station) {
    if (normalize(route.to) !== normalize(w.to_station)) return false;
  } else if (w.to_city) {
    if (normalize(route.to_city) !== normalize(w.to_city)) return false;
  }
  return true;
}

/* ---------- Oppstart ---------- */

async function bootstrap() {
  session = await requireSession();
  if (!session) return;
  $("userEmail").textContent = session.user.email;
  $("logoutBtn").addEventListener("click", signOut);

  await Promise.all([loadStations(), loadLiveRoutes(), loadRoutes(), loadTelegramStatus()]);

  populateDatalist("fromDatalist", fromMode);
  populateDatalist("toDatalist", toMode);
  renderRoutes();
  renderMap();
  renderAvailable();
  updateStatsLine();

  setupModeToggle($("fromModeToggle"), (mode) => { fromMode = mode; populateDatalist("fromDatalist", mode); });
  setupModeToggle($("toModeToggle"), (mode) => { toMode = mode; populateDatalist("toDatalist", mode); });

  $("addRouteBtn").addEventListener("click", addRoute);
  $("availableFilterInput").addEventListener("input", renderAvailable);
  $("connectTelegramBtn").addEventListener("click", connectTelegram);
  $("disconnectTelegramBtn").addEventListener("click", disconnectTelegram);
  $("clearSelectionBtn").addEventListener("click", () => {
    if (clearMapSelection) clearMapSelection();
    onCitySelected(null, null);
  });

  setInterval(async () => {
    await loadLiveRoutes();
    renderMap();
    renderAvailable();
    updateStatsLine();
  }, 3 * 60 * 1000);
}

async function loadStations() {
  const resp = await fetch("stations.json");
  const data = await resp.json();
  stations = data.stations;
  cities = data.cities;
}

async function loadLiveRoutes() {
  try {
    const resp = await fetch(`live-routes.json?t=${Date.now()}`);
    if (!resp.ok) { liveRoutes = []; return; }
    const data = await resp.json();
    liveRoutes = data.routes || [];
  } catch (e) {
    liveRoutes = [];
  }
}

/* ---------- Ruter (Supabase) ---------- */

async function loadRoutes() {
  const { data, error } = await sb
    .from("routes")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) {
    showStatus("Klarte ikke å hente rutene dine: " + error.message, "error");
    routes = [];
    return;
  }
  routes = data;
}

async function addRoute() {
  const fromVal = $("fromSelect").value.trim();
  const toVal = $("toSelect").value.trim();
  if (!fromVal || !toVal) {
    showStatus("Fyll ut både fra og til.", "error");
    return;
  }

  const row = {
    user_id: session.user.id,
    from_station: fromMode === "station" ? fromVal.toUpperCase() : null,
    from_city: fromMode === "city" ? fromVal.toUpperCase() : null,
    to_station: toMode === "station" ? toVal.toUpperCase() : null,
    to_city: toMode === "city" ? toVal.toUpperCase() : null,
  };

  const { error } = await sb.from("routes").insert(row);
  if (error) {
    showStatus("Klarte ikke å legge til ruten: " + error.message, "error");
    return;
  }

  $("fromSelect").value = "";
  $("toSelect").value = "";
  clearStatus();
  await loadRoutes();
  renderRoutes();
  renderMap();
  renderAvailable();
  updateStatsLine();
}

async function removeRoute(id) {
  const { error } = await sb.from("routes").delete().eq("id", id);
  if (error) {
    showStatus("Klarte ikke å fjerne ruten: " + error.message, "error");
    return;
  }
  await loadRoutes();
  renderRoutes();
  renderMap();
  renderAvailable();
  updateStatsLine();
}

/* ---------- Telegram-tilkobling ---------- */

function randomCode(len = 24) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, len);
}

async function loadTelegramStatus() {
  const { data } = await sb
    .from("telegram_links")
    .select("chat_id")
    .eq("user_id", session.user.id)
    .maybeSingle();

  renderTelegramStatus(!!(data && data.chat_id));
}

function renderTelegramStatus(connected) {
  const dot = $("telegramDot");
  const text = $("telegramStatusText");
  const connectBtn = $("connectTelegramBtn");
  const disconnectBtn = $("disconnectTelegramBtn");

  if (connected) {
    dot.className = "dot on";
    text.textContent = "Tilkoblet — varsler sendes til Telegram";
    connectBtn.style.display = "none";
    disconnectBtn.style.display = "inline-flex";
  } else {
    dot.className = "dot off";
    text.textContent = "Ikke tilkoblet ennå";
    connectBtn.style.display = "inline-flex";
    disconnectBtn.style.display = "none";
  }
}

async function connectTelegram() {
  const code = randomCode();
  const { error } = await sb
    .from("telegram_links")
    .upsert({ user_id: session.user.id, link_code: code, chat_id: null }, { onConflict: "user_id" });

  if (error) {
    showStatus("Klarte ikke å starte tilkoblingen: " + error.message, "error");
    return;
  }

  window.open(`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${code}`, "_blank");
  $("telegramStatusText").textContent = "Venter på at du trykker Start i Telegram …";

  if (telegramPollTimer) clearInterval(telegramPollTimer);
  let attempts = 0;
  telegramPollTimer = setInterval(async () => {
    attempts += 1;
    const { data } = await sb
      .from("telegram_links")
      .select("chat_id")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (data && data.chat_id) {
      clearInterval(telegramPollTimer);
      renderTelegramStatus(true);
      showStatus("Telegram er koblet til!", "success");
    } else if (attempts > 40) { // ~2 minutter
      clearInterval(telegramPollTimer);
      $("telegramStatusText").textContent = "Fikk ikke bekreftelse ennå — prøv igjen, eller sjekk at du trykket Start.";
    }
  }, 3000);
}

async function disconnectTelegram() {
  const { error } = await sb
    .from("telegram_links")
    .update({ chat_id: null, link_code: null })
    .eq("user_id", session.user.id);
  if (error) {
    showStatus("Klarte ikke å koble fra: " + error.message, "error");
    return;
  }
  renderTelegramStatus(false);
}

/* ---------- Rendering ---------- */

function populateDatalist(datalistId, mode) {
  const items = mode === "station" ? stations : cities;
  document.getElementById(datalistId).innerHTML = items
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");
}

function setupModeToggle(toggleEl, onChange) {
  toggleEl.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleEl.querySelectorAll("button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      onChange(btn.dataset.mode);
    });
  });
}

function renderRoutes() {
  const list = $("routeList");
  if (routes.length === 0) {
    list.innerHTML = `<div class="empty-state">Ingen ruter lagt til ennå. Bruk skjemaet over for å legge til den første.</div>`;
    return;
  }
  list.innerHTML = routes.map((w) => {
    const { from, to } = describeWatch(w);
    return `
      <div class="route-card">
        <div class="route-path">
          <span>${escapeHtml(from)}</span>
          <span class="route-arrow">&#8594;</span>
          <span>${escapeHtml(to)}</span>
        </div>
        <button class="remove-btn" data-id="${w.id}" type="button">Fjern</button>
      </div>
    `;
  }).join("");

  list.querySelectorAll(".remove-btn").forEach((btn) => {
    btn.addEventListener("click", () => removeRoute(btn.dataset.id));
  });
}

const NORSKE_UKEDAGER = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];
const NORSKE_MAANEDER = ["jan","feb","mar","apr","mai","jun","jul","aug","sep","okt","nov","des"];

function formatDate(iso) {
  if (!iso) return "ukjent";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${NORSKE_UKEDAGER[d.getDay()]} ${d.getDate()}. ${NORSKE_MAANEDER[d.getMonth()]} kl. ${hh}:${mm}`;
}

function timeUntil(iso) {
  if (!iso) return { text: "", urgent: false };
  const diffMs = new Date(iso).getTime() - Date.now();
  if (isNaN(diffMs)) return { text: "", urgent: false };
  if (diffMs <= 0) return { text: "utløpt", urgent: true };
  const diffMin = Math.round(diffMs / 60000);
  const hours = Math.floor(diffMin / 60);
  const days = Math.floor(hours / 24);
  let text;
  if (days >= 1) text = `om ${days} dag${days === 1 ? "" : "er"}`;
  else if (hours >= 1) text = `om ${hours} time${hours === 1 ? "" : "r"}`;
  else text = `om ${diffMin} min`;
  return { text, urgent: hours < 24 };
}

function updateStatsLine() {
  const el = $("statsLine");
  const antallRuter = routes.length;
  const antallBiler = routes.reduce((sum, w) => sum + liveRoutes.filter((r) => matchesWatch(r, w)).length, 0);
  if (antallRuter === 0) {
    el.textContent = "Legg til din første rute under.";
    return;
  }
  el.textContent = `${antallRuter} rute${antallRuter === 1 ? "" : "r"} overvåkes, ${antallBiler} bil${antallBiler === 1 ? "" : "er"} tilgjengelig nå`;
  document.title = antallBiler > 0 ? `(${antallBiler}) Freerider-ruter` : "Freerider-ruter";
}

function renderMap() {
  const wrap = $("mapWrap");
  if (!wrap) return;
  const allMatches = routes.flatMap((w) => liveRoutes.filter((r) => matchesWatch(r, w)));
  clearMapSelection = renderRouteMap(wrap, allMatches, onCitySelected);
}

function onCitySelected(cities, label) {
  selectedCities = cities;
  const bar = $("selectionBar");
  if (bar) {
    if (cities && cities.length) {
      bar.style.display = "flex";
      $("selectionText").textContent = `Viser ruter til/fra ${label}`;
    } else {
      bar.style.display = "none";
    }
  }
  renderAvailable();
}

function renderAvailable() {
  const container = $("availableList");
  if (routes.length === 0) {
    container.innerHTML = `<div class="board-empty">Legg til en rute for å se tilgjengelige biler her.</div>`;
    return;
  }
  const query = ($("availableFilterInput").value || "").trim().toLowerCase();

  container.innerHTML = routes.map((w) => {
    const { from, to } = describeWatch(w);
    let matches = liveRoutes.filter((r) => matchesWatch(r, w));
    if (selectedCities) {
      matches = matches.filter((r) => selectedCities.includes(r.from_city) || selectedCities.includes(r.to_city));
    }
    if (query) {
      matches = matches.filter((r) =>
        [r.from, r.from_city, r.to, r.to_city, r.car_model].join(" ").toLowerCase().includes(query)
      );
    }
    const bodyHtml = matches.length === 0
      ? `<div class="board-empty">${query ? "Ingen treff på filteret." : "Ingen ledige biler akkurat nå."}</div>`
      : matches.map((r) => {
          const countdown = timeUntil(r.expire_time);
          return `
            <div class="board-row">
              <div class="board-route">
                <span class="dot ${countdown.urgent ? "urgent" : "on"}"></span>
                <span>${escapeHtml(r.from)}</span>
                <span class="arrow">&#8594;</span>
                <span>${escapeHtml(r.to)}</span>
              </div>
              <div class="board-countdown${countdown.urgent ? " urgent" : ""}">${countdown.text || "—"}</div>
              <div class="board-meta">
                <span class="car">${escapeHtml(r.car_model)}</span>
                <span>Fra ${formatDate(r.available_at)}</span>
                <span>Frist ${formatDate(r.expire_time)}</span>
              </div>
            </div>
          `;
        }).join("");

    return `
      <div style="margin-bottom: 18px;">
        <h3 style="font-family:'IBM Plex Mono',monospace; font-size:12px; letter-spacing:0.03em; color:var(--ink-secondary); margin:0 0 8px; text-transform:uppercase;">${escapeHtml(from)} &#8594; ${escapeHtml(to)}</h3>
        ${bodyHtml}
      </div>
    `;
  }).join("");
}

bootstrap();
