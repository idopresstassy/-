/** Don't expose raw provider responses or internal configuration in the login form. */
export function authErrorMessage(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case "invalid_credentials":
      return "이메일 또는 비밀번호가 맞지 않습니다. 다시 확인해 주세요.";
    case "email_not_confirmed":
      return "가입할 때 받은 인증 이메일을 먼저 확인해 주세요. 스팸함도 확인해 주세요.";
    case "user_already_exists":
    case "email_exists":
      return "이미 가입한 이메일입니다. 이메일 로그인이나 비밀번호 찾기를 이용해 주세요.";
    case "weak_password":
      return "비밀번호가 너무 단순합니다. 영문과 숫자를 섞어 8자 이상으로 입력해 주세요.";
    case "email_address_invalid":
      return "이메일 주소를 다시 확인해 주세요.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "요청이 많아 잠시 기다려야 합니다. 조금 뒤에 다시 시도해 주세요.";
    case "signup_disabled":
      return "지금은 신규 가입을 잠시 쉬고 있습니다. 가입 없이 책을 읽을 수 있습니다.";
    case "provider_disabled":
    case "oauth_provider_not_supported":
      return "지금은 Google 연결을 사용할 수 없습니다. 이메일로 이용해 주세요.";
    default:
      return "연결을 완료하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.";
  }
}

export function isEmbeddedBrowser(userAgent: string) {
  return /; wv\)|\bKAKAOTALK\b|NAVER\(inapp\)|Instagram|FBAN|FBAV/i.test(
    userAgent
  );
}
