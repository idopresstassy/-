package com.myeongjak.library

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import androidx.core.content.ContextCompat
import androidx.media3.datasource.ResolvingDataSource
import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.atomic.AtomicBoolean

@RunWith(AndroidJUnit4::class)
class ScreenOffPlaybackTest {
  @Test fun sixClipsFinishWithScreenOffAndActivityDestroyed() {
    val context = ApplicationProvider.getApplicationContext<Context>()
    val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
    val power = context.getSystemService(PowerManager::class.java)
    val file = File(context.cacheDir, "screen-off-test.wav")
    file.writeBytes(tone())
    val requested = CopyOnWriteArraySet<Int>()
    val advancedWhileOff = AtomicBoolean(false)
    val observer: (String) -> Unit = { state ->
      val value = JSONObject(state)
      if (value.optInt("index") >= 3 && !power.isInteractive) advancedWhileOff.set(true)
    }
    AudioResolverFactory.testResolver = ResolvingDataSource.Resolver { spec ->
      requested.add(spec.uri.lastPathSegment!!.toInt())
      spec.withUri(Uri.fromFile(file))
    }
    NarrationState.subscribe(observer)
    val scenario = ActivityScenario.launch(MainActivity::class.java)
    try {
      scenario.onActivity { activity ->
        val queue = NarrationQueue(90003, "화면 꺼짐 연속 낭독 시험", 1f,
          (0..5).map { NarrationRow(it, "시험 문단 $it", it / 2 + 1, it % 2) })
        ContextCompat.startForegroundService(activity, Intent(activity, PlaybackService::class.java)
          .setAction(PlaybackService.START).putExtra("token", PendingNarration.put(queue)))
      }
      awaitCondition(15000) { JSONObject(NarrationState.latest).optLong("positionMs") > 200 }
      device.sleep()
      assertFalse("The test must actually lock the emulator screen", power.isInteractive)
      // Remove the entire WebView/Activity: no JS callback can fetch the next clip.
      scenario.close()
      awaitCondition(30000) { JSONObject(NarrationState.latest).optBoolean("finished") }
      assertTrue("Native queue must advance while screen is off", advancedWhileOff.get())
      assertEquals(setOf(0, 1, 2, 3, 4, 5), requested.toSet())
      assertEquals(5, JSONObject(NarrationState.latest).getInt("index"))
    } finally {
      device.wakeUp()
      scenario.close()
      context.stopService(Intent(context, PlaybackService::class.java))
      NarrationState.unsubscribe(observer)
      AudioResolverFactory.testResolver = null
    }
  }
  private fun awaitCondition(timeoutMs: Long, condition: () -> Boolean) {
    val deadline = System.currentTimeMillis() + timeoutMs
    while (!condition() && System.currentTimeMillis() < deadline) Thread.sleep(100)
    assertTrue("Timed out: ${NarrationState.latest}", condition())
  }
  private fun tone(): ByteArray {
    val samples = 16000 * 2
    val size = samples * 2
    val buffer = ByteBuffer.allocate(44 + size).order(ByteOrder.LITTLE_ENDIAN)
    buffer.put("RIFF".toByteArray()).putInt(36 + size).put("WAVEfmt ".toByteArray())
      .putInt(16).putShort(1.toShort()).putShort(1.toShort()).putInt(16000).putInt(32000)
      .putShort(2.toShort()).putShort(16.toShort()).put("data".toByteArray()).putInt(size)
    for (i in 0 until samples) buffer.putShort((kotlin.math.sin(i * 2 * Math.PI * 440 / 16000) * 5000).toInt().toShort())
    return buffer.array()
  }
}
