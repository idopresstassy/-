# 도서 뷰어 오디오 낭독 시험 설정

## Google Cloud 설정

1. Google Cloud 프로젝트에서 Cloud Text-to-Speech API를 사용 설정하고 결제 계정을 연결합니다.
2. Text-to-Speech 호출 권한이 있는 서비스 계정을 만들고 JSON 키를 발급합니다.
3. JSON 키 파일은 GitHub나 웹사이트 파일에 올리지 않습니다.

## Render 환경 변수

Render의 `korealib-library` 서비스에서 **Environment**에 다음 값을 추가한 뒤 서비스를 다시 배포합니다.

| 변수 | 시험값 |
| --- | --- |
| `GOOGLE_TTS_SERVICE_ACCOUNT_JSON` | 서비스 계정 JSON 전체 내용 |
| `GOOGLE_TTS_VOICE_NAME` | `ko-KR-Chirp3-HD-Achernar` |
| `GOOGLE_TTS_PILOT_BOOK_ID` | `3540034` |

`3540034`는 현재 등록된 **행복한 왕자**입니다. 시험 중에는 이 책만 Google 음성을 생성하고, 다른 책은 브라우저 기본 음성으로 읽습니다. 시험을 마친 뒤 전체 도서에 열려면 `GOOGLE_TTS_PILOT_BOOK_ID` 값을 `all`로 바꿉니다.

음성 이름은 환경 변수에서 바꿀 수 있습니다. Google이 지원하는 한국어 Chirp 3 HD 이름 예: `ko-KR-Chirp3-HD-Achernar`, `ko-KR-Chirp3-HD-Kore`, `ko-KR-Chirp3-HD-Charon`.

## 데이터베이스 준비

배포 전에 Supabase SQL Editor에서 `supabase/migrations/20261111_0005_book_audio_tts.sql`을 실행합니다. 이 migration은 비공개 `book-audio` 버킷, 문장 캐시, 월간 사용량 제한을 추가합니다. 기존 도서와 회원 행은 변경하지 않습니다.

## 브라우저에서 시험

1. 사이트에서 **행복한 왕자**를 열고 뷰어 상단의 스피커 아이콘을 누릅니다.
2. **듣기**를 눌러 첫 문장을 듣고, 읽는 문장이 노란색으로 표시되는지 확인합니다.
3. 일시정지 후 다시 듣기, 이전·다음 문장, 속도 0.8~1.5배, 문장 직접 누르기를 확인합니다.
4. 페이지 마지막까지 들으면 다음 페이지로 넘어가는지 확인합니다.
5. 듣기를 멈추고 페이지를 새로 열어 다시 듣기를 눌러 저장한 위치에서 이어지는지 확인합니다.
6. 다시 듣기를 반복해도 같은 문장의 음성 파일이 캐시에서 재사용되는지 확인합니다.
7. 관리자 화면 대시보드에서 이번 달 문자 사용량을 확인합니다.

문장 캐시는 책 ID, 페이지, 문장 순서, 음성 이름과 원문 지문을 기준으로 하며 비공개 저장소에서 서명된 주소로 재생됩니다. 월 900,000자에 도달하면 Google 음성 생성을 멈추고 브라우저 음성으로 전환합니다. 구글 드라이브 책은 해당 문서가 웹 서버에서 읽을 수 있도록 공유되어 있어야 합니다.
