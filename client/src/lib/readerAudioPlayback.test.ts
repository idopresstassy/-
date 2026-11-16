import { describe, expect, it, vi } from "vitest";
import { ReaderAudioPlayback, type ReaderAudioBatch, type ReaderAudioClip, type ReaderSpeechCallbacks } from "./readerAudioPlayback";
import type { ReaderAudioSentence } from "./readerAudioText";
import { retrySelectedNarrator } from "./readerNarratorRetry";

class FakeAudio {
  private source = "";
  currentTime = 0;
  duration = 10;
  ended = false;
  playbackRate = 1;
  paused = true;
  onended: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sources: string[] = [];
  playError: Error | null = null;
  play = vi.fn(() => {
    this.paused = false;
    return this.playError ? Promise.reject(this.playError) : Promise.resolve();
  });
  pause = vi.fn(() => { this.paused = true; });
  get src() { return this.source; }
  set src(value: string) {
    this.source = value;
    this.sources.push(value);
    this.currentTime = 0;
    this.ended = false;
  }
  end() { this.ended = true; this.paused = true; this.onended?.(); }
}
const row = (id: number, page = 0): ReaderAudioSentence => ({
  id, text: `문단 ${id}`, pageNumber: page + 1, sentenceNumber: id, pageTransitions: [],
});
const clip = (item: ReaderAudioSentence): ReaderAudioClip => ({ fallback: false, audioUrl: `audio-${item.id}` });
async function settle() { for (let i = 0; i < 8; ++i) await Promise.resolve(); }
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function setup(batches: ReaderAudioBatch[], request = vi.fn(async (item: ReaderAudioSentence) => clip(item))) {
  const audio = new FakeAudio();
  // Deliberately no React render, animation frame or timer implementation.
  const onCursor = vi.fn();
  const onState = vi.fn();
  const onProgress = vi.fn();
  const preload = vi.fn(async (item: ReaderAudioSentence) => clip(item));
  const nextBatch = vi.fn((batch: ReaderAudioBatch, excluded: Set<number>) => {
    const next = batches[batches.indexOf(batch) + 1];
    if (!next) return null;
    expect(next.rows.every((item) => !excluded.has(item.id))).toBe(true);
    return next;
  });
  let speech: ReaderSpeechCallbacks | undefined;
  const speak = vi.fn((_text: string, _speed: number, callbacks: ReaderSpeechCallbacks) => {
    speech = callbacks;
    return vi.fn();
  });
  const player = new ReaderAudioPlayback({
    audio: audio as unknown as HTMLAudioElement, request, preload, nextBatch, speak, onCursor, onState, onProgress,
  });
  return { player, audio, request, preload, nextBatch, speak, onCursor, onState, onProgress, speech: () => speech };
}

