-- Run after ../schema.sql. Account-owned reading data and group/community features.
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followed_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint follows_not_self check (follower_id <> followed_id)
);
create index if not exists follows_followed_idx on public.follows (followed_id, created_at desc);

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);
create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid references public.profiles(id) on delete set null,
  post_id uuid references public.community_posts(id) on delete set null,
  reason text not null check (char_length(trim(reason)) between 5 and 1000),
  status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reader-media', 'reader-media', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "reader media is publicly readable" on storage.objects for select
using (bucket_id = 'reader-media');
create policy "users upload to their own media folder" on storage.objects for insert to authenticated
with check (bucket_id = 'reader-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update their own media" on storage.objects for update to authenticated
using (bucket_id = 'reader-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'reader-media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete their own media" on storage.objects for delete to authenticated
using (bucket_id = 'reader-media' and (storage.foldername(name))[1] = auth.uid()::text);

create table if not exists public.reader_books (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null,
  title text not null check (char_length(trim(title)) between 1 and 180),
  author text not null default '' check (char_length(author) <= 140),
  cover_url text not null default '',
  total_pages integer not null default 0 check (total_pages >= 0),
  current_page integer not null default 0 check (current_page >= 0),
  status text not null default 'reading' check (status in ('planned','reading','finished','paused')),
  description text not null default '' check (char_length(description) <= 1200),
  started_at date,
  finished_at date,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_updated_at timestamptz not null default now(),
  unique (user_id, client_id),
  check (total_pages = 0 or current_page <= total_pages)
);
create index if not exists reader_books_owner_idx on public.reader_books (user_id, updated_at desc);

create table if not exists public.book_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.reader_books(id) on delete cascade,
  client_id text not null,
  kind text not null check (kind in ('quote','note','opinion')),
  body text not null check (char_length(trim(body)) between 1 and 5000),
  book_title text not null default '',
  book_author text not null default '',
  page_number integer check (page_number is null or page_number > 0),
  visibility text not null default 'private' check (visibility in ('private','group','public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  client_updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists book_entries_book_idx on public.book_entries (book_id, created_at desc);

create table if not exists public.reading_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.reader_books(id) on delete cascade,
  client_id text not null,
  pages_read integer not null check (pages_read > 0),
  start_page integer check (start_page is null or start_page >= 0),
  end_page integer check (end_page is null or end_page >= 0),
  reflection text not null default '' check (char_length(reflection) <= 2000),
  session_date date not null default current_date,
  created_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists reading_sessions_owner_date_idx on public.reading_sessions (user_id, session_date desc);

create table if not exists public.reader_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 2 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  invite_code text not null unique,
  created_at timestamptz not null default now()
);
alter table public.book_entries add column if not exists group_id uuid references public.reader_groups(id) on delete set null;

create table if not exists public.group_members (
  group_id uuid not null references public.reader_groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','moderator','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id, joined_at desc);

create table if not exists public.reading_challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.reader_groups(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  book_title text not null check (char_length(trim(book_title)) between 1 and 180),
  book_author text not null default '' check (char_length(book_author) <= 140),
  cover_url text not null default '',
  duration_days integer not null check (duration_days between 1 and 366),
  daily_pages integer not null check (daily_pages between 1 and 2000),
  start_date date not null default current_date,
  prize text not null default '' check (char_length(prize) <= 500),
  consequence text not null default '' check (char_length(consequence) <= 500),
  rules text not null default '' check (char_length(rules) <= 2000),
  status text not null default 'active' check (status in ('draft','active','completed','cancelled')),
  created_at timestamptz not null default now()
);
create index if not exists reading_challenges_group_idx on public.reading_challenges (group_id, created_at desc);

create table if not exists public.challenge_progress (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.reading_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null,
  pages_read integer not null check (pages_read between 1 and 2000),
  summary text not null default '' check (char_length(summary) <= 3000),
  proof_shared boolean not null default false,
  reading_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_id)
);
create index if not exists challenge_progress_challenge_date_idx on public.challenge_progress (challenge_id, reading_date desc);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.reader_groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists group_messages_group_created_idx on public.group_messages (group_id, created_at desc);

create table if not exists public.group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.reader_groups(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  progress_id uuid references public.challenge_progress(id) on delete set null,
  body text not null check (char_length(trim(body)) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists group_posts_group_created_idx on public.group_posts (group_id, created_at desc);

create table if not exists public.group_post_reactions (
  post_id uuid not null references public.group_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.group_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.group_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists group_post_comments_post_created_idx on public.group_post_comments (post_id, created_at asc);

create or replace function public.is_reader_group_member(target_group uuid, target_user uuid default auth.uid())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = target_group and user_id = target_user
  );
$$;
revoke all on function public.is_reader_group_member(uuid, uuid) from public;
grant execute on function public.is_reader_group_member(uuid, uuid) to authenticated;

-- Joining is only possible with the invite code, and the caller's identity is taken from Supabase Auth.
create or replace function public.join_reader_group(invite text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare found_group uuid;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select id into found_group from public.reader_groups where invite_code = upper(trim(invite));
  if found_group is null then raise exception 'Group invite code not found'; end if;
  insert into public.group_members (group_id, user_id, role)
  values (found_group, auth.uid(), 'member') on conflict do nothing;
  return found_group;
end;
$$;
revoke all on function public.join_reader_group(text) from public;
grant execute on function public.join_reader_group(text) to authenticated;

alter table public.follows enable row level security;
alter table public.user_blocks enable row level security;
alter table public.user_reports enable row level security;
alter table public.reader_books enable row level security;
alter table public.book_entries enable row level security;
alter table public.reading_sessions enable row level security;
alter table public.reader_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.reading_challenges enable row level security;
alter table public.challenge_progress enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_posts enable row level security;
alter table public.group_post_reactions enable row level security;
alter table public.group_post_comments enable row level security;

-- Let visitors read follower lists and counts for public profiles without
-- making private profile relationships visible.
create or replace function public.is_public_profile(target_profile uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles where id = target_profile and is_public
  );
$$;
revoke all on function public.is_public_profile(uuid) from public;
grant execute on function public.is_public_profile(uuid) to authenticated;

drop policy if exists "profiles are visible when public or self" on public.profiles;
create policy "profiles are visible when public or self" on public.profiles for select
using (is_public or auth.uid() = id or exists (
  select 1 from public.follows where follower_id = auth.uid() and followed_id = id
));
create policy "users can follow public profiles" on public.follows for insert to authenticated
with check (follower_id = auth.uid() and followed_id <> auth.uid() and exists (
  select 1 from public.profiles where id = followed_id and is_public
));
create policy "users can unfollow" on public.follows for delete to authenticated using (follower_id = auth.uid());
create policy "follow lists are visible for public profiles" on public.follows for select to authenticated using (
  follower_id = auth.uid() or followed_id = auth.uid() or public.is_public_profile(followed_id)
);
create policy "users manage blocks they create" on public.user_blocks for all to authenticated
using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());
create policy "users submit reports" on public.user_reports for insert to authenticated
with check (reporter_id = auth.uid());
create policy "users read reports they submitted" on public.user_reports for select to authenticated
using (reporter_id = auth.uid());

create policy "owners manage their books" on public.reader_books for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "public books are visible on public profiles" on public.reader_books for select to authenticated
using (is_public and exists (select 1 from public.profiles where id = user_id and is_public));
create policy "owners manage their entries" on public.book_entries for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "shared entries can be read" on public.book_entries for select to authenticated
using ((visibility = 'public' and exists (select 1 from public.profiles p where p.id = user_id and p.is_public))
  or (visibility = 'group' and group_id is not null and public.is_reader_group_member(group_id)));
create policy "owners manage their reading sessions" on public.reading_sessions for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "members can read their groups" on public.reader_groups for select to authenticated
using (owner_id = auth.uid() or public.is_reader_group_member(id));
create policy "signed in users create groups" on public.reader_groups for insert to authenticated
with check (owner_id = auth.uid());
create policy "group owners update groups" on public.reader_groups for update to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "group owners delete groups" on public.reader_groups for delete to authenticated
using (owner_id = auth.uid());
create policy "members read member lists" on public.group_members for select to authenticated
using (public.is_reader_group_member(group_id));
create policy "group owners add themselves" on public.group_members for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.reader_groups g where g.id = group_id and g.owner_id = auth.uid()));
create policy "members leave groups" on public.group_members for delete to authenticated
using (user_id = auth.uid() or exists (select 1 from public.reader_groups g where g.id = group_id and g.owner_id = auth.uid()));

create policy "members read challenges" on public.reading_challenges for select to authenticated
using (public.is_reader_group_member(group_id));
create policy "members create challenges" on public.reading_challenges for insert to authenticated
with check (created_by = auth.uid() and public.is_reader_group_member(group_id));
create policy "challenge creator manages challenge" on public.reading_challenges for update to authenticated
using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "challenge creator deletes challenge" on public.reading_challenges for delete to authenticated
using (created_by = auth.uid());
create policy "members read challenge progress" on public.challenge_progress for select to authenticated
using (public.is_reader_group_member((select c.group_id from public.reading_challenges c where c.id = challenge_id)));
create policy "users manage own challenge progress" on public.challenge_progress for all to authenticated
using (user_id = auth.uid() and public.is_reader_group_member((select c.group_id from public.reading_challenges c where c.id = challenge_id)))
with check (user_id = auth.uid() and public.is_reader_group_member((select c.group_id from public.reading_challenges c where c.id = challenge_id)));

create policy "members read group messages" on public.group_messages for select to authenticated
using (public.is_reader_group_member(group_id));
create policy "members send group messages" on public.group_messages for insert to authenticated
with check (author_id = auth.uid() and public.is_reader_group_member(group_id));
create policy "authors delete own messages" on public.group_messages for delete to authenticated
using (author_id = auth.uid());
create policy "members read group posts" on public.group_posts for select to authenticated
using (public.is_reader_group_member(group_id));
create policy "members create group posts" on public.group_posts for insert to authenticated
with check (author_id = auth.uid() and public.is_reader_group_member(group_id));
create policy "authors edit or delete group posts" on public.group_posts for update to authenticated
using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "authors delete group posts" on public.group_posts for delete to authenticated
using (author_id = auth.uid());
create policy "members read group post reactions" on public.group_post_reactions for select to authenticated
using (exists (select 1 from public.group_posts p where p.id = post_id and public.is_reader_group_member(p.group_id)));
create policy "members react to group posts" on public.group_post_reactions for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.group_posts p where p.id = post_id and public.is_reader_group_member(p.group_id)));
create policy "users remove own group reactions" on public.group_post_reactions for delete to authenticated using (user_id = auth.uid());
create policy "members read group post comments" on public.group_post_comments for select to authenticated
using (exists (select 1 from public.group_posts p where p.id = post_id and public.is_reader_group_member(p.group_id)));
create policy "members comment on group posts" on public.group_post_comments for insert to authenticated
with check (author_id = auth.uid() and exists (select 1 from public.group_posts p where p.id = post_id and public.is_reader_group_member(p.group_id)));
create policy "authors manage own group comments" on public.group_post_comments for update to authenticated
using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "authors delete own group comments" on public.group_post_comments for delete to authenticated
using (author_id = auth.uid());

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check
check (type in ('reaction','comment','challenge_update','follow','group_message','group_invite'));
create or replace function public.notify_followed_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  values (new.followed_id, new.follower_id, 'follow');
  return new;
