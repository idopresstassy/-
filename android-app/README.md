# Myeongjak Library Android background audio

This Android shell opens the existing library website and exposes a native Media3 foreground playback service to the reader WebView. The web reader sends each cached/generated audio clip to the service; Media3 owns the active audio session and lock-screen controls.

## Current state

- The Reader now sends each generated Google TTS clip to the native foreground media service when it runs inside this app.
- When a clip ends, the service notifies the reader so it can continue with the next clip while the display is locked.
- This project is a test build, not a Play Store release. A signed release and physical Android device test are still required.

## Build

Open this folder in Android Studio, let Gradle sync, then run the app configuration on an Android device. The service needs network access to fetch the existing cached TTS audio URLs.