describe("ReaderAudioPlayback without UI commits", () => {
  it("rechecks the chosen narrator after fallback and ignores the old speech completion", async () => {
    const batch = { page: 0, rows: [row(0), row(1)] };
    const request = vi.fn(async (item: ReaderAudioSentence): Promise<ReaderAudioClip> => clip(item))
      .mockResolvedValueOnce({ fallback: true });
    const s = setup([batch], request);
    s.player.start(batch);
    await settle();
    const oldSpeech = s.speech()!;
    expect(s.onState.mock.lastCall![0].browserVoice).toBe(true);
    expect(retrySelectedNarrator(s.player, vi.fn())).toBe(true);
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    expect(s.audio.src).toBe("audio-0");
    expect(s.onState.mock.lastCall![0].browserVoice).toBe(false);
    oldSpeech.end();
    expect(s.player.cursor?.index).toBe(0);
    s.audio.end();
    expect(s.audio.src).toBe("audio-1");
  });

  it("discards a failed MP3 URL before retrying the same paragraph", async () => {
    const batch = { page: 0, rows: [row(0)] };
    const request = vi.fn(async (_item: ReaderAudioSentence): Promise<ReaderAudioClip> => ({ fallback: false, audioUrl: "fresh-url" }))
      .mockResolvedValueOnce({ fallback: false, audioUrl: "expired-url" });
    const s = setup([batch], request);
    s.player.start(batch);
    await settle();
    s.audio.onerror?.();
    expect(s.onState.mock.lastCall![0].browserVoice).toBe(true);
    retrySelectedNarrator(s.player, vi.fn());
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    expect(s.audio.src).toBe("fresh-url");
    expect(s.onState.mock.lastCall![0].browserVoice).toBe(false);
  });

  it("retains fallback when the server still refuses Cloud audio without a retry loop", async () => {
    const batch = { page: 0, rows: [row(0)] };
    const request = vi.fn(async (_item: ReaderAudioSentence): Promise<ReaderAudioClip> => ({ fallback: true }));
    const s = setup([batch], request);
    s.player.start(batch);
    await settle();
    retrySelectedNarrator(s.player, vi.fn());
    await settle();
    expect(request).toHaveBeenCalledTimes(2);
    expect(s.speak).toHaveBeenCalledTimes(2);
    expect(s.onState.mock.lastCall![0].browserVoice).toBe(true);
    expect(s.player.playing).toBe(true);
  });

  it("starts the next prepared MP3 synchronously on ended across three pages", async () => {
    const batches = [0, 1, 2].map((page) => ({ page, rows: [row(page * 2, page), row(page * 2 + 1, page)] }));
    const { player, audio, onCursor } = setup(batches);
    player.start(batches[0]);
    await settle();
    expect(audio.src).toBe("audio-0");
    for (let id = 1; id < 6; ++id) {
      audio.end();
      // This assertion is before a microtask flush, let alone a screen paint.
      expect(audio.src).toBe(`audio-${id}`);
      expect(audio.paused).toBe(false);
      await settle();
    }
    audio.end();
    expect(player.playing).toBe(false);
    expect(onCursor.mock.calls.map(([batch, index]) => batch.rows[index].id)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("only generates the next two clips and two clips from the next batch", async () => {
    const batches = [0, 1, 2].map((page) => ({ page, rows: Array.from({ length: 10 }, (_, i) => row(page * 10 + i, page)) }));
    const { player, request, preload } = setup(batches);
    player.start(batches[0]);
    await settle();
    expect(request.mock.calls.map(([item]) => item.id)).toEqual([0]);
    expect(preload.mock.calls.map(([item]) => item.id)).toEqual([1, 2, 10, 11]);
  });

  it("waits for a missing next clip without requiring a UI update", async () => {
    const batches = [{ page: 0, rows: [row(0), row(1)] }];
    const next = deferred<ReaderAudioClip>();
    const s = setup(batches);
    s.preload.mockImplementationOnce(() => next.promise);
    s.player.start(batches[0]);
    await settle();
    s.audio.end();
    expect(s.player.playing).toBe(true);
    next.resolve(clip(batches[0].rows[1]));
    await settle();
    expect(s.audio.src).toBe("audio-1");
    expect(s.audio.paused).toBe(false);
  });

  it("preserves the MP3 position on pause/resume and changes speed without reloading", async () => {
    const batches = [{ page: 0, rows: [row(0), row(1)] }];
    const { player, audio } = setup(batches);
    player.start(batches[0]);
    await settle();
    audio.currentTime = 4.5;
    player.pause();
    player.setSpeed(1.2);
    player.resume();
    expect(audio.currentTime).toBe(4.5);
    expect(audio.sources).toEqual(["audio-0"]);
    expect(audio.playbackRate).toBe(1.2);
    audio.end();
    expect(audio.src).toBe("audio-1");
  });

  it("does not restart a paused pending request, but resumes it without duplication", async () => {
    const batches = [{ page: 0, rows: [row(0)] }];
    const pending = deferred<ReaderAudioClip>();
    const request = vi.fn(() => pending.promise);
    const { player, audio } = setup(batches, request);
    player.start(batches[0]);
    player.pause();
    pending.resolve(clip(batches[0].rows[0]));
    await settle();
    expect(audio.play).not.toHaveBeenCalled();
    player.resume();
    expect(audio.src).toBe("audio-0");
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("ignores stale audio requests and ended handlers after selecting another paragraph", async () => {
    const batch = { page: 0, rows: [row(0), row(1)] };
    const pending = deferred<ReaderAudioClip>();
    const request = vi.fn((item: ReaderAudioSentence) => item.id === 0 ? pending.promise : Promise.resolve(clip(item)));
    const { player, audio } = setup([batch], request);
    player.start(batch);
    await settle();
    player.skip(1);
    expect(audio.src).toBe("audio-1");
    const oldEnd = audio.onended;
    player.start({ page: 1, rows: [row(2, 1)] });
    pending.resolve(clip(batch.rows[0]));
    await settle();
    // Resolving old work cannot overwrite the newly selected row.
    expect(audio.src).toBe("audio-2");
    expect(audio.sources).not.toContain("audio-0");
    const count = audio.play.mock.calls.length;
    oldEnd?.();
    expect(audio.play.mock.calls.length).toBe(count);
  });

  it("does not silently switch voices or skip when the phone denies playback", async () => {
    const batches = [{ page: 0, rows: [row(0), row(1)] }];
    const { player, audio, speak, onState } = setup(batches);
    player.start(batches[0]);
    await settle();
    audio.playError = Object.assign(new Error("blocked"), { name: "NotAllowedError" });
    audio.end();
    await settle();
    expect(player.playing).toBe(false);
    expect(player.cursor?.index).toBe(1);
    expect(speak).not.toHaveBeenCalled();
    expect(onState.mock.lastCall?.[0].error).toContain("재생 버튼");
    audio.playError = null;
    player.resume();
    await settle();
    expect(player.playing).toBe(true);
    expect(audio.src).toBe("audio-1");
  });

  it("continues after a browser fallback and reports speech errors without skipping", async () => {
    const batch = { page: 0, rows: [row(0), row(1)] };
    const request = vi.fn(async (): Promise<ReaderAudioClip> => ({ fallback: true }));
    const s = setup([batch], request);
    s.player.start(batch);
    await settle();
    s.speech()?.end();
    expect(s.audio.src).toBe("audio-1");
    s.audio.onerror?.();
    s.speech()?.error();
    expect(s.player.playing).toBe(false);
    expect(s.player.cursor?.index).toBe(1);
  });

  it("keeps paragraph progress events while crossing a page, without restarting the audio", async () => {
    const item = row(0);
    item.pageTransitions = [{ pageIndex: 1, progress: 0.5 }];
    const batch = { page: 0, rows: [item] };
    const { player, audio, onProgress } = setup([batch]);
    player.start(batch);
    await settle();
    audio.currentTime = 6;
    audio.ontimeupdate?.();
    expect(onProgress).toHaveBeenLastCalledWith(item, 0.6);
    expect(audio.sources).toHaveLength(1);
  });

  it("cannot restart from a pending response after the reader is closed", async () => {
    const batch = { page: 0, rows: [row(0)] };
    const pending = deferred<ReaderAudioClip>();
    const request = vi.fn(() => pending.promise);
    const { player, audio } = setup([batch], request);
    player.start(batch);
    player.dispose();
    pending.resolve(clip(batch.rows[0]));
    await settle();
    expect(audio.play).not.toHaveBeenCalled();
  });
});
