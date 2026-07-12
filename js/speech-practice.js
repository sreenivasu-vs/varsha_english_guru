/* Speaking Practice: Web Speech API (speech-to-text) -> FastAPI backend
   (LanguageTool grammar check + PostgreSQL save) -> Speech Synthesis (playback).
   Requires being logged in (see js/auth.js) - practice attempts are saved
   against the logged-in username. */

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

/* Browser speech-to-text almost always returns lowercase text (e.g. "i went
   to the store"), which the grammar checker then flags as a capitalization
   mistake even though the user said nothing wrong. Capitalize the start of
   the transcript and after any sentence-ending punctuation before it's
   shown or checked. */
function capitalizeSentences(text) {
  return text.replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase());
}

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognition = null;
let isListening = false;

function renderLoggedOutState(container) {
  container.innerHTML = "";
  const card = el("div", "card");
  card.innerHTML = `
    <div class="section-title" style="margin-top:0">Log In to Practice Speaking</div>
    <p style="margin:0 0 12px;color:var(--text-muted);">Speaking Practice saves your attempts to your account so you can track progress over time. Please log in or create an account first.</p>
  `;
  const link = el("a", "btn block", "← Go to Dashboard to Log In");
  link.href = "../index.html";
  card.appendChild(link);
  container.appendChild(card);
}

function renderPracticeCard(container, username) {
  const card = el("div", "card");
  card.innerHTML = `
    <div class="section-title" style="margin-top:0">Speak a Sentence</div>
    <p style="margin:0 0 6px;color:var(--text-muted);font-size:14.5px;">Press the microphone and say a simple English sentence out loud. We'll transcribe it and check your grammar.</p>
    <p style="margin:0 0 12px;font-size:13px;color:var(--text-muted);">Practicing as <b style="color:var(--text);">${escapeHtml(username)}</b></p>
  `;

  const micBtn = el("button", "btn block", "🎤 Start Speaking");
  const transcriptBox = el("textarea", "text-input", "");
  transcriptBox.rows = 3;
  transcriptBox.placeholder = "Your speech will appear here - you can also type or edit it directly.";
  transcriptBox.style.resize = "vertical";

  const statusText = el("div", "", "");
  statusText.style.cssText = "font-size:13px;color:var(--text-muted);margin:8px 0;min-height:18px;";

  const checkBtn = el("button", "btn block", "Check Grammar");
  checkBtn.style.marginTop = "8px";

  const resultArea = el("div");
  resultArea.style.marginTop = "14px";

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
      micBtn.textContent = "🎤 Start Speaking";
      if (statusText.textContent === "Listening... speak now.") {
        statusText.textContent = "";
      }
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

  checkBtn.onclick = () => runGrammarCheck(transcriptBox.value, username, statusText, resultArea, checkBtn);

  card.appendChild(micBtn);
  card.appendChild(statusText);
  card.appendChild(transcriptBox);
  card.appendChild(checkBtn);
  card.appendChild(resultArea);
  container.appendChild(card);
}

function renderHighlighted(text, matches) {
  const sorted = [...matches].sort((a, b) => a.offset - b.offset);
  let html = "";
  let cursor = 0;
  sorted.forEach((m) => {
    if (m.offset < cursor) return; // skip overlapping matches for simplicity
    html += escapeHtml(text.slice(cursor, m.offset));
    html += `<mark title="${escapeHtml(m.message)}" style="background:#fde68a;color:#1c1e29;padding:0 2px;border-radius:3px;">${escapeHtml(text.slice(m.offset, m.offset + m.length))}</mark>`;
    cursor = m.offset + m.length;
  });
  html += escapeHtml(text.slice(cursor));
  return html;
}

async function runGrammarCheck(text, username, statusText, resultArea, checkBtn) {
  const trimmed = (text || "").trim();
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
    renderResult(resultArea, data);
    statusText.textContent = "";
  } catch (e) {
    resultArea.innerHTML = `<div class="feedback-box incorrect">Couldn't reach the grammar checker backend. Make sure it's running (see backend/README.md) at ${API_BASE}.</div>`;
  } finally {
    checkBtn.disabled = false;
    checkBtn.textContent = "Check Grammar";
  }
}

function renderResult(resultArea, data) {
  const { original_text, corrected_text, issues_found, matches } = data;

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

function speakButton(text) {
  const btn = el("button", "speak-btn", "🔊");
  btn.onclick = () => speak(text);
  return btn;
}

function init() {
  setupThemeToggle();
  const container = document.getElementById("speechContainer");
  const session = getSession();

  if (!session || session.guest) {
    renderLoggedOutState(container);
    return;
  }

  renderPracticeCard(container, session.username);
}

init();
