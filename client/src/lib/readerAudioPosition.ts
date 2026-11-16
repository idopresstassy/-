import type { ReaderAudioLayout, ReaderAudioSentence } from "./readerAudioText";

/** Visual position is independent of the audio queue and its storage keys. */
export class ReaderAudioPosition {
  private active: { row: ReaderAudioSentence; progress: number } | null = null;
  private layouts = new WeakMap<ReaderAudioSentence, ReaderAudioLayout>();

  constructor(
    private measure: (row: ReaderAudioSentence) => ReaderAudioLayout | null,
    private onPage: (row: ReaderAudioSentence, page: number) => void,
  ) {}

  update(row: ReaderAudioSentence, progress: number) {
    this.active = { row, progress };
    let layout = this.layouts.get(row);
    if (!layout) {
      layout = this.measure(row) ?? undefined;
      if (layout) this.layouts.set(row, layout);
    }
    if (!layout) return;
    const page = layout.pageTransitions.filter((entry) => progress >= entry.progress).at(-1)?.pageIndex
      ?? layout.pageIndex;
    this.onPage(row, page);
  }

  reflow() {
    this.layouts = new WeakMap();
    if (this.active) this.update(this.active.row, this.active.progress);
  }

  reset() {
    this.active = null;
    this.layouts = new WeakMap();
  }
}
