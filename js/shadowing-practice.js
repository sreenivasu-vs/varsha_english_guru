/* Shadowing Practice: listen to a native text-to-speech reading of a
   sentence, then record yourself saying it with the microphone (raw audio,
   not transcribed), and play both back side by side so you can compare your
   rhythm, stress and pronunciation. No backend, no login, no grading - this
   is a self-comparison drill, not a graded one. */

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

let SENTENCES = [];
let currentIndex = 0;
let mediaStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedUrl = null;

function pickRandomIndex(excludeIndex) {
  if (SENTENCES.length <= 1) return 0;
  let i;
  do {
    i = Math.floor(Math.random() * SENTENCES.length);
  } while (i === excludeIndex);
  return i;
}

function stopMediaStream() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
}

function renderSentence(container) {
  container.innerHTML = "";
  if (recordedUrl) {
    URL.revokeObjectURL(recordedUrl);
    recordedUrl = null;
  }
  stopMediaStream();

  const sentence = SENTENCES[currentIndex];

  const card = el("div", "card");
  card.innerHTML = `
    <div class="tag">${sentence.category}</div>
    <p style="margin:14px 0;font-size:19px;font-weight:700;line-height:1.5;">"${sentence.text}"</p>
  `;

  const listenBtn = el("button", "btn block", "🔊 Listen to Native Pace");
  listenBtn.onclick = () => speak(sentence.text);
  card.appendChild(listenBtn);

  const recordBtn = el("button", "btn secondary block", "🎙️ Start Recording");
  recordBtn.style.marginTop = "8px";
  card.appendChild(recordBtn);

  const statusText = el("div", "", "");
  statusText.style.cssText = "font-size:13px;color:var(--text-muted);margin:8px 0;min-height:18px;";
  card.appendChild(statusText);

  const playbackArea = el("div");
  playbackArea.style.marginTop = "12px";
  card.appendChild(playbackArea);

  const hasRecordSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  if (!hasRecordSupport) {
    recordBtn.disabled = true;
    statusText.textContent = "Recording isn't supported in this browser (try Chrome or Edge on desktop/Android).";
  }

  let isRecording = false;

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
        const blob = new Blob(recordedChunks, { type: "audio/webm" });
        recordedUrl = URL.createObjectURL(blob);
        renderPlayback(playbackArea, sentence.text);
        stopMediaStream();
      };
      mediaRecorder.start();
      isRecording = true;
      recordBtn.textContent = "⏹ Stop Recording";
      statusText.textContent = "Recording... say the sentence now.";
      playbackArea.innerHTML = "";
    } else {
      mediaRecorder.stop();
      isRecording = false;
      recordBtn.textContent = "🎙️ Start Recording";
      statusText.textContent = "";
    }
  };

  container.appendChild(card);

  const nextBtn = el("button", "btn block", "Next Sentence →");
  nextBtn.style.marginTop = "14px";
  nextBtn.onclick = () => {
    currentIndex = pickRandomIndex(currentIndex);
    renderSentence(container);
  };
  container.appendChild(nextBtn);
}

function renderPlayback(playbackArea, nativeText) {
  playbackArea.innerHTML = "";

  const heading = el("div", "", "Compare your recording with the native pace:");
  heading.style.cssText = "font-size:13px;color:var(--text-muted);margin-bottom:8px;";
  playbackArea.appendChild(heading);

  const row = el("div");
  row.style.cssText = "display:flex;gap:10px;flex-wrap:wrap;";

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

async function init() {
  setupThemeToggle();
  const container = document.getElementById("shadowingContainer");
  container.innerHTML = `<div class="empty-state">Loading sentences...</div>`;
  try {
    const res = await fetch("../data/shadowing-sentences.json");
    SENTENCES = await res.json();
    currentIndex = Math.floor(Math.random() * SENTENCES.length);
    renderSentence(container);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load shadowing sentences. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
