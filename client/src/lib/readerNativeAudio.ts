import type { ReaderAudioBatch, ReaderAudioPlaybackState } from "./readerAudioPlayback";
import type { ReaderAudioSentence } from "./readerAudioText";

type NativeBridge = { postMessage(message: string): void };
export function nativeNarrationBridge(): NativeBridge | null {
  const bridge = (window as unknown as { MyeongjakAudioV2?: NativeBridge }).MyeongjakAudioV2;
  return bridge && typeof bridge.postMessage === "function" ? bridge : null;
}
export type NativeNarrationSnapshot = {
  bookId: number; sentenceId: number; index: number; positionMs: number; durationMs: number;
  playing: boolean; loading: boolean; finished: boolean; deviceVoice: boolean; error: string | null;
};
type NativeOptions = {
  bookId: number;
  title(): string;
  allRows(): ReaderAudioSentence[];
  onCursor(batch: ReaderAudioBatch, index: number): void;
  onProgress(row: ReaderAudioSentence, progress: number): void;
  onState(state: ReaderAudioPlaybackState): void;
};

/** Service owns text, fetching and the queue. Web events only update the visible reader. */
export class NativeReaderAudioPlayback {
  private rows: ReaderAudioSentence[] = [];
  private current: ReaderAudioBatch | null = null;
  private isPlaying = false;
  private speed = 0.8;
  private disposed = false;
  private listener = (event: Event) => this.receive((event as CustomEvent<NativeNarrationSnapshot>).detail);
  constructor(private bridge: NativeBridge, private options: NativeOptions) {
    window.addEventListener("myeongjak-audio-state", this.listener);
    window.addEventListener("pageshow", this.requestState);
    document.addEventListener("visibilitychange", this.requestState);
    this.requestState();
  }
  get playing() { return this.isPlaying; }
  get cursor() { return this.current ? { batch: this.current, index: 0 } : null; }
  private send(action: string, extra: object = {}) { this.bridge.postMessage(JSON.stringify({ action, ...extra })); }
  private requestState = () => { if (!document.hidden) this.send("state"); };

  start(batch: ReaderAudioBatch, index = 0) {
    const first = batch.rows.slice(index);
    if (!first.length) return;
    const lastId = first[first.length - 1].id;
    this.rows = [...first, ...this.options.allRows().filter((row) => row.id > lastId)];
    this.current = { page: batch.page, rows: [first[0]] };
    this.isPlaying = true;
    this.options.onCursor(this.current, 0);
    this.options.onState({ playing: true, loading: true, browserVoice: false, error: null });
    this.send("start", { bookId: this.options.bookId, title: this.options.title(), speed: this.speed,
      rows: this.rows.map(({ id, text, pageNumber, sentenceNumber }) => ({ id, text, pageNumber, sentenceNumber })) });
  }
  pause() { this.send("pause"); }
  resume() { this.send("resume"); }
  setSpeed(speed: number) { this.speed = speed; if (this.current) this.send("speed", { speed }); }
  skip(direction: -1 | 1) {
    if (!this.current) return false;
    if (direction < 0 && this.rows[0]?.id === this.current.rows[0].id) return false;
    this.send(direction < 0 ? "previous" : "next");
    return true;
  }
  private receive(state: NativeNarrationSnapshot) {
    if (this.disposed || !state || state.bookId !== this.options.bookId || !Number.isInteger(state.sentenceId)) return;
    if (!this.rows.length) this.rows = this.options.allRows();
    const row = this.rows.find((item) => item.id === state.sentenceId);
    if (!row) return;
    if (this.current?.rows[0]?.id !== row.id) {
      this.current = { page: row.pageNumber - 1, rows: [row] };
      this.options.onCursor(this.current, 0);
    }
    if (state.durationMs > 0) this.options.onProgress(row, Math.min(1, state.positionMs / state.durationMs));
    this.isPlaying = state.playing;
    if (state.finished) this.current = null;
    this.options.onState({ playing: state.playing, loading: state.loading, browserVoice: state.deviceVoice, error: state.error });
  }
  dispose() {
    this.disposed = true;
    window.removeEventListener("myeongjak-audio-state", this.listener);
    window.removeEventListener("pageshow", this.requestState);
    document.removeEventListener("visibilitychange", this.requestState);
    // Closing the reader must not stop the independent background service.
  }
}
