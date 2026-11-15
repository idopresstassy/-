import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleReaderAudioPreparation } from "./readerAudioScheduling";

describe("narration preparation across screen locking", () => {
  let page: EventTarget & { hidden: boolean };
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;

  beforeEach(() => {
    page = Object.assign(new EventTarget(), { hidden: false });
    frames = new Map();
    nextFrame = 0;
    vi.stubGlobal("document", page);
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn((id: number) => frames.delete(id)));
  });

  afterEach(() => vi.unstubAllGlobals());

  function paint() {
    const pending = Array.from(frames.entries());
    frames.clear();
    for (const [, callback] of pending) callback(0);
  }

  function setHidden(hidden: boolean) {
    page.hidden = hidden;
    page.dispatchEvent(new Event("visibilitychange"));
  }

  it("waits for the existing two layout frames while the reader is visible", () => {
    const prepare = vi.fn();
    scheduleReaderAudioPreparation(prepare);
    expect(prepare).not.toHaveBeenCalled();
    paint();
    expect(prepare).not.toHaveBeenCalled();
    paint();
    expect(prepare).toHaveBeenCalledTimes(1);
    setHidden(true);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("prepares consecutive pages while locked without any paint callbacks", () => {
    setHidden(true);
    const preparedPages: number[] = [];
    for (const pageNumber of [2, 3, 4]) {
      scheduleReaderAudioPreparation(() => preparedPages.push(pageNumber));
    }
    expect(preparedPages).toEqual([2, 3, 4]);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it.each([0, 1])("releases pending work when locked after %i frames", (frameCount) => {
    const prepare = vi.fn();
    scheduleReaderAudioPreparation(prepare);
    for (let i = 0; i < frameCount; i += 1) paint();
    setHidden(true);
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(frames.size).toBe(0);
    setHidden(false);
    paint();
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it.each([0, 1])("cancels obsolete page work after %i frames", (frameCount) => {
    const prepare = vi.fn();
    const cancel = scheduleReaderAudioPreparation(prepare);
    for (let i = 0; i < frameCount; i += 1) paint();
    cancel();
    setHidden(true);
    paint();
    expect(prepare).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });
});