end;
$$;
drop trigger if exists follow_notification on public.follows;
create trigger follow_notification after insert on public.follows
for each row execute function public.notify_followed_profile();

create or replace function public.notify_group_post_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_post uuid; target_group uuid; actor uuid; recipient uuid;
begin
  target_post := (to_jsonb(new) ->> 'post_id')::uuid;
  actor := coalesce((to_jsonb(new) ->> 'user_id')::uuid, (to_jsonb(new) ->> 'author_id')::uuid);
  select group_id, author_id into target_group, recipient from public.group_posts where id = target_post;
  if recipient is not null and recipient <> actor then
    insert into public.notifications (recipient_id, actor_id, post_id, type)
    values (recipient, actor, target_post, case when tg_table_name = 'group_post_reactions' then 'reaction' else 'comment' end);
  end if;
  return new;
end;
$$;
drop trigger if exists group_reaction_notification on public.group_post_reactions;
create trigger group_reaction_notification after insert on public.group_post_reactions
for each row execute function public.notify_group_post_activity();
drop trigger if exists group_comment_notification on public.group_post_comments;
create trigger group_comment_notification after insert on public.group_post_comments
for each row execute function public.notify_group_post_activity();

create or replace function public.notify_group_members_of_message()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  select gm.user_id, new.author_id, 'group_message'
  from public.group_members gm
  where gm.group_id = new.group_id and gm.user_id <> new.author_id;
  return new;
