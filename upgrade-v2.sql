-- ASK & Quotation (QQC) — ترقية v2
-- رسائل خاصة (DM) + اقتباس مميز + نظام عملات متوازن + شوت أوت للجميع + هوية الاعتراف الاختيارية
-- شغّل هذا كامل داخل Supabase → SQL Editor → New query → Run (آمن يتكرر أكثر من مرة)

-- ============ 0) شبكة أمان: التأكد من وجود صف profile عند إنشاء أي حساب جديد ============
-- (يشتغل بالتوازي مع أي تريغر موجود عندك مسبقاً — on conflict do nothing يمنع أي تعارض)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, initials, coins, vip)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    upper(left(coalesce(new.raw_user_meta_data->>'name', new.email, 'A'), 1)),
    50, false
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ 1) الرسائل الخاصة (DM) ============
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  from_id uuid references profiles(id) on delete cascade,
  to_id uuid references profiles(id) on delete cascade,
  text text not null,
  read boolean default false,
  created_at timestamptz default now()
);
alter table messages enable row level security;

drop policy if exists "users see their own messages" on messages;
create policy "users see their own messages" on messages
  for select using (auth.uid() = from_id or auth.uid() = to_id);
drop policy if exists "users send messages as themselves" on messages;
create policy "users send messages as themselves" on messages
  for insert with check (auth.uid() = from_id);
drop policy if exists "users update messages they received" on messages;
create policy "users update messages they received" on messages
  for update using (auth.uid() = to_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

-- ============ 2) هوية الاعتراف (اختياري: باسمك أو مجهول) ============
alter table confessions add column if not exists user_id uuid references profiles(id);
alter table confessions add column if not exists user_name text;
alter table confessions add column if not exists user_initials text;
alter table confessions add column if not exists user_avatar text;
alter table confessions add column if not exists anon boolean default true;

-- ============ 3) عرض من أجاب على السؤال ============
alter table posts add column if not exists answered_by_name text;
alter table posts add column if not exists answered_by_initials text;
alter table posts add column if not exists answered_by_avatar text;

-- ============ 4) نظام عملات آمن (RPC ذري يمنع تعارض التحديثات المتزامنة) ============
create or replace function increment_coins(uid uuid, delta int)
returns void as $$
begin
  update profiles set coins = greatest(0, coins + delta) where id = uid;
end;
$$ language plpgsql security definer;

-- ============ 5) الشوت أوت ينبّه كل الأعضاء تلقائياً (لأنه بعملات حقيقية) ============
create or replace function notify_all_on_shoutout()
returns trigger as $$
begin
  if new.is_shoutout = true then
    insert into notifications (user_id, text, type, post_id)
    select p.id, coalesce(new.asker_name,'شخص') || ' أرسل شوت أوت جديد 📢', 'shoutout', new.id
    from profiles p
    where p.id <> new.asked_by;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_notify_shoutout on posts;
create trigger trg_notify_shoutout
after insert on posts
for each row execute function notify_all_on_shoutout();

-- ============ 6) الاقتباس المميز (أعلى لايكات كل 24 ساعة، يترست تلقائياً) ============
create table if not exists app_state (
  id int primary key default 1,
  featured_post_id uuid references posts(id),
  featured_until timestamptz,
  constraint single_row check (id = 1)
);
insert into app_state (id) values (1) on conflict (id) do nothing;
alter table app_state enable row level security;

drop policy if exists "app_state viewable by everyone" on app_state;
create policy "app_state viewable by everyone" on app_state for select using (true);

create or replace function refresh_featured_quote()
returns void as $$
declare
  top_id uuid;
  cur_until timestamptz;
begin
  select featured_until into cur_until from app_state where id = 1;
  if cur_until is null or cur_until < now() then
    select id into top_id from posts where type = 'quote' order by likes desc, created_at desc limit 1;
    update app_state set featured_post_id = top_id, featured_until = now() + interval '24 hours' where id = 1;
  end if;
end;
$$ language plpgsql security definer;

notify pgrst, 'reload schema';
