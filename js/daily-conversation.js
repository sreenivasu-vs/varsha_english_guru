/* Daily IT/Business Conversation Practice: same rotating scenario for every
   user on a given calendar day (day-of-year modulo scenario count - no
   backend needed for rotation). Narrator lines play via text-to-speech;
   "your turn" lines are recorded via the Web Speech API and grammar-checked
   through the same backend Speaking Practice already uses. Completing every
   "your turn" line once per day awards XP and touches the streak. */

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

function speakButton(text) {
  const btn = el("button", "speak-btn", "🔊");
  btn.onclick = () => speak(text);
  return btn;
}

function capitalizeSentences(text) {
  return text.replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase());
}

function dayOfYear(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.floor(diff / 86400000);
}

function getTodayScenario(scenarios) {
  return scenarios[dayOfYear() % scenarios.length];
}

function renderLoggedOutState(container) {
  container.innerHTML = "";
  const card = el("div", "card");
  card.innerHTML = `
    <div class="section-title" style="margin-top:0">Log In to Practice</div>
    <p style="margin:0 0 12px;color:var(--text-muted);">Daily Conversation saves your attempts to your account so you can track progress over time. Please log in or create an account first.</p>
  `;
  const link = el("a", "btn block", "← Go to Dashboard to Log In");
  link.href = "../index.html";
  card.appendChild(link);
  container.appendChild(card);
}

function renderNarratorLine(item) {
  const line = el("div", "dialogue-line");
  line.innerHTML = `<div class="dialogue-speaker">${escapeHtml(item.speaker)}</div>`;
  const textWrap = el("div", "dialogue-text");
  textWrap.textContent = item.line;
  line.appendChild(textWrap);
  line.appendChild(speakButton(item.line));
  return line;
}

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

function renderHighlighted(text, matches) {
  const sorted = [...matches].sort((a, b) => a.offset - b.offset);
  let html = "";
  let cursor = 0;
  sorted.forEach((m) => {
    if (m.offset < cursor) return;
    html += escapeHtml(text.slice(cursor, m.offset));
    html += `<mark title="${escapeHtml(m.message)}" style="background:#fde68a;color:#1c1e29;padding:0 2px;border-radius:3px;">${escapeHtml(text.slice(m.offset, m.offset + m.length))}</mark>`;
    cursor = m.offset + m.length;
  });
  html += escapeHtml(text.slice(cursor));
  return html;
}

function renderCheckResult(resultArea, data) {
  const { original_text, corrected_text, issues_found, matches } = data;
  resultArea.innerHTML = "";

  const card = el("div", "card");
  card.style.background = "var(--surface-2)";
  const perfect = issues_found === 0;
  card.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px;">${perfect ? "✅ No issues found - nice work!" : `⚠ ${issues_found} issue${issues_found > 1 ? "s" : ""} found`}</div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">You said:</div>
    <div style="margin-bottom:12px;">${renderHighlighted(original_text, matches)}</div>
  `;
  if (!perfect) {
    const correctedBlock = el("div");
    correctedBlock.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Suggested correction:</div>
      <div style="font-weight:700;color:var(--accent);margin-bottom:10px;">${escapeHtml(corrected_text)}</div>
    `;
    correctedBlock.appendChild(speakButton(corrected_text));
    card.appendChild(correctedBlock);
  }
  resultArea.appendChild(card);

  if (matches.length) {
    matches.forEach((m) => {
      const item = el("div", "mistake-item");
      item.innerHTML = `
        <div><span class="mistake-wrong">${escapeHtml(m.original)}</span>${m.suggestions.length ? ` → <span class="mistake-right">${escapeHtml(m.suggestions[0])}</span>` : ""}</div>
        <div class="mistake-why">${escapeHtml(m.message)}</div>
      `;
      resultArea.appendChild(item);
    });
  }
}

/* One independent mic-recording + grammar-check widget per "your turn" line.
   onChecked() fires the first time this line gets a successful check, so the
   page can track how many of the scenario's turns have been completed. */
