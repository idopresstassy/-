import type { ReaderSpeechCallbacks } from "./readerAudioPlayback";

/** Fallback only; cloud MP3 playback does not depend on this timer or Web Speech. */
export function speakReaderText(text: string, speed: number, callbacks: ReaderSpeechCallbacks): () => void {
  const speech = window.speechSynthesis;
  if (!speech || typeof SpeechSynthesisUtterance === "undefined") throw new Error("Speech unavailable");
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "ko-KR";
  utterance.rate = speed;
  let active = true;
  const started = performance.now();
  let lastBoundary = started;
  const estimatedDuration = Math.max(1500, text.length / (4 * speed) * 1000);
  const timer = window.setInterval(() => {
    const now = performance.now();
    if (active && now - lastBoundary > 1200) callbacks.progress(Math.min(1, (now - started) / estimatedDuration));
  }, 250);
  utterance.onboundary = (event) => {
    lastBoundary = performance.now();
    if (active && event.charIndex >= 0 && text.length) callbacks.progress(event.charIndex / text.length);
  };
  const finish = (callback: () => void) => {
    if (!active) return;
    active = false;
    window.clearInterval(timer);
    callback();
  };
  utterance.onend = () => finish(callbacks.end);
  utterance.onerror = () => finish(callbacks.error);
  speech.cancel();
  speech.speak(utterance);
  return () => {
    active = false;
    window.clearInterval(timer);
    utterance.onend = null;
    utterance.onerror = null;
    utterance.onboundary = null;
    speech.cancel();
  };
}
