package com.myeongjak.library

import android.view.ViewGroup
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.UiDevice
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.atomic.AtomicBoolean
import java.io.ByteArrayInputStream

/** Exercises a real system Back event, including API 36's predictive-back dispatch. */
@RunWith(AndroidJUnit4::class)
class NavigationTest {
  @Test fun systemBackReturnsToPreviousWebPage() {
    val device = UiDevice.getInstance(InstrumentationRegistry.getInstrumentation())
    device.wakeUp()
    ActivityScenario.launch(MainActivity::class.java).use { scenario ->
      scenario.onActivity { activity ->
        val web = view(activity)
        web.stopLoading()
        val productionClient = web.webViewClient
        // Use a real HTTPS navigation with a local response. loadDataWithBaseURL
        // does not create normal pushState/back history on all WebView versions.
        // Delegate production history callbacks so this tests the actual Back handler.
        web.webViewClient = object : WebViewClient() {
          override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
            if (request.url.host == "korealib.com" && request.url.path?.startsWith("/__navigation_fixture__") == true) {
              return WebResourceResponse("text/html", "UTF-8", ByteArrayInputStream(
                "<html><body id='nav-fixture'>Navigation test</body></html>".toByteArray()))
            }
            return productionClient.shouldInterceptRequest(view, request)
          }
          override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            productionClient.shouldOverrideUrlLoading(view, request)
          override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) =
            productionClient.doUpdateVisitedHistory(view, url, isReload)
          override fun onPageFinished(view: WebView, url: String) = productionClient.onPageFinished(view, url)
        }
        web.loadUrl("https://korealib.com/__navigation_fixture__")
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
        view(it).evaluateJavascript("history.pushState({}, '', '/__navigation_fixture__/reader');", null)
      }
      await(10000) {
        var ready = false
        scenario.onActivity { ready = view(it).url?.endsWith("/__navigation_fixture__/reader") == true && view(it).canGoBack() }
        ready
      }
      device.pressBack()
      await(10000) {
        var returned = false
        scenario.onActivity { returned = view(it).url == "https://korealib.com/__navigation_fixture__" }
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
