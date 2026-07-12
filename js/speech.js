/* Free pronunciation playback using the browser's built-in Web Speech API.
   Defaults to a UK English voice so learners consistently hear a native
   British accent across lessons, dialogues and shadowing practice. Falls
   back to any available English voice, then to the browser default, since
   not every device ships a British voice. */

let cachedVoice = null;
let cachedVoiceLang = null;

if ("speechSynthesis" in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
  };
}

function pickVoice(lang) {
  if (cachedVoice && cachedVoiceLang === lang) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  const exact = voices.find((v) => v.lang === lang);
  const family = voices.find((v) => v.lang && v.lang.startsWith(lang.split("-")[0]));
  cachedVoice = exact || family || null;
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
  window.speechSynthesis.speak(utter);
}
