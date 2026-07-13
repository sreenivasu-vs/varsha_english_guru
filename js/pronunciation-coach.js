/* Pronunciation Coach: 9 rounds of speaking practice (Echo, Pause, Stress,
   Speed, Match, Missing Sound, Minimal Pairs, Voice Clarity, Intonation),
   all sharing one capture pipeline: record via getUserMedia + Web Speech API
   (transcript) and the Web Audio API's AnalyserNode (volume + a lightweight
   autocorrelation pitch estimate), then score against the target.

   Honesty note (for future maintainers, not shown in the UI): only the
   transcript-matching rounds (Echo, Match, Missing Sound, Minimal Pairs) are
   a fairly reliable signal - if the recogniser heard the wrong word, it's a
   meaningful clue about pronunciation. Volume-based rounds (Pause, Voice
   Clarity) and the pitch-based rounds (Stress, Intonation) are genuine signal
   processing on the real microphone input, but are approximations relative
   to the recording itself (there's no calibrated reference voice to compare
   against), not lab-grade acoustic analysis. Feedback copy is deliberately
   worded as encouraging guidance rather than a precise measurement. */

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

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeShuffleState(length) {
  return { order: shuffleArray(Array.from({ length }, (_, i) => i)), pos: 0 };
}
function currentItemIndex(state) {
  return state.order[state.pos];
}
function advanceShuffleState(state) {
  state.pos += 1;
  if (state.pos >= state.order.length) {
    const lastIndex = state.order[state.order.length - 1];
    let reshuffled = shuffleArray(state.order);
    if (reshuffled.length > 1 && reshuffled[0] === lastIndex) {
      [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
    }
    state.order = reshuffled;
    state.pos = 0;
  }
}

function normalizeWords(text) {
  return text.toLowerCase().replace(/[^a-z0-9' ]+/g, "").split(/\s+/).filter(Boolean);
}

/* Longest-common-subsequence word diff (same technique as Listening
   Practice's dictation scoring) - which expected words the user actually
   said, in order. */
function diffWords(expectedWords, actualWords) {
  const m = expectedWords.length, n = actualWords.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = expectedWords[i - 1] === actualWords[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const matchedExpected = new Set();
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (expectedWords[i - 1] === actualWords[j - 1]) { matchedExpected.add(i - 1); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return matchedExpected;
}

/* ---------- Session score dashboard (Pronunciation / Clarity / Fluency / Accuracy) ---------- */

const sessionScores = {
  pronunciation: { sum: 0, count: 0 },
  clarity: { sum: 0, count: 0 },
  fluency: { sum: 0, count: 0 },
  accuracy: { sum: 0, count: 0 },
};

function recordScore(key, value) {
  const s = sessionScores[key];
  s.sum += Math.max(0, Math.min(100, Math.round(value)));
  s.count += 1;
  updateScoreDashboard();
}
function avgScore(key) {
  const s = sessionScores[key];
  return s.count ? Math.round(s.sum / s.count) : null;
}

function updateScoreDashboard() {
  const bar = document.getElementById("scoreDashboard");
  if (!bar) return;
  const metrics = [
    ["pronunciation", "Pronunciation"],
    ["clarity", "Clarity"],
    ["fluency", "Fluency"],
    ["accuracy", "Accuracy"],
  ];
  bar.innerHTML = metrics.map(([key, label]) => {
    const v = avgScore(key);
    const display = v === null ? "--" : v + "%";
    const width = v === null ? 0 : v;
    return `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
          <span style="color:var(--text-muted);">${label}</span>
          <span style="font-weight:700;">${display}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${width}%"></div></div>
      </div>
    `;
  }).join("");
}

/* ---------- Audio capture: transcript + volume + pitch, all from one recording ---------- */

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

/* Simplified autocorrelation pitch detector, restricted to the human voice
   fundamental-frequency range (~70-400Hz) to keep the per-frame cost small
   (only that lag range is scanned, not the whole buffer). */
function estimatePitch(buf, sampleRate) {
  const SIZE = buf.length;
  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return null;

  const minLag = Math.floor(sampleRate / 400);
  const maxLag = Math.min(Math.floor(sampleRate / 70), SIZE - 1);
  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < SIZE - lag; i++) sum += buf[i] * buf[i + lag];
    if (sum > bestCorr) { bestCorr = sum; bestLag = lag; }
  }
  if (bestLag <= 0 || bestCorr < rms * rms * SIZE * 0.05) return null;
  return sampleRate / bestLag;
}

/* Starts mic capture + speech recognition together. Returns { stop, promise }.
   promise resolves with { transcript, durationMs, volumeSamples, pitchSamples }
   volumeSamples/pitchSamples: [{ t: msSinceStart, v: rms|null, hz: hz|null }] */
function captureAttempt() {
  let stopFn = () => {};
  const promise = new Promise((resolve, reject) => {
    if (!SpeechRecognitionCtor) { reject(new Error("no-speech-recognition")); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { reject(new Error("no-mic")); return; }

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const samples = [];
      const startTime = performance.now();
      let settled = false;

      const sampleTimer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
        const v = Math.sqrt(sumSq / buf.length);
        const hz = estimatePitch(buf, audioCtx.sampleRate);
        samples.push({ t: performance.now() - startTime, v, hz });
      }, 50);

      function cleanup() {
        clearInterval(sampleTimer);
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close().catch(() => {});
      }

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-US";
      recognition.interimResults = false;
      recognition.continuous = false;

      recognition.onresult = (event) => {
        let finalText = "";
        for (let i = 0; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalText += event.results[i][0].transcript + " ";
        }
        if (settled) return;
        settled = true;
        const durationMs = performance.now() - startTime;
        cleanup();
        resolve({ transcript: finalText.trim(), durationMs, samples });
      };
      recognition.onerror = (e) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(e.error || "recognition-error"));
      };
      recognition.onend = () => {
        if (settled) return;
        settled = true;
        const durationMs = performance.now() - startTime;
        cleanup();
        resolve({ transcript: "", durationMs, samples });
      };

      recognition.start();
      stopFn = () => recognition.stop();
    }).catch((err) => reject(err));
  });
  return { promise, stop: () => stopFn() };
}

