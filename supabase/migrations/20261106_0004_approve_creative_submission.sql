-- 관리자 승인 시 창작 원고를 공개 도서로 전환하는 원자적 함수.
create or replace function public.approve_creative_submission(
  p_submission_id bigint,
  p_reviewed_by uuid
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.creative_submissions%rowtype;
  v_book_id bigint;
begin
  select * into v_submission
  from public.creative_submissions
  where id = p_submission_id
  for update;

  if not found then
    raise exception '원고를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if v_submission.status <> 'pending' then
    raise exception '이미 검수된 원고입니다.' using errcode = 'P0001';
  end if;

  insert into public.books (title, author, genre, creative_genre, content, description)
  values (v_submission.title, v_submission.author_name, 'creative', v_submission.genre,
          v_submission.content, v_submission.description)
  returning id into v_book_id;

  update public.creative_submissions
  set status = 'approved', reviewed_by = p_reviewed_by,
      reviewed_at = now(), published_book_id = v_book_id
  where id = p_submission_id;

  return v_book_id;
end;
$$;

revoke all on function public.approve_creative_submission(bigint, uuid) from public, anon, authenticated;
grant execute on function public.approve_creative_submission(bigint, uuid) to service_role;
