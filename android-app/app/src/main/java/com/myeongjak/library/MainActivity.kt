package com.myeongjak.library

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.ContextCompat
import java.lang.ref.WeakReference

class MainActivity : Activity() {
  private lateinit var webView: WebView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    webView = WebView(this).apply {
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      settings.mediaPlaybackRequiresUserGesture = true
      addJavascriptInterface(AudioBridge(this@MainActivity), "MyeongjakAudio")
      webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
          val uri = request.url
          if (uri.host == "korealib.com" || uri.host?.endsWith(".korealib.com") == true) return false
          startActivity(Intent(Intent.ACTION_VIEW, uri))
          return true
        }
      }
    }
    activeWebView = WeakReference(webView)
    setContentView(webView)
    webView.loadUrl("https://korealib.com")
  }

  override fun onDestroy() {
    activeWebView.clear()
    webView.destroy()
    super.onDestroy()
  }

  inner class AudioBridge(private val activity: Activity) {
    @JavascriptInterface fun playTrack(url: String, title: String, speed: Float) {
      if (!url.startsWith("https://")) return
      val intent = Intent(activity, PlaybackService::class.java)
        .setAction(PlaybackService.ACTION_PLAY)
        .putExtra(PlaybackService.EXTRA_URL, url)
        .putExtra(PlaybackService.EXTRA_TITLE, title)
        .putExtra(PlaybackService.EXTRA_SPEED, speed)
      ContextCompat.startForegroundService(activity, intent)
    }
    @JavascriptInterface fun pause() {
      activity.startService(Intent(activity, PlaybackService::class.java).setAction(PlaybackService.ACTION_PAUSE))
    }
    @JavascriptInterface fun resume() {
      activity.startService(Intent(activity, PlaybackService::class.java).setAction(PlaybackService.ACTION_RESUME))
    }
    @JavascriptInterface fun setSpeed(speed: Float) {
      activity.startService(Intent(activity, PlaybackService::class.java).setAction(PlaybackService.ACTION_SPEED).putExtra(PlaybackService.EXTRA_SPEED, speed))
    }
  }

  companion object {
    @Volatile private var activeWebView = WeakReference<WebView>(null)
    fun notifyWebAudioEnded() {
      activeWebView.get()?.post {
        activeWebView.get()?.evaluateJavascript("window.dispatchEvent(new Event('myeongjak-native-audio-ended'))", null)
      }
    }
  }
}
