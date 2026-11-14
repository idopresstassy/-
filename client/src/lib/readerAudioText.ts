export type ReaderAudioSentence = {
  id: number;
  text: string;
  pageNumber: number;
  sentenceNumber: number;
  pageTransitions: Array<{ pageIndex: number; progress: number }>;
};

const MAX_TTS_BYTES = 3800;

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

function splitOverlongText(text: string): string[] {
  const words = text.match(/\S+\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    if (byteLength(cleanReaderAudioText(current + word)) <= MAX_TTS_BYTES) {
      current += word;
      continue;
    }
    if (current) chunks.push(current);
    if (byteLength(cleanReaderAudioText(word)) <= MAX_TTS_BYTES) {
      current = word;
      continue;
    }
    current = "";
    for (const character of Array.from(word)) {
      if (byteLength(cleanReaderAudioText(current + character)) > MAX_TTS_BYTES && current) {
        chunks.push(current);
        current = "";
      }
      current += character;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/** Keep each source line as one narration unit unless it exceeds Cloud TTS's safe request size. */
export function splitReaderParagraph(text: string): string[] {
  if (byteLength(cleanReaderAudioText(text)) <= MAX_TTS_BYTES) return [text];

  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale: string, options: { granularity: "sentence" }) => { segment: (value: string) => Iterable<{ segment: string }> } }).Segmenter;
  const sentences = Segmenter
    ? Array.from(new Segmenter("ko", { granularity: "sentence" }).segment(text), (item) => item.segment)
    : (text.match(/[^.!?。！？…]+[.!?。！？…]*[”’」』"']*\s*|[.!?。！？…]+/g) ?? [text]);

  const chunks: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (byteLength(cleanReaderAudioText(current + sentence)) <= MAX_TTS_BYTES) {
      current += sentence;
      continue;
    }
    if (current) chunks.push(current);
    if (byteLength(cleanReaderAudioText(sentence)) <= MAX_TTS_BYTES) current = sentence;
    else {
      chunks.push(...splitOverlongText(sentence));
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function cleanReaderAudioText(text: string): string {
  return text
    .replace(/\([^)]*[\u3400-\u4DBF\u4E00-\u9FFF][^)]*\)|（[^）]*[\u3400-\u4DBF\u4E00-\u9FFF][^）]*）/g, "")
    .replace(/[\u00B9\u00B2\u00B3\u2070-\u2079†‡※]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSpokenCharacterRanges(text: string): Array<{ offset: number; length: number }> {
  const omittedRanges = Array.from(
    text.matchAll(/\([^)]*[\u3400-\u4DBF\u4E00-\u9FFF][^)]*\)|（[^）]*[\u3400-\u4DBF\u4E00-\u9FFF][^）]*）/g),
    (match) => {
      const start = match.index ?? 0;
      return { start, end: start + match[0].length };
    },
  );
  const characters: Array<{ offset: number; length: number }> = [];
  let offset = 0;
  let rangeIndex = 0;
  let pendingSpace: { offset: number; length: number } | null = null;

  for (const character of Array.from(text)) {
    const end = offset + character.length;
    while (rangeIndex < omittedRanges.length && omittedRanges[rangeIndex].end <= offset) rangeIndex += 1;
    const omittedAsHanja = rangeIndex < omittedRanges.length &&
      omittedRanges[rangeIndex].start < end && omittedRanges[rangeIndex].end > offset;
    const omittedAsFootnote = /[\u00B9\u00B2\u00B3\u2070-\u2079†‡※]/u.test(character);

    if (!omittedAsHanja && !omittedAsFootnote) {
      if (/\s/u.test(character)) {
        if (characters.length > 0 && pendingSpace === null) pendingSpace = { offset, length: character.length };
      } else {
        if (pendingSpace) characters.push(pendingSpace);
        pendingSpace = null;
        characters.push({ offset, length: character.length });
      }
    }
    offset = end;
  }

  return characters;
}
function measureParagraphPageTransitions(
  span: HTMLElement,
  rootLeft: number,
  stride: number,
): Array<{ pageIndex: number; progress: number }> {
  const textNode = span.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return [];
  const text = textNode.textContent ?? "";
  if (!text) return [];

  const pageWeights = new Map<number, number>();
  const range = document.createRange();
  // Use the same text normalization as the audio request. Parenthesized Hanja,
  // footnote symbols, and collapsed whitespace must not shift the page timer.
  for (const character of getSpokenCharacterRanges(text)) {
    range.setStart(textNode, character.offset);
    range.setEnd(textNode, character.offset + character.length);
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      const page = Math.floor(Math.max(0, rect.left - rootLeft) / stride);
      pageWeights.set(page, (pageWeights.get(page) ?? 0) + 1);
    }
  }
  range.detach?.();

  let pages = [...pageWeights.entries()].sort((a, b) => a[0] - b[0]);

  // Some browsers report each word range in only one fragment even when the
  // inline paragraph itself crosses CSS columns. Fall back to the span's visual
  // fragments so the reader can still follow the page boundary.
  if (pages.length < 2) {
    const fragmentWeights = new Map<number, number>();
    for (const rect of Array.from(span.getClientRects())) {
      if (rect.width <= 0 || rect.height <= 0) continue;
      const page = Math.floor(Math.max(0, rect.left - rootLeft) / stride);
      fragmentWeights.set(page, (fragmentWeights.get(page) ?? 0) + rect.width);
    }
    pages = [...fragmentWeights.entries()].sort((a, b) => a[0] - b[0]);
  }

  if (pages.length < 2) {
    const box = span.getBoundingClientRect();
    const left = Math.max(0, box.left - rootLeft);
    const right = Math.max(left, box.right - rootLeft);
    const firstPage = Math.floor(left / stride);
    const lastPage = Math.floor(Math.max(left, right - 1) / stride);
    if (lastPage > firstPage) {
      const transitionCount = lastPage - firstPage;
      return Array.from({ length: transitionCount }, (_, index) => ({
        pageIndex: firstPage + index + 1,
        // As a final fallback, turn at evenly spaced points through the
        // paragraph instead of waiting for the whole audio file to end.
        progress: (index + 1) / (transitionCount + 1),
      }));
    }
  }

  const total = pages.reduce((sum, [, weight]) => sum + weight, 0);
  if (pages.length < 2 || total <= 0) return [];

  let elapsedWeight = 0;
  return pages.slice(0, -1).map(([, weight], index) => {
    elapsedWeight += weight;
    return { pageIndex: pages[index + 1][0], progress: elapsedWeight / total };
  });
}

function getSpokenTextByPage(
  span: HTMLElement,
  rootLeft: number,
  stride: number,
): Map<number, string> {
  const textNode = span.firstChild;
  const text = textNode?.textContent ?? "";
  const pageText = new Map<number, string>();
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE || !text) return pageText;

  const range = document.createRange();
  for (const character of getSpokenCharacterRanges(text)) {
    range.setStart(textNode, character.offset);
    range.setEnd(textNode, character.offset + character.length);
    const rect = range.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) continue;
    const page = Math.floor(Math.max(0, rect.left - rootLeft) / stride);
    pageText.set(page, (pageText.get(page) ?? "") + text.slice(character.offset, character.offset + character.length));
  }
  range.detach?.();
  return new Map([...pageText.entries()].filter(([, value]) => value.trim().length > 0));
}

