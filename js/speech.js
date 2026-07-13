/* Free pronunciation playback using the browser's built-in Web Speech API.
   Defaults to a UK English voice so learners consistently hear a native
   British accent across lessons, dialogues and shadowing practice. Falls
   back to any available English voice, then to the browser default, since
   not every device ships a British voice.

   Voice *quality* varies enormously between what a device happens to expose
   under the same generic API - anywhere from a tinny 2005-era offline robot
   voice to a genuinely natural-sounding cloud neural voice (Edge on Windows
   ships Microsoft's Azure "Online (Natural)" voices for free through this
   same API; Chrome ships Google's cloud voices). scoreVoice() ranks the
   candidates so we always pick the clearest one actually available on this
   device/browser, instead of whichever the platform lists first. There's no
   way to guarantee a specific assistant-grade voice (that requires a paid
   cloud TTS API and a backend to call it from) - this gets the best of what
   the browser already offers for free. */

let cachedVoice = null;
let cachedVoiceLang = null;

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
  };
}

function scoreVoice(voice) {
  const name = voice.name.toLowerCase();
  let score = 0;
  if (/natural|neural|online|enhanced|premium/.test(name)) score += 100;
  else if (/google/.test(name)) score += 40;
  if (voice.localService === false) score += 20;
  return score;
}

function pickVoice(lang) {
  if (cachedVoice && cachedVoiceLang === lang) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  const langPrefix = lang.split("-")[0];
  const exact = voices.filter((v) => v.lang === lang);
  const family = voices.filter((v) => v.lang && v.lang.startsWith(langPrefix));
  const candidates = exact.length ? exact : family;
  const best = [...candidates].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
  cachedVoice = best || null;
  cachedVoiceLang = lang;
  return cachedVoice;
}

function speak(text, lang = "en-GB") {
  if (!("speechSynthesis" in window)) {
    alert("Speech playback is not supported in this browser.");
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  const voice = pickVoice(lang);
  if (voice) utter.voice = voice;
  utter.rate = 0.95;
  utter.volume = 1;
  utter.pitch = 1;
  window.speechSynthesis.speak(utter);
}
