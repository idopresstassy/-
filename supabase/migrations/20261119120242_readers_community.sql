-- All community data travels through authenticated server procedures. Direct
-- Data API access is denied, including private titles and read receipts.
create table public.community_members (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20 and position('@' in nickname)=0)
);
create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('notice','talk','request','private')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null,
  nickname text not null check (char_length(nickname) between 2 and 20 and position('@' in nickname)=0),
  author_is_admin boolean not null default false,
  book_id bigint references public.books(id) on delete set null,
  book_title text,
  is_pinned boolean not null default false check (not is_pinned or category='notice'),
  is_hidden boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_deleted or char_length(body) between 1 and 20000)
);
create table public.community_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  nickname text not null check (char_length(nickname) between 2 and 20 and position('@' in nickname)=0),
  author_is_admin boolean not null default false,
  is_hidden boolean not null default false,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_deleted or char_length(body) between 1 and 3000)
);
create table public.community_reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.community_posts(id) on delete cascade,
  last_read_at timestamptz not null,
  primary key (user_id,post_id)
);
create index community_posts_owner on public.community_posts(user_id,created_at desc);
create index community_posts_public on public.community_posts(is_pinned desc,created_at desc,id desc) where not is_deleted and not is_hidden and category<>'private';
create index community_posts_book on public.community_posts(book_id);
create index community_comments_post on public.community_comments(post_id,created_at,id);
create index community_comments_author on public.community_comments(user_id,created_at desc);
create index community_reads_post on public.community_reads(post_id);

alter table public.community_members enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_reads enable row level security;
revoke all on public.community_members,public.community_posts,public.community_comments,public.community_reads from public,anon,authenticated;
grant select,insert,update,delete on public.community_members,public.community_posts,public.community_comments,public.community_reads to service_role;
create policy community_members_server on public.community_members to service_role using (true) with check (true);
create policy community_posts_server on public.community_posts to service_role using (true) with check (true);
create policy community_comments_server on public.community_comments to service_role using (true) with check (true);
create policy community_reads_server on public.community_reads to service_role using (true) with check (true);

create view public.community_post_summaries with (security_invoker=true) as
select p.*, c.comment_count, c.answered, c.last_reply_at
from public.community_posts p
cross join lateral (
  select count(*) as comment_count, coalesce(bool_or(author_is_admin),false) as answered,
    max(created_at) filter (where user_id<>p.user_id) as last_reply_at
  from public.community_comments where post_id=p.id and not is_deleted and not is_hidden
) c where not p.is_deleted;
revoke all on public.community_post_summaries from public,anon,authenticated;
grant select on public.community_post_summaries to service_role;

create function public.community_unread_count(p_actor uuid) returns integer
language sql stable security invoker set search_path='' as $$
  select count(*)::integer from public.community_post_summaries p
  left join public.community_reads r on r.post_id=p.id and r.user_id=p_actor
  where p.user_id=p_actor and not p.is_hidden and p.last_reply_at is not null
    and (r.last_read_at is null or p.last_reply_at>r.last_read_at);
$$;
revoke all on function public.community_unread_count(uuid) from public,anon,authenticated;
grant execute on function public.community_unread_count(uuid) to service_role;

