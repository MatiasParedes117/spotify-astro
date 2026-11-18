/* =====================================================================
 * Spotify Astro — Mejora interactiva del shell renderizado por Astro
 * ================================================================== */

const SHELL_ICONS = {
  "sp2-icon-logo": "logo",
  "sp2-ico-back": "chevron-left",
  "sp2-ico-fwd": "chevron-right",
  "sp2-ico-search": "search",
  "sp2-ico-bell": "bell",
  "sp2-ico-chdown": "chevron-down",
  "sp2-ico-user": "user",
  "sp2-ico-star": "premium",
  "sp2-ico-info": "info",
  "sp2-ico-logout": "logout",
  "sp2-ico-lib": "library",
  "sp2-ico-lib-search": "search",
  "sp2-ico-lib-plus": "plus",
  "sp2-ico-libsrch2": "search",
  "sp2-ico-shuffle": "shuffle",
  "sp2-ico-prev": "prev",
  "sp2-ico-play": "play",
  "sp2-ico-next": "next",
  "sp2-ico-repeat": "repeat",
  "sp2-ico-queue": "queue",
  "sp2-ico-devices": "devices",
  "sp2-ico-vol": "volume",
  "sp2-ico-mini-play": "play",
  "sp2-ico-npdown": "chevron-down",
  "sp2-ico-npmore": "more",
  "sp2-ico-npsh": "shuffle",
  "sp2-ico-npprev": "prev",
  "sp2-ico-npplay": "play",
  "sp2-ico-npnext": "next",
  "sp2-ico-nprep": "repeat",
  "sp2-ico-qclose": "close",
  "sp2-ico-install": "download",
  "sp2-ico-reset": "logout",
  "sp2-ico-notif-radio": "radio",
  "sp2-ico-notif-list": "add-list",
  "sp2-ico-notif-premium": "premium",
  "sp2-ico-hdr-home": "home",
  "sp2-ico-hdr-search": "search",
  "sp2-ico-hdr-library": "library",
  "sp2-ico-hdr-explore": "globe",
  "sp2-ico-hdr-about": "info",
  "sp2-ico-bn-home": "home",
  "sp2-ico-bn-search": "search",
  "sp2-ico-bn-library": "library",
  "sp2-ico-bn-explore": "globe",
  "sp2-ico-bn-about": "info",
};

function injectShellIcons() {
  for (const [id, name] of Object.entries(SHELL_ICONS)) {
    const el = document.getElementById(id);
    if (el && ICONS[name]) el.innerHTML = ICONS[name];
  }
  const likeBtn = document.getElementById("sp2-like");
  if (likeBtn) likeBtn.innerHTML = `<span class="text-[18px]">${icon("heart-outline")}</span>`;
  const npLikeBtn = document.getElementById("sp2-np-like");
  if (npLikeBtn) npLikeBtn.innerHTML = `<span class="text-[20px]">${icon("heart-outline")}</span>`;
}

function updateSliderFill(el) {
  if (!el) return;
  const min = Number(el.min) || 0;
  const max = Number(el.max) || 100;
  const v = ((Number(el.value) - min) / (max - min || 1)) * 100;
  el.style.setProperty("--pct", v + "%");
}

function initShell() {
  injectShellIcons();

  ["sp2-progress", "sp2-np-progress", "sp2-volume"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    updateSliderFill(el);
    el.addEventListener("input", () => updateSliderFill(el));
  });
}
