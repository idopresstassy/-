package com.myeongjak.library

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Handler
import android.os.Looper
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.MimeTypes
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultDataSource
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.datasource.ResolvingDataSource
import androidx.media3.exoplayer.DefaultLoadControl
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap

class PlaybackService : MediaSessionService() {
  private lateinit var player: ExoPlayer
  private lateinit var speech: DeviceSpeechFiles
  private var mediaSession: MediaSession? = null
  private var queue: NarrationQueue? = null
  private var sourceFactory: ProgressiveMediaSource.Factory? = null
  private var appended = 0
  private var error: String? = null
  private val deviceVoices = ConcurrentHashMap.newKeySet<Int>()
  private val handler = Handler(Looper.getMainLooper())
  private val ticker = object : Runnable {
    override fun run() { publish(); handler.postDelayed(this, 1000) }
  }

  override fun onCreate() {
    super.onCreate()
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel(CHANNEL, "오디오 낭독", NotificationManager.IMPORTANCE_LOW))
    setMediaNotificationProvider(DefaultMediaNotificationProvider.Builder(this)
      .setNotificationId(NOTIFICATION).setChannelId(CHANNEL).build())
    speech = DeviceSpeechFiles(this)
    player = ExoPlayer.Builder(this)
      .setLoadControl(DefaultLoadControl.Builder().setBufferDurationsMs(15000, 30000, 1000, 1500).build())
      .build().apply {
        setAudioAttributes(AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build(), true)
        setHandleAudioBecomingNoisy(true)
        setWakeMode(C.WAKE_MODE_NETWORK)
        addListener(object : Player.Listener {
          override fun onMediaItemTransition(item: MediaItem?, reason: Int) {
            appendUpcoming()
            publish()
          }
          override fun onPlaybackStateChanged(state: Int) { publish() }
          override fun onIsPlayingChanged(isPlaying: Boolean) { publish() }
          override fun onPlayerError(playbackError: PlaybackException) {
            error = "음성을 불러오지 못했습니다. 인터넷 연결을 확인하고 재생을 눌러 주세요."
            publish()
          }
        })
      }
    val openApp = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    mediaSession = MediaSession.Builder(this, player).setSessionActivity(openApp).build()
    handler.post(ticker)
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val result = super.onStartCommand(intent, flags, startId)
    when (intent?.action) {
      START -> {
        // Show a media notification before a slow first synthesis can exceed the foreground deadline.
        startForeground(NOTIFICATION, Notification.Builder(this, CHANNEL)
          .setSmallIcon(android.R.drawable.ic_media_play).setContentTitle("명작무료책방")
          .setContentText("낭독 준비 중").setCategory(Notification.CATEGORY_TRANSPORT).build())
        val next = PendingNarration.take(intent.getStringExtra("token"))
        if (next == null) { stopSelf(); return result }
        player.stop()
        player.clearMediaItems()
        queue = next
        appended = 0
        error = null
        deviceVoices.clear()
        val http = DefaultHttpDataSource.Factory().setConnectTimeoutMs(15000).setReadTimeoutMs(30000)
        val data = ResolvingDataSource.Factory(DefaultDataSource.Factory(this, http), AudioResolverFactory.create(next, speech, deviceVoices))
        sourceFactory = ProgressiveMediaSource.Factory(data)
        appendUpcoming()
        player.setPlaybackSpeed(next.speed)
        player.prepare()
        player.play()
      }
      "pause" -> player.pause()
      "resume" -> {
        error = null
        if (player.playerError != null) player.prepare()
        player.play()
      }
      "next" -> if (player.hasNextMediaItem()) player.seekToNextMediaItem()
      "previous" -> if (player.hasPreviousMediaItem()) player.seekToPreviousMediaItem()
      "speed" -> player.setPlaybackSpeed(intent.getFloatExtra("speed", 0.8f).coerceIn(0.8f, 1.5f))
    }
    publish()
    return result
  }

  private fun appendUpcoming() {
    val book = queue ?: return
    val factory = sourceFactory ?: return
    val current = player.currentMediaItemIndex.coerceAtLeast(0)
    // At most current + two future clips can trigger the server resolver.
    val until = (current + 3).coerceAtMost(book.rows.size)
    while (appended < until) {
      val index = appended++
      val item = MediaItem.Builder().setMediaId(index.toString())
        .setUri("https://korealib.com/native-narration/$index")
        .setMimeType(MimeTypes.AUDIO_MPEG)
        .setMediaMetadata(MediaMetadata.Builder().setTitle(book.title).setArtist("명작무료책방")
          .setDisplayTitle(book.title).setSubtitle("${index + 1} / ${book.rows.size} 문단").build()).build()
      // The URI is resolved inside the service's loader; it is never fetched as a web route.
      player.addMediaSource(factory.createMediaSource(item))
    }
  }

  private fun publish() {
    val book = queue ?: return
    val index = player.currentMediaItemIndex.coerceIn(0, book.rows.lastIndex)
    val row = book.rows[index]
    val duration = player.duration.takeIf { it != C.TIME_UNSET && it > 0 } ?: 0
    NarrationState.publish(JSONObject().put("bookId", book.bookId).put("sentenceId", row.id)
      .put("index", index).put("positionMs", player.currentPosition).put("durationMs", duration)
      .put("speed", player.playbackParameters.speed).put("playing", player.playWhenReady && player.playbackState != Player.STATE_ENDED && error == null)
      .put("loading", player.playbackState == Player.STATE_BUFFERING).put("finished", player.playbackState == Player.STATE_ENDED)
      .put("deviceVoice", deviceVoices.contains(index)).put("error", error ?: JSONObject.NULL))
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    mediaSession?.release()
    player.release()
    speech.close()
    mediaSession = null
    super.onDestroy()
  }
  companion object {
    const val START = "com.myeongjak.library.START_QUEUE"
    private const val CHANNEL = "reader-narration"
    private const val NOTIFICATION = 1001
  }
}
