export type ReaderAudioSentence = {
  id: number;
  text: string;
  pageNumber: number;
  sentenceNumber: number;
};

/** Split display paragraphs while retaining every character in the rendered spans. */
export function splitReaderParagraph(text: string): string[] {
  const Segmenter = (Intl as typeof Intl & { Segmenter?: new (locale: string, options: { granularity: "sentence" }) => { segment: (value: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Segmenter) {
    return Array.from(new Segmenter("ko", { granularity: "sentence" }).segment(text), (item) => item.segment);
  }
  return text.match(/[^.!?。！？…]+[.!?。！？…]*[”’」』\"']*\s*|[.!?。！？…]+/g) ?? [text];
}

export function cleanReaderAudioText(text: string): string {
  return text
    .replace(/[\u00B9\u00B2\u00B3\u2070-\u2079†‡※]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
    });
  }
  return rows;
}
