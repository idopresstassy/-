package com.myeongjak.library

import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import android.widget.FrameLayout
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

class MainActivity : ComponentActivity() {
  private lateinit var webView: WebView
  private val webBack = object : OnBackPressedCallback(false) {
    override fun handleOnBackPressed() {
      if (webView.canGoBack()) webView.goBack()
      else {
        isEnabled = false
        onBackPressedDispatcher.onBackPressed()
      }
    }
  }
  private var visible = false
  private val observer: (String) -> Unit = { state ->
    if (visible) runOnUiThread { deliver(state) }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    onBackPressedDispatcher.addCallback(this, webBack)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    window.statusBarColor = Color.TRANSPARENT
    window.navigationBarColor = Color.TRANSPARENT
    webView = WebView(this).apply {
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      settings.allowFileAccess = false
      settings.allowContentAccess = false
      settings.mediaPlaybackRequiresUserGesture = true
      webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
          val uri = request.url
          if (uri.scheme == "https" && uri.host == "korealib.com") return false
          if (request.isForMainFrame && uri.scheme in listOf("https", "mailto", "tel")) {
            try { startActivity(Intent(Intent.ACTION_VIEW, uri)) } catch (_: Exception) { }
          }
          return true
        }
        override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
          webBack.isEnabled = view.canGoBack()
        }
        override fun onPageFinished(view: WebView, url: String) {
          webBack.isEnabled = view.canGoBack()
          deliver(NarrationState.latest)
        }
      }
    }
    if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
      WebViewCompat.addWebMessageListener(webView, "MyeongjakAuth", setOf("https://korealib.com")) {
        _, message, origin, mainFrame, _ ->
        if (mainFrame && origin.scheme == "https" && origin.host == "korealib.com") {
          val safeUrl = GoogleAuthLinks.authorizationUrl(message.data ?: "")
          if (safeUrl != null) {
            try { startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(safeUrl))) }
            catch (_: Exception) {
              webView.evaluateJavascript("window.dispatchEvent(new Event('myeongjak-auth-error'))", null)
            }
          }
        }
      }
      WebViewCompat.addWebMessageListener(webView, "MyeongjakAudioV2", setOf("https://korealib.com")) {
        _, message, origin, mainFrame, _ ->
        if (mainFrame && origin.scheme == "https" && origin.host == "korealib.com") {
          handleMessage(message.data ?: "")
        }
      }
    } else {
      Toast.makeText(this, "Android System WebView를 업데이트한 뒤 다시 열어 주세요.", Toast.LENGTH_LONG).show()
    }
    NarrationState.subscribe(observer)
    val container = FrameLayout(this).apply {
      setBackgroundColor(Color.WHITE)
      addView(webView, FrameLayout.LayoutParams(-1, -1))
    }
    ViewCompat.setOnApplyWindowInsetsListener(container) { view, insets ->
      val safe = insets.getInsets(WindowInsetsCompat.Type.systemBars() or
        WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
      view.setPadding(safe.left, safe.top, safe.right, safe.bottom)
      insets
    }
    setContentView(container)
    WindowCompat.getInsetsController(window, container).apply {
      isAppearanceLightStatusBars = true
      isAppearanceLightNavigationBars = true
    }
    ViewCompat.requestApplyInsets(container)
    webView.loadUrl(GoogleAuthLinks.webCallback(intent?.dataString ?: "") ?: "https://korealib.com")
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    GoogleAuthLinks.webCallback(intent.dataString ?: "")?.let { webView.loadUrl(it) }
  }

  private fun handleMessage(message: String) {
    try {
      val json = JSONObject(message)
      val action = json.getString("action")
      if (action == "state") { deliver(NarrationState.latest); return }
      if (action == "start") {
        val queue = NarrationQueue.parse(message)
        val token = PendingNarration.put(queue)
        ContextCompat.startForegroundService(this, Intent(this, PlaybackService::class.java)
          .setAction(PlaybackService.START).putExtra("token", token))
      } else if (action in setOf("pause", "resume", "previous", "next", "speed")) {
        startService(Intent(this, PlaybackService::class.java).setAction(action)
          .putExtra("speed", json.optDouble("speed", 0.8).toFloat()))
      }
    } catch (_: Exception) {
      Toast.makeText(this, "낭독을 준비하지 못했습니다. 책을 다시 열어 주세요.", Toast.LENGTH_LONG).show()
    }
  }

  private fun deliver(state: String) {
    if (!visible || android.net.Uri.parse(webView.url ?: "").host != "korealib.com") return
    webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('myeongjak-audio-state',{detail:$state}))", null)
  }

  override fun onResume() {
    super.onResume()
    visible = true
    webView.onResume()
    deliver(NarrationState.latest)
  }
  override fun onPause() {
    visible = false
    webView.onPause()
    super.onPause()
  }
  override fun onDestroy() {
    NarrationState.unsubscribe(observer)
    webView.destroy()
    super.onDestroy()
  }
}
