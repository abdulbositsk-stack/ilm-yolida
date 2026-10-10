-- Ilm yo'lida community foundation
-- Run this in Supabase Dashboard -> SQL Editor as a single migration.

create extension if not exists "pgcrypto";

create type public.post_kind as enum ('quote', 'note', 'reflection');
create type public.post_visibility as enum ('public', 'challenge', 'private');
create type public.reaction_kind as enum ('like', 'dislike');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 2 and 80),
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 280),
  currently_reading text not null default '' check (char_length(currently_reading) <= 180),
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.community_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  challenge_code text,
  kind public.post_kind not null,
  body text not null check (char_length(trim(body)) between 1 and 3000),
  visibility public.post_visibility not null default 'public',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index community_posts_author_created_idx on public.community_posts (author_id, created_at desc);
create index community_posts_challenge_created_idx on public.community_posts (challenge_code, created_at desc);

create table public.post_reactions (
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.reaction_kind not null,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index post_comments_post_created_idx on public.post_comments (post_id, created_at asc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  post_id uuid references public.community_posts(id) on delete cascade,
  type text not null check (type in ('reaction', 'comment', 'challenge_update')),
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger community_posts_set_updated_at before update on public.community_posts
for each row execute function public.set_updated_at();
create trigger post_comments_set_updated_at before update on public.post_comments
for each row execute function public.set_updated_at();

-- A profile is created automatically as soon as a person signs up.
create or replace function public.create_profile_for_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    'reader_' || replace(substr(new.id::text, 1, 8), '-', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'Ilm yo''lovchisi'), '@', 1)),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  ) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.create_profile_for_user();

-- Notifications are generated in the database, rather than trusting browser code.
create or replace function public.notify_post_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  owner_id uuid;
  source_post_id uuid;
  actor uuid;
begin
  source_post_id := (to_jsonb(new) ->> 'post_id')::uuid;
  actor := coalesce((to_jsonb(new) ->> 'user_id')::uuid, (to_jsonb(new) ->> 'author_id')::uuid);
  select author_id into owner_id from public.community_posts where id = source_post_id;
  if owner_id is not null and owner_id <> actor then
    insert into public.notifications (recipient_id, actor_id, post_id, type)
    values (owner_id, actor, source_post_id,
      case when tg_table_name = 'post_reactions' then 'reaction' else 'comment' end);
  end if;
  return new;
end;
$$;
create trigger reaction_notification after insert on public.post_reactions
for each row execute function public.notify_post_owner();
create trigger comment_notification after insert on public.post_comments
for each row execute function public.notify_post_owner();

alter table public.profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.post_reactions enable row level security;
alter table public.post_comments enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are visible when public or self" on public.profiles for select
using (is_public or auth.uid() = id);
create policy "users update only their profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "visible posts can be read" on public.community_posts for select
using (visibility = 'public' or author_id = auth.uid());
create policy "users create their own posts" on public.community_posts for insert with check (auth.uid() = author_id);
create policy "users update own posts" on public.community_posts for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "users delete own posts" on public.community_posts for delete using (auth.uid() = author_id);

create policy "reactions are readable with visible post" on public.post_reactions for select using (
  exists (select 1 from public.community_posts post where post.id = public.post_reactions.post_id and (post.visibility = 'public' or post.author_id = auth.uid()))
);
create policy "users manage own reactions" on public.post_reactions for insert with check (auth.uid() = user_id);
create policy "users change own reactions" on public.post_reactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users remove own reactions" on public.post_reactions for delete using (auth.uid() = user_id);

create policy "comments are readable with visible post" on public.post_comments for select using (
  exists (select 1 from public.community_posts post where post.id = public.post_comments.post_id and (post.visibility = 'public' or post.author_id = auth.uid()))
);
create policy "users create comments" on public.post_comments for insert with check (auth.uid() = author_id);
create policy "users update own comments" on public.post_comments for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "users delete own comments" on public.post_comments for delete using (auth.uid() = author_id);

create policy "users read their notifications" on public.notifications for select using (auth.uid() = recipient_id);
create policy "users update their notifications" on public.notifications for update using (auth.uid() = recipient_id) with check (auth.uid() = recipient_id);
