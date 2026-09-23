/* Tema-håndtering: lyst/mørkt, husket per nettleser.
 *
 * Selve valget av tema (lest fra localStorage, eller systeminnstillingen
 * første gang) settes av den lille inline-blokken øverst i <head> på hver
 * side — det må skje der, synkront, før CSS-en tegnes, for å unngå et
 * kort glimt av feil tema. Denne filen håndterer selve bryter-knappen.
 */

const THEME_STORAGE_KEY = "ffr-theme";

const SUN_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="10" cy="10" r="3.6"/><path d="M10 1.6v2M10 16.4v2M18.4 10h-2M3.6 10h-2M15.5 4.5l-1.4 1.4M5.9 14.1l-1.4 1.4M15.5 15.5l-1.4-1.4M5.9 5.9L4.5 4.5"/></svg>`;
const MOON_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M17 11.3A7.3 7.3 0 1 1 8.7 3a5.8 5.8 0 0 0 8.3 8.3Z"/></svg>`;

function currentTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {
    // Privat nettlesing e.l. — ikke kritisk, temaet holder seg bare for denne økten.
  }
}

function initThemeToggle() {
  const btn = document.getElementById("themeToggleBtn");
  if (!btn) return;

  function render() {
    const isDark = currentTheme() === "dark";
    // Ikonet viser hva du bytter TIL, ikke hva du står i.
    btn.innerHTML = isDark ? SUN_ICON : MOON_ICON;
    btn.setAttribute("aria-label", isDark ? "Bytt til lyst tema" : "Bytt til mørkt tema");
    btn.setAttribute("title", isDark ? "Lyst tema" : "Mørkt tema");
  }

  btn.addEventListener("click", () => {
    applyTheme(currentTheme() === "dark" ? "light" : "dark");
    render();
  });

  render();
}

document.addEventListener("DOMContentLoaded", initThemeToggle);
