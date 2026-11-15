plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}
android {
  namespace = "com.myeongjak.library"
  compileSdk = 35
  buildFeatures { buildConfig = true }
  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions { jvmTarget = "17" }
  defaultConfig {
    applicationId = "com.myeongjak.library"
    minSdk = 26
    targetSdk = 35
    versionCode = 2
    versionName = "0.2.0"
    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
  }
}
dependencies {
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.webkit:webkit:1.12.1")
  androidTestImplementation("androidx.test:runner:1.6.2")
  androidTestImplementation("androidx.test:rules:1.6.1")
  androidTestImplementation("androidx.test.ext:junit:1.2.1")
  androidTestImplementation("androidx.test.uiautomator:uiautomator:2.3.0")
  testImplementation("junit:junit:4.13.2")
  testImplementation("org.json:json:20240303")
  implementation("androidx.media3:media3-exoplayer:1.5.1")
  implementation("androidx.media3:media3-session:1.5.1")
}
