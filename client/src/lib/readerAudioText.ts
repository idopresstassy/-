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

function measureParagraphPageTransitions(
  span: HTMLElement,
  rootLeft: number,
  stride: number,
): Array<{ pageIndex: number; progress: number }> {
  const textNode = span.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return [];
  const text = textNode.textContent ?? "";
  if (!text) return [];

  const Segmenter = (Intl as typeof Intl & {
    Segmenter?: new (locale: string, options: { granularity: "word" }) => {
      segment: (value: string) => Iterable<{ segment: string; index: number }>;
    };
  }).Segmenter;
  const segments = Segmenter
    ? Array.from(new Segmenter("ko", { granularity: "word" }).segment(text))
    : Array.from(text.matchAll(/\S+\s*|\s+/g), (match) => ({
        segment: match[0],
        index: match.index ?? 0,
      }));

  const pageWeights = new Map<number, number>();
  const range = document.createRange();
  for (const part of segments) {
    range.setStart(textNode, part.index);
    range.setEnd(textNode, part.index + part.segment.length);
    const rects = Array.from(range.getClientRects());
    if (rects.length === 0) continue;
    const weight = Array.from(part.segment).length / rects.length;
    for (const rect of rects) {
      const page = Math.floor(Math.max(0, rect.left - rootLeft) / stride);
      pageWeights.set(page, (pageWeights.get(page) ?? 0) + weight);
    }
  }
  range.detach?.();

  const pages = [...pageWeights.entries()].sort((a, b) => a[0] - b[0]);
  const total = pages.reduce((sum, [, weight]) => sum + weight, 0);
  if (pages.length < 2 || total <= 0) return [];

  let elapsedWeight = 0;
  return pages.slice(0, -1).map(([pageIndex, weight], index) => {
    elapsedWeight += weight;
    return { pageIndex: pages[index + 1][0], progress: elapsedWeight / total };
  });
}

export function collectPageAudioSentences(
  root: HTMLElement | null,
  pageIndex: number,
  stride: number,
): ReaderAudioSentence[] {
  if (!root || stride <= 0) return [];
  const spans = Array.from(root.querySelectorAll<HTMLElement>("[data-audio-sentence-id]"));
  const rootLeft = root.getBoundingClientRect().left;
  const rows: ReaderAudioSentence[] = [];
  for (const span of spans) {
    if (!span.closest<HTMLElement>("[data-line-index]")) continue;
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
