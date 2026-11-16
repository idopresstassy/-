package com.myeongjak.library

import androidx.media3.common.PlaybackException
import androidx.media3.common.util.StuckPlayerException
import androidx.media3.datasource.HttpDataSource
import java.io.IOException

/** Never treat a pause, an audio-focus change or the end of a book as a retry. */
object PlaybackRecovery {
  fun delayMs(attempt: Int): Long = when (attempt) {
    1 -> 1000L
    2 -> 2000L
    3 -> 5000L
    4 -> 10000L
    else -> 15000L
  }

  fun canRetry(error: PlaybackException): Boolean = canRetry(error.errorCode, error.cause)

  fun canRetry(code: Int, cause: Throwable?): Boolean {
    val causes = generateSequence(cause) { it.cause }.take(12).toList()
    // A decoder/renderer can stop advancing without a network IOException.
    // Media3 reports this only after checking real playback/loading progress.
    // Suppressed playback must never be forced to resume (e.g. audio focus).
    causes.filterIsInstance<StuckPlayerException>().firstOrNull()?.let {
      return it.stuckType in setOf(
        StuckPlayerException.STUCK_BUFFERING_NOT_LOADING,
        StuckPlayerException.STUCK_BUFFERING_NO_PROGRESS,
        StuckPlayerException.STUCK_PLAYING_NO_PROGRESS,
        StuckPlayerException.STUCK_PLAYING_NOT_ENDING
      )
    }
    // A rejected API request (e.g. bad input or authorization) must not loop.
    causes.filterIsInstance<NarrationRequestException>().firstOrNull()?.let {
      return it.status == 408 || it.status == 429 || it.status in 500..599
    }
    // A stored file URL may have expired or been replaced. Resolve a fresh URL.
    causes.filterIsInstance<HttpDataSource.InvalidResponseCodeException>().firstOrNull()?.let {
      return it.responseCode in setOf(403, 404, 408, 429) || it.responseCode in 500..599
    }
    return code in setOf(
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED,
      PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT
    ) || (code == PlaybackException.ERROR_CODE_IO_UNSPECIFIED && causes.any { it is IOException }) ||
      (code == PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND)
  }
}

class NarrationRequestException(val status: Int) : IOException("Narration HTTP $status")
