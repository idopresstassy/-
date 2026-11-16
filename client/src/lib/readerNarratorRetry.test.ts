import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeReaderAudioPlayback } from "./readerNativeAudio";
import { retrySelectedNarrator } from "./readerNarratorRetry";
import type { ReaderAudioSentence } from "./readerAudioText";

afterEach(() => vi.unstubAllGlobals());

describe("retrying the chosen narrator in the installed Android app", () => {
  for (const playing of [true, false]) {
    it(`replaces a ${playing ? "playing" : "paused"} device clip using the existing START bridge`, () => {
      const window = new EventTarget();
      vi.stubGlobal("window", window);
      vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
      const rows: ReaderAudioSentence[] = [0, 1, 2, 3].map(id => ({
        id, text: `문단 ${id}`, pageNumber: id + 1, sentenceNumber: 0, pageTransitions: [],
      }));
      const bridge = { postMessage: vi.fn() };
      const onState = vi.fn();
      const player = new NativeReaderAudioPlayback(bridge, {
        bookId: 90003, title: () => "돈", allRows: () => rows,
        onState, onCursor: vi.fn(), onProgress: vi.fn(),
      });
      const partial = { ...rows[1], text: "현재 페이지부터 읽던 문단의 나머지" };
      player.start({ page: 1, rows: [partial, rows[2]] });
      window.dispatchEvent(Object.assign(new Event("myeongjak-audio-state"), { detail: {
        bookId: 90003, sentenceId: 1, index: 0, positionMs: 1500, durationMs: 5000,
        speed: 0.8, playing, loading: false, finished: false, deviceVoice: true, error: null,
      } }));
      const invalidate = vi.fn();
      expect(retrySelectedNarrator(player, invalidate)).toBe(true);
      const payload = JSON.parse(bridge.postMessage.mock.lastCall![0]);
      expect(invalidate).toHaveBeenCalledOnce();
      expect(payload.action).toBe("start"); // resume would keep the prepared local file
      expect(payload.speed).toBe(0.8);
      expect(payload.rows.map((row: ReaderAudioSentence) => row.id)).toEqual([1, 2, 3]);
      expect(payload.rows[0].text).toBe(partial.text);
      expect(onState.mock.lastCall![0].loading).toBe(true);
      // A successful server response replaces the old device-voice indicator.
      window.dispatchEvent(Object.assign(new Event("myeongjak-audio-state"), { detail: {
        bookId: 90003, sentenceId: 1, index: 0, positionMs: 0, durationMs: 5000,
        playing: true, loading: false, finished: false, deviceVoice: false, error: null,
      } }));
      expect(onState.mock.lastCall![0].browserVoice).toBe(false);
      player.dispose();
    });
  }

  it("does not restart a finished or absent book", () => {
    const start = vi.fn();
    const invalidate = vi.fn();
    expect(retrySelectedNarrator({ cursor: null, start }, invalidate)).toBe(false);
    expect(start).not.toHaveBeenCalled();
    expect(invalidate).not.toHaveBeenCalled();
  });
});
