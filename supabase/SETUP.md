# 명작무료책방 Supabase 초기 설정

새 환경에서는 Supabase가 **PostgreSQL 데이터베이스**, **사용자 인증**, **도서 표지 이미지 저장소**를 맡습니다. 웹사이트 서버는 별도 Render 서비스에서 실행하며, 관리자 작업과 비로그인 방문 통계 기록은 서버만 Supabase의 서비스 키로 처리합니다.

## 1. 스키마 만들기

Supabase 프로젝트의 왼쪽 메뉴에서 **SQL Editor**를 열고, `supabase/migrations/20260826_0001_korealib_schema.sql` 전체를 붙여 넣어 실행합니다. 이 작업은 도서, 읽기 진행도, 책갈피, 서재, 통계, 후원 정보 테이블 및 `book-covers` 이미지 버킷을 만듭니다.

## 2. 첫 관리자 지정

사이트에서 회원 가입을 한 뒤, SQL Editor에서 아래 SQL의 이메일을 실제 관리자 이메일로 바꾸어 실행합니다.

```sql
update public.profiles
set role = 'admin'
where email = '관리자_이메일_주소';
```

## 3. Render에만 넣을 비밀값

Supabase Dashboard의 **Project Settings → API**에서 아래 값을 확인합니다. `SUPABASE_URL`과 `SUPABASE_ANON_KEY`는 웹 앱 설정에 사용하고, `SUPABASE_SERVICE_ROLE_KEY`는 Render 서버의 비밀 환경변수에만 저장합니다. 서비스 역할 키는 브라우저, GitHub, 소스코드에 절대 기록하지 않습니다.

```text
SUPABASE_URL=https://[프로젝트ID].supabase.co
SUPABASE_ANON_KEY=[anon key]
SUPABASE_SERVICE_ROLE_KEY=[service_role key]
```

## 4. 데이터 복구 원칙

이전 환경의 운영 DB 데이터가 없으면, 도서 TXT 원고와 표지·오디오북·웹툰 링크를 새 관리자 페이지에서 다시 등록합니다. 소스코드는 GitHub 저장소에서 이어서 관리합니다.
