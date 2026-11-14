plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}
android {
  namespace = "com.myeongjak.library"
  compileSdk = 35
  defaultConfig {
    applicationId = "com.myeongjak.library"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "0.1.0"
  }
}
dependencies {
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.media3:media3-exoplayer:1.5.1")
  implementation("androidx.media3:media3-session:1.5.1")
}
