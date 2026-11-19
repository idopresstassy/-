-- Integration regression: generated fixtures only; ALWAYS rolls everything back.
-- Run with the migration owner after applying readers_community.
begin;
do $$
declare
  member_id uuid:=gen_random_uuid(); other_id uuid:=gen_random_uuid(); admin_id uuid:=gen_random_uuid();
  private_id uuid; public_id uuid; notice_id uuid; reply_id uuid; another_id uuid;
  old_version timestamptz; read_time timestamptz; failed boolean; obj text; role_name text; n integer;
begin
  foreach role_name in array array['anon','authenticated'] loop
    foreach obj in array array['community_members','community_posts','community_comments','community_reads','community_post_summaries'] loop
      if has_table_privilege(role_name,'public.'||obj,'SELECT,INSERT,UPDATE,DELETE') then raise exception 'Direct access unexpectedly granted: % %',role_name,obj; end if;
    end loop;
    if has_function_privilege(role_name,'public.community_write(uuid,text,uuid,jsonb)','EXECUTE') or has_function_privilege(role_name,'public.community_unread_count(uuid)','EXECUTE') then raise exception 'RPC exposed to %',role_name; end if;
  end loop;
  if not has_function_privilege('service_role','public.community_write(uuid,text,uuid,jsonb)','EXECUTE') then raise exception 'Service RPC inaccessible'; end if;
  insert into auth.users(id) values(member_id),(other_id),(admin_id);
  update public.profiles set role='admin' where id=admin_id;
  private_id:=public.community_write(member_id,'create_post',null,jsonb_build_object('category','private','title','비공개 시험 제목','body','비공개 시험 내용','nickname','시험독자','user_id',other_id,'author_is_admin',true));
  if not exists(select 1 from public.community_posts where id=private_id and user_id=member_id and not author_is_admin) then raise exception 'Actor injection'; end if;
  failed:=false; begin
    perform public.community_write(other_id,'create_comment',private_id,'{"body":"침입","nickname":"다른독자"}');
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Private reply access allowed'; end if;
  failed:=false; begin
    perform public.community_write(other_id,'create_post',null,'{"category":"notice","title":"가짜공지","body":"본문","nickname":"다른독자"}');
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Member notice allowed'; end if;
  failed:=false; begin
    perform public.community_write(other_id,'create_post',null,'{"category":"talk","title":"가짜관리자","body":"본문","nickname":"관리자"}');
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Reserved nickname allowed'; end if;
  notice_id:=public.community_write(admin_id,'create_post',null,'{"category":"notice","title":"시험공지","body":"공지본문","nickname":"ignored"}');
  perform public.community_write(admin_id,'moderate_post',notice_id,'{"isPinned":true}');
  if not exists(select 1 from public.community_posts where id=notice_id and is_pinned and nickname='책방지기' and author_is_admin) then raise exception 'Admin identity or pin failed'; end if;
  reply_id:=public.community_write(admin_id,'create_comment',private_id,'{"body":"관리자 답변","nickname":"ignored"}');
  if public.community_unread_count(member_id)<>1 or public.community_unread_count(other_id)<>0 then raise exception 'Unread scope'; end if;
  select created_at into read_time from public.community_comments where id=reply_id;
  perform public.community_write(member_id,'mark_read',private_id,jsonb_build_object('through',read_time));
  if public.community_unread_count(member_id)<>0 then raise exception 'Read acknowledgement failed'; end if;
  another_id:=public.community_write(admin_id,'create_comment',private_id,'{"body":"새 답변","nickname":"ignored"}');
  update public.community_comments set created_at=clock_timestamp()+interval '1 millisecond' where id=another_id;
  perform public.community_write(member_id,'mark_read',private_id,jsonb_build_object('through',read_time));
  if public.community_unread_count(member_id)<>1 then raise exception 'Old read receipt swallowed newer reply'; end if;
  select updated_at into old_version from public.community_posts where id=private_id;
  perform public.community_write(member_id,'update_post',private_id,jsonb_build_object('title','수정제목','body','수정본문','expectedUpdatedAt',old_version,'category','talk'));
  if not exists(select 1 from public.community_posts where id=private_id and category='private' and title='수정제목') then raise exception 'Privacy changed during edit'; end if;
  failed:=false; begin
    perform public.community_write(member_id,'update_post',private_id,jsonb_build_object('title','덮어쓰기','body','충돌','expectedUpdatedAt',old_version));
  exception when serialization_failure then failed:=true; end;
  if not failed then raise exception 'Stale update allowed'; end if;
  failed:=false; begin
    perform public.community_write(other_id,'delete_post',private_id,'{}');
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Other member deletion allowed'; end if;
  failed:=false; begin
    perform public.community_write(member_id,'moderate_post',private_id,'{"isHidden":true}');
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Member moderation allowed'; end if;
  perform public.community_write(admin_id,'moderate_comment',reply_id,'{"isHidden":true}');
  if exists(select 1 from public.community_comments where id=reply_id and not is_hidden) then raise exception 'Comment hide failed'; end if;
  perform public.community_write(admin_id,'moderate_comment',reply_id,'{"isHidden":false}');
  perform public.community_write(admin_id,'moderate_post',private_id,'{"isHidden":true}');
  failed:=false; begin
    perform public.community_write(member_id,'create_comment',private_id,'{"body":"숨긴글댓글","nickname":"시험독자"}');
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Hidden post accepts comments'; end if;
  perform public.community_write(admin_id,'moderate_post',private_id,'{"isHidden":false}');
  public_id:=public.community_write(member_id,'create_post',null,jsonb_build_object('category','request','title','공개 문의','body','도서 문의','nickname','시험독자','bookId',(select id from public.books where is_public order by id limit 1)));
  if not exists(select 1 from public.community_posts where id=public_id and book_title is not null) then raise exception 'Book link failed'; end if;
  for n in 1..10 loop
    perform public.community_write(other_id,'create_comment',public_id,'{"body":"공개댓글","nickname":"다른독자"}');
  end loop;
  failed:=false; begin
    perform public.community_write(other_id,'create_comment',public_id,'{"body":"초과댓글","nickname":"다른독자"}');
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Comment rate limit failed'; end if;
  for n in 1..3 loop
    perform public.community_write(member_id,'create_post',null,'{"category":"talk","title":"빈도시험","body":"본문","nickname":"시험독자"}');
  end loop;
  failed:=false; begin
    perform public.community_write(member_id,'create_post',null,'{"category":"talk","title":"초과글","body":"본문","nickname":"시험독자"}');
  exception when raise_exception then failed:=true; end;
  if not failed then raise exception 'Post rate limit failed'; end if;
  perform public.community_write(member_id,'delete_post',private_id,'{}');
  if exists(select 1 from public.community_post_summaries where id=private_id) or exists(select 1 from public.community_comments where post_id=private_id and (body<>'' or not is_deleted)) then raise exception 'Delete failed to clear thread'; end if;
  if not exists(select 1 from public.community_posts where id=private_id and body='' and title='삭제된 글' and is_deleted) then raise exception 'Post content remains'; end if;
end;
$$;
-- Actual permission probes: neither unauthenticated nor signed-in Data API roles
-- may bypass the server by selecting tables or calling the service RPC.
set local role anon;
do $$ begin
  begin perform 1 from public.community_posts limit 1; raise check_violation using message='Anonymous SELECT unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  begin perform public.community_write(gen_random_uuid(),'create_post',null,'{}'); raise check_violation using message='Anonymous RPC unexpectedly succeeded'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ begin
  begin perform 1 from public.community_post_summaries limit 1; raise check_violation using message='Member SELECT unexpectedly succeeded'; exception when insufficient_privilege then null; end;
  begin perform public.community_unread_count(gen_random_uuid()); raise check_violation using message='Member RPC unexpectedly succeeded'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'community access, moderation, rate, conflict, privacy and deletion checks passed; fixtures rolled back' as result;
