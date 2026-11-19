# 간편 가입과 Google 로그인

## 변경 내용

- `/login`에 가입 없이 읽기, 이메일 로그인/가입 탭, 비밀번호 보기, 한국어 오류 안내, 인증 메일 재발송(60초 대기).
- 기존 이메일 가입의 인증·비밀번호 재설정 방식, 회원 ID와 책장 데이터는 유지.
- `/auth/v1/settings`에서 `external.google === true`일 때만 Google 버튼 노출. 확인 실패나 미설정 상태에서는 정상 작동하는 이메일과 비회원 읽기를 제공.
- Google 로그인은 계정마다 최초 동의가 필요함. 앱 설치만으로 가입시키지 않음.
- Google 전용 PKCE 클라이언트는 시도별 저장 공간을 사용. 코드 교환 후 기존 Supabase 클라이언트에 세션을 전달하고 임시 인증 자료를 삭제. 기존 이메일 인증 클라이언트의 흐름은 변경하지 않음.
- 이메일이 다르면 별개 계정. 같은 이메일의 신원 연결은 Supabase의 검증된 기본 정책에 맡김. 클라이언트가 회원 ID, 관리자 권한을 변경하지 않음.
- Android 1.1.0/versionCode 6: Google 인증은 기기의 외부 브라우저에서 진행한 뒤 앱으로 복귀. 앱 링크에는 일회용 코드만 사용하고 PKCE 검증은 원래 앱 안에서 수행. 구버전 WebView에서는 Google 버튼을 실행하지 않음. 이메일 로그인과 비회원 읽기는 구버전에서도 사용 가능.

## 운영자가 완료해야 하는 Google 연결

2026-11-19 확인 시 korealib 프로젝트의 Google 제공자는 비활성화 상태였다. 코드 배포만으로 OAuth 클라이언트가 생성되거나 Google 로그인이 활성화되지는 않는다.

1. Google Auth Platform에서 명작무료책방의 OAuth 웹 클라이언트를 생성/확인한다. 기존 음성 합성용 API 키나 서비스 계정 JSON은 로그인용 키가 아니다.
2. 승인된 자바스크립트 원본: `https://korealib.com`.
3. Google의 승인된 리디렉션 URI: `https://xzjywznaeszgbjyppfxa.supabase.co/auth/v1/callback`.
4. Google 동의 화면의 앱 이름, 지원 이메일 `idopublishingcompan@gmail.com`, 홈페이지 `https://korealib.com`, 개인정보처리방침 `https://korealib.com/privacy`를 확인한다. 범위는 `openid`, 이메일, 기본 프로필만 사용한다. 모든 고객이 이용하려면 테스트 사용자 한정 상태를 해제해야 한다.
5. Supabase → Authentication → URL Configuration: Site URL은 `https://korealib.com`. 기존 이메일 재설정 URL을 유지하면서 다음 주소를 Redirect URLs에 추가한다. `?attempt=…` 쿼리를 포함하므로 경로 뒤 와일드카드가 필요하다.
   - `https://korealib.com/auth/callback**`
   - `com.myeongjak.library://auth/callback**`
6. Supabase → Authentication → Sign In / Providers → Google에 웹 클라이언트 ID와 Secret을 넣고 활성화한다. Secret은 Supabase 설정에만 저장한다. Render의 VITE 환경 변수, GitHub, 채팅에 입력하지 않는다. Skip nonce check는 켜지 않는다.
7. 위 설정이 끝나면 로그인 페이지를 새로 열어 Google 버튼을 확인한다. Android는 versionCode 6 이상 앱 업데이트 후 테스트한다. Play 배포 파일은 기존 업로드 키로 서명해야 한다.

## 검증

- TypeScript, Vitest, Vite 빌드 및 GitHub Android 단위 테스트·릴리스 빌드·탐색 회귀 검사를 실행한다.
- 웹: 가입 없이 책 읽기 → 책 목록. 이메일 가입 탭 → 8자 이상/이메일 입력만 요구, 인증 메일 안내, 비밀번호 표시·숨기기. 기존 이메일 로그인·비밀번호 찾기 유지.
- Google 설정 후 실제 사용자 동의로 최초 가입과 재로그인을 테스트한다. 돌아온 페이지에서 로그인 상태, 내 책장, 원래 독자마당 글쓰기 경로를 확인한다. 취소/만료/다른 브라우저로 연 콜백은 로그인되지 않아야 한다.
- Android: Google 버튼 → 외부 브라우저 → 계정 선택 → 책방 앱 자동 복귀 → 앱 종료·재실행 후 로그인 유지. 기존 뒤로 가기와 화면을 끈 상태의 낭독을 확인한다.
- 같은 검증된 이메일로 Google 연결 시 기존 회원의 내 책장과 관리자 권한이 유지되는지 실제 계정으로 확인한다. 다른 이메일은 별도 계정이라는 점을 안내한다.
- Google 연결이 꺼져 있을 때와 네트워크 오류 때 이메일/비회원 이용이 계속 가능한지 확인한다.

## 검증 한계

OAuth 제공자와 Google 클라이언트 연결 전에는 실제 Google 로그인 성공 및 동의 화면 테스트를 완료할 수 없다. 모의 응답 테스트는 실제 Google 로그인 성공을 뜻하지 않는다. 서비스 역할 키·회원 테이블·보유 도서는 변경하지 않았다.
