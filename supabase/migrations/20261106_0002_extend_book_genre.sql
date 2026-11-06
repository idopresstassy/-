-- 회원 창작 원고 접수와 관리자 검수를 위한 추가 스키마.
alter type public.book_genre add value if not exists 'creative';

