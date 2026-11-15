package com.myeongjak.library

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.view.ViewGroup
import android.webkit.WebView
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.datasource.HttpDataSource
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.json.JSONObject
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.io.FileNotFoundException
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger

@RunWith(AndroidJUnit4::class)
class ScreenOffPlaybackTest {
  @Test fun sixClipsFinishWithScreenOffAndActivityDestroyed() = playWhileLocked(6, 2, false)

  @Test fun twelveMinutesRecoverFromNetworkFailureAndFinishNinetyPages() = playWhileLocked(180, 4, true)

  private fun playWhileLocked(clipCount: Int, seconds: Int, injectFailures: Boolean) {
    NarrationState.publish(JSONObject())
    val context = ApplicationProvider.getApplicationContext<Context>()
    val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
    val power = context.getSystemService(PowerManager::class.java)
    val file = File(context.cacheDir, "screen-off-test.wav")
    file.writeBytes(tone(seconds))
    val requested = CopyOnWriteArraySet<Int>()
    val advancedWhileOff = AtomicBoolean(false)
    val recoveredWhileOff = AtomicBoolean(false)
    val failures = AtomicInteger(0)
    val missingFile = AtomicBoolean(injectFailures)
    val played = CopyOnWriteArraySet<Int>()
    val observer: (String) -> Unit = { state ->
      val value = JSONObject(state)
      if (value.optInt("index") >= 3 && !power.isInteractive) advancedWhileOff.set(true)
      if (value.optInt("recoveryAttempt") > 0 && !power.isInteractive) recoveredWhileOff.set(true)
      if (value.optLong("positionMs") > 0 && value.optBoolean("playing")) played.add(value.optInt("index"))
    }
    AudioResolverFactory.testResolver = ResolvingDataSource.Resolver { spec ->
      val index = spec.uri.lastPathSegment!!.toInt()
      requested.add(index)
      if (injectFailures && index == 24 && failures.getAndIncrement() < 8) {
        throw HttpDataSource.InvalidResponseCodeException(503, "temporary outage", null, emptyMap(), spec, ByteArray(0))
      }
      if (index == 60 && missingFile.compareAndSet(true, false)) throw FileNotFoundException("temporary clip removed")
      spec.withUri(Uri.fromFile(file))
    }
    NarrationState.subscribe(observer)
    val scenario = ActivityScenario.launch(MainActivity::class.java)
    try {
      handOver(scenario, clipCount)
      awaitCondition(15000) { JSONObject(NarrationState.latest).optLong("positionMs") > 200 }
      device.sleep()
      assertFalse("The test must actually lock the emulator screen", power.isInteractive)
      // Remove the entire WebView/Activity: no JS callback can fetch the next clip.
      scenario.close()
      awaitCondition(clipCount * seconds * 1000L + 120000L) { JSONObject(NarrationState.latest).optBoolean("finished") }
      assertTrue("Native queue must advance while screen is off", advancedWhileOff.get())
      assertEquals((0 until clipCount).toSet(), requested.toSet())
      assertEquals((0 until clipCount).toSet(), played.toSet())
      assertEquals(clipCount - 1, JSONObject(NarrationState.latest).getInt("index"))
      if (injectFailures) {
        assertTrue("A fatal loading error must recover without a play tap", recoveredWhileOff.get())
        assertTrue(failures.get() > 8)
        assertFalse(missingFile.get())
      }
    } finally {
      device.wakeUp()
      scenario.close()
      context.stopService(Intent(context, PlaybackService::class.java))
      InstrumentationRegistry.getInstrumentation().waitForIdleSync()
      NarrationState.unsubscribe(observer)
      AudioResolverFactory.testResolver = null
    }
  }
  @Test fun pauseCancelsRecoveryAndExplicitResumeContinues() {
    NarrationState.publish(JSONObject())
    val context = ApplicationProvider.getApplicationContext<Context>()
    val file = File(context.cacheDir, "pause-retry-test.wav").apply { writeBytes(tone(2)) }
    val allowAudio = AtomicBoolean(false)
    val requests = AtomicInteger(0)
    AudioResolverFactory.testResolver = ResolvingDataSource.Resolver { spec ->
      requests.incrementAndGet()
      if (!allowAudio.get()) throw FileNotFoundException("temporary cache miss")
      spec.withUri(Uri.fromFile(file))
    }
    val scenario = ActivityScenario.launch(MainActivity::class.java)
    try {
      handOver(scenario, 3)
      awaitCondition(15000) { JSONObject(NarrationState.latest).optInt("recoveryAttempt") > 0 }
      scenario.onActivity { it.startService(Intent(it, PlaybackService::class.java).setAction("pause")) }
      awaitCondition(5000) { !JSONObject(NarrationState.latest).optBoolean("playing") }
      val before = requests.get()
      Thread.sleep(2500)
      assertEquals("A pause must cancel the scheduled retry", before, requests.get())
      allowAudio.set(true)
      scenario.onActivity { it.startService(Intent(it, PlaybackService::class.java).setAction("resume")) }
      awaitCondition(15000) { JSONObject(NarrationState.latest).optBoolean("finished") }
      assertEquals(2, JSONObject(NarrationState.latest).optInt("index"))
    } finally {
      scenario.close()
      context.stopService(Intent(context, PlaybackService::class.java))
      InstrumentationRegistry.getInstrumentation().waitForIdleSync()
      AudioResolverFactory.testResolver = null
    }
  }

  private fun handOver(scenario: ActivityScenario<MainActivity>, count: Int) {
    scenario.onActivity { activity ->
      val payload = JSONObject().put("action", "start").put("bookId", 90003)
        .put("title", "화면 꺼짐 연속 낭독 시험").put("speed", 1)
        .put("rows", JSONArray((0 until count).map { JSONObject().put("id", it)
          .put("text", "시험 문단 $it").put("pageNumber", it / 2 + 1).put("sentenceNumber", it % 2) }))
      val container = activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0) as ViewGroup
      val webView = container.getChildAt(0) as WebView
      webView.loadDataWithBaseURL("https://korealib.com/", "<html><body><script>" +
        "window.MyeongjakAudioV2.postMessage(" + JSONObject.quote(payload.toString()) +
        ");</script></body></html>", "text/html", "UTF-8", null)
    }
  }
  private fun awaitCondition(timeoutMs: Long, condition: () -> Boolean) {
    val deadline = System.currentTimeMillis() + timeoutMs
    while (!condition() && System.currentTimeMillis() < deadline) Thread.sleep(100)
    assertTrue("Timed out: ${NarrationState.latest}", condition())
  }
  private fun tone(seconds: Int): ByteArray {
    val samples = 16000 * seconds
    val size = samples * 2
    val buffer = ByteBuffer.allocate(44 + size).order(ByteOrder.LITTLE_ENDIAN)
    buffer.put("RIFF".toByteArray()).putInt(36 + size).put("WAVEfmt ".toByteArray())
      .putInt(16).putShort(1.toShort()).putShort(1.toShort()).putInt(16000).putInt(32000)
      .putShort(2.toShort()).putShort(16.toShort()).put("data".toByteArray()).putInt(size)
    for (i in 0 until samples) buffer.putShort((kotlin.math.sin(i * 2 * Math.PI * 440 / 16000) * 5000).toInt().toShort())
    return buffer.array()
  }
}
