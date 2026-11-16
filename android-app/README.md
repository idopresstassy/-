# 명작무료책방 Android 낭독 시험판 0.2.2

## What changed

The Media3 foreground service owns the remaining book text, a bounded audio queue,
HTTPS audio requests, the next-item transition, speed, audio focus and lock-screen controls.
It does not call a WebView to request the next clip. Closing the Activity or locking the
screen does not remove the queue. Reopening the reader mirrors the service's current position.

The website hands over text/layout metadata once using an origin-scoped, main-frame-only
WebMessage bridge. It never sends Google or Supabase credentials to the app. Each native
loader request uses the existing server readerAudio.getOrCreate endpoint, preserving the
server's cache key, validation and monthly character budget. Only the current and two next
clips are added to the native media playlist. Quota/configuration fallback uses Android's
Korean device speech, synthesized to a temporary file for the same native queue.

## Build / validation

Java 17, Android SDK 36 and Gradle 8.11.1:

```
gradle -p android-app testDebugUnitTest assembleDebug assembleDebugAndroidTest
gradle -p android-app connectedDebugAndroidTest
```

GitHub Actions sends a six-clip queue through the real origin-scoped WebView bridge,
runs six local two-second WAV clips through the real MediaSessionService,
locks the API 35 emulator and destroys the Activity/WebView. It asserts all six clips
finish and later transitions occurred while the screen was off. The fixture does not use
Google Cloud or consume narration quota. Test resolver injection is internal, debug-only,
and cannot be selected through web messages or Intents.

The test APK is attached only after the screen-off test succeeds. This is not a Play Store
release, and real Galaxy power/network conditions still need device confirmation.

## Device check

1. Install the generated test APK and open 명작무료책방.
2. Open 돈 (90003), tap 듣기 and confirm the settings say 앱에서 연속 낭독 중.
3. Lock the phone while a paragraph plays. Listen across at least three paragraphs and a page.
4. Pause/resume from lock-screen controls; reopen the book and check the highlighted position.
5. Compare the selected Cloud voice and speed, and check the normal web reader still works.

The original draft PR #5 forwarded each clip's end back to the WebView. This implementation
replaces that design; the old draft must not be merged alongside this version.

## 0.2.1: recovery during a long book

The service retries transient network/server/storage failures with delays capped at 15 seconds,
refreshing signed audio URLs and preserving the current clip/position. User pauses, audio-focus
loss, and headset disconnects cancel recovery. Decoder failures and rejected API requests remain
visible errors. There is no page-count stop or whole-book audio generation.

Regression coverage includes a 12-minute, 180-clip / 90-test-page queue with the screen locked and
Activity destroyed. Repeated HTTP 503 responses are injected at clip 24 and a missing temporary
file at clip 60. All clips must play, both failures must recover without a tap, and a separate
pause test must prevent automatic restarts. Local generated WAV fixtures incur no cloud TTS cost.
The short six-clip test is retained. Real Galaxy/network behavior still needs device confirmation.

Test APKs use ephemeral CI debug signing. Updating an older test APK may require uninstalling
that test app first; this clears local app data, not server books or membership. Store releases
must use a retained release/upload signing key instead.

## 0.2.2: actual MP3 transitions and a stuck player

The phone successfully fetched the reported short quote and subsequent audio, so the exact
Galaxy failure is not yet isolated. Previous 0.2.1 tests used WAV clips and only exercised
network errors. They did not establish that actual Cloud MP3 transitions work on the device.

Update Media3 from 1.5.1 to 1.11.1, explicitly enable its internal no-progress (10 seconds),
not-ending (10 seconds past duration) and buffering-no-progress (90 seconds) detection, and
retry recognized StuckPlayerException states with the existing position-preserving recovery.
Suppression/focus and user pause are excluded. This hardens a known missing recovery path;
it does not claim that this specific Galaxy stop was reproduced. Native state includes the
app version, actual playing state, buffer position and suppression reason for diagnosis.

MoneyAudioTest uses five original cached 24 kHz Cloud MP3 files from 돈 around the reported
quote, plays at 0.8x with the screen off and Activity destroyed, checks every clip progresses
and page 12 is reached, and repeats with a 45-second next-file delay. It makes no Cloud TTS
calls. The dedicated workflow targets API 36; API 37 is unavailable in this CI SDK repository.
The full API 35 suite retains the 12-minute retry/pause tests. Real Galaxy confirmation is
still required before calling the reported issue resolved.
