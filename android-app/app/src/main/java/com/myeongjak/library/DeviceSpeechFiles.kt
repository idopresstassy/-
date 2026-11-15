package com.myeongjak.library

import android.content.Context
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.io.File
import java.io.IOException
import java.util.Locale
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Converts quota fallback speech to a file so the same native player keeps its queue. */
class DeviceSpeechFiles(context: Context) {
  private val directory = File(context.cacheDir, "device-narration").apply { mkdirs() }
  private val ready = CountDownLatch(1)
  private val waits = ConcurrentHashMap<String, Pair<CountDownLatch, BooleanArray>>()
  private var initialized = false
  private val speech = TextToSpeech(context.applicationContext) { status ->
    initialized = status == TextToSpeech.SUCCESS
    ready.countDown()
  }
  init {
    speech.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
      override fun onStart(id: String?) { }
      override fun onDone(id: String?) { waits[id]?.let { it.second[0] = true; it.first.countDown() } }
      @Deprecated("Deprecated in Java")
      override fun onError(id: String?) { waits[id]?.first?.countDown() }
    })
  }
  @Synchronized fun synthesize(text: String): File {
    if (!ready.await(15, TimeUnit.SECONDS) || !initialized) throw IOException("기기 기본 음성을 사용할 수 없습니다.")
    if (speech.setLanguage(Locale.KOREAN) < TextToSpeech.LANG_AVAILABLE) throw IOException("한국어 기본 음성을 설치해 주세요.")
    speech.setSpeechRate(1f)
    val id = UUID.randomUUID().toString()
    val file = File(directory, "$id.wav")
    val wait = CountDownLatch(1) to booleanArrayOf(false)
    waits[id] = wait
    try {
      if (speech.synthesizeToFile(text, Bundle(), file, id) != TextToSpeech.SUCCESS ||
        !wait.first.await(60, TimeUnit.SECONDS) || !wait.second[0]) {
        file.delete()
        throw IOException("기기 기본 음성을 준비하지 못했습니다.")
      }
      directory.listFiles()?.sortedByDescending { it.lastModified() }?.drop(8)?.forEach { it.delete() }
      return file
    } finally { waits.remove(id) }
  }
  fun close() { speech.shutdown(); waits.values.forEach { it.first.countDown() } }
}
