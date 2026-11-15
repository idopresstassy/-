package com.myeongjak.library

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject

class MainActivity : Activity() {
  private lateinit var webView: WebView
  private var visible = false
  private val observer: (String) -> Unit = { state ->
    if (visible) runOnUiThread { deliver(state) }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
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
        override fun onPageFinished(view: WebView, url: String) { deliver(NarrationState.latest) }
      }
    }
    if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
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
    setContentView(webView)
    webView.loadUrl("https://korealib.com")
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
  @Deprecated("Deprecated in Java")
  override fun onBackPressed() {
    if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
  }
  override fun onDestroy() {
    NarrationState.unsubscribe(observer)
    webView.destroy()
    super.onDestroy()
  }
}
