# 구글 드라이브 도서 연동 분석

## 확인 사항
- 구글 드라이브 문서 예시: https://docs.google.com/document/d/1zJow-NjTe6vzNiPwqQBaDPQ0PxBJtqyilEYNhPi3RZI/edit
- 문서 제목: "00001_주생전"
- 문서가 공개 접근 가능 (로그인 없이 열람 가능)

## 기존 방식 (압축 파일의 코드 기반)
- 관리자가 도서 추가 시 구글 드라이브 문서 URL을 입력
- 읽기 버튼 클릭 시 해당 구글 문서의 텍스트를 가져와 이북 뷰어에 표시
- 구글 문서 내용을 export 방식으로 가져옴 (plain text export)

## 구글 드라이브 문서 텍스트 export URL 패턴
- https://docs.google.com/document/d/{DOC_ID}/export?format=txt
- 이 방식으로 문서 본문 텍스트를 가져올 수 있음

## 구현 방향
1. books 테이블에 googleDriveUrl 필드 추가
2. 관리자 페이지에서 도서 추가/수정 시 구글 드라이브 URL 입력
3. 이북 뷰어에서 해당 URL의 텍스트를 fetch하여 페이지로 분할 표시
4. 기존 content 필드는 유지 (직접 입력도 가능하도록)
