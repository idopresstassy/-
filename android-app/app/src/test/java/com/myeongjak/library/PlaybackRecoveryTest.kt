package com.myeongjak.library

import androidx.media3.common.PlaybackException
import androidx.media3.common.util.StuckPlayerException
import org.junit.Assert.*
import org.junit.Test
import java.io.IOException
import java.net.SocketTimeoutException

class PlaybackRecoveryTest {
  @Test fun recoversPlayerStallsWithoutNeedingANetworkError() {
    for (kind in listOf(
      StuckPlayerException.STUCK_BUFFERING_NOT_LOADING,
      StuckPlayerException.STUCK_BUFFERING_NO_PROGRESS,
      StuckPlayerException.STUCK_PLAYING_NO_PROGRESS,
      StuckPlayerException.STUCK_PLAYING_NOT_ENDING
    )) {
      assertTrue(PlaybackRecovery.canRetry(PlaybackException.ERROR_CODE_UNSPECIFIED,
        IllegalStateException(StuckPlayerException(kind, 10000))))
    }
  }
  @Test fun doesNotForceSuppressedPlaybackOrUnrelatedTimeoutsToResume() {
    assertFalse(PlaybackRecovery.canRetry(PlaybackException.ERROR_CODE_UNSPECIFIED,
      StuckPlayerException(StuckPlayerException.STUCK_SUPPRESSED, 10000)))
    assertFalse(PlaybackRecovery.canRetry(PlaybackException.ERROR_CODE_TIMEOUT, IllegalStateException()))
  }
  @Test fun backsOffWithoutAStoppingPageOrAttemptLimit() {
    assertEquals(listOf(1000L, 2000L, 5000L, 10000L, 15000L, 15000L),
      listOf(1, 2, 3, 4, 5, 100).map { PlaybackRecovery.delayMs(it) })
  }
  @Test fun retriesConnectionTimeouts() {
    assertTrue(PlaybackRecovery.canRetry(PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT, SocketTimeoutException()))
  }
  @Test fun retriesNestedTemporaryHttpErrors() {
    assertTrue(PlaybackRecovery.canRetry(PlaybackException.ERROR_CODE_IO_UNSPECIFIED, IOException(NarrationRequestException(503))))
    assertTrue(PlaybackRecovery.canRetry(PlaybackException.ERROR_CODE_IO_UNSPECIFIED, NarrationRequestException(429)))
  }
  @Test fun doesNotLoopRejectedRequests() {
    for (status in listOf(400, 401, 403, 404)) {
      assertFalse(PlaybackRecovery.canRetry(PlaybackException.ERROR_CODE_IO_UNSPECIFIED, NarrationRequestException(status)))
    }
  }
  @Test fun doesNotLoopDecoderFailures() {
    assertFalse(PlaybackRecovery.canRetry(PlaybackException.ERROR_CODE_DECODING_FAILED, IOException()))
  }
  @Test fun refreshesMissingTemporaryAudio() {
    assertTrue(PlaybackRecovery.canRetry(PlaybackException.ERROR_CODE_IO_FILE_NOT_FOUND, IOException()))
  }
}
