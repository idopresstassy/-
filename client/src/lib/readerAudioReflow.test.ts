import { afterEach, describe, expect, it, vi } from "vitest";
import { ReaderAudioPosition } from "./readerAudioPosition";
import { ReaderAudioPlayback } from "./readerAudioPlayback";
import { NativeReaderAudioPlayback } from "./readerNativeAudio";
import { cleanReaderAudioText, collectFollowingAudioSentences, collectPageAudioSentences,
  measureReaderAudioLayout, type ReaderAudioSentence } from "./readerAudioText";

function fixture(entries: Array<{ id: number; text: string; pages: number[] }>) {
  let rootLeft = -500;
  vi.stubGlobal("Node", { TEXT_NODE: 3 });
  vi.stubGlobal("window", new EventTarget());
  const document = Object.assign(new EventTarget(), { hidden: false, createRange: () => {
    let node: { pages: number[] }; let offset = 0;
    return { setStart: (n: typeof node, o: number) => { node = n; offset = o; }, setEnd: () => {}, detach: () => {},
      getBoundingClientRect: () => ({ left: rootLeft + node.pages[offset] * 100, width: 10, height: 10 }) };
  } });
  vi.stubGlobal("document", document);
  const spans = entries.map((entry) => ({
    firstChild: { nodeType: 3, textContent: entry.text, pages: entry.pages }, textContent: entry.text,
    dataset: { audioSentenceId: String(entry.id), audioText: cleanReaderAudioText(entry.text) },
    closest: () => ({}),
    getBoundingClientRect: () => ({ left: rootLeft + entry.pages[0] * 100 }),
  }));
  const root = { getBoundingClientRect: () => ({ left: rootLeft }), querySelectorAll: () => spans,
    querySelector: (selector: string) => spans.find((span) => selector === `[data-audio-sentence-id="${span.dataset.audioSentenceId}"]`),
  } as unknown as HTMLElement;
  const onPage = vi.fn();
  const measure = vi.fn((row: ReaderAudioSentence) => measureReaderAudioLayout(root, 100, row));
  const position = new ReaderAudioPosition(measure, onPage);
  return { root, spans, entries, onPage, measure, position, translate: (left: number) => { rootLeft = left; } };
}
const row = (id: number, text: string, pageNumber = 1): ReaderAudioSentence =>
  ({ id, text, pageNumber, sentenceNumber: 0, pageTransitions: [{ pageIndex: pageNumber, progress: 0.5 }] });
async function settle() { for (let i = 0; i < 8; ++i) await Promise.resolve(); }
afterEach(() => vi.unstubAllGlobals());

