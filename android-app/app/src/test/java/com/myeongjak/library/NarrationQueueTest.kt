package com.myeongjak.library

import org.junit.Assert.*
import org.junit.Test

class NarrationQueueTest {
  private val valid = """{"bookId":90003,"title":"돈","speed":0.8,"rows":[{"id":4,"text":"시험 문장.","pageNumber":2,"sentenceNumber":0}]}"""
  @Test fun preservesCacheCoordinatesAndText() {
    val queue = NarrationQueue.parse(valid)
    assertEquals(90003L, queue.bookId)
    assertEquals(NarrationRow(4, "시험 문장.", 2, 0), queue.rows[0])
    assertEquals(0.8f, queue.speed)
  }
  @Test fun boundsPlaybackSpeed() { assertEquals(1.5f, NarrationQueue.parse(valid.replace("0.8", "8.0")).speed) }
  @Test(expected = IllegalArgumentException::class) fun rejectsInvalidBook() { NarrationQueue.parse(valid.replace("90003", "-1")) }
  @Test(expected = IllegalArgumentException::class) fun rejectsEmptyQueue() { NarrationQueue.parse("""{"bookId":90003,"rows":[]}""") }
  @Test fun tokenCanOnlyBeConsumedOnce() {
    val token = PendingNarration.put(NarrationQueue.parse(valid))
    assertNotNull(PendingNarration.take(token))
    assertNull(PendingNarration.take(token))
  }
}
