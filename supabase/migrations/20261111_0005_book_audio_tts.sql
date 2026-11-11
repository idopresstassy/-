-- Book reader on-demand speech cache and monthly character guard.
create table public.book_audio_cache (
  cache_key text primary key,
  book_id bigint not null references public.books(id) on delete cascade,
  page_number integer not null check (page_number >= 0),
  sentence_number integer not null check (sentence_number >= 0),
  voice_name text not null,
  source_hash text not null,
  storage_path text not null,
  status text not null check (status in ('generating', 'ready', 'failed')),
  lease_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.book_audio_monthly_usage (
  month_start date primary key,
  characters_used integer not null default 0 check (characters_used >= 0),
  updated_at timestamptz not null default now()
);

alter table public.book_audio_cache enable row level security;
alter table public.book_audio_monthly_usage enable row level security;
revoke all on public.book_audio_cache, public.book_audio_monthly_usage from anon, authenticated;
grant all on public.book_audio_cache, public.book_audio_monthly_usage to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-audio', 'book-audio', false, 52428800, array['audio/mpeg'])
on conflict (id) do update set public = false, allowed_mime_types = array['audio/mpeg'];

create or replace function public.reserve_book_audio(
  p_cache_key text,
  p_book_id bigint,
  p_page_number integer,
  p_sentence_number integer,
  p_voice_name text,
  p_source_hash text,
  p_storage_path text,
  p_characters integer
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cache public.book_audio_cache%rowtype;
  v_month date := date_trunc('month', now() at time zone 'UTC')::date;
  v_used integer;
begin
  if p_characters < 1 or p_characters > 4000 then
    raise exception 'Invalid synthesis character count';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_cache_key, 0));
  select * into v_cache from public.book_audio_cache where cache_key = p_cache_key for update;

  if found and v_cache.status = 'ready' then
    return jsonb_build_object('status', 'ready', 'storage_path', v_cache.storage_path);
  end if;
  if found and v_cache.status = 'generating' and v_cache.lease_until > now() then
    return jsonb_build_object('status', 'pending');
  end if;

  insert into public.book_audio_monthly_usage (month_start, characters_used)
  values (v_month, 0) on conflict (month_start) do nothing;
  update public.book_audio_monthly_usage
     set characters_used = characters_used + p_characters, updated_at = now()
   where month_start = v_month and characters_used + p_characters <= 900000
   returning characters_used into v_used;
  if not found then
    return jsonb_build_object('status', 'quota');
  end if;

  insert into public.book_audio_cache (
    cache_key, book_id, page_number, sentence_number, voice_name,
    source_hash, storage_path, status, lease_until
  ) values (
    p_cache_key, p_book_id, p_page_number, p_sentence_number, p_voice_name,
    p_source_hash, p_storage_path, 'generating', now() + interval '5 minutes'
  ) on conflict (cache_key) do update set
    status = 'generating', lease_until = excluded.lease_until,
    storage_path = excluded.storage_path, updated_at = now();

  return jsonb_build_object('status', 'generate', 'month_characters', v_used);
end;
$$;

create or replace function public.finish_book_audio(p_cache_key text, p_storage_path text)
returns void language sql security invoker set search_path = public as $$
  update public.book_audio_cache
     set status = 'ready', storage_path = p_storage_path, lease_until = null, updated_at = now()
   where cache_key = p_cache_key;
$$;

create or replace function public.fail_book_audio(p_cache_key text, p_characters integer, p_release_usage boolean)
returns void language plpgsql security invoker set search_path = public as $$
declare v_month date := date_trunc('month', now() at time zone 'UTC')::date;
begin
  update public.book_audio_cache set status = 'failed', lease_until = null, updated_at = now()
   where cache_key = p_cache_key;
  if p_release_usage then
    update public.book_audio_monthly_usage
       set characters_used = greatest(0, characters_used - p_characters), updated_at = now()
     where month_start = v_month;
  end if;
end;
$$;

create or replace function public.get_book_audio_monthly_usage()
returns integer language sql security invoker set search_path = public as $$
  select coalesce((select characters_used from public.book_audio_monthly_usage
    where month_start = date_trunc('month', now() at time zone 'UTC')::date), 0);
$$;

revoke all on function public.reserve_book_audio(text,bigint,integer,integer,text,text,text,integer) from public, anon, authenticated;
revoke all on function public.finish_book_audio(text,text) from public, anon, authenticated;
revoke all on function public.fail_book_audio(text,integer,boolean) from public, anon, authenticated;
revoke all on function public.get_book_audio_monthly_usage() from public, anon, authenticated;
grant execute on function public.reserve_book_audio(text,bigint,integer,integer,text,text,text,integer) to service_role;
grant execute on function public.finish_book_audio(text,text) to service_role;
grant execute on function public.fail_book_audio(text,integer,boolean) to service_role;
grant execute on function public.get_book_audio_monthly_usage() to service_role;

comment on table public.book_audio_cache is 'Private cached MP3 files keyed to the book, displayed page, sentence and Google TTS voice.';
comment on table public.book_audio_monthly_usage is 'Monthly Google Cloud Text-to-Speech character usage, capped at 900,000.';