describe("audio position after line spacing/font size reflow", () => {
  it("keeps a manually chosen page through paused native heartbeats and layout changes", () => {
    const pages = [2, 2, 3, 3];
    const f = fixture([{ id: 0, text: "가나다라", pages }, { id: 1, text: "앞문단", pages: [0, 0, 0] }]);
    const rows = [row(0, "가나다라", 3), row(1, "앞문단")];
    const bridge = { postMessage: vi.fn() };
    const player = new NativeReaderAudioPlayback(bridge, { bookId: 90003, title: () => "돈", allRows: () => rows,
      onState: () => {}, onCursor: (batch, index) => f.position.update(batch.rows[index], 0),
      onProgress: (item, progress) => f.position.update(item, progress),
    });
    const snapshot = (playing = false) => window.dispatchEvent(Object.assign(new Event("myeongjak-audio-state"), {
      detail: { bookId: 90003, sentenceId: 0, index: 0, positionMs: 600, durationMs: 1000,
        playing, loading: false, finished: false, deviceVoice: false, error: null },
    }));
    player.start({ page: 2, rows: [rows[0]] });
    snapshot(true);
    expect(f.onPage).toHaveBeenLastCalledWith(rows[0], 3);
    player.pause();
    expect(player.playing).toBe(false); // before the service acknowledges the pause
    f.position.browse(); // reader chooses page 0
    f.onPage.mockClear();
    snapshot(true); // an already queued old status must not steal the chosen page
    snapshot();
    snapshot();
    pages.fill(5);
    f.position.reflow();
    expect(f.onPage).not.toHaveBeenCalled();
    expect(f.position.following).toBe(false);
    f.position.reset(); // listen from the manually chosen page
    player.start({ page: 0, rows: [rows[1]] });
    expect(f.onPage).toHaveBeenLastCalledWith(rows[1], 0);
    expect(JSON.parse(bridge.postMessage.mock.lastCall![0]).rows[0].text).toBe("앞문단");
    player.dispose();
  });

  it("resumes page following for an explicit audio skip after browsing", () => {
    const f = fixture([{ id: 0, text: "가나다라", pages: [0, 0, 1, 1] }]);
    const clip = row(0, "가나다라");
    f.position.update(clip, 0);
    f.position.browse();
    f.position.update(clip, 0.8);
    expect(f.onPage).toHaveBeenCalledTimes(1);
    f.position.follow();
    f.position.update(clip, 0.8);
    expect(f.onPage).toHaveBeenLastCalledWith(clip, 1);
  });

  it("follows the same playing text forward AND backward, ignoring stale queue pages", () => {
    const pages = [0, 0, 1, 1, 1, 2];
    const f = fixture([{ id: 4, text: "가나다라마바", pages }]);
    const clip = row(4, "가나다라마바", 9);
    const unchanged = structuredClone(clip);
    f.position.update(clip, 0.6);
    expect(f.onPage).toHaveBeenLastCalledWith(clip, 1);
    pages.splice(0, 6, 2, 2, 3, 4, 4, 5); // larger text / wider spacing
    f.position.reflow();
    expect(f.onPage).toHaveBeenLastCalledWith(clip, 4);
    pages.fill(0); // narrower spacing moves it backwards
    f.position.reflow();
    expect(f.onPage).toHaveBeenLastCalledWith(clip, 0);
    expect(clip).toEqual(unchanged); // audio/cache request must remain identical
    f.translate(-3200);
    f.position.reflow();
    expect(f.onPage).toHaveBeenLastCalledWith(clip, 0);
  });

  it("maps a partial first clip after omitted Hanja, footnotes and whitespace", () => {
    const text = "가(漢字)†  나다라마";
    const pages = Array.from(text, () => 0);
    pages[text.indexOf("나")] = 1;
    pages[text.indexOf("다")] = 2;
    pages[text.indexOf("라")] = pages[text.indexOf("마")] = 3;
    const f = fixture([{ id: 0, text, pages }]);
    const clip = row(0, "나다라마");
    f.position.update(clip, 0);
    expect(f.onPage).toHaveBeenLastCalledWith(clip, 1);
    f.position.update(clip, 0.25);
    expect(f.onPage).toHaveBeenLastCalledWith(clip, 2);
    f.position.update(clip, 0.5);
    expect(f.onPage).toHaveBeenLastCalledWith(clip, 3);
  });

  it("retains fragment timing when the browser cannot measure character ranges", () => {
    const f = fixture([{ id: 0, text: "가나다라", pages: [0, 0, 1, 1] }]);
    vi.spyOn(document, "createRange").mockReturnValue({ setStart() {}, setEnd() {}, detach() {},
      getBoundingClientRect: () => ({ left: 0, width: 0, height: 0 }),
    } as unknown as Range);
    Object.assign(f.spans[0], { getClientRects: () => [
      { left: -500, width: 50, height: 20 }, { left: -400, width: 50, height: 20 },
    ] });
    f.position.update(row(0, "가나다라"), 0.6);
    expect(f.onPage.mock.lastCall![1]).toBe(1);
    f.position.update(row(0, "다라"), 0);
    expect(f.onPage.mock.lastCall![1]).toBe(1);
  });

  it("caches measurements between media ticks and invalidates them for each reflow", () => {
    const f = fixture([{ id: 0, text: "가나다라", pages: [0, 0, 1, 1] }]);
    const clip = row(0, "가나다라");
    for (const progress of [0, 0.1, 0.3, 0.8]) f.position.update(clip, progress);
    expect(f.measure).toHaveBeenCalledTimes(1);
    f.position.reflow();
    expect(f.measure).toHaveBeenCalledTimes(2);
    f.position.reset();
    f.position.reflow();
    expect(f.measure).toHaveBeenCalledTimes(2);
  });

  it("continues with the next text even when it moved into the same or an earlier page", () => {
    const f = fixture([
      { id: 0, text: "앞문단", pages: [0, 0, 0] },
      { id: 1, text: "현재문단", pages: [0, 0, 0, 0] },
      { id: 2, text: "다음문단", pages: [0, 0, 0, 1] },
      { id: 3, text: "끝문단", pages: [1, 1, 1] },
    ]);
    const next = collectFollowingAudioSentences(f.root, 100, 1);
    expect(next.map((entry) => entry.id)).toEqual([2]);
    expect(next[0].text).toBe("다음문단");
    expect(collectFollowingAudioSentences(f.root, 100, 2).map((entry) => entry.id)).toEqual([3]);
    expect(collectFollowingAudioSentences(f.root, 100, 3)).toEqual([]);
  });

  it("keeps browser MP3 position, prepared clips and pause state across repeated reflows", async () => {
    const pages = [0, 0, 1, 1];
    const f = fixture([{ id: 0, text: "가나다라", pages }, { id: 1, text: "마바", pages: [1, 1] }]);
    const rows = [row(0, "가나다라"), row(1, "마바", 2)];
    const audio = { src: "", currentTime: 6, duration: 10, ended: false, playbackRate: 0.8,
      play: vi.fn(async () => {}), pause: vi.fn(),
      ontimeupdate: null as (() => void) | null, onended: null as (() => void) | null, onerror: null };
    const request = vi.fn(async (item: ReaderAudioSentence) => ({ fallback: false as const, audioUrl: `clip-${item.id}` }));
    const player = new ReaderAudioPlayback({ audio: audio as unknown as HTMLAudioElement,
      request, preload: request, nextBatch: () => null, speak: () => () => {}, onState: () => {},
      onCursor: (batch, index) => f.position.update(batch.rows[index], 0),
      onProgress: (item, progress) => f.position.update(item, progress),
    });
    player.start({ page: 0, rows });
    await settle();
    audio.ontimeupdate?.();
    const plays = audio.play.mock.calls.length, requests = request.mock.calls.length;
    pages.splice(0, 4, 1, 2, 3, 3);
    f.position.reflow();
    expect(f.onPage).toHaveBeenLastCalledWith(rows[0], 3);
    expect(audio.currentTime).toBe(6);
    expect(audio.play).toHaveBeenCalledTimes(plays);
    expect(request).toHaveBeenCalledTimes(requests);
    expect(player.playing).toBe(true);
    player.pause();
    pages.fill(0);
    f.position.reflow();
    expect(player.playing).toBe(false);
    expect(audio.currentTime).toBe(6);
    player.resume();
    audio.onended?.();
    expect(audio.src).toBe("clip-1");
    expect(f.onPage).toHaveBeenLastCalledWith(rows[1], 1);
    expect(request).toHaveBeenCalledTimes(requests);
    player.dispose();
  });

  it("updates native app pages without replacing or restarting its background queue", () => {
    const pages = [0, 0, 1, 1];
    const f = fixture([{ id: 0, text: "가나다라", pages }, { id: 1, text: "마바", pages: [1, 1] }]);
    const bridge = { postMessage: vi.fn() };
    const rows = [row(0, "가나다라"), row(1, "마바", 2)];
    const player = new NativeReaderAudioPlayback(bridge, { bookId: 90003, title: () => "돈", allRows: () => rows,
      onState: () => {}, onCursor: (batch, index) => f.position.update(batch.rows[index], 0),
      onProgress: (item, progress) => f.position.update(item, progress),
    });
    player.start({ page: 0, rows });
    const count = bridge.postMessage.mock.calls.length;
    const snapshot = (id: number, progress: number) => window.dispatchEvent(Object.assign(new Event("myeongjak-audio-state"), {
      detail: { bookId: 90003, sentenceId: id, index: id, positionMs: progress * 1000, durationMs: 1000,
        playing: true, loading: false, finished: false, deviceVoice: false, error: null },
    }));
    snapshot(0, 0.6);
    pages.splice(0, 4, 2, 2, 3, 3);
    f.entries[1].pages.fill(4);
    f.position.reflow();
    expect(f.onPage).toHaveBeenLastCalledWith(rows[0], 3);
    snapshot(1, 0.2); // native queue still has old pageNumber=2
    expect(f.onPage).toHaveBeenLastCalledWith(rows[1], 4);
    expect(bridge.postMessage).toHaveBeenCalledTimes(count);
    expect(player.playing).toBe(true);
    player.dispose();
  });

  it("retains the exact tail selected on a page when it is reflowed onto an earlier page", () => {
    const pages = [0, 0, 1, 1, 2, 2];
    const f = fixture([{ id: 0, text: "가나다라마바", pages }]);
    const clip = collectPageAudioSentences(f.root, 1, 100)[0];
    expect(clip.text).toBe("다라마바");
    f.position.update(clip, 0.5);
    expect(f.onPage).toHaveBeenLastCalledWith(clip, 2);
    pages.fill(0);
    f.position.reflow();
    expect(f.onPage).toHaveBeenLastCalledWith(clip, 0);
    expect(clip.text).toBe("다라마바");
  });
});
