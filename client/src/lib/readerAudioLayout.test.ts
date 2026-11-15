import { afterEach, expect, it, vi } from "vitest";
import { collectBookAudioSentences, collectPageAudioSentences } from "./readerAudioText";

afterEach(() => vi.unstubAllGlobals());
it("keeps paragraph/cache identities across pages in the native metadata snapshot", () => {
  vi.stubGlobal("Node", { TEXT_NODE: 3 });
  vi.stubGlobal("document", { createRange: () => {
    let node: { pages: number[] }; let offset = 0;
    return { setStart: (n: typeof node, o: number) => { node = n; offset = o; }, setEnd: () => {}, detach: () => {},
      getBoundingClientRect: () => ({ left: node.pages[offset] * 100, width: 10, height: 10 }) };
  } });
  const span = (id: number, text: string, pages: number[]) => ({
    firstChild: { nodeType: 3, textContent: text, pages },
    dataset: { audioSentenceId: String(id), audioText: text },
    closest: () => ({}), getBoundingClientRect: () => ({ left: pages[0] * 100 }),
  });
  const root = { getBoundingClientRect: () => ({ left: 0 }), querySelectorAll: () => [
    span(0, "가나다라", [0, 0, 1, 1]), span(1, "마바", [1, 1]), span(2, "사아", [2, 2]),
  ] } as unknown as HTMLElement;
  const book = collectBookAudioSentences(root, 100);
  expect(book.map(({ id, text, pageNumber, sentenceNumber }) => ({ id, text, pageNumber, sentenceNumber }))).toEqual([
    { id: 0, text: "가나다라", pageNumber: 1, sentenceNumber: 0 },
    { id: 1, text: "마바", pageNumber: 2, sentenceNumber: 0 },
    { id: 2, text: "사아", pageNumber: 3, sentenceNumber: 0 },
  ]);
  expect(book[0].pageTransitions).toEqual([{ pageIndex: 1, progress: 0.5 }]);
  expect(collectPageAudioSentences(root, 1, 100, new Set([0]))).toEqual([book[1]]);
  expect(collectPageAudioSentences(root, 2, 100, new Set([0, 1]))).toEqual([book[2]]);
});
