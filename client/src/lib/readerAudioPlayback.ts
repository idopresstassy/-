import type { ReaderAudioSentence } from "./readerAudioText";

export type ReaderAudioBatch = { page: number; rows: ReaderAudioSentence[] };
export type ReaderAudioClip = { fallback: true } | { fallback: false; audioUrl: string };
export type ReaderAudioPlaybackState = {
  playing: boolean;
  loading: boolean;
  browserVoice: boolean;
  error: string | null;
};
export type ReaderSpeechCallbacks = { progress(value: number): void; end(): void; error(): void };

type PlaybackOptions = {
  audio: HTMLAudioElement;
  request(row: ReaderAudioSentence): Promise<ReaderAudioClip>;
  preload(row: ReaderAudioSentence): Promise<ReaderAudioClip>;
  nextBatch(batch: ReaderAudioBatch, excluded: Set<number>): ReaderAudioBatch | null;
  speak(text: string, speed: number, callbacks: ReaderSpeechCallbacks): () => void;
  onCursor(batch: ReaderAudioBatch, index: number): void;
  onProgress(row: ReaderAudioSentence, progress: number): void;
  onState(state: ReaderAudioPlaybackState): void;
};

/** The media event owns the next clip. React renders only mirror playback. */
export class ReaderAudioPlayback {
  private batch: ReaderAudioBatch | null = null;
  private index = 0;
  private speed = 0.8;
  private token = 0;
  private disposed = false;
  private loadedRow: ReaderAudioSentence | null = null;
  private stopSpeech: (() => void) | null = null;
  private completed = new Set<number>();
  private preparedNext: ReaderAudioBatch | null | undefined;
  private ready = new WeakMap<ReaderAudioSentence, ReaderAudioClip>();
  private pending = new WeakMap<ReaderAudioSentence, Promise<ReaderAudioClip>>();
  private state: ReaderAudioPlaybackState = { playing: false, loading: false, browserVoice: false, error: null };

  constructor(private options: PlaybackOptions) {}

  get playing() { return this.state.playing; }
  get cursor() { return this.batch ? { batch: this.batch, index: this.index } : null; }

  private notify(update: Partial<ReaderAudioPlaybackState>) {
    this.state = { ...this.state, ...update };
    this.options.onState(this.state);
  }

  private cancelCurrent() {
    ++this.token;
    const audio = this.options.audio;
    audio.onended = null;
    audio.ontimeupdate = null;
    audio.onerror = null;
    audio.pause();
    const stop = this.stopSpeech;
    this.stopSpeech = null;
    stop?.();
  }

  start(batch: ReaderAudioBatch, index = 0) {
    if (this.disposed) return;
    this.cancelCurrent();
    this.loadedRow = null;
    this.completed.clear();
    this.preparedNext = undefined;
    this.batch = batch.rows.length ? batch : null;
    this.index = Math.max(0, Math.min(index, batch.rows.length - 1));
    if (!this.batch) { this.notify({ playing: false, loading: false }); return; }
    this.playCurrent();
  }

  pause() {
    if (this.disposed) return;
    this.cancelCurrent();
    this.notify({ playing: false, loading: false });
  }

  resume() {
    if (this.disposed || !this.batch || this.playing) return;
    this.playCurrent(true);
  }

  setSpeed(speed: number) {
    this.speed = Math.max(0.8, Math.min(1.5, speed));
    this.options.audio.playbackRate = this.speed;
  }

  /** Returns false only when previous is outside this batch. */
  skip(direction: -1 | 1): boolean {
    if (!this.batch || this.disposed) return false;
    if (direction < 0 && this.index === 0) return false;
    this.cancelCurrent();
    this.loadedRow = null;
    if (direction > 0) this.advance();
    else { --this.index; this.playCurrent(); }
    return true;
  }

  private fetch(row: ReaderAudioSentence, preload: boolean): Promise<ReaderAudioClip> {
    const ready = this.ready.get(row);
    if (ready) return Promise.resolve(ready);
    const pending = this.pending.get(row);
    if (pending) return pending;
    const request = (preload ? this.options.preload(row) : this.options.request(row)).then((clip) => {
      // A transient fallback must not become a permanent voice choice.
      if (!clip.fallback) this.ready.set(row, clip);
      return clip;
    }).finally(() => this.pending.delete(row));
    this.pending.set(row, request);
    return request;
  }