/* Same idea as captureAttempt, but for free-form speech lasting up to a
   minute: continuous recognition (accumulates every final result using
   event.resultIndex so nothing is double-counted) with interim results on
   so it keeps listening through natural pauses, plus an auto-stop timer. */
function captureLongAttempt({ maxMs = 60000 } = {}) {
  let stopFn = () => {};
  let timeoutId = null;
  const promise = new Promise((resolve, reject) => {
    if (!SpeechRecognitionCtor) { reject(new Error("no-speech-recognition")); return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { reject(new Error("no-mic")); return; }

    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const audioCtx = new AudioCtx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);

      const samples = [];
      const startTime = performance.now();
      let settled = false;
      let finalText = "";

      const sampleTimer = setInterval(() => {
        analyser.getFloatTimeDomainData(buf);
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
        const v = Math.sqrt(sumSq / buf.length);
        const hz = estimatePitch(buf, audioCtx.sampleRate);
        samples.push({ t: performance.now() - startTime, v, hz });
      }, 50);

      function cleanup() {
        clearInterval(sampleTimer);
        clearTimeout(timeoutId);
        stream.getTracks().forEach((t) => t.stop());
        audioCtx.close().catch(() => {});
      }

      const recognition = new SpeechRecognitionCtor();
      recognition.lang = "en-US";
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onresult = (event) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalText += event.results[i][0].transcript + " ";
        }
      };
      recognition.onerror = (e) => {
        if (e.error === "no-speech") return; // silence gaps are normal in free speech - keep going
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(e.error || "recognition-error"));
      };
      recognition.onend = () => {
        if (settled) return;
        settled = true;
        const durationMs = performance.now() - startTime;
        cleanup();
        resolve({ transcript: finalText.trim(), durationMs, samples });
      };

      recognition.start();
      timeoutId = setTimeout(() => { try { recognition.stop(); } catch (e) { /* already stopped */ } }, maxMs);
      stopFn = () => { try { recognition.stop(); } catch (e) { /* already stopped */ } };
    }).catch((err) => reject(err));
  });
  return { promise, stop: () => stopFn() };
}

/* ---------- Metric helpers, computed from a capture attempt ---------- */

function clarityFromSamples(samples) {
  const voiced = samples.filter((s) => s.v !== null && s.v !== undefined);
  if (!voiced.length) return { score: 0, tips: ["We couldn't hear you clearly - try again a bit closer to the mic."] };
  const avg = voiced.reduce((a, s) => a + s.v, 0) / voiced.length;
  const score = Math.max(0, Math.min(100, Math.round((avg / 0.12) * 100)));
  const tips = [];
  if (score < 55) tips.push("Speak slightly louder.");
  const low = voiced.filter((s) => s.v < avg * 0.35).length / voiced.length;
  if (low > 0.35) tips.push("Reduce mumbling - try to keep your volume steady through the whole sentence.");
  if (!tips.length) tips.push("Nice, clear voice!");
  return { score, tips };
}

function wpmFromAttempt(transcript, durationMs) {
  const words = normalizeWords(transcript).length;
  const minutes = Math.max(durationMs, 1) / 60000;
  return Math.round(words / minutes);
}

function pauseCountFromSamples(samples, silenceThreshold = 0.02, minPauseMs = 180) {
  const voicedIdx = samples.map((s, i) => (s.v > silenceThreshold ? i : -1)).filter((i) => i >= 0);
  if (voicedIdx.length < 2) return 0;
  const startIdx = voicedIdx[0];
  const endIdx = voicedIdx[voicedIdx.length - 1];
  let pauses = 0;
  let silenceStart = null;
  for (let i = startIdx; i <= endIdx; i++) {
    const isSilent = samples[i].v <= silenceThreshold;
    if (isSilent && silenceStart === null) silenceStart = samples[i].t;
    if (!isSilent && silenceStart !== null) {
      if (samples[i].t - silenceStart >= minPauseMs) pauses += 1;
      silenceStart = null;
    }
  }
  return pauses;
}

function pitchStats(samples) {
  const voiced = samples.map((s) => s.hz).filter((hz) => hz && hz > 0);
  if (voiced.length < 4) return null;
  const sorted = [...voiced].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = voiced.reduce((a, b) => a + b, 0) / voiced.length;
  const variance = voiced.reduce((a, b) => a + (b - mean) * (b - mean), 0) / voiced.length;
  const stdDev = Math.sqrt(variance);
  const half = Math.floor(voiced.length / 2);
  const firstHalf = voiced.slice(0, half);
  const secondHalf = voiced.slice(half);
  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / (firstHalf.length || 1);
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / (secondHalf.length || 1);
  return { median, stdDev, firstAvg, secondAvg, relativeVariance: stdDev / median };
}

function stressSegmentMatch(samples, syllableCount, expectedIndex) {
  if (!samples.length) return { detectedIndex: -1, matched: false };
  const totalT = samples[samples.length - 1].t || 1;
  const energies = new Array(syllableCount).fill(0);
  const counts = new Array(syllableCount).fill(0);
  samples.forEach((s) => {
    const seg = Math.min(syllableCount - 1, Math.floor((s.t / totalT) * syllableCount));
    energies[seg] += s.v || 0;
    counts[seg] += 1;
  });
  const avgEnergies = energies.map((e, i) => (counts[i] ? e / counts[i] : 0));
  let detectedIndex = 0;
  for (let i = 1; i < avgEnergies.length; i++) if (avgEnergies[i] > avgEnergies[detectedIndex]) detectedIndex = i;
  return { detectedIndex, matched: detectedIndex === expectedIndex };
}

