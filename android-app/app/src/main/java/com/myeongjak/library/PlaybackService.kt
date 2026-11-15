package com.myeongjak.library

import android.content.Intent
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

class PlaybackService : MediaSessionService() {
  private var player: ExoPlayer? = null
  private var mediaSession: MediaSession? = null

  override fun onCreate() {
    super.onCreate()
    val exoPlayer = ExoPlayer.Builder(this).build()
    player = exoPlayer
    exoPlayer.addListener(object : Player.Listener {
      override fun onPlaybackStateChanged(playbackState: Int) {
        if (playbackState == Player.STATE_ENDED) MainActivity.notifyWebAudioEnded()
      }
    })
    mediaSession = MediaSession.Builder(this, exoPlayer).build()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = mediaSession

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val result = super.onStartCommand(intent, flags, startId)
    val exoPlayer = player ?: return result
    when (intent?.action) {
      ACTION_PLAY -> {
        val url = intent.getStringExtra(EXTRA_URL) ?: return result
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "명작무료책방 낭독"
        val speed = intent.getFloatExtra(EXTRA_SPEED, 0.8f)
        val item = MediaItem.Builder().setUri(url)
          .setMediaMetadata(MediaMetadata.Builder().setTitle(title).setArtist("명작무료책방").build())
          .build()
        exoPlayer.setMediaItem(item)
        exoPlayer.setPlaybackSpeed(speed.coerceIn(0.8f, 1.5f))
        exoPlayer.prepare()
        exoPlayer.play()
      }
      ACTION_PAUSE -> exoPlayer.pause()
      ACTION_RESUME -> exoPlayer.play()
      ACTION_SPEED -> exoPlayer.setPlaybackSpeed(intent.getFloatExtra(EXTRA_SPEED, 0.8f).coerceIn(0.8f, 1.5f))
    }
    return result
  }

  override fun onDestroy() {
    mediaSession?.release()
    player?.release()
    mediaSession = null
    player = null
    super.onDestroy()
  }

  companion object {
    const val ACTION_PLAY = "com.myeongjak.library.PLAY"
    const val ACTION_PAUSE = "com.myeongjak.library.PAUSE"
    const val ACTION_RESUME = "com.myeongjak.library.RESUME"
    const val ACTION_SPEED = "com.myeongjak.library.SPEED"
    const val EXTRA_URL = "url"
    const val EXTRA_TITLE = "title"
    const val EXTRA_SPEED = "speed"
  }
}
