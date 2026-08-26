# 명작무료책방 신규 운영 환경

이 프로젝트는 기존 Manus 운영 환경과 분리하여 다음 구조로 이전합니다.

| 구성 요소 | 서비스 | 용도 |
|---|---|---|
| 소스코드 | GitHub `idopresstassy/-` | 변경 이력 및 자동 배포 원본 |
| 웹 애플리케이션 | Render Web Service | React·Express·tRPC 서버 실행 |
| DB·인증·이미지 | Supabase | PostgreSQL, 회원 인증, `book-covers` 파일 버킷 |

## Render 기본 설정

Render에서 새 Web Service를 만들 때 `main` 브랜치, Singapore 리전, Node 런타임을 사용합니다. Root Directory는 비워 둡니다. Build Command는 `pnpm install --frozen-lockfile && pnpm run build`, Start Command는 `pnpm run start`입니다.

## 비밀값 관리

Supabase Project Settings → API에서 URL·anon key·service_role key를 확인합니다. Render에는 같은 프로젝트 URL을 `SUPABASE_URL`과 `VITE_SUPABASE_URL` 두 이름으로 넣고, anon key는 `VITE_SUPABASE_ANON_KEY`로 넣습니다. `SUPABASE_SERVICE_ROLE_KEY`는 Render 환경변수에만 넣으며, GitHub·브라우저·클라이언트 코드에 저장하지 않습니다.

## 데이터 복구

이전 DB 원본이 복구 불가능한 경우, 도서 TXT·표지 이미지·오디오북·웹툰 링크를 새 관리자 페이지에서 재등록합니다. 프로젝트의 SQL 스키마는 `supabase/migrations/20260826_0001_korealib_schema.sql`입니다.
