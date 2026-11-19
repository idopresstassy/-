package com.myeongjak.library

import org.junit.Assert.*
import org.junit.Test
import java.net.URLEncoder

class GoogleAuthLinksTest {
  private val attempt = "abcde123-abcd-abcd-abcd-123456789abc"
  private val callback = "com.myeongjak.library://auth/callback?attempt=$attempt"
  private val authorize = "https://xzjywznaeszgbjyppfxa.supabase.co/auth/v1/authorize?provider=google&code_challenge_method=s256&code_challenge=" + "a".repeat(43) + "&redirect_to=" + URLEncoder.encode(callback, "UTF-8")

  @Test fun allowsOnlyGooglePkceForOurProjectAndApp() {
    assertEquals(authorize, GoogleAuthLinks.authorizationUrl(authorize))
    for (url in listOf(
      authorize.replace(".supabase.co", ".supabase.co.evil.example"),
      authorize.replace("provider=google", "provider=github"),
      authorize.replace("method=s256", "method=plain"),
      authorize.replace("https:", "http:"),
      authorize.replace("redirect_to=", "redirect_to=https://evil.example&ignored="),
      "$authorize&provider=google"
    )) assertNull(url, GoogleAuthLinks.authorizationUrl(url))
  }
  @Test fun forwardsOnlyCodeAndBoundAttempt() {
    assertEquals("https://korealib.com/auth/callback?attempt=$attempt&code=abcdef123456", GoogleAuthLinks.webCallback("$callback&code=abcdef123456"))
    assertEquals("https://korealib.com/auth/callback?attempt=$attempt&sb_flow_id=1234567890&code=abcdef123456", GoogleAuthLinks.webCallback("$callback&sb_flow_id=1234567890&code=abcdef123456"))
    assertEquals("https://korealib.com/auth/callback?attempt=$attempt&error=cancelled", GoogleAuthLinks.webCallback("$callback&error=access_denied&error_description=private"))
  }
  @Test fun rejectsTokensHostSpoofingAndArbitraryNavigation() {
    for (url in listOf(
      "$callback&code=abcdef123456&next=https://evil.example",
      "$callback&access_token=secret&refresh_token=secret",
      "$callback#access_token=secret", "$callback&code=a", "$callback&code=abcdef123456&code=other",
      callback.replace("auth/callback", "auth.evil.example/callback") + "&code=abcdef123456",
      callback.replace("auth/callback", "evil@auth/callback") + "&code=abcdef123456",
      callback.replace("attempt=$attempt", "attempt=../other") + "&code=abcdef123456"
    )) assertNull(url, GoogleAuthLinks.webCallback(url))
  }
}
