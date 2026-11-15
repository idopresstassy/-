import { afterEach, describe, expect, it, vi } from "vitest";
import { NativeReaderAudioPlayback, type NativeNarrationSnapshot } from "./readerNativeAudio";
import type { ReaderAudioSentence } from "./readerAudioText";

const row = (id: number, page: number, text = `문단 ${id}`): ReaderAudioSentence => ({
  id, text, pageNumber: page + 1, sentenceNumber: id, pageTransitions: [],
});
function setup() {
  const page = new EventTarget();
  const document = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal("window", page);
  vi.stubGlobal("document", document);
  const bridge = { postMessage: vi.fn() };
  const rows = [row(0, 0), row(1, 0), row(2, 1), row(3, 2)];
  const options = { bookId: 90003, title: () => "돈", allRows: () => rows,
    onCursor: vi.fn(), onProgress: vi.fn(), onState: vi.fn() };
  const player = new NativeReaderAudioPlayback(bridge, options);
  const snapshot = (overrides: Partial<NativeNarrationSnapshot> = {}) => {
    const detail = { bookId: 90003, sentenceId: 2, index: 1, positionMs: 4, durationMs: 10,
      playing: true, loading: false, finished: false, deviceVoice: false, error: null, ...overrides };
    page.dispatchEvent(Object.assign(new Event("myeongjak-audio-state"), { detail }));
  };
  return { player, bridge, rows, options, snapshot, document, page };
}
afterEach(() => vi.unstubAllGlobals());
describe("native narration handover", () => {
  it("sends remaining text once, including a partial first paragraph, without synthesizing the book", () => {
    const s = setup();
    s.player.setSpeed(0.8);
    const partial = { ...s.rows[1], text: "현재 페이지에 남은 부분", pageNumber: 2 };
    s.player.start({ page: 1, rows: [partial, s.rows[2]] });
    const payload = JSON.parse(s.bridge.postMessage.mock.lastCall![0]);
    expect(payload.action).toBe("start");
    expect(payload.rows.map((item: ReaderAudioSentence) => item.id)).toEqual([1, 2, 3]);
    expect(payload.rows[0].text).toBe(partial.text);
    expect(payload.rows[0].pageNumber).toBe(2);
    expect(payload.rows[1].sentenceNumber).toBe(s.rows[2].sentenceNumber);
    expect(s.bridge.postMessage).toHaveBeenCalledTimes(2); // state + one handover
  });
  it("only mirrors native transitions and never asks the webpage to fetch the next clip", () => {
    const s = setup();
    s.player.start({ page: 0, rows: s.rows.slice(0, 2) });
    const count = s.bridge.postMessage.mock.calls.length;
    s.snapshot({ sentenceId: 2 });
    s.snapshot({ sentenceId: 3, index: 2 });
    expect(s.player.cursor?.batch.page).toBe(2);
    expect(s.options.onProgress).toHaveBeenLastCalledWith(s.rows[3], 0.4);
    expect(s.bridge.postMessage).toHaveBeenCalledTimes(count);
  });
  it("reattaches to the service after the reader is reopened and ignores another book", () => {
    const s = setup();
    s.snapshot({ bookId: 1 });
    expect(s.player.cursor).toBeNull();
    s.snapshot();
    expect(s.player.playing).toBe(true);
    expect(s.player.cursor?.batch.rows[0].id).toBe(2);
    s.document.dispatchEvent(new Event("visibilitychange"));
    expect(JSON.parse(s.bridge.postMessage.mock.lastCall![0]).action).toBe("state");
  });
  it("closing the web reader detaches UI listeners without stopping native audio", () => {
    const s = setup();
    s.player.start({ page: 0, rows: s.rows.slice(0, 2) });
    const count = s.bridge.postMessage.mock.calls.length;
    s.player.dispose();
    s.snapshot();
    expect(s.bridge.postMessage).toHaveBeenCalledTimes(count);
    expect(s.options.onCursor).toHaveBeenCalledTimes(1);
  });
});
