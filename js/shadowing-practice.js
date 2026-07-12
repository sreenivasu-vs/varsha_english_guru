/* Shadowing Practice: listen to a native (UK English) text-to-speech
   reading, then record yourself with the mic (raw audio, not transcribed),
   and play both back side by side to compare rhythm, stress and
   pronunciation. No backend, no login, no grading - a self-comparison drill.

   Three modes share one reusable record/playback widget:
   - Sentences: short everyday/workplace sentences, one at a time.
   - Paragraphs: longer connected-speech passages, one at a time.
   - Natural Speech: a browsable list of formal-vs-contracted word pairs
     (e.g. "can not" -> "can't") with example sentences and a teacher tip,
     so learners practice sounding like natural speakers instead of overly
     formal ones. */

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

let SENTENCES = [];
let PARAGRAPHS = [];
let NATURAL_SPEECH = [];
let sentenceIndex = 0;
let paragraphIndex = 0;
let activeMode = "sentences";

function pickRandomIndex(list, excludeIndex) {
  if (list.length <= 1) return 0;
  let i;
  do {
    i = Math.floor(Math.random() * list.length);
  } while (i === excludeIndex);
  return i;
}

/* One independent record/playback widget, reused for sentences, paragraphs
   and natural-speech examples. Each call gets its own mic stream and
   recorder instance so multiple widgets can coexist on screen (e.g. the
   Natural Speech list) without interfering with each other. */
function buildRecordWidget(nativeText) {
  const wrap = el("div");
  let mediaStream = null;
  let mediaRecorder = null;
  let recordedChunks = [];
  let recordedUrl = null;
  let isRecording = false;

  const recordBtn = el("button", "btn secondary block", "🎙️ Start Recording");
  const statusText = el("div", "", "");
  statusText.style.cssText = "font-size:13px;color:var(--text-muted);margin:8px 0;min-height:18px;";
  const playbackArea = el("div");

  const hasRecordSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  if (!hasRecordSupport) {
    recordBtn.disabled = true;
    statusText.textContent = "Recording isn't supported in this browser (try Chrome or Edge on desktop/Android).";
  }

  function stopStream() {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      mediaStream = null;
    }
  }

  function renderPlayback() {
    playbackArea.innerHTML = "";
    const heading = el("div", "", "Compare your recording with the native pace:");
    heading.style.cssText = "font-size:13px;color:var(--text-muted);margin-bottom:8px;";
    playbackArea.appendChild(heading);

    const row = el("div");
    row.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;align-items:center;";
    const yourAudio = el("audio");
    yourAudio.controls = true;
    yourAudio.src = recordedUrl;
    yourAudio.style.cssText = "flex:1;min-width:200px;";
    row.appendChild(yourAudio);

    const nativeBtn = el("button", "speak-btn", "🔊");
    nativeBtn.title = "Play native pace again";
    nativeBtn.onclick = () => speak(nativeText);
    row.appendChild(nativeBtn);

    playbackArea.appendChild(row);
  }

  recordBtn.onclick = async () => {
    if (!isRecording) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        statusText.textContent = "Microphone permission was denied. Please allow mic access to record yourself.";
        return;
      }
      recordedChunks = [];
      mediaRecorder = new MediaRecorder(mediaStream);
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        if (recordedUrl) URL.revokeObjectURL(recordedUrl);
        const blob = new Blob(recordedChunks, { type: "audio/webm" });
        recordedUrl = URL.createObjectURL(blob);
        renderPlayback();
        stopStream();
      };
      mediaRecorder.start();
      isRecording = true;
      recordBtn.textContent = "⏹ Stop Recording";
      statusText.textContent = "Recording... say it now.";
      playbackArea.innerHTML = "";
    } else {
      mediaRecorder.stop();
      isRecording = false;
      recordBtn.textContent = "🎙️ Start Recording";
      statusText.textContent = "";
    }
  };

  wrap.appendChild(recordBtn);
  wrap.appendChild(statusText);
  wrap.appendChild(playbackArea);
  return wrap;
}

