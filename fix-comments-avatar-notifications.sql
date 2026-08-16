-- ترقية شاملة: نظام تعليقات + صور شخصية + إشعارات قابلة للنقر
-- شغّل هذا الملف كامل داخل Supabase → SQL Editor → New query → Run (آمن يتكرر أكثر من مرة)

-- ============ 1) جدول التعليقات ============
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade,
  confession_id uuid references confessions(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  user_name text,
  user_initials text,
  user_avatar text,
  text text not null,
  created_at timestamptz default now(),
  constraint comments_one_target check (
    (post_id is not null and confession_id is null) or
    (post_id is null and confession_id is not null)
  )
);
alter table comments enable row level security;

drop policy if exists "comments viewable by everyone" on comments;
create policy "comments viewable by everyone" on comments for select using (true);
drop policy if exists "authenticated users insert comments" on comments;
create policy "authenticated users insert comments" on comments for insert with check (auth.uid() is not null);

create or replace function increment_post_comments(pid uuid, delta int)
returns void as $$
begin
  update posts set comments = greatest(0, comments + delta) where id = pid;
end;
$$ language plpgsql security definer;

create or replace function increment_confession_comments(cid uuid, delta int)
returns void as $$
begin
  update confessions set comments = greatest(0, comments + delta) where id = cid;
end;
$$ language plpgsql security definer;

-- ============ 2) الصور الشخصية ============
alter table profiles add column if not exists avatar_url text;
alter table posts add column if not exists asker_avatar text;
alter table posts add column if not exists author_avatar text;

insert into storage.buckets (id, name, public)
values ('avatars','avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatar images are publicly accessible" on storage.objects;
create policy "avatar images are publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "users can upload own avatar" on storage.objects;
create policy "users can upload own avatar" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "users can update own avatar" on storage.objects;
create policy "users can update own avatar" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- ============ 3) إشعارات قابلة للنقر (تعرف توديك لمكان الحدث) ============
alter table notifications add column if not exists type text;
alter table notifications add column if not exists post_id uuid references posts(id) on delete cascade;
alter table notifications add column if not exists confession_id uuid references confessions(id) on delete cascade;

notify pgrst, 'reload schema';
