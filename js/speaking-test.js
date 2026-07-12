/* IELTS/TOEFL-style Speaking Test simulation: a cue-card topic, 1 minute
   silent preparation, then up to 2 minutes of continuous recorded speech
   (transcribed live via the Web Speech API), followed by the same
   grammar-check backend Speaking Practice uses. Requires login, since
   attempts are graded through the account-linked grammar checker. */

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

function showToast(msg) {
  const t = el("div", "toast", msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function capitalizeSentences(text) {
  return text.replace(/(^\s*\w|[.!?]\s+\w)/g, (m) => m.toUpperCase());
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let TOPICS = [];
let topicOrder = [];
let topicPos = 0;
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

function nextTopic() {
  topicPos += 1;
  if (topicPos >= topicOrder.length) {
    topicOrder = shuffleArray(topicOrder);
    topicPos = 0;
  }
  return TOPICS[topicOrder[topicPos]];
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function renderLoggedOutState(container) {
  container.innerHTML = "";
  const card = el("div", "card");
  card.innerHTML = `
    <div class="section-title" style="margin-top:0">Log In to Take the Speaking Test</div>
    <p style="margin:0 0 12px;color:var(--text-muted);">Your response is graded through the grammar-check backend, which saves attempts to your account. Please log in or create an account first.</p>
  `;
  const link = el("a", "btn block", "← Go to Dashboard to Log In");
  link.href = "../index.html";
  card.appendChild(link);
  container.appendChild(card);
}

function renderOverview(container, username) {
  container.innerHTML = "";
  const card = el("div", "card");
  card.innerHTML = `
    <div class="section-title" style="margin-top:0">IELTS/TOEFL-Style Speaking Test</div>
    <p style="margin:0 0 10px;color:var(--text-muted);font-size:14.5px;">You'll get a topic ("cue card"), one minute of silent preparation time, then up to two minutes to speak continuously. Afterward, you'll get grammar feedback on your transcript.</p>
    <p style="margin:0 0 12px;font-size:13px;color:var(--text-muted);">Practicing as <b style="color:var(--text);">${escapeHtml(username)}</b></p>
  `;
  const startBtn = el("button", "btn block", "▶ Start Test");
  startBtn.onclick = () => renderCueCard(container, username, nextTopic());
  card.appendChild(startBtn);
  container.appendChild(card);
}

function renderCueCard(container, username, topic) {
  container.innerHTML = "";
  const card = el("div", "card");
  card.innerHTML = `
    <div class="tag">Cue Card</div>
    <p style="margin:14px 0 10px;font-size:18px;font-weight:700;">${escapeHtml(topic.title)}</p>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:6px;">You should say:</div>
    <ul class="plain-list">${topic.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
  `;
  const startPrepBtn = el("button", "btn block", "Begin 1-Minute Preparation");
  startPrepBtn.style.marginTop = "10px";
  startPrepBtn.onclick = () => runPrepPhase(container, username, topic);
  card.appendChild(startPrepBtn);
  container.appendChild(card);
}

function runPrepPhase(container, username, topic) {
  container.innerHTML = "";
  const card = el("div", "card");
  card.innerHTML = `
    <div class="tag">Preparation Time</div>
    <p style="margin:14px 0 10px;font-size:16px;font-weight:700;">${escapeHtml(topic.title)}</p>
    <ul class="plain-list">${topic.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
  `;
  const timerDisplay = el("div", "", "1:00");
  timerDisplay.style.cssText = "font-size:36px;font-weight:800;text-align:center;color:var(--primary);margin:14px 0;";
  card.appendChild(timerDisplay);

  const skipBtn = el("button", "btn secondary block", "Skip to Speaking →");
  card.appendChild(skipBtn);
  container.appendChild(card);

  let secondsLeft = 60;
  const interval = setInterval(() => {
    secondsLeft -= 1;
    timerDisplay.textContent = formatTime(Math.max(secondsLeft, 0));
    if (secondsLeft <= 0) {
      clearInterval(interval);
      runRecordingPhase(container, username, topic);
    }
  }, 1000);

  skipBtn.onclick = () => {
    clearInterval(interval);
    runRecordingPhase(container, username, topic);
  };
}

function runRecordingPhase(container, username, topic) {
  container.innerHTML = "";
  const card = el("div", "card");
  card.innerHTML = `
    <div class="tag">Speaking Now</div>
    <p style="margin:14px 0 10px;font-size:16px;font-weight:700;">${escapeHtml(topic.title)}</p>
  `;
  const timerDisplay = el("div", "", "2:00");
  timerDisplay.style.cssText = "font-size:36px;font-weight:800;text-align:center;color:var(--danger);margin:14px 0;";
  card.appendChild(timerDisplay);

  const transcriptBox = el("textarea", "text-input", "");
  transcriptBox.rows = 5;
  transcriptBox.placeholder = "Your speech will appear here as you talk...";
  transcriptBox.style.resize = "vertical";
  card.appendChild(transcriptBox);

  const statusText = el("div", "", "🎙️ Listening...");
  statusText.style.cssText = "font-size:13px;color:var(--text-muted);margin:8px 0;";
  card.appendChild(statusText);

  const stopBtn = el("button", "btn block", "⏹ Stop Recording");
  stopBtn.style.marginTop = "8px";
  card.appendChild(stopBtn);
  container.appendChild(card);

  let secondsLeft = 120;
  let accumulatedText = "";
  let isActive = true;
  let recognition = null;

  const timerInterval = setInterval(() => {
    secondsLeft -= 1;
    timerDisplay.textContent = formatTime(Math.max(secondsLeft, 0));
    if (secondsLeft <= 0) finish();
  }, 1000);

  if (SpeechRecognitionCtor) {
    recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) accumulatedText += chunk + " ";
        else interim += chunk;
      }
      transcriptBox.value = capitalizeSentences((accumulatedText + interim).trim());
    };
    recognition.onerror = (e) => {
      if (e.error !== "no-speech") statusText.textContent = `Microphone error: ${e.error}.`;
    };
    recognition.onend = () => {
      if (isActive) {
        try { recognition.start(); } catch (e) { /* already running */ }
      }
    };
    try {
      recognition.start();
    } catch (e) {
      statusText.textContent = "Couldn't start the microphone. You can type your response instead.";
    }
  } else {
    statusText.textContent = "Speech recognition isn't supported in this browser (try Chrome or Edge). You can type your response instead.";
  }

  function finish() {
    if (!isActive) return;
    isActive = false;
    clearInterval(timerInterval);
    if (recognition) {
      recognition.onend = null;
      recognition.stop();
    }
    statusText.textContent = "";
    renderReview(container, username, topic, transcriptBox.value);
  }

  stopBtn.onclick = finish;
}

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

function renderReview(container, username, topic, transcript) {
  container.innerHTML = "";
  const card = el("div", "card");
  card.innerHTML = `
    <div class="tag">Your Response</div>
    <p style="margin:14px 0 10px;font-size:15px;font-weight:700;">${escapeHtml(topic.title)}</p>
  `;
  const editBox = el("textarea", "text-input", "");
  editBox.rows = 6;
  editBox.value = transcript;
  editBox.style.resize = "vertical";
  card.appendChild(editBox);

  const checkBtn = el("button", "btn block", "Check Grammar & Fluency");
  checkBtn.style.marginTop = "10px";
  const resultArea = el("div");
  resultArea.style.marginTop = "14px";

  checkBtn.onclick = async () => {
    const trimmed = editBox.value.trim();
    if (!trimmed) {
      resultArea.innerHTML = `<div class="feedback-box incorrect">No response recorded. Try speaking a bit longer next time.</div>`;
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

      const result = recordSpeakingTest();
      if (result.awarded) showToast("✅ Speaking test complete · +30 XP earned");
    } catch (e) {
      resultArea.innerHTML = `<div class="feedback-box incorrect">Couldn't reach the grammar checker backend. Make sure it's running at ${API_BASE}.</div>`;
    } finally {
      checkBtn.disabled = false;
      checkBtn.textContent = "Check Grammar & Fluency";
    }
  };

  card.appendChild(checkBtn);
  card.appendChild(resultArea);
  container.appendChild(card);

  const nextBtn = el("button", "btn secondary block", "🔁 Try Another Topic");
  nextBtn.style.marginTop = "10px";
  nextBtn.onclick = () => renderCueCard(container, username, nextTopic());
  container.appendChild(nextBtn);
}

function renderResult(resultArea, data) {
  const { original_text, corrected_text, issues_found, matches } = data;
  const card = el("div", "card");
  card.style.background = "var(--surface-2)";
  const perfect = issues_found === 0;
  card.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px;">${perfect ? "✅ No issues found - great job!" : `⚠ ${issues_found} issue${issues_found > 1 ? "s" : ""} found`}</div>
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Your response:</div>
    <div style="margin-bottom:12px;">${renderHighlighted(original_text, matches)}</div>
  `;
  if (!perfect) {
    const correctedBlock = el("div");
    correctedBlock.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Suggested correction:</div>
      <div style="font-weight:700;color:var(--accent);">${escapeHtml(corrected_text)}</div>
    `;
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

async function init() {
  setupThemeToggle();
  const container = document.getElementById("speakingTestContainer");
  const session = getSession();

  if (!session || session.guest) {
    renderLoggedOutState(container);
    return;
  }

  container.innerHTML = `<div class="empty-state">Loading topics...</div>`;
  try {
    const res = await fetch("../data/speaking-test-topics.json");
    TOPICS = await res.json();
    topicOrder = shuffleArray(TOPICS.map((_, i) => i));
    topicPos = -1;
    renderOverview(container, session.username);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load speaking test topics. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
