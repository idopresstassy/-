package com.myeongjak.library

import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

data class NarrationRow(val id: Int, val text: String, val pageNumber: Int, val sentenceNumber: Int)
data class NarrationQueue(val bookId: Long, val title: String, val speed: Float, val rows: List<NarrationRow>) {
  companion object {
    fun parse(message: String): NarrationQueue {
      require(message.length <= 8_000_000) { "도서가 너무 커서 앱 낭독을 준비하지 못했습니다." }
      val json = JSONObject(message)
      val bookId = json.getLong("bookId")
      val input = json.getJSONArray("rows")
      require(bookId > 0 && input.length() in 1..20000)
      val ids = HashSet<Int>()
      val rows = (0 until input.length()).map { i ->
        val row = input.getJSONObject(i)
        val id = row.getInt("id")
        val text = row.getString("text").trim()
        val page = row.getInt("pageNumber")
        val sentence = row.getInt("sentenceNumber")
        require(id >= 0 && ids.add(id) && text.isNotEmpty() && text.length <= 4000 && page > 0 && sentence >= 0)
        NarrationRow(id, text, page, sentence)
      }
      return NarrationQueue(bookId, json.optString("title", "도서 낭독").take(200),
        json.optDouble("speed", 0.8).toFloat().coerceIn(0.8f, 1.5f), rows)
    }
  }
}

/** Only this small token crosses Binder; the book text stays in the app process. */
object PendingNarration {
  private val queues = ConcurrentHashMap<String, NarrationQueue>()
  fun put(queue: NarrationQueue): String {
    queues.clear()
    return UUID.randomUUID().toString().also { queues[it] = queue }
  }
  fun take(token: String?) = token?.let { queues.remove(it) }
}

/** UI observers are optional. Neither loading nor advancing audio calls a WebView. */
object NarrationState {
  @Volatile var latest: String = "{}"
    private set
  private val observers = CopyOnWriteArraySet<(String) -> Unit>()
  fun publish(state: JSONObject) {
    latest = state.toString()
    observers.forEach { it(latest) }
  }
  fun subscribe(observer: (String) -> Unit) { observers.add(observer) }
  fun unsubscribe(observer: (String) -> Unit) { observers.remove(observer) }
}
