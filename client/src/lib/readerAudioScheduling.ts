/**
 * Allow a visible reader to finish layout before measuring its next narration
 * page. Animation frames stop when the screen is locked, so audio preparation
 * must also have a path that does not wait for a paint.
 */
export function scheduleReaderAudioPreparation(prepare: () => void): () => void {
  let finished = false;
  let frame: number | null = null;

  const cleanup = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
  const run = () => {
    if (finished) return;
    finished = true;
    cleanup();
    prepare();
  };
  function handleVisibilityChange() {
    // Also release work queued just before the user locked the screen.
    if (document.hidden) run();
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  if (document.hidden) {
    run();
  } else {
    frame = requestAnimationFrame(() => {
      if (!finished) frame = requestAnimationFrame(run);
    });
  }

  return () => {
    finished = true;
    cleanup();
  };
}