-- Atomic writes re-check the trusted actor's current database role, ownership,
-- private-thread access, edit version and posting rate. Never accepts a role or
-- owner from request payload. Only the service role can call this function.
create function public.community_write(p_actor uuid,p_action text,p_id uuid,p_payload jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare
  v_admin boolean;
  v_post public.community_posts%rowtype;
  v_comment public.community_comments%rowtype;
  v_id uuid;
  v_nickname text;
  v_book_title text;
  v_book_id bigint;
  v_category text;
begin
  select role='admin' into v_admin from public.profiles where id=p_actor;
  if not found then raise exception '로그인이 필요합니다.'; end if;
  if p_action in ('create_post','create_comment') then
    perform pg_advisory_xact_lock(hashtextextended(p_actor::text,7901));
    v_nickname:=case when v_admin then '책방지기' else btrim(p_payload->>'nickname') end;
    if v_nickname is null or char_length(v_nickname) not between 2 and 20 or v_nickname !~ '^[[:alnum:]_ 가-힣]+$' then
      raise exception '닉네임은 2~20자의 글자, 숫자, 공백, 밑줄로 입력해 주세요.';
    end if;
    if not v_admin and (v_nickname ~ '(관리자|운영자|책방지기|명작무료책방)') then
      raise exception '운영자로 오해할 수 없는 다른 닉네임을 사용해 주세요.';
    end if;
  end if;
  if p_action='create_post' then
    v_category:=p_payload->>'category';
    if v_category='notice' and not v_admin then raise exception '공지사항은 관리자만 작성할 수 있습니다.'; end if;
    if not v_admin and ((select count(*) from public.community_posts where user_id=p_actor and created_at>now()-interval '10 minutes')>=5
      or (select count(*) from public.community_posts where user_id=p_actor and created_at>now()-interval '1 day')>=50) then
      raise exception '글을 너무 자주 작성하셨습니다. 잠시 후 다시 작성해 주세요.';
    end if;
    v_book_id:=(p_payload->>'bookId')::bigint;
    if v_book_id is not null then
      select title into v_book_title from public.books where id=v_book_id and is_public;
      if not found then raise exception '문의할 도서를 찾을 수 없습니다.'; end if;
    end if;
    insert into public.community_posts(user_id,category,title,body,nickname,author_is_admin,book_id,book_title)
    values(p_actor,v_category,btrim(p_payload->>'title'),btrim(p_payload->>'body'),v_nickname,v_admin,v_book_id,v_book_title)
    returning id into v_id;
  elsif p_action in ('create_comment','update_post','delete_post','moderate_post','mark_read') then
    select * into v_post from public.community_posts where id=p_id and not is_deleted for update;
    if not found or (v_post.category='private' and v_post.user_id<>p_actor and not v_admin)
       or (v_post.is_hidden and v_post.user_id<>p_actor and not v_admin) then
      raise exception '글을 찾을 수 없거나 볼 수 없는 글입니다.';
    end if;
    v_id:=p_id;
    if p_action='create_comment' then
      if v_post.is_hidden then raise exception '숨긴 글에는 댓글을 작성할 수 없습니다.'; end if;
      if not v_admin and ((select count(*) from public.community_comments where user_id=p_actor and created_at>now()-interval '1 minute')>=10
        or (select count(*) from public.community_comments where user_id=p_actor and created_at>now()-interval '1 day')>=200) then
        raise exception '댓글을 너무 자주 작성하셨습니다. 잠시 후 다시 작성해 주세요.';
      end if;
      insert into public.community_comments(post_id,user_id,body,nickname,author_is_admin)
      values(p_id,p_actor,btrim(p_payload->>'body'),v_nickname,v_admin) returning id into v_id;
    elsif p_action='update_post' then
      if v_post.user_id<>p_actor or v_post.is_hidden then raise exception '본인의 공개 중인 글만 수정할 수 있습니다.'; end if;
      if v_post.updated_at is distinct from (p_payload->>'expectedUpdatedAt')::timestamptz then raise exception using errcode='40001',message='글이 변경되었습니다.'; end if;
      update public.community_posts set title=btrim(p_payload->>'title'),body=btrim(p_payload->>'body'),updated_at=clock_timestamp() where id=p_id;
    elsif p_action='delete_post' then
      if v_post.user_id<>p_actor then raise exception '본인의 글만 삭제할 수 있습니다.'; end if;
      update public.community_posts set is_deleted=true,body='',title='삭제된 글',nickname='삭제한 독자',book_title=null,updated_at=clock_timestamp() where id=p_id;
      update public.community_comments set is_deleted=true,body='',nickname='삭제한 독자',updated_at=clock_timestamp() where post_id=p_id;
    elsif p_action='moderate_post' then
      if not v_admin then raise exception '관리자 권한이 필요합니다.'; end if;
      if coalesce((p_payload->>'isPinned')::boolean,false) and v_post.category<>'notice' then raise exception '공지사항만 상단에 고정할 수 있습니다.'; end if;
      update public.community_posts set is_hidden=coalesce((p_payload->>'isHidden')::boolean,is_hidden),
        is_pinned=coalesce((p_payload->>'isPinned')::boolean,is_pinned),updated_at=clock_timestamp() where id=p_id;
    else
      if v_post.user_id=p_actor then
        insert into public.community_reads(user_id,post_id,last_read_at)
          values(p_actor,p_id,least((p_payload->>'through')::timestamptz,clock_timestamp()))
        on conflict(user_id,post_id) do update set last_read_at=greatest(community_reads.last_read_at,excluded.last_read_at);
      end if;
    end if;
  elsif p_action in ('update_comment','delete_comment','moderate_comment') then
    -- Take the parent lock first, matching post deletion and comment creation.
    select p.* into v_post from public.community_posts p join public.community_comments c on c.post_id=p.id
      where c.id=p_id and not p.is_deleted and not c.is_deleted for update of p;
    if not found or (v_post.category='private' and v_post.user_id<>p_actor and not v_admin)
      or (v_post.is_hidden and v_post.user_id<>p_actor and not v_admin) then raise exception '글을 찾을 수 없거나 볼 수 없는 글입니다.'; end if;
    select * into v_comment from public.community_comments where id=p_id and not is_deleted for update;
    if not found then raise exception '댓글을 찾을 수 없습니다.'; end if;
    v_id:=p_id;
    if p_action='moderate_comment' then
      if not v_admin then raise exception '관리자 권한이 필요합니다.'; end if;
      update public.community_comments set is_hidden=(p_payload->>'isHidden')::boolean,updated_at=clock_timestamp() where id=p_id;
    else
      if v_comment.user_id<>p_actor then raise exception '본인의 댓글만 변경할 수 있습니다.'; end if;
      if p_action='delete_comment' then
        update public.community_comments set is_deleted=true,body='',nickname='삭제한 독자',updated_at=clock_timestamp() where id=p_id;
      else
        if v_post.is_hidden or v_comment.is_hidden then raise exception '숨긴 글이나 댓글은 수정할 수 없습니다.'; end if;
        if v_comment.updated_at is distinct from (p_payload->>'expectedUpdatedAt')::timestamptz then raise exception using errcode='40001',message='댓글이 변경되었습니다.'; end if;
        update public.community_comments set body=btrim(p_payload->>'body'),updated_at=clock_timestamp() where id=p_id;
      end if;
    end if;
  else raise exception '지원하지 않는 요청입니다.';
  end if;
  if p_action in ('create_post','create_comment') then
    insert into public.community_members(user_id,nickname) values(p_actor,v_nickname)
    on conflict(user_id) do update set nickname=excluded.nickname;
  end if;
  return v_id;
end;
$$;
revoke all on function public.community_write(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.community_write(uuid,text,uuid,jsonb) to service_role;
