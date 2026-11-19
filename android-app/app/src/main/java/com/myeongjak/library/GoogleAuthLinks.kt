package com.myeongjak.library

import java.net.URI
import java.net.URLDecoder
import java.net.URLEncoder

/** Only our Supabase Google PKCE flow may leave the WebView through the auth bridge. */
object GoogleAuthLinks {
  private val attemptPattern = Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
  private fun params(uri: URI): Map<String, String> {
    val parts = (uri.rawQuery ?: "").split("&").filter { it.isNotEmpty() }.map {
      val pair = it.split("=", limit = 2)
      URLDecoder.decode(pair[0], "UTF-8") to URLDecoder.decode(pair.getOrElse(1) { "" }, "UTF-8")
    }
    require(parts.map { it.first }.distinct().size == parts.size)
    return parts.toMap()
  }
  private fun callback(raw: String): Pair<URI, Map<String, String>> {
    require(raw.length < 8192)
    val uri = URI(raw)
    require(uri.scheme == "com.myeongjak.library" && uri.host == "auth" && uri.path == "/callback")
    require(uri.userInfo == null && uri.port == -1 && uri.fragment == null)
    val values = params(uri)
    require(attemptPattern.matches(values["attempt"] ?: ""))
    values["sb_flow_id"]?.let { require(Regex("[A-Za-z0-9_-]{8,64}").matches(it)) }
    return uri to values
  }
  fun authorizationUrl(raw: String): String? = runCatching {
    require(raw.length < 12000)
    val uri = URI(raw)
    require(uri.scheme == "https" && uri.host == "xzjywznaeszgbjyppfxa.supabase.co" && uri.path == "/auth/v1/authorize")
    require(uri.userInfo == null && uri.port == -1 && uri.fragment == null)
    val values = params(uri)
    require(values["provider"] == "google")
    require(values["code_challenge_method"]?.lowercase() == "s256")
    require(Regex("[A-Za-z0-9_-]{43}").matches(values["code_challenge"] ?: ""))
    val (_, redirect) = callback(values["redirect_to"] ?: "")
    require(redirect.keys.all { it in setOf("attempt", "sb_flow_id") })
    raw
  }.getOrNull()

  /** No access/refresh tokens, arbitrary destination, or error description enters the WebView. */
  fun webCallback(raw: String): String? = runCatching {
    val (_, values) = callback(raw)
    require(values.keys.all { it in setOf("attempt", "sb_flow_id", "code", "error", "error_code", "error_description") })
    val safe = linkedMapOf("attempt" to values.getValue("attempt"))
    values["sb_flow_id"]?.let { safe["sb_flow_id"] = it }
    if (values.containsKey("error")) safe["error"] = "cancelled"
    else {
      val code = values["code"] ?: error("Missing authorization code")
      require(Regex("[A-Za-z0-9_-]{10,2048}").matches(code))
      safe["code"] = code
    }
    "https://korealib.com/auth/callback?" + safe.entries.joinToString("&") {
      it.key + "=" + URLEncoder.encode(it.value, "UTF-8")
    }
  }.getOrNull()
}