function buildShadowCard({ tag, text, extraHtml }) {
  const card = el("div", "card");
  card.innerHTML = `
    ${tag ? `<div class="tag">${escapeHtml(tag)}</div>` : ""}
    <p style="margin:14px 0;font-size:18px;font-weight:700;line-height:1.6;">"${escapeHtml(text)}"</p>
  `;
  const listenBtn = el("button", "btn block", "🔊 Listen to Native Pace");
  listenBtn.style.marginBottom = "8px";
  listenBtn.onclick = () => speak(text);
  card.appendChild(listenBtn);
  card.appendChild(buildRecordWidget(text));
  if (extraHtml) card.appendChild(el("div", "", extraHtml));
  return card;
}

function renderSentenceMode(container) {
  container.innerHTML = "";
  const sentence = SENTENCES[sentenceIndex];
  container.appendChild(buildShadowCard({ tag: sentence.category, text: sentence.text }));
  const nextBtn = el("button", "btn block", "Next Sentence →");
  nextBtn.style.marginTop = "14px";
  nextBtn.onclick = () => {
    sentenceIndex = pickRandomIndex(SENTENCES, sentenceIndex);
    renderSentenceMode(container);
  };
  container.appendChild(nextBtn);
}

function renderParagraphMode(container) {
  container.innerHTML = "";
  const paragraph = PARAGRAPHS[paragraphIndex];
  container.appendChild(buildShadowCard({ tag: paragraph.title, text: paragraph.text }));
  const nextBtn = el("button", "btn block", "Next Paragraph →");
  nextBtn.style.marginTop = "14px";
  nextBtn.onclick = () => {
    paragraphIndex = pickRandomIndex(PARAGRAPHS, paragraphIndex);
    renderParagraphMode(container);
  };
  container.appendChild(nextBtn);
}

function renderNaturalSpeechMode(container) {
  container.innerHTML = "";
  const intro = el("div", "card", `
    <p style="margin:0;font-size:14.5px;color:var(--text-muted);">These are the most common places English learners sound overly formal. Native speakers use the contracted form by default in conversation - practice saying the natural version until it feels automatic.</p>
  `);
  intro.style.background = "var(--surface-2)";
  container.appendChild(intro);

  NATURAL_SPEECH.forEach((item) => {
    const tagHtml = `<span class="mistake-wrong">${escapeHtml(item.formal)}</span> → <span class="mistake-right">${escapeHtml(item.natural)}</span>`;
    const card = buildShadowCard({
      text: item.example,
      extraHtml: `<div style="margin-top:10px;"><div style="font-weight:700;margin-bottom:4px;">${tagHtml}</div><div class="mistake-why">${escapeHtml(item.tip)}</div></div>`,
    });
    container.appendChild(card);
  });
}

function renderActiveMode() {
  const container = document.getElementById("shadowingContainer");
  if (activeMode === "sentences") renderSentenceMode(container);
  else if (activeMode === "paragraphs") renderParagraphMode(container);
  else renderNaturalSpeechMode(container);
}

function setupTabs() {
  const tabs = document.getElementById("shadowingTabs");
  const modes = [
    { id: "sentences", label: "Sentences" },
    { id: "paragraphs", label: "Paragraphs" },
    { id: "natural", label: "Natural Speech" },
  ];
  modes.forEach((m) => {
    const btn = el("button", "btn secondary", m.label);
    btn.style.cssText = "flex:1;padding:10px 8px;font-size:13.5px;";
    btn.onclick = () => {
      activeMode = m.id;
      [...tabs.children].forEach((b) => b.classList.remove("active-tab"));
      btn.classList.add("active-tab");
      renderActiveMode();
    };
    if (m.id === activeMode) btn.classList.add("active-tab");
    tabs.appendChild(btn);
  });
}

async function init() {
  setupThemeToggle();
  setupTabs();
  const container = document.getElementById("shadowingContainer");
  container.innerHTML = `<div class="empty-state">Loading...</div>`;
  try {
    const [sRes, pRes, nRes] = await Promise.all([
      fetch("../data/shadowing-sentences.json"),
      fetch("../data/shadowing-paragraphs.json"),
      fetch("../data/natural-speech.json"),
    ]);
    SENTENCES = await sRes.json();
    PARAGRAPHS = await pRes.json();
    NATURAL_SPEECH = await nRes.json();
    sentenceIndex = Math.floor(Math.random() * SENTENCES.length);
    paragraphIndex = Math.floor(Math.random() * PARAGRAPHS.length);
    renderActiveMode();
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load shadowing content. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