function intonationMatch(samples, emotionId) {
  const stats = pitchStats(samples);
  const clarity = clarityFromSamples(samples);
  if (!stats) return { matched: false, note: "We couldn't detect enough voice to analyze pitch - try speaking a bit louder and clearer." };
  const rising = stats.secondAvg > stats.firstAvg * 1.12;
  const highVariance = stats.relativeVariance > 0.16;
  const lowVariance = stats.relativeVariance < 0.09;
  const loud = clarity.score > 65;

  let matched = false;
  let note = "";
  if (emotionId === "happy") {
    matched = highVariance;
    note = matched ? "Nice bright, varied pitch - sounds happy!" : "Try more pitch variation - let your voice go up and down more.";
  } else if (emotionId === "sad") {
    matched = lowVariance && !rising;
    note = matched ? "Good - low, flat tone comes across as sad." : "Try flattening your pitch more and slowing down.";
  } else if (emotionId === "angry") {
    matched = loud;
    note = matched ? "Good projection - that reads as angry/forceful." : "Try more volume and a sharper edge in your voice.";
  } else if (emotionId === "surprised") {
    matched = rising;
    note = matched ? "Good rising pitch at the end - sounds surprised!" : "Try a sharper rise in pitch, especially on the last word.";
  }
  return { matched, note };
}

/* ---------- Filler words + free-speech scoring ---------- */

const FILLER_WORDS = ["um", "uh", "actually", "like", "basically"];

const JOINING_WORD_SUGGESTIONS = [
  "First of all", "In addition", "However", "As a result", "For example",
  "In my opinion", "To sum up", "On the other hand", "Furthermore", "Meanwhile",
];

const PAUSE_AND_SPEED_TIPS = [
  "Replace the urge to say \"um\" with a silent pause - a brief silence sounds confident, not awkward.",
  "Take a breath at the end of each sentence - it naturally paces your speech and gives your brain a moment to plan the next thought.",
  "Slow down on your most important word in a sentence - it adds emphasis and buys you thinking time.",
  "Chunk your ideas: finish one thought, pause briefly, then start the next - don't chain everything together with \"and... and... and\".",
  "If you catch yourself about to say a filler word, close your mouth and count to one in your head instead.",
  "Practice the same topic twice in a row - the second attempt is almost always smoother with fewer fillers.",
  "Record yourself daily for a week and track your filler count - awareness alone cuts most fillers in half.",
];

/* Counts each filler word as a whole word (so "like" doesn't match inside
   "likely"), case-insensitive. Returns { counts: {word: n}, total }. */
function countFillerWords(transcript) {
  const counts = {};
  let total = 0;
  FILLER_WORDS.forEach((w) => {
    const re = new RegExp(`\\b${w}\\b`, "gi");
    const n = (transcript.match(re) || []).length;
    counts[w] = n;
    total += n;
  });
  return { counts, total };
}

/* Highlights filler words in-place within the transcript for display. */
function highlightFillers(transcript) {
  let html = escapeHtml(transcript);
  FILLER_WORDS.forEach((w) => {
    const re = new RegExp(`\\b(${w})\\b`, "gi");
    html = html.replace(re, `<mark style="background:#fde68a;color:#1c1e29;padding:0 2px;border-radius:3px;">$1</mark>`);
  });
  return html;
}

/* Best-effort: only scores real grammar if the user is logged in and the
   backend is reachable (same /api/check LanguageTool endpoint Speaking
   Practice uses) - returns null otherwise so the round can degrade
   gracefully for guests instead of requiring login just for this one round. */
