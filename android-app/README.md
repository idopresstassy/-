# Myeongjak Library Android background audio

This Android shell opens the existing library website and exposes a native Media3 foreground playback service to the reader WebView. The web reader sends each cached/generated audio clip to the service; Media3 owns the active audio session and lock-screen controls.

## Current state

- Android project scaffold and Media3 service are present.
- The Reader web UI still needs the native bridge integration and device testing before this app can be used for continuous book playback.
- This project is a test build, not a Play Store release. A signed release and Android device test are still required.

## Build

Open this folder in Android Studio, let Gradle sync, then run the app configuration on an Android device. The service needs network access to fetch the existing cached TTS audio URLs.
