# 창작 작품 출시 전 확인표 (2026-10-31)

## 현재 확인
- GitHub PR #1: draft 상태, main 미병합
- Supabase production SQL 실행 화면에서 Success 확인
- Table Editor에 public.creative_works가 있고 빈 테이블인 점 확인
- 기존 books의 SQL 조회 결과 252건 (마이그레이션 실행 **전** 기준)
- GitHub Actions verify 성공 (TypeScript check + build)
- 기존 관리자 .docx/.txt 자동 등록 기능은 이 변경 범위에 포함되지 않음

## 배포 전 필수 확인
1. **백업**: Supabase는 대시보드에 No backups 표시. 기존 books, profiles 등 운영 데이터를 별도 안전 장소에 백업하고 복구 가능성을 점검한다. 저장소 GitHub 소스코드는 DB 백업을 대체하지 않는다.
2. **기존 도서 수 재확인**: `SELECT COUNT(*) FROM public.books;` 재실행하여 252건인지 확인.
3. **DB 테이블 검증**: `SELECT COUNT(*) FROM public.creative_works;`는 초기값 0이어야 한다.
4. **Render**: 실제 배포 대상이 GitHub `idopresstassy/-`의 main인지, 자동 배포가 활성화되었는지, 기존 SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 설정이 유지되는지 확인. 키 원문을 대화·GitHub로 복사하지 않는다.
5. **PR**: 체크가 모두 통과하고 운영자 승인을 받은 후에만 draft → ready → merge.

## 배포 후 테스트 시나리오
1. 비로그인 방문자는 /creative 공개 작품 목록을 읽을 수 있지만 신규 등록은 로그인 안내만 보인다.
2. 일반 회원 A: 제목·필명·소설/시/수필/동화·소개·본문 입력, 임시 저장 후 내 작품 목록에 표시.
3. 회원 A: 본문이 있는 임시 작품을 승인 신청하면 pending 상태가 된다.
4. 일반 회원 B: 대기 중인 A의 작품을 읽을 수 없고 A의 작품을 수정할 수 없다.
5. 관리자: /admin/creative 페이지에서 pending 작품 전체를 읽고 승인/반려 가능.
6. 반려 시 회원 A에게 사유가 보이고 수정 후 재신청 가능.
7. 승인 시 /creative 공개 목록에 나타나고 비로그인 독자가 읽을 수 있다.
8. 관리자 메뉴, 기존 도서 목록, 검색, 내 책장, 독서 페이지가 기존대로 작동.
9. 실패 시 Render 이전 성공 배포로 롤백하되 DB 백업/복원 계획을 별도로 검토.

## 제한사항
- 작품 본문 텍스트 입력만 지원. DOCX/TXT 첨부·연재·원고 삭제·승인 후 개정은 추후 기능.
- 자동 CI 통과는 로그인·DB·운영 배포의 통합 테스트를 대체하지 않음.