async function fetchGrammarScore(text) {
  if (typeof getSession !== "function" || typeof API_BASE === "undefined") return null;
  const session = getSession();
  if (!session || session.guest || !text.trim()) return null;
  try {
    const res = await fetch(`${API_BASE}/api/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: session.username, text }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Math.max(0, Math.min(100, 100 - (data.issues_found || 0) * 10));
  } catch (e) {
    return null;
  }
}

function scoreBar(label, value) {
  const display = value === null ? "--" : value + "%";
  const width = value === null ? 0 : value;
  return `
    <div style="margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
        <span style="color:var(--text-muted);">${label}</span>
        <span style="font-weight:700;">${display}</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${width}%"></div></div>
    </div>
  `;
}

/* ---------- Round definitions ---------- */

const ROUNDS = [
  { key: "echo", num: 1, icon: "🔁", title: "Echo Challenge", subtitle: "Listen and repeat exactly." },
  { key: "pause", num: 2, icon: "⏸️", title: "Pause Challenge", subtitle: "Checks your natural pauses." },
  { key: "stress", num: 3, icon: "🔤", title: "Stress Word", subtitle: "Say the word with the right syllable stressed." },
  { key: "speed", num: 4, icon: "⏱️", title: "Speed Control", subtitle: "Read at a natural pace - not too fast, not too slow." },
  { key: "match", num: 5, icon: "🎧", title: "Pronunciation Match", subtitle: "Play the audio, then match it." },
  { key: "missingSound", num: 6, icon: "🔍", title: "Missing Sound", subtitle: "Don't drop the sounds learners often skip." },
  { key: "minimalPairs", num: 7, icon: "👂", title: "Minimal Pair Challenge", subtitle: "Similar sounds, like ship & sheep." },
  { key: "clarity", num: 8, icon: "📢", title: "Voice Clarity Meter", subtitle: "How clearly are you speaking?" },
  { key: "intonation", num: 9, icon: "🎭", title: "Intonation Practice", subtitle: "Pick an emotion, then say it like you mean it." },
  { key: "oneMinuteSpeech", num: 10, icon: "🗣️", title: "One-Minute Speech", subtitle: "Pick a topic and speak for up to a minute." },
  { key: "fillerDetector", num: 11, icon: "🚫", title: "Filler Word Detector", subtitle: "Talk about anything - we'll flag your filler words." },
];

let DATA = null;
let SHADOWING = [];
const roundStates = {};
let currentRoundKey = null;
let selectedEmotion = null;
let selectedTopic = null;

function itemsForRound(key) {
  if (key === "echo") return SHADOWING.filter((s) => s.category === "Workplace" || s.category === "Business");
  if (key === "match") return SHADOWING.filter((s) => s.category === "Everyday" || s.category === "Greetings");
  if (key === "pause") return DATA.pause;
  if (key === "stress") return DATA.stress;
  if (key === "speed") return DATA.speed;
  if (key === "missingSound") return DATA.missingSound;
  if (key === "minimalPairs") return DATA.minimalPairs;
  if (key === "clarity") return SHADOWING.filter((s) => s.category === "Business" || s.category === "Everyday");
  if (key === "intonation") return DATA.intonationSentences.map((sentence) => ({ sentence, emotions: DATA.intonationEmotions }));
  if (key === "oneMinuteSpeech") return [DATA.oneMinuteSpeech];
  if (key === "fillerDetector") return [DATA.fillerDetector];
  return [];
}

function ensureRoundState(key) {
  if (!roundStates[key]) {
    const items = itemsForRound(key);
    roundStates[key] = makeShuffleState(items.length);
  }
  return roundStates[key];
}

/* ---------- Shared mic-round UI: Listen -> Record -> Analyze -> Feedback -> Retry/Next ---------- */

function renderMicRound(container, { promptHtml, listenText, onAnalyze, extraControls }) {
  const card = el("div", "card");
  card.innerHTML = promptHtml;

  if (extraControls) card.appendChild(extraControls);

  const controls = el("div");
  controls.style.cssText = "display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;";

  if (listenText) {
    const listenBtn = el("button", "btn secondary", "🔊 Listen");
    listenBtn.style.flex = "1";
    listenBtn.onclick = () => speak(listenText);
    controls.appendChild(listenBtn);
  }

  const recordBtn = el("button", "btn", "🎤 Record");
  recordBtn.style.flex = "1";
  controls.appendChild(recordBtn);
  card.appendChild(controls);

  const statusText = el("div", "", "");
  statusText.style.cssText = "font-size:13px;color:var(--text-muted);margin-top:10px;min-height:18px;text-align:center;";
  card.appendChild(statusText);

  const resultArea = el("div");
  resultArea.style.cssText = "margin-top:14px;";
  card.appendChild(resultArea);

  let activeCapture = null;
  let recording = false;

  recordBtn.onclick = () => {
    if (recording) {
      activeCapture && activeCapture.stop();
      return;
    }
    if (!SpeechRecognitionCtor) {
      statusText.textContent = "Speech recognition isn't supported in this browser - try Chrome or Edge.";
      return;
    }
    recording = true;
    recordBtn.textContent = "⏹ Stop";
    statusText.textContent = "Listening... speak now.";
    resultArea.innerHTML = "";

    activeCapture = captureAttempt();
    activeCapture.promise
      .then((attempt) => {
        recording = false;
        recordBtn.textContent = "🎤 Record";
        statusText.textContent = "";
        onAnalyze(attempt, resultArea);
      })
      .catch((err) => {
        recording = false;
        recordBtn.textContent = "🎤 Record";
        if (err.message === "no-mic" || err.name === "NotAllowedError" || err.message === "not-allowed") {
          statusText.textContent = "Microphone access is needed for this game - please allow it and try again.";
        } else {
          statusText.textContent = "Didn't catch that - try again.";
        }
      });
  };

  container.appendChild(card);
  return { resultArea };
}

function feedbackBox(isGood, mainText, extraHtml) {
  return `
    <div class="feedback-box ${isGood ? "correct" : "incorrect"}">${mainText}</div>
    ${extraHtml || ""}
  `;
}

/* ---------- Round renderers ---------- */

function renderRoundBody(container) {
  const round = ROUNDS.find((r) => r.key === currentRoundKey);
  const state = ensureRoundState(round.key);
  const items = itemsForRound(round.key);

  if (!items.length) {
    container.appendChild(el("div", "empty-state", "No items available for this round yet."));
    return;
  }

  const item = items[currentItemIndex(state)];

  const header = el("div");
  header.style.cssText = "text-align:center;margin-bottom:6px;";
  header.innerHTML = `<div style="font-size:13px;color:var(--text-muted);">Round ${round.num} of ${ROUNDS.length}</div>`;
  container.appendChild(header);

  const renderers = {
    echo: renderEcho, match: renderEcho,
    pause: renderPause,
    stress: renderStress,
    speed: renderSpeed,
    missingSound: renderMissingSound,
    minimalPairs: renderMinimalPairs,
    clarity: renderClarity,
    intonation: renderIntonation,
    oneMinuteSpeech: renderOneMinuteSpeech,
    fillerDetector: renderFillerDetector,
  };
  renderers[round.key](container, item, state);

  const nav = el("div");
  nav.style.cssText = "display:flex;gap:8px;margin-top:14px;";
  const nextItemBtn = el("button", "btn secondary block", "Next Item →");
  nextItemBtn.onclick = () => {
    advanceShuffleState(state);
    renderRound(container);
  };
  nav.appendChild(nextItemBtn);
  container.appendChild(nav);
}

function renderEcho(container, item) {
  const { resultArea } = renderMicRound(container, {
    promptHtml: `<div class="section-title" style="margin-top:0">${escapeHtml(ROUNDS.find(r => r.key === currentRoundKey).title)}</div>
      <div style="text-align:center;font-size:19px;font-weight:700;margin:10px 0;">${escapeHtml(item.text)}</div>`,
    listenText: item.text,
    onAnalyze: (attempt, area) => {
      const expected = normalizeWords(item.text);
      const actual = normalizeWords(attempt.transcript);
      const matched = diffWords(expected, actual);
      const accuracy = expected.length ? Math.round((matched.size / expected.length) * 100) : 0;
      const clarity = clarityFromSamples(attempt.samples);
      const isGood = accuracy >= 80;

      recordScore("accuracy", accuracy);
      recordScore("pronunciation", accuracy);
      recordScore("clarity", clarity.score);

      const wordsHtml = expected.map((w, i) => {
        const ok = matched.has(i);
        return `<span style="${ok ? "color:var(--accent);font-weight:700;" : "color:var(--danger);text-decoration:line-through;"}">${escapeHtml(w)}</span>`;
      }).join(" ");

      area.innerHTML = feedbackBox(isGood, isGood ? "✅ Excellent!" : "✘ Try Again", `
        <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">You said:</div>
        <div style="margin-top:4px;">${escapeHtml(attempt.transcript) || "<i>(nothing recognized)</i>"}</div>
        <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Word match:</div>
        <div style="margin-top:4px;">${wordsHtml}</div>
      `);
    },
  });
}

function renderPause(container, item) {
  renderMicRound(container, {
    promptHtml: `<div class="section-title" style="margin-top:0">Pause Challenge</div>
      <p style="margin:0 0 8px;font-size:13.5px;color:var(--text-muted);">Read this sentence naturally - pause briefly at each comma.</p>
      <div style="text-align:center;font-size:18px;font-weight:700;margin:10px 0;">${escapeHtml(item.text)}</div>`,
    listenText: item.text,
    onAnalyze: (attempt, area) => {
      const expectedPauses = (item.text.match(/,/g) || []).length;
      const detected = pauseCountFromSamples(attempt.samples);
      const diff = Math.abs(detected - expectedPauses);
      const fluency = Math.max(0, 100 - diff * 30);
      const isGood = diff <= 1;

      recordScore("fluency", fluency);

      area.innerHTML = feedbackBox(isGood,
        isGood ? "✅ Nice, natural pausing!" : "✘ Try pausing right at the commas.",
        `<div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Expected pauses: ${expectedPauses} · Detected: ${detected}</div>`
      );
    },
  });
}

function renderStress(container, item) {
  const display = item.syllables.map((syl, i) =>
    i === item.stressIndex
      ? `<span style="color:var(--primary);font-weight:800;">${escapeHtml(syl.toUpperCase())}</span>`
      : escapeHtml(syl.toLowerCase())
  ).join("-");

  renderMicRound(container, {
    promptHtml: `<div class="section-title" style="margin-top:0">Stress Word</div>
      <p style="margin:0 0 8px;font-size:13.5px;color:var(--text-muted);">Say this word, stressing the highlighted syllable.</p>
      <div style="text-align:center;font-size:26px;font-weight:800;margin:10px 0;">${escapeHtml(item.word)}</div>
      <div style="text-align:center;font-size:20px;letter-spacing:1px;">${display}</div>`,
    listenText: item.word,
    onAnalyze: (attempt, area) => {
      const { detectedIndex, matched } = stressSegmentMatch(attempt.samples, item.syllables.length, item.stressIndex);
      const heardWord = normalizeWords(attempt.transcript).some((w) => w.includes(item.word.slice(0, 4)));
      const score = matched ? 100 : 45;

      recordScore("pronunciation", score);

      const detectedSyl = detectedIndex >= 0 ? item.syllables[detectedIndex] : "?";
      area.innerHTML = feedbackBox(matched,
        matched ? "✅ Correct stress!" : "✘ Try Again - stress landed elsewhere.",
        `<div style="margin-top:10px;font-size:13px;color:var(--text-muted);">
          We heard the strongest stress on: <b style="color:var(--text);">${escapeHtml(detectedSyl)}</b>
          ${heardWord ? "" : " (couldn't confirm the word itself - make sure you're saying " + escapeHtml(item.word) + ")"}
        </div>`
      );
    },
  });
}

function renderSpeed(container, item) {
  renderMicRound(container, {
    promptHtml: `<div class="section-title" style="margin-top:0">Speed Control</div>
      <p style="margin:0 0 8px;font-size:13.5px;color:var(--text-muted);">Read this paragraph at a natural pace - target ${item.targetWpm} words per minute.</p>
      <div style="font-size:15.5px;line-height:1.7;margin:10px 0;">${escapeHtml(item.text)}</div>`,
    onAnalyze: (attempt, area) => {
      const wpm = wpmFromAttempt(attempt.transcript, attempt.durationMs);
      const diffPct = Math.abs(wpm - item.targetWpm) / item.targetWpm;
      let label, score;
      if (diffPct <= 0.12) { label = "Excellent"; score = 100; }
      else if (diffPct <= 0.25) { label = wpm > item.targetWpm ? "A little fast" : "A little slow"; score = 75; }
      else { label = wpm > item.targetWpm ? "Too fast" : "Too slow"; score = 45; }

      recordScore("fluency", score);
      recordScore("accuracy", Math.round((normalizeWords(attempt.transcript).length / normalizeWords(item.text).length) * 100));

      area.innerHTML = feedbackBox(score >= 75, `Speed: <b>${wpm} WPM</b> - ${label}`, `
        <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Target: ${item.targetWpm} WPM</div>
      `);
    },
  });
}

function renderMissingSound(container, item) {
  renderMicRound(container, {
    promptHtml: `<div class="section-title" style="margin-top:0">Missing Sound</div>
      <p style="margin:0 0 8px;font-size:13.5px;color:var(--text-muted);">Say this word, keeping every sound - don't drop any letters.</p>
      <div style="text-align:center;font-size:28px;font-weight:800;margin:10px 0;">${escapeHtml(item.word)}</div>`,
    listenText: item.word,
    onAnalyze: (attempt, area) => {
      const said = normalizeWords(attempt.transcript);
      const isGood = said.includes(item.word.toLowerCase());
      const soundedLikeMistake = said.includes(item.commonMistake.toLowerCase());
      recordScore("pronunciation", isGood ? 100 : 40);

      area.innerHTML = feedbackBox(isGood,
        isGood ? "✅ Excellent - all sounds present!" : soundedLikeMistake ? `✘ That sounded like "${escapeHtml(item.commonMistake)}" - a common shortcut.` : "✘ Try Again",
        `<div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Tip:</div>
         <div style="margin-top:4px;">${escapeHtml(item.tip)}</div>`
      );
    },
  });
}

function renderMinimalPairs(container, item, state) {
  if (!state._target || state._targetFor !== currentItemIndex(state)) {
    state._target = Math.random() < 0.5 ? item.a : item.b;
    state._targetFor = currentItemIndex(state);
  }
  const target = state._target;
  const other = target === item.a ? item.b : item.a;

  renderMicRound(container, {
    promptHtml: `<div class="section-title" style="margin-top:0">Minimal Pair Challenge</div>
      <p style="margin:0 0 8px;font-size:13.5px;color:var(--text-muted);">Say this word clearly (not the similar-sounding one).</p>
      <div style="text-align:center;font-size:28px;font-weight:800;margin:10px 0;">${escapeHtml(target)}</div>
      <div style="text-align:center;font-size:13px;color:var(--text-muted);">${escapeHtml(item.tip)}</div>`,
    listenText: target,
    onAnalyze: (attempt, area) => {
      const said = normalizeWords(attempt.transcript);
      const gotTarget = said.includes(target.toLowerCase());
      const gotOther = said.includes(other.toLowerCase());
      recordScore("pronunciation", gotTarget ? 100 : 35);

      area.innerHTML = feedbackBox(gotTarget,
        gotTarget ? "✅ Excellent!" : gotOther
          ? `✘ That sounded like "${escapeHtml(other)}", not "${escapeHtml(target)}".`
          : "✘ Try Again",
        `<div style="margin-top:10px;font-size:13px;color:var(--text-muted);">${escapeHtml(item.tip)}</div>`
      );
    },
  });
}

function renderClarity(container, item) {
  renderMicRound(container, {
    promptHtml: `<div class="section-title" style="margin-top:0">Voice Clarity Meter</div>
      <p style="margin:0 0 8px;font-size:13.5px;color:var(--text-muted);">Read this sentence clearly and confidently.</p>
      <div style="text-align:center;font-size:18px;font-weight:700;margin:10px 0;">${escapeHtml(item.text)}</div>`,
    onAnalyze: (attempt, area) => {
      const { score, tips } = clarityFromSamples(attempt.samples);
      recordScore("clarity", score);
      area.innerHTML = feedbackBox(score >= 65, `Voice Clarity: <b>${score}%</b>`, `
        <ul class="plain-list" style="margin-top:8px;">${tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      `);
    },
  });
}

function renderIntonation(container, item) {
  const chipRow = el("div");
  chipRow.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;";
  item.emotions.forEach((em) => {
    const chip = el("button", "btn secondary", em.label);
    chip.style.flex = "1 1 40%";
    if (selectedEmotion === em.id) chip.classList.add("active-tab");
    chip.onclick = () => { selectedEmotion = em.id; renderRound(container); };
    chipRow.appendChild(chip);
  });

  if (!selectedEmotion) {
    const card = el("div", "card");
    card.innerHTML = `<div class="section-title" style="margin-top:0">Intonation Practice</div>
      <p style="margin:0 0 8px;font-size:13.5px;color:var(--text-muted);">Pick an emotion, then say the sentence like you mean it.</p>
      <div style="text-align:center;font-size:18px;font-weight:700;margin:10px 0;">${escapeHtml(item.sentence)}</div>`;
    card.appendChild(chipRow);
    container.appendChild(card);
    return;
  }

  const emotion = item.emotions.find((e) => e.id === selectedEmotion);
  renderMicRound(container, {
    promptHtml: `<div class="section-title" style="margin-top:0">Intonation Practice</div>
      <p style="margin:0 0 6px;font-size:13.5px;color:var(--text-muted);">Say it like: <b>${escapeHtml(emotion.label)}</b> - ${escapeHtml(emotion.hint)}</p>
      <div style="text-align:center;font-size:18px;font-weight:700;margin:10px 0;">${escapeHtml(item.sentence)}</div>`,
    listenText: item.sentence,
    extraControls: chipRow,
    onAnalyze: (attempt, area) => {
      const { matched, note } = intonationMatch(attempt.samples, selectedEmotion);
      recordScore("fluency", matched ? 100 : 50);
      area.innerHTML = feedbackBox(matched, matched ? "✅ Great intonation!" : "✘ Try Again", `
        <div style="margin-top:10px;">${escapeHtml(note)}</div>
      `);
    },
  });
}

/* Same idea as renderMicRound, but for the up-to-a-minute free-speech
   rounds: a live countdown instead of an auto-stop-on-pause, and a Stop
   button to end early. */
function renderLongMicRound(container, { promptHtml, maxMs, onAnalyze, extraControls }) {
  const card = el("div", "card");
  card.innerHTML = promptHtml;
  if (extraControls) card.appendChild(extraControls);

  const recordBtn = el("button", "btn block", "🎤 Start Speaking");
  card.appendChild(recordBtn);

  const statusText = el("div", "", "");
  statusText.style.cssText = "font-size:13px;color:var(--text-muted);margin-top:10px;min-height:18px;text-align:center;";
  card.appendChild(statusText);

  const resultArea = el("div");
  resultArea.style.cssText = "margin-top:14px;";
  card.appendChild(resultArea);

  let activeCapture = null;
  let recording = false;
  let countdownTimer = null;

  recordBtn.onclick = () => {
    if (recording) {
      activeCapture && activeCapture.stop();
      return;
    }
    if (!SpeechRecognitionCtor) {
      statusText.textContent = "Speech recognition isn't supported in this browser - try Chrome or Edge.";
      return;
    }
    recording = true;
    recordBtn.textContent = "⏹ Stop Now";
    resultArea.innerHTML = "";

    let secondsLeft = Math.round(maxMs / 1000);
    statusText.textContent = `Listening... ${secondsLeft}s left`;
    countdownTimer = setInterval(() => {
      secondsLeft -= 1;
      if (secondsLeft > 0) statusText.textContent = `Listening... ${secondsLeft}s left`;
      else statusText.textContent = "Wrapping up...";
    }, 1000);

    activeCapture = captureLongAttempt({ maxMs });
    activeCapture.promise
      .then((attempt) => {
        recording = false;
        clearInterval(countdownTimer);
        recordBtn.textContent = "🎤 Start Speaking";
        statusText.textContent = "";
        onAnalyze(attempt, resultArea);
      })
      .catch((err) => {
        recording = false;
        clearInterval(countdownTimer);
        recordBtn.textContent = "🎤 Start Speaking";
        if (err.message === "no-mic" || err.name === "NotAllowedError" || err.message === "not-allowed") {
          statusText.textContent = "Microphone access is needed for this game - please allow it and try again.";
        } else {
          statusText.textContent = "Didn't catch that - try again.";
        }
      });
  };

  container.appendChild(card);
  return { resultArea };
}

function renderOneMinuteSpeech(container, item) {
  if (!selectedTopic) {
    const card = el("div", "card");
    card.innerHTML = `<div class="section-title" style="margin-top:0">One-Minute Speech</div>
      <p style="margin:0 0 10px;font-size:13.5px;color:var(--text-muted);">Pick a topic, then speak about it for up to a minute.</p>`;
    const grid = el("div");
    grid.style.cssText = "display:flex;flex-direction:column;gap:8px;max-height:420px;overflow-y:auto;";
    item.topics.forEach((topic) => {
      const btn = el("button", "quiz-option", escapeHtml(topic));
      btn.onclick = () => { selectedTopic = topic; renderRound(container); };
      grid.appendChild(btn);
    });
    card.appendChild(grid);
    container.appendChild(card);
    return;
  }

  const changeTopicLink = el("button", "btn secondary", "← Choose a different topic");
  changeTopicLink.style.marginBottom = "10px";
  changeTopicLink.onclick = () => { selectedTopic = null; renderRound(container); };
  container.appendChild(changeTopicLink);

  renderLongMicRound(container, {
    promptHtml: `<div class="section-title" style="margin-top:0">One-Minute Speech</div>
      <p style="margin:0 0 6px;font-size:13px;color:var(--text-muted);">Your topic:</p>
      <div style="text-align:center;font-size:18px;font-weight:700;margin:6px 0 4px;">${escapeHtml(selectedTopic)}</div>`,
    maxMs: item.durationMs,
    onAnalyze: async (attempt, area) => {
      area.innerHTML = `<div class="empty-state">Analyzing your speech...</div>`;

      const words = normalizeWords(attempt.transcript);
      const fillers = countFillerWords(attempt.transcript);
      const uniqueRatio = words.length ? new Set(words).size / words.length : 0;
      const clarity = clarityFromSamples(attempt.samples);
      const longPauses = pauseCountFromSamples(attempt.samples, 0.02, 700);
      const segments = pauseCountFromSamples(attempt.samples, 0.02, 180) + 1;
      const wordsPerSegment = words.length / segments;
      const wpm = wpmFromAttempt(attempt.transcript, attempt.durationMs);

      const grammarScore = await fetchGrammarScore(attempt.transcript);
      const vocabularyScore = Math.max(0, Math.min(100, Math.round(uniqueRatio * 170)));
      const fillerScore = Math.max(0, Math.min(100, 100 - fillers.total * 8));
      const confidenceScore = Math.round((clarity.score + Math.max(0, 100 - longPauses * 15)) / 2);
      const sentenceStructureScore = wordsPerSegment >= 6 && wordsPerSegment <= 22
        ? 100
        : Math.max(30, 100 - Math.abs(wordsPerSegment - 14) * 5);
      const wpmDiffPct = Math.abs(wpm - 140) / 140;
      const wpmScore = wpmDiffPct <= 0.2 ? 100 : wpmDiffPct <= 0.4 ? 70 : 45;
      const fluencyScore = Math.round((wpmScore + Math.max(0, 100 - longPauses * 10) + fillerScore) / 3);

      recordScore("fluency", fluencyScore);
      recordScore("accuracy", grammarScore !== null ? grammarScore : Math.round(sentenceStructureScore));

      const fillerList = FILLER_WORDS.filter((w) => fillers.counts[w] > 0)
        .map((w) => `${escapeHtml(w)} (${fillers.counts[w]})`).join(", ") || "none detected";

      area.innerHTML = `
        ${scoreBar("Grammar", grammarScore !== null ? Math.round(grammarScore) : null)}
        ${scoreBar("Vocabulary", vocabularyScore)}
        ${scoreBar("Filler Words", fillerScore)}
        ${scoreBar("Confidence", confidenceScore)}
        ${scoreBar("Sentence Structure", Math.round(sentenceStructureScore))}
        ${scoreBar("Fluency", fluencyScore)}
        ${grammarScore === null ? '<div style="font-size:12px;color:var(--text-muted);margin:6px 0 12px;">Log in (from the dashboard) to also get a real grammar score here.</div>' : ""}
        <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Filler words used:</div>
        <div style="margin-top:4px;">${fillerList}</div>
        <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Speed: ${wpm} WPM</div>
        <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">What you said:</div>
        <div style="margin-top:4px;">${highlightFillers(attempt.transcript) || "<i>(nothing recognized)</i>"}</div>
      `;
    },
  });
}

function renderFillerDetector(container, item) {
  renderLongMicRound(container, {
    promptHtml: `<div class="section-title" style="margin-top:0">Filler Word Detector</div>
      <p style="margin:0 0 8px;font-size:13.5px;color:var(--text-muted);">Talk about anything you like for up to a minute - a hobby, your day, a plan. We'll flag your filler words.</p>`,
    maxMs: item.durationMs,
    onAnalyze: (attempt, area) => {
      const fillers = countFillerWords(attempt.transcript);
      const words = normalizeWords(attempt.transcript).length;
      const perMinute = words ? Math.round((fillers.total / Math.max(attempt.durationMs, 1)) * 60000) : 0;

      recordScore("fluency", Math.max(0, 100 - fillers.total * 8));

      const breakdown = FILLER_WORDS
        .map((w) => `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>${escapeHtml(w)}</span><b>${fillers.counts[w]}</b></div>`)
        .join("");

      area.innerHTML = `
        <div class="feedback-box ${fillers.total <= 2 ? "correct" : "incorrect"}">
          ${fillers.total === 0 ? "✅ No filler words detected - excellent!" : `You used <b>${fillers.total}</b> filler word${fillers.total === 1 ? "" : "s"} (about ${perMinute} per minute).`}
        </div>
        <div style="margin-top:12px;font-size:13px;color:var(--text-muted);">Breakdown:</div>
        <div style="margin-top:4px;">${breakdown}</div>
        <div style="margin-top:12px;font-size:13px;color:var(--text-muted);">What you said:</div>
        <div style="margin-top:4px;">${highlightFillers(attempt.transcript) || "<i>(nothing recognized)</i>"}</div>
        <div style="margin-top:14px;font-size:13px;font-weight:700;">Try joining words instead of fillers:</div>
        <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:6px;">${JOINING_WORD_SUGGESTIONS.map((w) => `<span class="tag">${escapeHtml(w)}</span>`).join("")}</div>
        <div style="margin-top:14px;font-size:13px;font-weight:700;">Tips to pause instead of filling:</div>
        <ul class="plain-list" style="margin-top:6px;">${PAUSE_AND_SPEED_TIPS.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>
      `;
    },
  });
}

/* ---------- Hub / navigation ---------- */

function renderHub(container) {
  container.innerHTML = "";
  const scoreCard = el("div", "card");
  scoreCard.innerHTML = `<div class="section-title" style="margin-top:0">Your Scores</div><div id="scoreDashboard"></div>`;
  container.appendChild(scoreCard);
  updateScoreDashboard();

  const intro = el("div", "", "Pick a round to start. You can play them in any order.");
  intro.style.cssText = "font-size:13px;color:var(--text-muted);margin:14px 4px 10px;";
  container.appendChild(intro);

  ROUNDS.forEach((round) => {
    const card = el("div", "card");
    card.style.cursor = "pointer";
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-size:26px;">${round.icon}</div>
        <div style="flex:1;">
          <div style="font-weight:700;">Round ${round.num}: ${escapeHtml(round.title)}</div>
          <div style="font-size:13px;color:var(--text-muted);margin-top:2px;">${escapeHtml(round.subtitle)}</div>
        </div>
        <div style="font-size:18px;color:var(--text-muted);">→</div>
      </div>
    `;
    card.onclick = () => {
      currentRoundKey = round.key;
      selectedEmotion = null;
      selectedTopic = null;
      renderRound(container);
    };
    container.appendChild(card);
  });
}

function renderRound(container) {
  container.innerHTML = "";
  const round = ROUNDS.find((r) => r.key === currentRoundKey);

  const header = el("div");
  header.style.cssText = "display:flex;gap:8px;margin-bottom:12px;";
  const backBtn = el("button", "btn secondary", "← All Rounds");
  backBtn.style.flex = "1";
  backBtn.onclick = () => { currentRoundKey = null; renderHub(container); };
  const nextLevelBtn = el("button", "btn", "Next Level →");
  nextLevelBtn.style.flex = "1";
  nextLevelBtn.onclick = () => {
    const idx = ROUNDS.findIndex((r) => r.key === currentRoundKey);
    const next = ROUNDS[(idx + 1) % ROUNDS.length];
    currentRoundKey = next.key;
    selectedEmotion = null;
    selectedTopic = null;
    renderRound(container);
  };
  header.appendChild(backBtn);
  header.appendChild(nextLevelBtn);
  container.appendChild(header);

  const scoreCard = el("div", "card");
  scoreCard.innerHTML = `<div class="section-title" style="margin-top:0;font-size:13px;">Your Scores</div><div id="scoreDashboard"></div>`;
  container.appendChild(scoreCard);
  updateScoreDashboard();

  renderRoundBody(container);
}

async function init() {
  setupThemeToggle();
  const container = document.getElementById("gameContainer");
  container.innerHTML = `<div class="empty-state">Loading...</div>`;
  try {
    const [dataRes, shadowRes] = await Promise.all([
      fetch("../data/pronunciation-coach.json"),
      fetch("../data/shadowing-sentences.json"),
    ]);
    DATA = await dataRes.json();
    SHADOWING = await shadowRes.json();
    renderHub(container);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load the game. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
