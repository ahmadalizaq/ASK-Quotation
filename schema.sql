-- ASK & Quotation — Supabase schema (v3: آمن للتشغيل أكثر من مرة)
-- شغّل هذا الملف كامل داخل Supabase → SQL Editor → New query → Run
-- هذا الملف آمن تماماً تشغّله أكثر من مرة (مثلاً لو صار خطأ بمنتصف مرة سابقة) —
-- ما راح يعطيك أخطاء "already exists" لأي جزء منه.

-- ============ الجدول 1: الحسابات (profiles) ============
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  initials text not null,
  coins int default 50,
  vip boolean default false,
  created_at timestamptz default now()
);
alter table profiles enable row level security;

drop policy if exists "profiles viewable by everyone" on profiles;
create policy "profiles viewable by everyone" on profiles for select using (true);
drop policy if exists "users insert own profile" on profiles;
create policy "users insert own profile" on profiles for insert with check (auth.uid() = id);
drop policy if exists "users update own profile" on profiles;
create policy "users update own profile" on profiles for update using (auth.uid() = id);

-- ============ الجدول 2: المنشورات (أسئلة + اقتباسات) ============
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('quote','qa')),

  text text,
  author_id uuid references profiles(id),
  author_name text,
  author_initials text,

  q text,
  a text,
  anon boolean default false,
  asked_by uuid references profiles(id),
  asker_name text,
  asker_initials text,
  answered_by uuid references profiles(id),
  is_shoutout boolean default false,

  topic text default 'الكل',
  likes int default 0,
  comments int default 0,
  created_at timestamptz default now()
);
alter table posts enable row level security;

drop policy if exists "posts viewable by everyone" on posts;
create policy "posts viewable by everyone" on posts for select using (true);
drop policy if exists "authenticated users insert posts" on posts;
create policy "authenticated users insert posts" on posts for insert with check (auth.uid() is not null);
drop policy if exists "authenticated users update posts" on posts;
create policy "authenticated users update posts" on posts for update using (auth.uid() is not null);

-- ============ الجدول 3: الاعترافات (مجهولة بالكامل) ============
create table if not exists confessions (
  id uuid primary key default gen_random_uuid(),
  text text not null,
  likes int default 0,
  comments int default 0,
  created_at timestamptz default now()
);
alter table confessions enable row level security;

drop policy if exists "confessions viewable by everyone" on confessions;
create policy "confessions viewable by everyone" on confessions for select using (true);
drop policy if exists "authenticated users insert confessions" on confessions;
create policy "authenticated users insert confessions" on confessions for insert with check (auth.uid() is not null);
drop policy if exists "authenticated users update confessions" on confessions;
create policy "authenticated users update confessions" on confessions for update using (auth.uid() is not null);

-- ============ الجدول 4: اللايكات ============
create table if not exists likes (
  user_id uuid references profiles(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);
alter table likes enable row level security;

drop policy if exists "likes viewable by everyone" on likes;
create policy "likes viewable by everyone" on likes for select using (true);
drop policy if exists "users manage own likes" on likes;
create policy "users manage own likes" on likes for all using (auth.uid() = user_id);

create table if not exists confession_likes (
  user_id uuid references profiles(id) on delete cascade,
  confession_id uuid references confessions(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, confession_id)
);
alter table confession_likes enable row level security;

drop policy if exists "confession likes viewable by everyone" on confession_likes;
create policy "confession likes viewable by everyone" on confession_likes for select using (true);
drop policy if exists "users manage own confession likes" on confession_likes;
create policy "users manage own confession likes" on confession_likes for all using (auth.uid() = user_id);

-- ============ الجدول 5: المتابعة ============
create table if not exists follows (
  follower_id uuid references profiles(id) on delete cascade,
  following_id uuid references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);
alter table follows enable row level security;

drop policy if exists "follows viewable by everyone" on follows;
create policy "follows viewable by everyone" on follows for select using (true);
drop policy if exists "users manage own follows" on follows;
create policy "users manage own follows" on follows for all using (auth.uid() = follower_id);

-- ============ الجدول 6: الإشعارات ============
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  text text not null,
  read boolean default false,
  created_at timestamptz default now()
);
alter table notifications enable row level security;

drop policy if exists "users see own notifications" on notifications;
create policy "users see own notifications" on notifications for select using (auth.uid() = user_id);
drop policy if exists "authenticated users insert notifications" on notifications;
create policy "authenticated users insert notifications" on notifications for insert with check (auth.uid() is not null);
drop policy if exists "users update own notifications" on notifications;
create policy "users update own notifications" on notifications for update using (auth.uid() = user_id);

-- ============ دوال العدّ الذري (atomic increment) ============
create or replace function increment_post_likes(pid uuid, delta int)
returns void as $$
begin
  update posts set likes = greatest(0, likes + delta) where id = pid;
end;
$$ language plpgsql security definer;

create or replace function increment_confession_likes(cid uuid, delta int)
returns void as $$
begin
  update confessions set likes = greatest(0, likes + delta) where id = cid;
end;
$$ language plpgsql security definer;

-- ============ تفعيل الريل تايم (آمن حتى لو كان مفعّل من قبل) ============
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts'
  ) then
    alter publication supabase_realtime add table posts;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'confessions'
  ) then
    alter publication supabase_realtime add table confessions;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;

-- ما فيه أي بيانات وهمية بهذا الملف — الموقع يبدأ فاضي تماماً
-- ويتعبى بمحتوى حقيقي بس من حسابات حقيقية تسجل وتنشر.