  private nextBatch() {
    if (this.preparedNext === undefined && this.batch) {
      const excluded = new Set([...this.completed, ...this.batch.rows.map((row) => row.id)]);
      this.preparedNext = this.options.nextBatch(this.batch, excluded);
    }
    return this.preparedNext ?? null;
  }

  private prefetch() {
    if (!this.batch || !this.playing) return;
    // Bound generation to two upcoming clips and two on the next relevant page.
    const rows = [...this.batch.rows.slice(this.index + 1, this.index + 3),
      ...(this.nextBatch()?.rows.slice(0, 2) ?? [])];
    for (const row of rows) void this.fetch(row, true).catch(() => undefined);
  }

  private advance() {
    if (!this.batch || this.disposed) return;
    if (this.index + 1 < this.batch.rows.length) ++this.index;
    else {
      const next = this.nextBatch();
      for (const row of this.batch.rows) this.completed.add(row.id);
      this.preparedNext = undefined;
      if (!next) {
        this.cancelCurrent();
        this.loadedRow = null;
        this.batch = null;
        this.notify({ playing: false, loading: false });
        return;
      }
      this.batch = next;
      this.index = 0;
    }
    // No state effect, animation frame or timeout between ended and play().
    this.playCurrent();
  }

  private playCurrent(resume = false) {
    const batch = this.batch;
    if (!batch || this.disposed) return;
    this.cancelCurrent();
    const token = this.token;
    const row = batch.rows[this.index];
    const current = () => !this.disposed && this.playing && this.token === token;
    this.notify({ playing: true, loading: true, error: null });
    if (!resume) this.options.onCursor(batch, this.index);
    const progress = (value: number) => { if (current()) this.options.onProgress(row, value); };
    const end = () => {
      if (!current()) return;
      progress(1);
      this.loadedRow = null;
      this.advance();
    };
    const blocked = (message: string) => {
      if (!current()) return;
      this.cancelCurrent();
      this.notify({ playing: false, loading: false, error: message });
    };
    let fallbackStarted = false;
    const browser = () => {
      if (!current() || fallbackStarted) return;
      fallbackStarted = true;
      // A failed/expired MP3 URL must not trap subsequent attempts in fallback.
      this.ready.delete(row);
      const audio = this.options.audio;
      audio.onerror = null;
      audio.onended = null;
      audio.ontimeupdate = null;
      audio.pause();
      this.loadedRow = null;
      this.notify({ browserVoice: true, loading: false });
      try {
        this.stopSpeech = this.options.speak(row.text, this.speed, {
          progress, end,
          error: () => blocked("기본 음성이 멈췄습니다. 듣기를 눌러 다시 시작해 주세요."),
        });
      } catch { blocked("이 기기에서 기본 음성을 시작할 수 없습니다. 잠시 후 듣기를 눌러 주세요."); }
    };
    const cloud = (url?: string) => {
      if (!current()) return;
      const audio = this.options.audio;
      if (url !== undefined) audio.src = url;
      this.loadedRow = row;
      audio.playbackRate = this.speed;
      audio.ontimeupdate = () => {
        if (audio.duration > 0) progress(audio.currentTime / audio.duration);
      };
      audio.onended = end;
      audio.onerror = browser;
      this.notify({ browserVoice: false, loading: true });
      void audio.play().then(() => {
        if (current()) this.notify({ loading: false });
      }).catch((error: unknown) => {
        if (!current()) return;
        if (error instanceof Error && error.name === "NotAllowedError") {
          blocked("휴대폰이 재생을 멈췄습니다. 화면이나 잠금화면의 재생 버튼을 눌러 이어 들어 주세요.");
        } else browser();
      });
    };
    if (resume && this.loadedRow === row && !this.options.audio.ended) cloud();
    else {
      const ready = this.ready.get(row);
      if (ready && !ready.fallback) cloud(ready.audioUrl);
      else void this.fetch(row, false).then((clip) => {
        if (!current()) return;
        if (clip.fallback) browser();
        else cloud(clip.audioUrl);
      }).catch(browser);
    }
    this.prefetch();
  }

  dispose() {
    this.disposed = true;
    this.cancelCurrent();
    this.batch = null;
    this.ready = new WeakMap();
  }
}
