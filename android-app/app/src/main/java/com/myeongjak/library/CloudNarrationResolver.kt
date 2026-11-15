package com.myeongjak.library

import android.content.Context
import android.net.Uri
import androidx.media3.datasource.DataSpec
import androidx.media3.datasource.ResolvingDataSource
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap

/** Called by ExoPlayer's loader thread, including while the Activity is stopped. */
class CloudNarrationResolver(
  private val queue: NarrationQueue,
  private val fallback: DeviceSpeechFiles,
  private val deviceVoices: MutableSet<Int>
) : ResolvingDataSource.Resolver {
  private val urls = ConcurrentHashMap<Int, Pair<Long, Uri>>()

  override fun resolveDataSpec(dataSpec: DataSpec): DataSpec {
    val index = dataSpec.uri.lastPathSegment?.toIntOrNull() ?: throw IOException("Invalid audio index")
    val row = queue.rows.getOrNull(index) ?: throw IOException("Invalid audio row")
    val cached = urls[index]
    if (cached != null && System.currentTimeMillis() - cached.first < 45 * 60 * 1000) return dataSpec.withUri(cached.second)
    val input = JSONObject().put("bookId", queue.bookId).put("pageNumber", row.pageNumber)
      .put("sentenceNumber", row.sentenceNumber).put("text", row.text)
    var result: JSONObject? = null
    for (attempt in 0..2) {
      result = request(input)
      if (!result.optBoolean("fallback") || result.optString("reason") != "busy") break
      if (attempt < 2) Thread.sleep(1000)
    }
    val response = result ?: throw IOException("Empty audio response")
    val uri = if (response.optBoolean("fallback")) {
      // The same server quota applies. Local device speech does not call Google Cloud.
      deviceVoices.add(index)
      Uri.fromFile(fallback.synthesize(row.text))
    } else {
      val url = Uri.parse(response.getString("audioUrl"))
      if (url.scheme != "https" || url.host.isNullOrBlank() || url.userInfo != null) throw IOException("Invalid audio URL")
      url
    }
    if (urls.size >= 8) urls.keys.minOrNull()?.let { urls.remove(it) }
    urls[index] = System.currentTimeMillis() to uri
    return dataSpec.withUri(uri)
  }

  private fun request(input: JSONObject): JSONObject {
    val connection = URL("https://korealib.com/api/trpc/readerAudio.getOrCreate").openConnection() as HttpURLConnection
    try {
      connection.requestMethod = "POST"
      connection.connectTimeout = 15000
      connection.readTimeout = 45000
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.outputStream.use { it.write(JSONObject().put("json", input).toString().toByteArray(Charsets.UTF_8)) }
      if (connection.responseCode !in 200..299) throw IOException("음성 서버 연결을 다시 시도합니다 (${connection.responseCode}).")
      val body = connection.inputStream.bufferedReader().use { it.readText() }
      return JSONObject(body).getJSONObject("result").getJSONObject("data").getJSONObject("json")
    } finally { connection.disconnect() }
  }
}

/** Test substitution is never accepted from the WebView or an Intent. */
object AudioResolverFactory {
  internal var testResolver: ResolvingDataSource.Resolver? = null
  fun create(queue: NarrationQueue, fallback: DeviceSpeechFiles, voices: MutableSet<Int>): ResolvingDataSource.Resolver =
    (if (BuildConfig.DEBUG) testResolver else null) ?: CloudNarrationResolver(queue, fallback, voices)
}