function renderYourTurnLine(item, username, onChecked) {
  const wrap = el("div", "dialogue-line your-turn");

  const header = el("div");
  header.innerHTML = `<div class="dialogue-speaker">You</div>`;
  const suggested = el("div", "dialogue-text", "");
  suggested.style.cssText = "font-style:italic;color:var(--text-muted);";
  suggested.textContent = `Try something like: "${item.line}"`;
  header.appendChild(suggested);
  wrap.appendChild(header);

  const micBtn = el("button", "btn block", "🎤 Record My Reply");
  micBtn.style.marginTop = "10px";
  const transcriptBox = el("textarea", "text-input", "");
  transcriptBox.rows = 2;
  transcriptBox.placeholder = "Your speech will appear here - you can also type or edit it directly.";
  transcriptBox.style.cssText = "resize:vertical;margin-top:8px;";

  const statusText = el("div", "", "");
  statusText.style.cssText = "font-size:13px;color:var(--text-muted);margin:8px 0;min-height:18px;";

  const checkBtn = el("button", "btn block", "Check Grammar");
  checkBtn.style.marginTop = "8px";

  const resultArea = el("div");
  resultArea.style.marginTop = "14px";

  let recognition = null;
  let isListening = false;
  let checkedOnce = false;

  if (!SpeechRecognitionCtor) {
    statusText.textContent = "Speech recognition isn't supported in this browser (try Chrome or Edge). You can still type a sentence below.";
  } else {
    recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      isListening = true;
      micBtn.textContent = "⏹ Stop Listening";
      statusText.textContent = "Listening... speak now.";
    };
    recognition.onerror = (e) => {
      statusText.textContent = `Microphone error: ${e.error}. You can type your sentence instead.`;
    };
    recognition.onend = () => {
      isListening = false;
      micBtn.textContent = "🎤 Record My Reply";
      if (statusText.textContent === "Listening... speak now.") statusText.textContent = "";
    };
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += chunk;
        else interimText += chunk;
      }
      transcriptBox.value = capitalizeSentences((finalText || interimText).trim());
    };
  }

  micBtn.onclick = () => {
    if (!recognition) return;
    if (isListening) {
      recognition.stop();
    } else {
      transcriptBox.value = "";
      resultArea.innerHTML = "";
      recognition.start();
    }
  };

  checkBtn.onclick = async () => {
    const trimmed = (transcriptBox.value || "").trim();
    if (!trimmed) {
      statusText.textContent = "Say or type a sentence first.";
      return;
    }
    checkBtn.disabled = true;
    checkBtn.textContent = "Checking...";
    resultArea.innerHTML = "";
    try {
      const res = await fetch(`${API_BASE}/api/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, text: trimmed }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      renderCheckResult(resultArea, data);
      statusText.textContent = "";
      if (!checkedOnce) {
        checkedOnce = true;
        onChecked();
      }
    } catch (e) {
      resultArea.innerHTML = `<div class="feedback-box incorrect">Couldn't reach the grammar checker backend. Make sure it's running at ${API_BASE}.</div>`;
    } finally {
      checkBtn.disabled = false;
      checkBtn.textContent = "Check Grammar";
    }
  };

  wrap.appendChild(micBtn);
  wrap.appendChild(statusText);
  wrap.appendChild(transcriptBox);
  wrap.appendChild(checkBtn);
  wrap.appendChild(resultArea);
  return wrap;
}

function showToast(msg) {
  const t = el("div", "toast", msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function renderScenario(container, scenario, username) {
  container.innerHTML = "";

  const alreadyDoneToday = getProgress().dailyConversation.lastCompletedDate === todayStr();
  if (alreadyDoneToday) {
    const banner = el("div", "feedback-box correct", "✅ You've completed today's conversation. Come back tomorrow for a new one! Feel free to keep practicing below.");
    banner.style.marginBottom = "14px";
    container.appendChild(banner);
  }

  const topicCard = el("div", "card");
  topicCard.innerHTML = `
    <div class="section-title" style="margin-top:0">${escapeHtml(scenario.topic)}</div>
    <p style="margin:0;color:var(--text-muted);font-size:14.5px;">${escapeHtml(scenario.scenario)}</p>
  `;
  container.appendChild(topicCard);

  const dialogueCard = el("div", "card");
  const yourTurnCount = scenario.exchange.filter((e) => e.yourTurn).length;
  let checkedCount = 0;

  scenario.exchange.forEach((item) => {
    if (item.yourTurn) {
      dialogueCard.appendChild(renderYourTurnLine(item, username, () => {
        checkedCount += 1;
        if (checkedCount === yourTurnCount) {
          const result = recordDailyConversation();
          if (result.awarded) {
            showToast("✅ Daily conversation complete · +25 XP earned");
          }
        }
      }));
    } else {
      dialogueCard.appendChild(renderNarratorLine(item));
    }
  });
  container.appendChild(dialogueCard);

  if (scenario.tips && scenario.tips.length) {
    const tipsHeading = el("div", "section-title", "Tips From an English Teacher");
    container.appendChild(tipsHeading);
    const tipsCard = el("div", "card");
    const list = el("ul", "plain-list");
    scenario.tips.forEach((t) => list.appendChild(el("li", "", t)));
    tipsCard.appendChild(list);
    container.appendChild(tipsCard);
  }
}

async function init() {
  setupThemeToggle();
  const container = document.getElementById("dailyConvContainer");
  const session = getSession();

  if (!session || session.guest) {
    renderLoggedOutState(container);
    return;
  }

  container.innerHTML = `<div class="empty-state">Loading today's conversation...</div>`;
  try {
    const res = await fetch("../data/daily-conversations.json");
    const scenarios = await res.json();
    const scenario = getTodayScenario(scenarios);
    renderScenario(container, scenario, session.username);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load today's conversation. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
