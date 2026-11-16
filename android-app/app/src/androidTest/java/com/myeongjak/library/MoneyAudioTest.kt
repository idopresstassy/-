package com.myeongjak.library

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.view.ViewGroup
import android.webkit.WebView
import androidx.media3.datasource.ResolvingDataSource
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean

/** Exact cached Cloud MP3s around 돈's reported page-11 stop, not synthetic WAV. */
@RunWith(AndroidJUnit4::class)
class MoneyAudioTest {
  @Test fun moneyPageElevenContinuesAtPointEightSpeedWithScreenOff() = playMoney(false)
  @Test fun delayedNextMp3StillContinuesWithoutAPLayTap() = playMoney(true)

  private fun playMoney(delayNext: Boolean) {
    NarrationState.publish(JSONObject())
    val instrumentation = InstrumentationRegistry.getInstrumentation()
    val context = ApplicationProvider.getApplicationContext<Context>()
    val assets = instrumentation.context.assets
    val rows = JSONArray(assets.open("money/rows.json").bufferedReader().use { it.readText() })
    val files = (0 until rows.length()).map { index ->
      val id = rows.getJSONObject(index).getInt("id")
      File(context.cacheDir, "money-$id.mp3").apply {
        assets.open("money/$id.mp3").use { input -> outputStream().use { input.copyTo(it) } }
      }
    }
    val firstDelay = AtomicBoolean(delayNext)
    AudioResolverFactory.testResolver = ResolvingDataSource.Resolver { spec ->
      val index = spec.uri.lastPathSegment!!.toInt()
      // Delay one real next-file load long enough to exhaust the preceding clip.
      if (index == 1 && firstDelay.compareAndSet(true, false)) Thread.sleep(45000)
      spec.withUri(Uri.fromFile(files[index]))
    }
    val power = context.getSystemService(PowerManager::class.java)
    val device = UiDevice.getInstance(instrumentation)
    val positions = ConcurrentHashMap<Int, Long>()
    val crossedWhileOff = AtomicBoolean(false)
    val observer: (String) -> Unit = { state ->
      val value = JSONObject(state)
      val index = value.optInt("index")
      if (value.optBoolean("playing")) positions.merge(index, value.optLong("positionMs")) { a, b -> maxOf(a, b) }
      if (value.optInt("pageNumber") == 12 && !power.isInteractive) crossedWhileOff.set(true)
    }
    NarrationState.subscribe(observer)
    val scenario = ActivityScenario.launch(MainActivity::class.java)
    try {
      scenario.onActivity { activity ->
        val payload = JSONObject().put("action", "start").put("bookId", 90003)
          .put("title", "돈 · 실제 MP3 검증").put("speed", 0.8).put("rows", rows)
        val container = activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as ViewGroup
        (container.getChildAt(0) as WebView).loadDataWithBaseURL("https://korealib.com/",
          "<html><script>window.MyeongjakAudioV2.postMessage(" + JSONObject.quote(payload.toString()) + ");</script></html>",
          "text/html", "UTF-8", null)
      }
      awaitCondition(20000) { JSONObject(NarrationState.latest).optLong("positionMs") > 200 }
      device.sleep()
      assertFalse(power.isInteractive)
      scenario.close()
      awaitCondition(190000) { JSONObject(NarrationState.latest).optBoolean("finished") }
      assertTrue("Page 12 must be reached while locked", crossedWhileOff.get())
      for (index in files.indices) assertTrue("MP3 $index was skipped: $positions", (positions[index] ?: 0) > 500)
      assertEquals(rows.length() - 1, JSONObject(NarrationState.latest).getInt("index"))
    } finally {
      device.wakeUp()
      scenario.close()
      context.stopService(Intent(context, PlaybackService::class.java))
      instrumentation.waitForIdleSync()
      NarrationState.unsubscribe(observer)
      AudioResolverFactory.testResolver = null
    }
  }

  private fun awaitCondition(timeoutMs: Long, condition: () -> Boolean) {
    val deadline = System.currentTimeMillis() + timeoutMs
    while (!condition() && System.currentTimeMillis() < deadline) Thread.sleep(100)
    assertTrue("Timed out: ${NarrationState.latest}", condition())
  }
}