export function collectPageAudioSentences(
  root: HTMLElement | null,
  pageIndex: number,
  stride: number,
  excludedSentenceIds: ReadonlySet<number> = new Set(),
): ReaderAudioSentence[] {
  if (!root || stride <= 0) return [];
  const spans = Array.from(root.querySelectorAll<HTMLElement>("[data-audio-sentence-id]"));
  const rootLeft = root.getBoundingClientRect().left;
  const rows: ReaderAudioSentence[] = [];
  for (const span of spans) {
    if (!span.closest<HTMLElement>("[data-line-index]")) continue;
    const sentenceId = Number(span.dataset.audioSentenceId);
    if (excludedSentenceIds.has(sentenceId)) continue;

    const pageParts = getSpokenTextByPage(span, rootLeft, stride);
    const pageText = pageParts.get(pageIndex);
    if (pageText?.trim()) {
      // Keep a paragraph that crosses a visual page boundary as one TTS clip.
      // The page changes while that clip is playing, so the voice does not stop
      // and restart at the column edge.
      const visibleParts = [...pageParts.entries()]
        .filter(([page, text]) => page >= pageIndex && text.trim().length > 0)
        .sort(([leftPage], [rightPage]) => leftPage - rightPage)
        .map(([pageIndex, text]) => ({ pageIndex, text, spokenText: cleanReaderAudioText(text) }))
        .filter((part) => part.spokenText.length > 0);
      const totalCharacters = visibleParts.reduce((sum, part) => sum + part.spokenText.length, 0);
      let elapsedCharacters = visibleParts[0]?.spokenText.length ?? 0;
      const pageTransitions = visibleParts.slice(1).map((part, index) => {
        const transition = {
          pageIndex: part.pageIndex,
          progress: totalCharacters > 0 ? Math.min(1, elapsedCharacters / totalCharacters) : 1,
        };
        elapsedCharacters += part.spokenText.length;
        return transition;
      });
      rows.push({
        id: sentenceId,
        text: cleanReaderAudioText(visibleParts.map((part) => part.text).join("")),
        pageNumber: pageIndex + 1,
        sentenceNumber: rows.length,
        pageTransitions,
      });
      continue;
    }

    // If this browser cannot measure individual text ranges, retain the
    // existing whole-paragraph timing fallback for the paragraph's first page.
    if (pageParts.size > 0) continue;
    const page = Math.floor(Math.max(0, span.getBoundingClientRect().left - rootLeft) / stride);
    if (page !== pageIndex) continue;
    const text = span.dataset.audioText ?? cleanReaderAudioText(span.textContent ?? "");
    if (!text) continue;
    rows.push({
      id: Number(span.dataset.audioSentenceId),
      text,
      pageNumber: pageIndex + 1,
      sentenceNumber: rows.length,
      pageTransitions: measureParagraphPageTransitions(span, rootLeft, stride),
    });
  }
  return rows;
}
