/* Games hub: a small, data-driven list of mini-games. Kept as its own page
   (rather than embedded on the dashboard) so the main dashboard's HTML/JS
   payload and load time stay unaffected by however many games get added
   here later - this page's content only loads when a user actually opens
   it. */

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("themeToggle").textContent = theme === "dark" ? "☀️" : "🌙";
}

function setupThemeToggle() {
  const progress = getProgress();
  applyTheme(progress.theme || "light");
  document.getElementById("themeToggle").addEventListener("click", () => {
    const p = getProgress();
    const next = p.theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  });
}

function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

async function init() {
  setupThemeToggle();
  const container = document.getElementById("gamesContainer");
  container.innerHTML = `<div class="empty-state">Loading games...</div>`;
  try {
    const res = await fetch("../data/games.json");
    const games = await res.json();
    container.innerHTML = "";
    games.forEach((g) => {
      const card = el("div", "card");
      card.innerHTML = `
        <div class="section-title" style="margin-top:0">${g.icon} ${escapeHtml(g.title)}</div>
        <p style="margin:0 0 12px;color:var(--text-muted);font-size:14.5px;">${escapeHtml(g.description)}</p>
      `;
      const link = el("a", "btn block", "Play Now →");
      link.href = g.page;
      card.appendChild(link);
      container.appendChild(card);
    });
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load games. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
