-- Additive only: retain every book, member, submission, and reading record.
begin;
alter table public.books add column if not exists is_public boolean not null default true;
-- Restrictive policy also protects direct REST reads even when another permissive
-- SELECT policy exists. The server must enforce visibility because it uses service_role.
create policy "Hidden books are not publicly readable" on public.books
as restrictive for select to anon, authenticated using (is_public);

create table public.creative_visibility_log (
  id bigint generated always as identity primary key,
  book_id bigint references public.books(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  is_public boolean not null,
  note text not null check (char_length(trim(note)) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.creative_visibility_log enable row level security;
revoke all on public.creative_visibility_log from public, anon, authenticated;
grant all on public.creative_visibility_log to service_role;
grant usage, select on sequence public.creative_visibility_log_id_seq to service_role;

create function public.set_creative_book_visibility(
  p_book_id bigint, p_is_public boolean, p_reviewed_by uuid, p_note text
) returns void language plpgsql security invoker set search_path = public as $$
begin
  if not exists (select 1 from public.profiles where id = p_reviewed_by and role = 'admin') then
    raise exception '관리자 권한이 필요합니다.';
  end if;
  if p_is_public is null or p_note is null or char_length(trim(p_note)) not between 1 and 2000 then
    raise exception '처리 이유를 1~2000자로 적어주세요.';
  end if;
  update public.books set is_public = p_is_public where id = p_book_id and genre = 'creative';
  if not found then raise exception '창작 작품을 찾을 수 없습니다.'; end if;
  insert into public.creative_visibility_log(book_id, reviewed_by, is_public, note)
    values (p_book_id, p_reviewed_by, p_is_public, trim(p_note));
end; $$;
revoke all on function public.set_creative_book_visibility(bigint, boolean, uuid, text) from public, anon, authenticated;
grant execute on function public.set_creative_book_visibility(bigint, boolean, uuid, text) to service_role;
-- Profiles are the server authorization source. Members must never promote
-- themselves by changing role via the Data API. Keep self-service display name.
revoke update on public.profiles from public, anon, authenticated;
revoke update (role) on public.profiles from public, anon, authenticated;
grant update (name) on public.profiles to authenticated;
commit;
