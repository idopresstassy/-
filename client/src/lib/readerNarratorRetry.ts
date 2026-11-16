import type { ReaderAudioBatch } from "./readerAudioPlayback";

type RestartableNarration = {
  readonly cursor: { batch: ReaderAudioBatch; index: number } | null;
  start(batch: ReaderAudioBatch, index?: number): void;
};

/** A deliberate retry restarts this paragraph, retaining the remaining book.
 * START also replaces an already-buffered device-voice clip in Android 0.2.2;
 * RESUME alone would continue that local file without contacting the server.
 */
export function retrySelectedNarrator(player: RestartableNarration, invalidate: () => void): boolean {
  const cursor = player.cursor;
  if (!cursor) return false;
  invalidate();
  player.start(cursor.batch, cursor.index);
  return true;
}