end;
$$;
drop trigger if exists group_message_notifications on public.group_messages;
create trigger group_message_notifications after insert on public.group_messages
for each row execute function public.notify_group_members_of_message();

drop trigger if exists reader_books_set_updated_at on public.reader_books;
create trigger reader_books_set_updated_at before update on public.reader_books
for each row execute function public.set_updated_at();
drop trigger if exists book_entries_set_updated_at on public.book_entries;
create trigger book_entries_set_updated_at before update on public.book_entries
for each row execute function public.set_updated_at();
drop trigger if exists challenge_progress_set_updated_at on public.challenge_progress;
create trigger challenge_progress_set_updated_at before update on public.challenge_progress
for each row execute function public.set_updated_at();
drop trigger if exists group_posts_set_updated_at on public.group_posts;
create trigger group_posts_set_updated_at before update on public.group_posts
for each row execute function public.set_updated_at();
drop trigger if exists group_comments_set_updated_at on public.group_post_comments;
create trigger group_comments_set_updated_at before update on public.group_post_comments
for each row execute function public.set_updated_at();

-- Enable Supabase Realtime for chat and notification badges where available.
do $$ begin
  alter publication supabase_realtime add table public.group_messages;
exception when duplicate_object or undefined_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object or undefined_object then null;
end $$;
