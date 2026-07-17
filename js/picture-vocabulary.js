/* Picture Vocabulary: a visual picture-dictionary. Each item is a hand-drawn
   SVG icon (no external image API - keeps this free and offline-friendly,
   same approach as the app's own logo) paired with its English name and an
   example sentence. Browsable by category (Vegetables, Fruits, Spices,
   Pulses & Lentils, Everyday Actions) or searchable by name across all of
   them. No login needed. */

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

let DATA = { categories: [], items: [] };
let activeCategory = null;
let searchTerm = "";

function renderTabs(container) {
  const row = el("div");
  row.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;";
  DATA.categories.forEach((cat) => {
    const btn = el("button", "btn secondary", `${cat.icon} ${escapeHtml(cat.label)}`);
    btn.style.cssText = "flex:1 1 auto;padding:8px 10px;font-size:13px;";
    if (cat.id === activeCategory) btn.classList.add("active-tab");
    btn.onclick = () => {
      activeCategory = cat.id;
      searchTerm = "";
      renderPage(container.parentElement);
    };
    row.appendChild(btn);
  });
  container.appendChild(row);
}

function renderSearch(container) {
  const input = el("input", "text-input", "");
  input.placeholder = "🔍 Search any word across all categories...";
  input.value = searchTerm;
  input.style.marginBottom = "14px";
  input.oninput = () => {
    searchTerm = input.value;
    renderGrid(document.getElementById("vocabGrid"));
  };
  container.appendChild(input);
}

function visibleItems() {
  const term = searchTerm.trim().toLowerCase();
  if (term) {
    return DATA.items.filter((i) => i.name.toLowerCase().includes(term));
  }
  return DATA.items.filter((i) => i.category === activeCategory);
}

function renderGrid(gridEl) {
  gridEl.innerHTML = "";
  const items = visibleItems();
  if (!items.length) {
    gridEl.appendChild(el("div", "empty-state", "No words found."));
    return;
  }
  items.forEach((item) => {
    const card = el("div", "vocab-card");
    const iconWrap = el("div", "", item.svg);
    card.appendChild(iconWrap.firstElementChild);
    card.appendChild(el("div", "vocab-name", escapeHtml(item.name)));
    card.appendChild(el("div", "vocab-example", `"${escapeHtml(item.example)}"`));
    const speakBtn = el("button", "btn secondary block", "🔊 Listen");
    speakBtn.style.fontSize = "12.5px";
    speakBtn.style.padding = "7px 10px";
    speakBtn.onclick = () => speak(`${item.name}. ${item.example}`);
    card.appendChild(speakBtn);
    gridEl.appendChild(card);
  });
}

function renderPage(container) {
  container.innerHTML = "";
  const intro = el("p", "", "Tap the picture, hear the word, read it in a sentence. Browse by category, or search for any word.");
  intro.style.cssText = "color:var(--text-muted);font-size:14px;margin:0 0 14px;";
  container.appendChild(intro);

  const tabsWrap = el("div");
  renderTabs(tabsWrap);
  container.appendChild(tabsWrap);

  const searchWrap = el("div");
  renderSearch(searchWrap);
  container.appendChild(searchWrap);

  const grid = el("div", "vocab-grid");
  grid.id = "vocabGrid";
  container.appendChild(grid);
  renderGrid(grid);
}

async function init() {
  setupThemeToggle();
  const container = document.getElementById("vocabContainer");
  container.innerHTML = `<div class="empty-state">Loading...</div>`;
  try {
    const res = await fetch("../data/picture-vocabulary.json");
    DATA = await res.json();
    activeCategory = DATA.categories[0] ? DATA.categories[0].id : null;
    renderPage(container);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load picture vocabulary. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
