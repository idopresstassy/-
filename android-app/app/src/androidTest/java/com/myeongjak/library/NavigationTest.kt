package com.myeongjak.library

import android.view.ViewGroup
import android.webkit.WebView
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.atomic.AtomicBoolean

/** Exercises a real system Back event, including API 36's predictive-back dispatch. */
@RunWith(AndroidJUnit4::class)
class NavigationTest {
  @Test fun systemBackReturnsToPreviousWebPage() {
    val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
    device.wakeUp()
    ActivityScenario.launch(MainActivity::class.java).use { scenario ->
      scenario.onActivity { activity ->
        view(activity).stopLoading()
        view(activity).loadDataWithBaseURL("https://korealib.com/", "<html><body id='nav-fixture'>Navigation test</body></html>", "text/html", "UTF-8", "https://korealib.com/")
      }
      val fixtureReady = AtomicBoolean(false)
      await(10000) {
        scenario.onActivity {
          view(it).evaluateJavascript("!!document.getElementById('nav-fixture')") { value ->
            fixtureReady.set(value == "true")
          }
        }
        fixtureReady.get()
      }
      scenario.onActivity {
        view(it).evaluateJavascript("history.pushState({}, '', '/read/90003');", null)
      }
      await(10000) {
        var ready = false
        scenario.onActivity { ready = view(it).url?.endsWith("/read/90003") == true && view(it).canGoBack() }
        ready
      }
      device.pressBack()
      await(10000) {
        var returned = false
        scenario.onActivity { returned = view(it).url == "https://korealib.com/" }
        returned
      }
    }
  }

  private fun view(activity: MainActivity): WebView =
    ((activity.findViewById<ViewGroup>(android.R.id.content).getChildAt(0)) as ViewGroup).getChildAt(0) as WebView

  private fun await(timeout: Long, condition: () -> Boolean) {
    val until = System.currentTimeMillis() + timeout
    while (!condition() && System.currentTimeMillis() < until) Thread.sleep(100)
    assertTrue("WebView did not navigate back using the system Back event", condition())
  }
}
