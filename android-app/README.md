# 명작무료책방 Android 낭독 시험판 0.2.0

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

Java 17, Android SDK 35 and Gradle 8.9:

```
gradle -p android-app testDebugUnitTest assembleDebug assembleDebugAndroidTest
gradle -p android-app connectedDebugAndroidTest
```

GitHub Actions runs six local two-second WAV clips through the real MediaSessionService,
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
