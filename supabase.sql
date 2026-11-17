-- =====================================================================================================
-- AUDACITY GAME · Supabase schema
-- =====================================================================================================
-- Run the whole file once in Supabase → SQL Editor → New query → Run. It is safe to run again: tables
-- are only created if missing, seed rows are only inserted if missing, functions/policies are replaced.
--
-- SECURITY MODEL (Row Level Security is ON for every table)
--   · Players read only their own rows. Game rules, prices and platform status are public (read only).
--   · Nobody writes tables directly from the browser: there are no INSERT/UPDATE/DELETE policies.
--     Every action is a SECURITY DEFINER function that checks the caller (auth.uid()) and the rules.
--   · Server-only functions (crediting a confirmed on-chain deposit, marking a withdrawal as sent,
--     recording the token price and on-chain burns, linking a wallet) can ONLY be called with the
--     service_role key, from your backend / Edge Functions. Never ship that key to the browser.
--
-- AUTH: a player is a Supabase Auth user (e.g. "Sign in with Solana" / Web3 login, or your own login
-- Edge Function that verifies a signed message). The backend then calls link_wallet(user_id, wallet)
-- once the wallet signature is verified. Withdrawals are sent to that linked wallet only.
--
-- TIME: farming uses real time. One farming day = game_config.day_seconds (86,400).
-- MONEY: DC is off-chain (100 DC = 1 USDC). Items and fees are priced in USD and paid in $AMMO at the
--        token price recorded by the backend (10-minute average). Spent AMMO is burned on-chain in batches.
-- =====================================================================================================


-- -----------------------------------------------------------------------------------------------------
-- 1. GAME RULES (public, read only for players; edit them here or from the dashboard)
-- -----------------------------------------------------------------------------------------------------

create table if not exists public.game_config (
  id                       int primary key default 1 check (id = 1),
  dacity_per_usdc          numeric not null default 100,
  box_price_dc             numeric not null default 300,
  launch_sale_boxes        int     not null default 500,
  launch_sale_price_dc     numeric not null default 150,
  max_boxes_per_order      int     not null default 1000,
  reveal_delay_seconds     int     not null default 3,
  day_seconds              int     not null default 86400,
  withdraw_cooldown_hours  int     not null default 24,
  min_withdraw_dc          numeric not null default 100,
  withdraw_fee_pct         numeric not null default 10 check (withdraw_fee_pct >= 0 and withdraw_fee_pct < 100),
  claim_all_fee_usd        numeric not null default 0.05,
  token_total_supply       numeric not null default 1000000000,
  price_window_seconds     int     not null default 600,
  price_stale_seconds      int     not null default 300,
  -- Used only while no price has ever been recorded (before launch). Set to NULL once the token is live.
  prelaunch_price_usd      numeric          default 0.0000046
);

create table if not exists public.rarities (
  id               int primary key,
  name             text    not null,
  chance           numeric not null check (chance > 0),     -- drop weight (%)
  per_day          numeric not null check (per_day > 0),    -- DC per farming day
  cap              numeric not null check (cap > 0),        -- career cap (DC)
  shot_chance_pct  numeric not null check (shot_chance_pct >= 0 and shot_chance_pct < 100),
  color            text    not null
);

create table if not exists public.fusion_recipes (
  from_rarity  int primary key references public.rarities(id),
  to_rarity    int not null unique references public.rarities(id),
  fee_usd      numeric not null check (fee_usd >= 0),
  per_day      numeric not null check (per_day > 0),
  cap          numeric not null check (cap > 0)
);

create table if not exists public.weapons (
  id         text primary key,
  name       text    not null,
  boost_pct  numeric not null check (boost_pct > 0),
  days       numeric not null check (days > 0)
);

create table if not exists public.item_prices (
  item       text primary key check (item in ('medkit', 'vest', 'pistol', 'smg', 'rifle')),
  name       text    not null,
  price_usd  numeric not null check (price_usd > 0)
);

create table if not exists public.bulk_tiers (
  min_count  int primary key check (min_count > 1),
  pct        numeric not null check (pct > 0 and pct < 100)
);

-- columns added after the first version (the table may already exist)
alter table public.game_config add column if not exists withdraw_fee_pct numeric not null default 10
  check (withdraw_fee_pct >= 0 and withdraw_fee_pct < 100);
-- referrals: the referrer earns this % of every USDC deposit their recruits make (credited in DC)
alter table public.game_config add column if not exists referral_pct numeric not null default 5
  check (referral_pct >= 0 and referral_pct <= 50);
-- box sales stay closed until Season 01 opens (the site's countdown). NULL = always open.
alter table public.game_config add column if not exists boxes_open_at timestamptz default '2026-11-18T11:00:00Z';

insert into public.game_config (id) values (1) on conflict (id) do nothing;
-- launch sale raised from 250 to 500 boxes (only touches a row still on the old default)
update public.game_config set launch_sale_boxes = 500 where id = 1 and launch_sale_boxes = 250;

insert into public.rarities (id, name, chance, per_day, cap, shot_chance_pct, color) values
  (0, 'Common',    60, 30, 1350, 4,   '#a7afc2'),
  (1, 'Uncommon',  25, 33, 1584, 3,   '#3ddc84'),
  (2, 'Rare',      10, 38, 1976, 2,   '#2fb4ff'),
  (3, 'Epic',       4, 50, 3000, 1.5, '#b45cff'),
  (4, 'Legendary',  1, 75, 5250, 1,   '#ffb020')
on conflict (id) do nothing;

insert into public.fusion_recipes (from_rarity, to_rarity, fee_usd, per_day, cap) values
  (0, 1, 0.60,  60, 3200),
  (1, 2, 1.00,  66, 4000),
  (2, 3, 1.50,  76, 5100),
  (3, 4, 2.50, 100, 8100)
on conflict (from_rarity) do nothing;

insert into public.weapons (id, name, boost_pct, days) values
  ('pistol', 'Pistol', 15, 7),
  ('smg',    'SMG',    30, 7),
  ('rifle',  'Rifle',  50, 7)
on conflict (id) do nothing;

insert into public.item_prices (item, name, price_usd) values
  ('medkit', 'Med kit',     0.50),
  ('vest',   'Kevlar vest', 0.35),
  ('pistol', 'Pistol',      0.50),
  ('smg',    'SMG',         1.00),
  ('rifle',  'Rifle',       1.60)
on conflict (item) do nothing;

-- weapons became weekly (7 days, $0.50 / $1.00 / $1.60): update rows still on the old 30-day values
update public.weapons set days = 7 where id in ('pistol', 'smg', 'rifle') and days = 30;
update public.item_prices set price_usd = case item when 'pistol' then 0.50 when 'smg' then 1.00 when 'rifle' then 1.60 end
 where (item, price_usd) in (('pistol', 1.20), ('smg', 2.80), ('rifle', 5.00));

insert into public.bulk_tiers (min_count, pct) values (50, 15), (100, 25), (1000, 40)
on conflict (min_count) do nothing;


-- -----------------------------------------------------------------------------------------------------
-- 2. PLATFORM STATE (public, read only)
-- -----------------------------------------------------------------------------------------------------

create table if not exists public.platform_state (
  id                    int primary key default 1 check (id = 1),
  maintenance_on        boolean     not null default false,
  maintenance_message   text        not null default '',
  maintenance_since     timestamptz,
  boxes_sold            bigint      not null default 0,     -- drives the launch sale (admin gifts don't count)
  ammo_spent_total      numeric     not null default 0,     -- AMMO spent in the game (all of it gets burned)
  ammo_pending_burn     numeric     not null default 0,     -- spent but not burned on-chain yet
  ammo_burned_onchain   numeric     not null default 0,     -- confirmed on-chain burns
  updated_at            timestamptz not null default now()
);
insert into public.platform_state (id) values (1) on conflict (id) do nothing;

create table if not exists public.announcements (
  id          bigint generated always as identity primary key,
  kind        text        not null check (kind in ('info', 'event', 'warning')),
  title       text        not null check (char_length(title) between 1 and 60),
  message     text        not null check (char_length(message) between 1 and 240),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz,
  active      boolean     not null default true
);

create table if not exists public.admins (
  wallet    text primary key,
  added_at  timestamptz not null default now()
);

create table if not exists public.token_price_samples (
  at         timestamptz not null default now(),
  price_usd  numeric     not null check (price_usd > 0),
  source     text        not null default 'dexscreener'
);
create index if not exists token_price_samples_at_idx on public.token_price_samples (at desc);

create table if not exists public.burn_batches (
  id          bigint generated always as identity primary key,
  amount      numeric     not null check (amount > 0),
  signature   text        not null unique,
  created_at  timestamptz not null default now()
);


-- -----------------------------------------------------------------------------------------------------
-- 3. PLAYERS AND THEIR STUFF (each player reads only their own rows)
-- -----------------------------------------------------------------------------------------------------

create table if not exists public.players (
  user_id           uuid primary key references auth.users(id) on delete cascade,
  wallet            text unique check (wallet is null or wallet ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  gang_name         text check (gang_name is null or octet_length(gang_name) between 3 and 24),
  protagonist       int  check (protagonist is null or protagonist in (1, 2)),
  gang_founded_at   timestamptz,
  dc                numeric     not null default 0 check (dc >= 0),
  ammo              numeric     not null default 0 check (ammo >= 0),   -- AMMO deposited into the game
  medkits           int         not null default 0 check (medkits >= 0),
  pistols           int         not null default 0 check (pistols >= 0),
  smgs              int         not null default 0 check (smgs >= 0),
  rifles            int         not null default 0 check (rifles >= 0),
  vests             int         not null default 0 check (vests >= 0),
  last_withdraw_at  timestamptz,
  total_deposited_usdc numeric  not null default 0,
  total_claimed_dc  numeric     not null default 0,
  total_opened      int         not null default 0,
  created_at        timestamptz not null default now()
);

create table if not exists public.boxes (
  id                bigint generated always as identity primary key,
  user_id           uuid        not null references public.players(user_id) on delete cascade,
  source            text        not null default 'purchase' check (source in ('purchase', 'gift')),
  bought_at         timestamptz not null default now(),
  ready_at          timestamptz not null default now(),
  server_seed_hash  text        not null,       -- published before opening (provably fair)
  server_seed       text,                       -- revealed after opening
  client_seed       text,
  roll              numeric,                    -- 0..100
  opened_at         timestamptz,
  gangster_id       bigint
);
create index if not exists boxes_user_open_idx on public.boxes (user_id) where opened_at is null;

-- Secret server seeds. RLS on with no policies: only the game's functions can read them.
create table if not exists public.box_seeds (
  box_id       bigint primary key references public.boxes(id) on delete cascade,
  server_seed  text not null
);

create table if not exists public.gangsters (
  id                   bigint generated always as identity primary key,
  user_id              uuid        not null references public.players(user_id) on delete cascade,
  rarity               int         not null references public.rarities(id),
  fused                boolean     not null default false,
  idle                 boolean     not null default true,   -- in the inventory, career not started
  started_at           timestamptz,                         -- when put to work
  claimed              numeric     not null default 0,
  paused_seconds       numeric     not null default 0,      -- time spent shot, not counted as farming
  next_shot_at         timestamptz,
  vest_absorb_at       timestamptz,
  weapon_id            text        references public.weapons(id),
  weapon_start_active  numeric     not null default 0,      -- farming seconds done when the weapon went on
  bonus_banked         numeric     not null default 0,      -- weapon DC from previous weapons
  source               text        not null default 'box' check (source in ('box', 'fusion')),
  created_at           timestamptz not null default now(),
  consumed_at          timestamptz                          -- used up by a fusion
);
create index if not exists gangsters_user_idx on public.gangsters (user_id) where consumed_at is null;

create table if not exists public.player_transactions (
  id       bigint generated always as identity primary key,
  user_id  uuid        not null references public.players(user_id) on delete cascade,
  at       timestamptz not null default now(),
  type     text        not null,
  title    text        not null,
  detail   text        not null default '',
  dc       numeric,
  usdc     numeric,
  ammo     numeric
);
create index if not exists player_transactions_user_idx on public.player_transactions (user_id, at desc);

-- A deposit starts as an intent with a unique Solana Pay reference (a random public key made by the
-- client), the player sends the transfer with that reference, the backend finds it on-chain and calls
-- confirm_deposit(). Only then is the balance credited.
create table if not exists public.deposits (
  id            bigint generated always as identity primary key,
  user_id       uuid        not null references public.players(user_id) on delete cascade,
  asset         text        not null check (asset in ('usdc', 'ammo')),
  reference     text        not null unique check (reference ~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$'),
  status        text        not null default 'pending' check (status in ('pending', 'confirmed', 'expired')),
  amount        numeric,                       -- token amount received (USDC or AMMO)
  signature     text unique,
  sender        text,
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);

create table if not exists public.withdrawals (
  id          bigint generated always as identity primary key,
  user_id     uuid        not null references public.players(user_id) on delete cascade,
  asset       text        not null check (asset in ('usdc', 'ammo')),
  amount_in   numeric     not null check (amount_in > 0),   -- DC (usdc) or AMMO (ammo) taken from the balance
  amount_out  numeric     not null check (amount_out > 0),  -- tokens to send
  wallet      text        not null,
  status      text        not null default 'requested' check (status in ('requested', 'sent', 'failed')),
  signature   text unique,
  note        text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists withdrawals_status_idx on public.withdrawals (status, created_at);

create table if not exists public.admin_log (
  id      bigint generated always as identity primary key,
  at      timestamptz not null default now(),
  wallet  text,
  action  text not null,
  detail  text not null default ''
);

-- Payment server bookkeeping (columns added after the first version, see section 10a).
alter table public.withdrawals add column if not exists reference text unique;
alter table public.withdrawals add column if not exists tx_base64 text;
alter table public.withdrawals add column if not exists tx_last_valid_height bigint;
alter table public.withdrawals add column if not exists issued_at timestamptz;
alter table public.burn_batches add column if not exists status text not null default 'confirmed'
  check (status in ('pending', 'confirmed', 'failed'));
alter table public.burn_batches add column if not exists last_valid_height bigint;

-- Referrals. referral_code = the gang name as a link slug ("Los Neon" -> los-neon), unique.
-- referred_by is set ONCE, when the player founds their gang, and never changes.
alter table public.players add column if not exists referral_code text;
alter table public.players add column if not exists referred_by uuid references public.players(user_id) on delete set null;
alter table public.players add column if not exists referred_at timestamptz;
alter table public.players add column if not exists referral_earned_dc numeric not null default 0;
create unique index if not exists players_referral_code_key on public.players (referral_code);
create index if not exists players_referred_by_idx on public.players (referred_by) where referred_by is not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'players_no_self_referral') then
    alter table public.players add constraint players_no_self_referral check (referred_by is null or referred_by <> user_id);
  end if;
end $$;

-- One reward per confirmed deposit, ever (deposit_id unique): a deposit can never pay a referrer twice.
create table if not exists public.referral_rewards (
  id           bigint generated always as identity primary key,
  referrer     uuid        not null references public.players(user_id) on delete cascade,
  referee      uuid        not null references public.players(user_id) on delete cascade,
  deposit_id   bigint      not null unique references public.deposits(id) on delete cascade,
  amount_usdc  numeric     not null check (amount_usdc > 0),
  amount_dc    numeric     not null check (amount_dc > 0),
  created_at   timestamptz not null default now()
);
create index if not exists referral_rewards_referrer_idx on public.referral_rewards (referrer, created_at desc);

-- One worker of each kind at a time, even with several server instances running.
create table if not exists public.worker_leases (
  name        text primary key,
  holder      text not null,
  expires_at  timestamptz not null
);



-- -----------------------------------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------------------------------

alter table public.game_config          enable row level security;
alter table public.rarities             enable row level security;
alter table public.fusion_recipes       enable row level security;
alter table public.weapons              enable row level security;
alter table public.item_prices          enable row level security;
alter table public.bulk_tiers           enable row level security;
alter table public.platform_state       enable row level security;
alter table public.announcements        enable row level security;
alter table public.admins               enable row level security;
alter table public.token_price_samples  enable row level security;
alter table public.burn_batches         enable row level security;
alter table public.players              enable row level security;
alter table public.boxes                enable row level security;
alter table public.box_seeds            enable row level security;
alter table public.gangsters            enable row level security;
alter table public.player_transactions  enable row level security;
alter table public.deposits             enable row level security;
alter table public.withdrawals          enable row level security;
alter table public.admin_log            enable row level security;
alter table public.worker_leases        enable row level security;
alter table public.referral_rewards     enable row level security;

-- public, read only
drop policy if exists "public read" on public.game_config;
create policy "public read" on public.game_config for select to anon, authenticated using (true);
drop policy if exists "public read" on public.rarities;
create policy "public read" on public.rarities for select to anon, authenticated using (true);
drop policy if exists "public read" on public.fusion_recipes;
create policy "public read" on public.fusion_recipes for select to anon, authenticated using (true);
drop policy if exists "public read" on public.weapons;
create policy "public read" on public.weapons for select to anon, authenticated using (true);
drop policy if exists "public read" on public.item_prices;
create policy "public read" on public.item_prices for select to anon, authenticated using (true);
drop policy if exists "public read" on public.bulk_tiers;
create policy "public read" on public.bulk_tiers for select to anon, authenticated using (true);
drop policy if exists "public read" on public.platform_state;
create policy "public read" on public.platform_state for select to anon, authenticated using (true);
drop policy if exists "public read" on public.token_price_samples;
create policy "public read" on public.token_price_samples for select to anon, authenticated using (true);
drop policy if exists "public read" on public.burn_batches;
create policy "public read" on public.burn_batches for select to anon, authenticated using (status = 'confirmed');
drop policy if exists "live announcements" on public.announcements;
create policy "live announcements" on public.announcements for select to anon, authenticated
  using (active and (expires_at is null or expires_at > now()));

-- own rows only
drop policy if exists "own row" on public.players;
create policy "own row" on public.players for select to authenticated using (user_id = auth.uid());
drop policy if exists "own rows" on public.boxes;
create policy "own rows" on public.boxes for select to authenticated using (user_id = auth.uid());
drop policy if exists "own rows" on public.gangsters;
create policy "own rows" on public.gangsters for select to authenticated using (user_id = auth.uid());
drop policy if exists "own rows" on public.player_transactions;
create policy "own rows" on public.player_transactions for select to authenticated using (user_id = auth.uid());
drop policy if exists "own rows" on public.deposits;
create policy "own rows" on public.deposits for select to authenticated using (user_id = auth.uid());
drop policy if exists "own rows" on public.withdrawals;
create policy "own rows" on public.withdrawals for select to authenticated using (user_id = auth.uid());
drop policy if exists "own rewards" on public.referral_rewards;
create policy "own rewards" on public.referral_rewards for select to authenticated using (referrer = auth.uid());

-- box_seeds, admins, admin_log, worker_leases: no policies on purpose (only functions and service_role).


-- -----------------------------------------------------------------------------------------------------
-- 5. INTERNAL HELPERS
-- -----------------------------------------------------------------------------------------------------

create or replace function public.cfg()
returns public.game_config language sql stable security definer set search_path = public, pg_temp
as $$ select * from public.game_config where id = 1 $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.admins a join public.players p on p.wallet = a.wallet
    where p.user_id = auth.uid()
  )
$$;

-- The Solana address a user signed in with ("Sign in with Solana" / Web3 provider). Read from
-- auth.identities, which only Supabase Auth writes, never from user_metadata (players can edit that).
create or replace function public.wallet_of(p_user uuid)
returns text language sql stable security definer set search_path = public, pg_temp
as $$
  select substring(i.provider_id from '^web3:solana:([1-9A-HJ-NP-Za-km-z]{32,44})$')
    from auth.identities i
   where i.user_id = p_user and i.provider = 'web3' and i.provider_id like 'web3:solana:%'
   limit 1
$$;

-- Lock (and create if missing) the calling player's row. Every action goes through here.
-- Also links the wallet the player signed in with, the first time.
create or replace function public.lock_me()
returns public.players language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_p public.players;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  insert into public.players (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_p from public.players where user_id = v_uid for update;
  if v_p.wallet is null then
    update public.players set wallet = public.wallet_of(v_uid)
     where user_id = v_uid and public.wallet_of(v_uid) is not null
    returning * into v_p;
    if v_p.user_id is null then
      select * into v_p from public.players where user_id = v_uid;
    end if;
  end if;
  return v_p;
end $$;

-- Gang name -> referral link code: lowercase letters/digits, anything else becomes one dash.
create or replace function public.ref_code(p_name text)
returns text language sql immutable
as $$ select btrim(regexp_replace(lower(coalesce(p_name, '')), '[^a-z0-9]+', '-', 'g'), '-') $$;

-- Game closed for maintenance (admins keep access).
create or replace function public.assert_open()
returns void language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if (select maintenance_on from public.platform_state where id = 1) and not public.is_admin() then
    raise exception 'The game is under maintenance: %', (select maintenance_message from public.platform_state where id = 1);
  end if;
end $$;

create or replace function public.require_gang(p public.players)
returns void language plpgsql immutable
as $$
begin
  if p.gang_name is null then raise exception 'Found your gang first'; end if;
end $$;

create or replace function public.log_tx(
  p_user uuid, p_type text, p_title text, p_detail text default '',
  p_dc numeric default null, p_usdc numeric default null, p_ammo numeric default null
) returns void language sql security definer set search_path = public, pg_temp
as $$
  insert into public.player_transactions (user_id, type, title, detail, dc, usdc, ammo)
  values (p_user, p_type, p_title, coalesce(p_detail, ''), p_dc, p_usdc, p_ammo)
$$;

-- AMMO paid into the game is burned: it's queued here and burned on-chain by the backend in batches.
create or replace function public.spend_ammo(p_amount numeric)
returns void language sql security definer set search_path = public, pg_temp
as $$
  update public.platform_state
     set ammo_spent_total = ammo_spent_total + p_amount,
         ammo_pending_burn = ammo_pending_burn + p_amount,
         updated_at = now()
   where id = 1 and p_amount > 0
$$;

-- $AMMO price in USD: average of the last price_window_seconds of samples recorded by the backend.
-- Purchases stop if the feed is stale. Before the first sample, the prelaunch price is used.
create or replace function public.ammo_price_usd()
returns numeric language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  c public.game_config := public.cfg();
  v_last timestamptz;
  v_price numeric;
begin
  select max(at) into v_last from public.token_price_samples;
  if v_last is null then
    if c.prelaunch_price_usd is null then raise exception 'AMMO price is not available yet'; end if;
    return c.prelaunch_price_usd;
  end if;
  if v_last < now() - make_interval(secs => c.price_stale_seconds) then
    raise exception 'The AMMO price feed is down: purchases are paused';
  end if;
  select avg(price_usd) into v_price
    from public.token_price_samples
   where at >= now() - make_interval(secs => c.price_window_seconds);
  return v_price;
end $$;

-- AMMO needed to pay p_usd dollars right now (rounded up to whole tokens).
create or replace function public.usd_to_ammo(p_usd numeric)
returns numeric language sql stable security definer set search_path = public, pg_temp
as $$ select ceil(p_usd / public.ammo_price_usd()) $$;

-- Random farming time (seconds) until the next bullet, from the rarity's daily shot chance.
create or replace function public.sample_shot_gap(p_rarity int)
returns numeric language plpgsql volatile security definer set search_path = public, pg_temp
as $$
declare
  v_p numeric;
  v_rate numeric;
begin
  select shot_chance_pct / 100 into v_p from public.rarities where id = p_rarity;
  if v_p is null or v_p <= 0 then return 1e12; end if;          -- never shot
  v_rate := -ln(1 - v_p);                                        -- shots per day
  return (-ln(1 - random()) / v_rate) * (public.cfg()).day_seconds;
end $$;


-- -----------------------------------------------------------------------------------------------------
-- 6. FARMING MATH (one function, used by the views and every action)
-- -----------------------------------------------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_type where typname = 'gangster_calc' and typnamespace = 'public'::regnamespace) then
    create type public.gangster_calc as (
      per_day           numeric,   -- base DC/day (fused stats when fused)
      cap               numeric,
      active_seconds    numeric,   -- farming time so far (stops when shot, excludes time spent shot)
      farmed            numeric,   -- career DC farmed (capped)
      retired           boolean,
      shot_at           timestamptz,
      is_shot           boolean,
      is_farming        boolean,
      weapon_days_left  numeric,
      bonus             numeric,   -- weapon DC on top of the career
      pending           numeric,   -- claimable now
      rate              numeric,   -- DC/day right now, weapon included (0 when idle, shot or retired)
      has_vest          boolean,
      career_pct        numeric
    );
  end if;
end $$;

create or replace function public.g_calc(g public.gangsters, p_now timestamptz default now())
returns public.gangster_calc language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  c public.gangster_calc;
  v_day numeric := (public.cfg()).day_seconds;
  v_boost numeric;
  v_wdays numeric;
  v_retire_at numeric;
  v_wend numeric;
  v_wactive numeric := 0;
begin
  if g.fused then
    select per_day, cap into c.per_day, c.cap from public.fusion_recipes where to_rarity = g.rarity;
  end if;
  if c.per_day is null then
    select per_day, cap into c.per_day, c.cap from public.rarities where id = g.rarity;
  end if;

  c.shot_at := case when not g.idle and g.next_shot_at is not null and g.next_shot_at <= p_now then g.next_shot_at end;
  if g.idle or g.started_at is null then
    c.active_seconds := 0;
  else
    c.active_seconds := greatest(0, extract(epoch from (coalesce(c.shot_at, p_now) - g.started_at)) - g.paused_seconds);
  end if;

  c.farmed := least(c.cap, c.per_day * c.active_seconds / v_day);
  c.retired := c.farmed >= c.cap;
  c.is_shot := not c.retired and c.shot_at is not null;
  c.is_farming := not g.idle and not c.retired and c.shot_at is null;
  c.bonus := g.bonus_banked;
  c.weapon_days_left := 0;

  if g.weapon_id is not null then
    select boost_pct, days into v_boost, v_wdays from public.weapons where id = g.weapon_id;
    v_retire_at := c.cap / c.per_day * v_day;
    v_wend := least(c.active_seconds, g.weapon_start_active + v_wdays * v_day, v_retire_at);
    v_wactive := greatest(0, v_wend - g.weapon_start_active);
    c.bonus := g.bonus_banked + c.per_day * v_boost / 100 * v_wactive / v_day;
    c.weapon_days_left := greatest(0, v_wdays - v_wactive / v_day);
  end if;

  c.pending := greatest(0, c.farmed + c.bonus - g.claimed);
  c.rate := case
    when not c.is_farming then 0
    when c.weapon_days_left > 0 then c.per_day * (1 + v_boost / 100)
    else c.per_day end;
  c.has_vest := g.vest_absorb_at is not null and g.vest_absorb_at > p_now;
  c.career_pct := round(c.farmed / c.cap * 100, 2);
  return c;
end $$;


-- -----------------------------------------------------------------------------------------------------
-- 7. VIEWS (respect RLS: each player sees only their own gangsters)
-- -----------------------------------------------------------------------------------------------------

create or replace view public.my_gangsters with (security_invoker = true) as
  select g.id, g.user_id, g.rarity, r.name as rarity_name, g.fused, g.idle, g.started_at, g.claimed,
         g.next_shot_at, g.vest_absorb_at, g.weapon_id, g.source, g.created_at,
         c.per_day, c.cap, c.active_seconds, c.farmed, c.retired, c.shot_at, c.is_shot, c.is_farming,
         c.weapon_days_left, c.bonus, c.pending, c.rate, c.has_vest, c.career_pct
    from public.gangsters g
    join public.rarities r on r.id = g.rarity
    cross join lateral public.g_calc(g, now()) c
   where g.consumed_at is null;

create or replace view public.token_price with (security_invoker = true) as
  select p.price_usd,
         p.price_usd * c.token_total_supply as market_cap_usd,
         (select max(at) from public.token_price_samples) as updated_at,
         not exists (select 1 from public.token_price_samples) as prelaunch
    from (select public.ammo_price_usd() as price_usd) p, public.game_config c
   where c.id = 1;


-- -----------------------------------------------------------------------------------------------------
-- 8. PLAYER ACTIONS (call from the app with supabase.rpc('name', { ... }))
-- -----------------------------------------------------------------------------------------------------

-- Create the player row if the auth trigger didn't (e.g. users created before this script ran).
create or replace function public.ensure_player()
returns public.players language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_p public.players;
begin
  v_p := public.lock_me();
  return v_p;
end $$;

-- found_gang changed signature (referral code); drop the old one so calls aren't ambiguous
drop function if exists public.found_gang(int, text);

-- Found the gang. The gang name is unique and becomes the player's referral link. p_ref = the code of
-- the link they arrived with: it binds their referrer once, here, and can never be changed. A bad,
-- unknown or own code is ignored (a broken link must never stop anyone from playing).
create or replace function public.found_gang(p_protagonist int, p_name text, p_ref text default null)
returns public.players language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_p public.players;
  v_name text := btrim(p_name);
  v_code text := public.ref_code(btrim(p_name));
  v_ref public.players;
  v_referrer uuid;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  if v_p.gang_name is not null then raise exception 'You already founded a gang'; end if;
  if p_protagonist not in (1, 2) then raise exception 'Pick a boss'; end if;
  if v_name is null or octet_length(v_name) not between 3 and 24 then raise exception 'Gang name must be 3 to 24 characters'; end if;
  if char_length(v_code) < 3 then raise exception 'Gang name needs at least 3 letters or numbers'; end if;
  if exists (select 1 from public.players where referral_code = v_code) then
    raise exception 'That gang name is taken. Pick another one';
  end if;

  if nullif(btrim(coalesce(p_ref, '')), '') is not null then
    select * into v_ref from public.players where referral_code = public.ref_code(p_ref) and gang_name is not null;
    if v_ref.user_id is not null and v_ref.user_id <> v_p.user_id and v_ref.wallet is distinct from v_p.wallet then
      v_referrer := v_ref.user_id;
    end if;
  end if;

  begin
    update public.players
       set gang_name = v_name, protagonist = p_protagonist, gang_founded_at = now(), referral_code = v_code,
           referred_by = v_referrer, referred_at = case when v_referrer is not null then now() end
     where user_id = v_p.user_id
    returning * into v_p;
  exception when unique_violation then
    raise exception 'That gang name is taken. Pick another one';
  end;
  perform public.log_tx(v_p.user_id, 'gang', 'Gang founded',
    v_name || case when v_referrer is not null then ' · recruited by ' || v_ref.gang_name else '' end);
  if v_referrer is not null then
    perform public.log_tx(v_referrer, 'referral', 'New recruit', v_name || ' joined with your link');
  end if;
  return v_p;
end $$;

-- Price an order: launch price for the first boxes sold game-wide, bulk discount on the rest.
create or replace function public.quote_boxes(p_count int)
returns table (launch_qty int, regular_qty int, pct numeric, total_dc numeric, full_dc numeric)
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  c public.game_config := public.cfg();
  v_sold bigint := (select boxes_sold from public.platform_state where id = 1);
begin
  launch_qty := least(p_count, greatest(0, c.launch_sale_boxes - v_sold))::int;
  regular_qty := p_count - launch_qty;
  pct := coalesce((select t.pct from public.bulk_tiers t where t.min_count <= p_count order by t.min_count desc limit 1), 0);
  total_dc := launch_qty * c.launch_sale_price_dc + round(regular_qty * c.box_price_dc * (1 - pct / 100));
  full_dc := p_count * c.box_price_dc;
  return next;
end $$;

create or replace function public.buy_boxes(p_count int)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c public.game_config := public.cfg();
  v_p public.players;
  q record;
  v_seed text;
  v_box bigint;
  i int;
begin
  perform public.assert_open();
  if c.boxes_open_at is not null and now() < c.boxes_open_at then
    raise exception 'Box sales open when Season 01 starts (%)', to_char(c.boxes_open_at at time zone 'UTC', 'Mon DD, HH24:MI "UTC"');
  end if;
  v_p := public.lock_me();
  perform public.require_gang(v_p);
  if p_count is null or p_count < 1 or p_count > c.max_boxes_per_order then
    raise exception 'You can buy 1 to % boxes per order', c.max_boxes_per_order;
  end if;
  perform 1 from public.platform_state where id = 1 for update;     -- serialize the launch-sale counter
  select * into q from public.quote_boxes(p_count);
  if q.total_dc > v_p.dc then raise exception 'Not enough DC: this order costs % DC', q.total_dc; end if;

  update public.players set dc = dc - q.total_dc where user_id = v_p.user_id;
  for i in 1 .. p_count loop
    v_seed := encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text || i::text, 'UTF8')), 'hex');
    insert into public.boxes (user_id, source, ready_at, server_seed_hash)
    values (v_p.user_id, 'purchase', now() + make_interval(secs => c.reveal_delay_seconds),
            encode(sha256(convert_to(v_seed, 'UTF8')), 'hex'))
    returning id into v_box;
    insert into public.box_seeds (box_id, server_seed) values (v_box, v_seed);
  end loop;
  update public.platform_state set boxes_sold = boxes_sold + p_count, updated_at = now() where id = 1;

  perform public.log_tx(v_p.user_id, 'buy', format('Bought %s box%s', p_count, case when p_count = 1 then '' else 'es' end),
    concat_ws(' · ',
      case when q.launch_qty > 0 then q.launch_qty || ' at launch price' end,
      case when q.regular_qty > 0 then q.regular_qty || ' regular' || case when q.pct > 0 then ' -' || q.pct || '%' else '' end end),
    -q.total_dc);
  return jsonb_build_object('count', p_count, 'total_dc', q.total_dc, 'saved_dc', q.full_dc - q.total_dc,
                            'launch_qty', q.launch_qty, 'regular_qty', q.regular_qty, 'bulk_pct', q.pct);
end $$;

-- Provably fair roll: sha256(server_seed:client_seed:box_id). The server seed hash was public since
-- purchase and the seed itself is revealed on the box row after opening, so anyone can recompute it.
create or replace function public.open_box(p_box_id bigint, p_client_seed text default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_p public.players;
  v_box public.boxes;
  v_seed text;
  v_client text := nullif(btrim(coalesce(p_client_seed, '')), '');
  v_hash text;
  v_roll numeric;
  v_total numeric;
  v_acc numeric := 0;
  v_rarity int;
  r record;
  v_gid bigint;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  select * into v_box from public.boxes where id = p_box_id and user_id = v_p.user_id for update;
  if v_box.id is null then raise exception 'Box not found'; end if;
  if v_box.opened_at is not null then raise exception 'This box is already open'; end if;
  if v_box.ready_at > now() then raise exception 'This box is still sealing'; end if;
  if v_client is null then v_client := encode(sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'); end if;
  if char_length(v_client) > 128 then raise exception 'Client seed is too long'; end if;

  select server_seed into v_seed from public.box_seeds where box_id = v_box.id;
  v_hash := encode(sha256(convert_to(v_seed || ':' || v_client || ':' || v_box.id::text, 'UTF8')), 'hex');
  select sum(chance) into v_total from public.rarities;
  v_roll := ('x' || lpad(substr(v_hash, 1, 8), 16, '0'))::bit(64)::bigint / 4294967296.0 * v_total;
  for r in select id, chance from public.rarities order by id loop
    v_acc := v_acc + r.chance;
    if v_roll < v_acc then v_rarity := r.id; exit; end if;
  end loop;
  if v_rarity is null then v_rarity := (select max(id) from public.rarities); end if;

  insert into public.gangsters (user_id, rarity, idle, source) values (v_p.user_id, v_rarity, true, 'box')
  returning id into v_gid;
  update public.boxes
     set opened_at = now(), gangster_id = v_gid, client_seed = v_client, server_seed = v_seed,
         roll = round(v_roll / v_total * 100, 6)
   where id = v_box.id;
  update public.players set total_opened = total_opened + 1 where user_id = v_p.user_id;
  perform public.log_tx(v_p.user_id, 'open', 'Opened box #' || v_box.id,
    (select name from public.rarities where id = v_rarity) || ' gangster #' || v_gid || ' · waiting in your inventory');
  return jsonb_build_object('box_id', v_box.id, 'gangster_id', v_gid, 'rarity', v_rarity,
                            'server_seed', v_seed, 'server_seed_hash', v_box.server_seed_hash, 'client_seed', v_client);
end $$;

-- Put idle gangsters to work: their career and shot risk start now. Can't be undone.
create or replace function public.deploy(p_ids bigint[])
returns int language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_p public.players;
  v_n int;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  update public.gangsters g
     set idle = false, started_at = now(), paused_seconds = 0,
         next_shot_at = now() + make_interval(secs => public.sample_shot_gap(g.rarity)::double precision)
   where g.user_id = v_p.user_id and g.id = any (p_ids) and g.idle and g.consumed_at is null;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Nobody to put to work'; end if;
  perform public.log_tx(v_p.user_id, 'deploy', 'Put to work',
    case when v_n = 1 then '#' || p_ids[1] else v_n || ' gangsters' end || ' started farming');
  return v_n;
end $$;

-- Claim one gangster: free.
create or replace function public.claim(p_gangster_id bigint)
returns numeric language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_p public.players;
  v_g public.gangsters;
  v_c public.gangster_calc;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  select * into v_g from public.gangsters where id = p_gangster_id and user_id = v_p.user_id and consumed_at is null for update;
  if v_g.id is null then raise exception 'Gangster not found'; end if;
  v_c := public.g_calc(v_g);
  if v_c.pending <= 0 then return 0; end if;
  update public.gangsters set claimed = claimed + v_c.pending where id = v_g.id;
  update public.players set dc = dc + v_c.pending, total_claimed_dc = total_claimed_dc + v_c.pending where user_id = v_p.user_id;
  perform public.log_tx(v_p.user_id, 'claim', 'Claim', 'Gangster #' || v_g.id || ' · no fee', v_c.pending);
  return v_c.pending;
end $$;

-- Claim every gangster with at least 1 DC pending (or only p_ids). Fee: claim_all_fee_usd per gangster, in AMMO, burned.
create or replace function public.claim_all(p_ids bigint[] default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_p public.players;
  r record;
  v_ids bigint[] := '{}';
  v_gross numeric := 0;
  v_fee numeric;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  for r in
    select g.id, c.pending
      from public.gangsters g cross join lateral public.g_calc(g) c
     where g.user_id = v_p.user_id and g.consumed_at is null and (p_ids is null or g.id = any (p_ids))
     for update of g
  loop
    if r.pending >= 1 then
      v_ids := v_ids || r.id;
      v_gross := v_gross + r.pending;
      update public.gangsters set claimed = claimed + r.pending where id = r.id;
    end if;
  end loop;
  if cardinality(v_ids) = 0 then raise exception 'Nothing to claim yet'; end if;
  v_fee := cardinality(v_ids) * public.usd_to_ammo((public.cfg()).claim_all_fee_usd);
  if v_fee > v_p.ammo then raise exception 'Need % AMMO for the claim-all fee', v_fee; end if;
  update public.players
     set dc = dc + v_gross, ammo = ammo - v_fee, total_claimed_dc = total_claimed_dc + v_gross
   where user_id = v_p.user_id;
  perform public.spend_ammo(v_fee);
  perform public.log_tx(v_p.user_id, 'claimAll', 'Claim all', cardinality(v_ids) || ' gangsters · fee burned', v_gross, null, -v_fee);
  return jsonb_build_object('gangsters', cardinality(v_ids), 'dc', v_gross, 'fee_ammo', v_fee);
end $$;

-- Fuse the two gangsters of p_rarity closest to retirement into one fused gangster of the next rarity.
create or replace function public.fuse(p_rarity int)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_p public.players;
  v_recipe public.fusion_recipes;
  v_pair bigint[];
  v_payout numeric;
  v_fee numeric;
  v_child bigint;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  select * into v_recipe from public.fusion_recipes where from_rarity = p_rarity;
  if v_recipe.from_rarity is null then raise exception 'This rarity can''t be fused'; end if;

  select array_agg(id order by progress desc), sum(pending)
    into v_pair, v_payout
    from (
      select g.id, c.pending, c.farmed / c.cap as progress
        from public.gangsters g cross join lateral public.g_calc(g) c
       where g.user_id = v_p.user_id and g.consumed_at is null and g.rarity = p_rarity
         and not g.fused and not c.retired and not c.is_shot
       order by c.farmed / c.cap desc
       limit 2
    ) s;
  if coalesce(cardinality(v_pair), 0) < 2 then
    raise exception 'Need 2 gangsters of this rarity that aren''t shot, retired or fused';
  end if;
  perform 1 from public.gangsters where id = any (v_pair) for update;

  v_fee := public.usd_to_ammo(v_recipe.fee_usd);
  if v_fee > v_p.ammo then raise exception 'Need % AMMO to fuse', v_fee; end if;

  update public.gangsters set consumed_at = now() where id = any (v_pair);
  insert into public.gangsters (user_id, rarity, fused, idle, source)
  values (v_p.user_id, v_recipe.to_rarity, true, true, 'fusion') returning id into v_child;
  update public.players
     set dc = dc + v_payout, ammo = ammo - v_fee, total_claimed_dc = total_claimed_dc + v_payout
   where user_id = v_p.user_id;
  perform public.spend_ammo(v_fee);
  perform public.log_tx(v_p.user_id, 'fuse', 'Fusion',
    format('#%s + #%s → fused %s #%s · fee burned', v_pair[1], v_pair[2],
           (select name from public.rarities where id = v_recipe.to_rarity), v_child),
    v_payout, null, -v_fee);
  return jsonb_build_object('child_id', v_child, 'rarity', v_recipe.to_rarity, 'parents', to_jsonb(v_pair),
                            'payout_dc', v_payout, 'fee_ammo', v_fee);
end $$;

-- The Armory: buy items into the inventory. Paid in AMMO at the current price, burned.
create or replace function public.buy_item(p_item text, p_count int default 1)
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_p public.players;
  v_price numeric;
  v_name text;
  v_cost numeric;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  perform public.require_gang(v_p);
  if p_count is null or p_count < 1 or p_count > 1000 then raise exception 'Count must be 1 to 1000'; end if;
  select price_usd, name into v_price, v_name from public.item_prices where item = p_item;
  if v_price is null then raise exception 'Unknown item'; end if;
  v_cost := public.usd_to_ammo(v_price) * p_count;
  if v_cost > v_p.ammo then raise exception 'Need % AMMO', v_cost; end if;
  update public.players
     set ammo = ammo - v_cost,
         medkits = medkits + case when p_item = 'medkit' then p_count else 0 end,
         vests   = vests   + case when p_item = 'vest'   then p_count else 0 end,
         pistols = pistols + case when p_item = 'pistol' then p_count else 0 end,
         smgs    = smgs    + case when p_item = 'smg'    then p_count else 0 end,
         rifles  = rifles  + case when p_item = 'rifle'  then p_count else 0 end
   where user_id = v_p.user_id;
  perform public.spend_ammo(v_cost);
  perform public.log_tx(v_p.user_id, case when p_item = 'medkit' then 'medkit' else 'shop' end,
    format('Bought %s × %s', p_count, v_name), format('$%s each · burned', v_price), null, null, -v_cost);
  return jsonb_build_object('item', p_item, 'count', p_count, 'cost_ammo', v_cost);
end $$;

-- Heal shot gangsters: uses med kits from stock first, buys the missing ones.
create or replace function public.heal(p_ids bigint[])
returns jsonb language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_p public.players;
  r record;
  v_n int := 0;
  v_stock int;
  v_buy int;
  v_cost numeric := 0;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  select count(*) into v_n
    from public.gangsters g cross join lateral public.g_calc(g) c
   where g.user_id = v_p.user_id and g.consumed_at is null and g.id = any (p_ids) and c.is_shot;
  if v_n = 0 then raise exception 'Nobody to heal'; end if;
  v_stock := least(v_p.medkits, v_n);
  v_buy := v_n - v_stock;
  if v_buy > 0 then
    v_cost := v_buy * public.usd_to_ammo((select price_usd from public.item_prices where item = 'medkit'));
    if v_cost > v_p.ammo then raise exception 'Need % AMMO for % med kit(s)', v_cost, v_buy; end if;
  end if;
  for r in
    select g.id, g.rarity, c.shot_at
      from public.gangsters g cross join lateral public.g_calc(g) c
     where g.user_id = v_p.user_id and g.consumed_at is null and g.id = any (p_ids) and c.is_shot
     for update of g
  loop
    update public.gangsters
       set paused_seconds = paused_seconds + extract(epoch from (now() - r.shot_at)),
           next_shot_at = now() + make_interval(secs => public.sample_shot_gap(r.rarity)::double precision),
           vest_absorb_at = null
     where id = r.id;
  end loop;
  update public.players set medkits = medkits - v_stock, ammo = ammo - v_cost where user_id = v_p.user_id;
  perform public.spend_ammo(v_cost);
  perform public.log_tx(v_p.user_id, 'heal', 'Healed',
    format('%s gangster(s) back to farming · %s from stock, %s bought', v_n, v_stock, v_buy), null, null,
    case when v_cost > 0 then -v_cost end);
  return jsonb_build_object('healed', v_n, 'from_stock', v_stock, 'bought', v_buy, 'cost_ammo', v_cost);
end $$;

-- One weapon at a time: a new one only goes on once the current one runs out.
create or replace function public.equip_weapon(p_gangster_id bigint, p_weapon text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_p public.players;
  v_g public.gangsters;
  v_c public.gangster_calc;
  v_have int;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  v_have := case p_weapon when 'pistol' then v_p.pistols when 'smg' then v_p.smgs when 'rifle' then v_p.rifles end;
  if v_have is null then raise exception 'Unknown weapon'; end if;
  if v_have < 1 then raise exception 'No % in stock', p_weapon; end if;
  select * into v_g from public.gangsters where id = p_gangster_id and user_id = v_p.user_id and consumed_at is null for update;
  if v_g.id is null then raise exception 'Gangster not found'; end if;
  if v_g.idle then raise exception 'Put this gangster to work first'; end if;
  v_c := public.g_calc(v_g);
  if v_c.retired then raise exception 'Retired gangsters don''t need weapons'; end if;
  if v_g.weapon_id is not null and v_c.weapon_days_left > 0 then
    raise exception 'This gangster already has a weapon (% days left)', round(v_c.weapon_days_left, 1);
  end if;
  update public.gangsters
     set bonus_banked = v_c.bonus, weapon_id = p_weapon, weapon_start_active = v_c.active_seconds
   where id = v_g.id;
  update public.players
     set pistols = pistols - case when p_weapon = 'pistol' then 1 else 0 end,
         smgs    = smgs    - case when p_weapon = 'smg'    then 1 else 0 end,
         rifles  = rifles  - case when p_weapon = 'rifle'  then 1 else 0 end
   where user_id = v_p.user_id;
  perform public.log_tx(v_p.user_id, 'equip', 'Equipped ' || (select name from public.weapons where id = p_weapon), '#' || v_g.id);
end $$;

-- Vest: stops the next bullet (the one already due); the bullet after that is rolled now.
create or replace function public.equip_vest(p_gangster_id bigint)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_p public.players;
  v_g public.gangsters;
  v_c public.gangster_calc;
  v_due timestamptz;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  if v_p.vests < 1 then raise exception 'No vest in stock'; end if;
  select * into v_g from public.gangsters where id = p_gangster_id and user_id = v_p.user_id and consumed_at is null for update;
  if v_g.id is null then raise exception 'Gangster not found'; end if;
  if v_g.idle then raise exception 'Put this gangster to work first'; end if;
  v_c := public.g_calc(v_g);
  if v_c.is_shot then raise exception 'Heal this gangster first'; end if;
  if v_c.retired then raise exception 'Retired gangsters don''t need a vest'; end if;
  if v_c.has_vest then raise exception 'Already wearing a vest'; end if;
  v_due := coalesce(v_g.next_shot_at, now() + make_interval(secs => public.sample_shot_gap(v_g.rarity)::double precision));
  update public.gangsters
     set vest_absorb_at = v_due,
         next_shot_at = v_due + make_interval(secs => public.sample_shot_gap(v_g.rarity)::double precision)
   where id = v_g.id;
  update public.players set vests = vests - 1 where user_id = v_p.user_id;
  perform public.log_tx(v_p.user_id, 'equip', 'Equipped Kevlar vest', '#' || v_g.id || ' · stops the next bullet');
end $$;

-- Start a deposit: the client makes a random public key (Solana Pay reference), registers it here, then
-- sends the USDC / AMMO transfer to the game wallet with that reference. The backend confirms it.
create or replace function public.create_deposit_intent(p_asset text, p_reference text)
returns public.deposits language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_p public.players;
  v_d public.deposits;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  if p_asset not in ('usdc', 'ammo') then raise exception 'Unknown asset'; end if;
  if p_reference !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'Invalid reference'; end if;
  insert into public.deposits (user_id, asset, reference) values (v_p.user_id, p_asset, p_reference)
  returning * into v_d;
  return v_d;
end $$;

-- Withdraw DC as USDC: one withdrawal per wallet every withdraw_cooldown_hours.
-- withdraw_fee_pct (10%) of the USDC value stays in the Reward Pool; the rest is sent (rounded down to the cent).
create or replace function public.request_withdrawal_usdc(p_amount_dc numeric)
returns public.withdrawals language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c public.game_config := public.cfg();
  v_p public.players;
  v_w public.withdrawals;
  v_next timestamptz;
  v_gross numeric;
  v_net numeric;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  if v_p.wallet is null then raise exception 'Link your wallet first'; end if;
  if p_amount_dc is null or p_amount_dc < c.min_withdraw_dc then raise exception 'Minimum withdrawal is % DC', c.min_withdraw_dc; end if;
  if p_amount_dc > v_p.dc then raise exception 'Not enough DC'; end if;
  v_next := v_p.last_withdraw_at + make_interval(hours => c.withdraw_cooldown_hours);
  if v_next > now() then raise exception 'One withdrawal every % hours. Next one at %', c.withdraw_cooldown_hours, v_next; end if;

  v_gross := p_amount_dc / c.dacity_per_usdc;
  v_net := floor(v_gross * (100 - c.withdraw_fee_pct)) / 100;
  if v_net <= 0 then raise exception 'Amount too small after the % percent fee', c.withdraw_fee_pct; end if;

  update public.players set dc = dc - p_amount_dc, last_withdraw_at = now() where user_id = v_p.user_id;
  insert into public.withdrawals (user_id, asset, amount_in, amount_out, wallet, note)
  values (v_p.user_id, 'usdc', p_amount_dc, v_net, v_p.wallet,
          format('fee %s%% = %s USDC kept in the Reward Pool', c.withdraw_fee_pct, round(v_gross - v_net, 6)))
  returning * into v_w;
  perform public.log_tx(v_p.user_id, 'withdraw', 'Withdraw',
    format('Vault: DC → USDC (requested) · %s%% fee $%s to the Reward Pool', c.withdraw_fee_pct, to_char(v_gross - v_net, 'FM999999990.00')),
    -p_amount_dc, v_w.amount_out);
  return v_w;
end $$;

-- Withdraw unspent AMMO back to the wallet (no cooldown).
create or replace function public.request_withdrawal_ammo(p_amount numeric)
returns public.withdrawals language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_p public.players;
  v_w public.withdrawals;
begin
  perform public.assert_open();
  v_p := public.lock_me();
  if v_p.wallet is null then raise exception 'Link your wallet first'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_amount > v_p.ammo then raise exception 'Not enough AMMO in the game'; end if;
  update public.players set ammo = ammo - p_amount where user_id = v_p.user_id;
  insert into public.withdrawals (user_id, asset, amount_in, amount_out, wallet)
  values (v_p.user_id, 'ammo', p_amount, p_amount, v_p.wallet)
  returning * into v_w;
  perform public.log_tx(v_p.user_id, 'ammoWithdraw', 'Withdraw AMMO', 'Game → wallet (requested)', null, null, -p_amount);
  return v_w;
end $$;


-- -----------------------------------------------------------------------------------------------------
-- 9. ADMIN ACTIONS (the caller's linked wallet must be in public.admins)
-- -----------------------------------------------------------------------------------------------------

create or replace function public.assert_admin()
returns text language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  if not public.is_admin() then raise exception 'Admins only'; end if;
  return (select wallet from public.players where user_id = auth.uid());
end $$;

create or replace function public.admin_set_maintenance(p_on boolean, p_message text default '')
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_who text := public.assert_admin();
begin
  update public.platform_state
     set maintenance_on = p_on, maintenance_message = coalesce(btrim(p_message), ''),
         maintenance_since = case when p_on then now() end, updated_at = now()
   where id = 1;
  insert into public.admin_log (wallet, action, detail)
  values (v_who, case when p_on then 'Maintenance ON' else 'Maintenance OFF' end, coalesce(p_message, ''));
end $$;

create or replace function public.admin_announce(p_kind text, p_title text, p_message text, p_expires_at timestamptz default null)
returns public.announcements language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_who text := public.assert_admin();
  v_a public.announcements;
begin
  update public.announcements set active = false where active;
  insert into public.announcements (kind, title, message, expires_at)
  values (p_kind, btrim(p_title), btrim(p_message), p_expires_at)
  returning * into v_a;
  insert into public.admin_log (wallet, action, detail) values (v_who, 'Announcement', '[' || p_kind || '] ' || p_title);
  return v_a;
end $$;

create or replace function public.admin_clear_announcement()
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_who text := public.assert_admin();
begin
  update public.announcements set active = false where active;
  insert into public.admin_log (wallet, action, detail) values (v_who, 'Announcement removed', '');
end $$;

create or replace function public.admin_grant_dc(p_wallet text, p_amount numeric)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_who text := public.assert_admin();
  v_user uuid;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  select user_id into v_user from public.players where wallet = p_wallet for update;
  if v_user is null then raise exception 'No player with that wallet'; end if;
  update public.players set dc = dc + p_amount where user_id = v_user;
  perform public.log_tx(v_user, 'gift', 'Received coins', 'Sent by an admin', p_amount);
  insert into public.admin_log (wallet, action, detail) values (v_who, 'Sent coins', p_amount || ' DC → ' || p_wallet);
end $$;

create or replace function public.admin_grant_boxes(p_wallet text, p_count int)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_who text := public.assert_admin();
  v_user uuid;
  v_seed text;
  v_box bigint;
  i int;
begin
  if p_count is null or p_count < 1 or p_count > 100 then raise exception 'Count must be 1 to 100'; end if;
  select user_id into v_user from public.players where wallet = p_wallet for update;
  if v_user is null then raise exception 'No player with that wallet'; end if;
  for i in 1 .. p_count loop
    v_seed := encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text || i::text, 'UTF8')), 'hex');
    insert into public.boxes (user_id, source, ready_at, server_seed_hash)
    values (v_user, 'gift', now(), encode(sha256(convert_to(v_seed, 'UTF8')), 'hex'))
    returning id into v_box;
    insert into public.box_seeds (box_id, server_seed) values (v_box, v_seed);
  end loop;
  perform public.log_tx(v_user, 'gift', 'Received boxes', p_count || ' box(es) sent by an admin');
  insert into public.admin_log (wallet, action, detail) values (v_who, 'Sent boxes', p_count || ' → ' || p_wallet);
end $$;

-- Gift Armory items (weapons, vests, med kits) straight into a player's stock. Nothing is paid or burned.
create or replace function public.admin_grant_items(p_wallet text, p_item text, p_count int)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_who text := public.assert_admin();
  v_user uuid;
  v_name text;
begin
  if p_count is null or p_count < 1 or p_count > 100 then raise exception 'Count must be 1 to 100'; end if;
  select name into v_name from public.item_prices where item = p_item;
  if v_name is null then raise exception 'Unknown item'; end if;
  select user_id into v_user from public.players where wallet = p_wallet for update;
  if v_user is null then raise exception 'No player with that wallet'; end if;
  update public.players
     set medkits = medkits + case when p_item = 'medkit' then p_count else 0 end,
         vests   = vests   + case when p_item = 'vest'   then p_count else 0 end,
         pistols = pistols + case when p_item = 'pistol' then p_count else 0 end,
         smgs    = smgs    + case when p_item = 'smg'    then p_count else 0 end,
         rifles  = rifles  + case when p_item = 'rifle'  then p_count else 0 end
   where user_id = v_user;
  perform public.log_tx(v_user, 'gift', 'Received items', format('%s × %s sent by an admin', p_count, v_name));
  insert into public.admin_log (wallet, action, detail) values (v_who, 'Sent items', format('%s × %s → %s', p_count, v_name, p_wallet));
end $$;

-- Admin read access to the log and the withdrawal queue.
create or replace function public.admin_recent_log(p_limit int default 50)
returns setof public.admin_log language plpgsql stable security definer set search_path = public, pg_temp
as $$
begin
  perform public.assert_admin();
  return query select * from public.admin_log order by at desc limit least(greatest(p_limit, 1), 500);
end $$;


-- -----------------------------------------------------------------------------------------------------
-- 10. SERVER-ONLY ACTIONS (service_role key, from your backend / Edge Functions)
-- -----------------------------------------------------------------------------------------------------

-- After verifying the wallet's signature at login.
create or replace function public.link_wallet(p_user_id uuid, p_wallet text)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_wallet !~ '^[1-9A-HJ-NP-Za-km-z]{32,44}$' then raise exception 'Invalid Solana address'; end if;
  insert into public.players (user_id, wallet) values (p_user_id, p_wallet)
  on conflict (user_id) do update set wallet = excluded.wallet;
end $$;

-- After finding the transfer on-chain (right reference, right mint, sent to the right game wallet).
create or replace function public.confirm_deposit(p_reference text, p_signature text, p_amount numeric, p_sender text default null)
returns public.deposits language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  c public.game_config := public.cfg();
  v_d public.deposits;
  v_referrer uuid;
  v_referrer_wallet text;
  v_referee_gang text;
  v_bonus numeric;
begin
  select * into v_d from public.deposits where reference = p_reference for update;
  if v_d.id is null then raise exception 'Unknown deposit reference'; end if;
  if v_d.status = 'confirmed' then return v_d; end if;                 -- idempotent
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  update public.deposits
     set status = 'confirmed', amount = p_amount, signature = p_signature, sender = p_sender, confirmed_at = now()
   where id = v_d.id
  returning * into v_d;
  if v_d.asset = 'usdc' then
    update public.players
       set dc = dc + p_amount * c.dacity_per_usdc, total_deposited_usdc = total_deposited_usdc + p_amount
     where user_id = v_d.user_id;
    perform public.log_tx(v_d.user_id, 'deposit', 'Deposit', 'Vault: USDC → DC', p_amount * c.dacity_per_usdc, -p_amount);

    -- referral: the referrer earns referral_pct of this deposit, in DC. Not when the money came from the
    -- referrer's own wallet (that's them funding their own recruit). One reward per deposit, ever.
    select p.referred_by, r.wallet, p.gang_name into v_referrer, v_referrer_wallet, v_referee_gang
      from public.players p left join public.players r on r.user_id = p.referred_by
     where p.user_id = v_d.user_id;
    v_bonus := round(p_amount * c.dacity_per_usdc * c.referral_pct / 100, 2);
    if v_referrer is not null and v_bonus > 0 and (p_sender is null or p_sender is distinct from v_referrer_wallet) then
      insert into public.referral_rewards (referrer, referee, deposit_id, amount_usdc, amount_dc)
      values (v_referrer, v_d.user_id, v_d.id, p_amount, v_bonus)
      on conflict (deposit_id) do nothing;
      if found then
        update public.players set dc = dc + v_bonus, referral_earned_dc = referral_earned_dc + v_bonus where user_id = v_referrer;
        perform public.log_tx(v_referrer, 'referral', 'Referral bonus',
          format('%s%% of a %s USDC deposit by %s', c.referral_pct, p_amount, coalesce(v_referee_gang, 'a recruit')), v_bonus);
      end if;
    end if;
  else
    update public.players set ammo = ammo + p_amount where user_id = v_d.user_id;
    perform public.log_tx(v_d.user_id, 'ammoDeposit', 'Deposit AMMO', 'Wallet → game', null, null, p_amount);
  end if;
  return v_d;
end $$;

-- After sending (or failing to send) a withdrawal. A failed one is refunded and frees the cooldown.
create or replace function public.mark_withdrawal(p_id bigint, p_status text, p_signature text default null, p_note text default null)
returns public.withdrawals language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_w public.withdrawals;
begin
  if p_status not in ('sent', 'failed') then raise exception 'Status must be sent or failed'; end if;
  select * into v_w from public.withdrawals where id = p_id for update;
  if v_w.id is null then raise exception 'Unknown withdrawal'; end if;
  if v_w.status <> 'requested' then raise exception 'This withdrawal is already %', v_w.status; end if;
  update public.withdrawals
     set status = p_status, signature = p_signature, note = coalesce(p_note, note), updated_at = now()
   where id = p_id
  returning * into v_w;
  if p_status = 'failed' then
    if v_w.asset = 'usdc' then
      update public.players set dc = dc + v_w.amount_in, last_withdraw_at = null where user_id = v_w.user_id;
      perform public.log_tx(v_w.user_id, 'withdraw', 'Withdrawal refunded', coalesce(p_note, 'Could not be sent'), v_w.amount_in);
    else
      update public.players set ammo = ammo + v_w.amount_in where user_id = v_w.user_id;
      perform public.log_tx(v_w.user_id, 'ammoWithdraw', 'AMMO withdrawal refunded', coalesce(p_note, 'Could not be sent'), null, null, v_w.amount_in);
    end if;
  end if;
  return v_w;
end $$;

-- Price feed: call every ~30s with the $AMMO USD price (DexScreener / Jupiter). Keeps 1 day of samples.
create or replace function public.record_price(p_price_usd numeric, p_source text default 'dexscreener')
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if p_price_usd is null or p_price_usd <= 0 then raise exception 'Price must be positive'; end if;
  insert into public.token_price_samples (price_usd, source) values (p_price_usd, p_source);
  delete from public.token_price_samples where at < now() - interval '1 day';
end $$;

-- After burning spent AMMO on-chain from the game's AMMO wallet.
create or replace function public.record_burn(p_amount numeric, p_signature text)
returns public.burn_batches language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_b public.burn_batches;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  insert into public.burn_batches (amount, signature) values (p_amount, p_signature) returning * into v_b;
  update public.platform_state
     set ammo_pending_burn = greatest(0, ammo_pending_burn - p_amount),
         ammo_burned_onchain = ammo_burned_onchain + p_amount,
         updated_at = now()
   where id = 1;
  return v_b;
end $$;


-- -----------------------------------------------------------------------------------------------------
-- 10a. PAYMENT SERVER (Railway) · bookkeeping that keeps withdrawals and burns from ever running twice
-- -----------------------------------------------------------------------------------------------------

-- Withdrawals: the server builds the transfer (player pays the network fee), pre-signs it as the sender
-- and hands it to the player to sign and send. Every withdrawal has its own reference key inside its
-- transfer, so the server can always find out whether it landed. A new transaction is only issued once
-- the previous one has expired (tx_last_valid_height passed) and is confirmed not to have landed.

-- Burns: a batch is recorded as 'pending' (with its signature) BEFORE it is sent, so a crash between
-- sending and recording can never cause the same AMMO to be burned twice.


create or replace function public.acquire_lease(p_name text, p_holder text, p_ttl_seconds int)
returns boolean language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_holder text;
begin
  insert into public.worker_leases (name, holder, expires_at)
  values (p_name, p_holder, now() + make_interval(secs => p_ttl_seconds))
  on conflict (name) do update
     set holder = excluded.holder, expires_at = excluded.expires_at
   where public.worker_leases.holder = excluded.holder or public.worker_leases.expires_at < now()
  returning holder into v_holder;
  return coalesce(v_holder = p_holder, false);
end $$;

-- Reserve spent AMMO for an on-chain burn that is about to be sent.
create or replace function public.start_burn(p_amount numeric, p_signature text, p_last_valid_height bigint)
returns public.burn_batches language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_b public.burn_batches;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if exists (select 1 from public.burn_batches where status = 'pending') then raise exception 'A burn is already in flight'; end if;
  update public.platform_state set ammo_pending_burn = ammo_pending_burn - p_amount, updated_at = now()
   where id = 1 and ammo_pending_burn >= p_amount;
  if not found then raise exception 'Not that much AMMO waiting to be burned'; end if;
  insert into public.burn_batches (amount, signature, status, last_valid_height)
  values (p_amount, p_signature, 'pending', p_last_valid_height)
  returning * into v_b;
  return v_b;
end $$;

-- The burn confirmed on-chain (p_ok) or definitely didn't land (expired / failed): settle the counters.
create or replace function public.finish_burn(p_signature text, p_ok boolean)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_b public.burn_batches;
begin
  select * into v_b from public.burn_batches where signature = p_signature for update;
  if v_b.id is null then raise exception 'Unknown burn'; end if;
  if v_b.status <> 'pending' then return; end if;                       -- idempotent
  update public.burn_batches set status = case when p_ok then 'confirmed' else 'failed' end where id = v_b.id;
  if p_ok then
    update public.platform_state set ammo_burned_onchain = ammo_burned_onchain + v_b.amount, updated_at = now() where id = 1;
  else
    update public.platform_state set ammo_pending_burn = ammo_pending_burn + v_b.amount, updated_at = now() where id = 1;
  end if;
end $$;


-- -----------------------------------------------------------------------------------------------------
-- 10c. REFERRALS (player + public reads)
-- -----------------------------------------------------------------------------------------------------

-- The caller's referral link code, how many joined with it and what it earned.
create or replace function public.my_referrals()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  return (
    select jsonb_build_object(
      'code', p.referral_code,
      'pct', (public.cfg()).referral_pct,
      'earned_dc', p.referral_earned_dc,
      'recruits', (select count(*) from public.players r where r.referred_by = v_uid),
      'depositors', (select count(distinct referee) from public.referral_rewards w where w.referrer = v_uid),
      'list', (select coalesce(jsonb_agg(x order by x.joined_at desc), '[]'::jsonb) from (
                 select r.gang_name as gang, r.referred_at as joined_at,
                        coalesce((select sum(amount_dc) from public.referral_rewards w where w.referrer = v_uid and w.referee = r.user_id), 0) as earned_dc
                   from public.players r where r.referred_by = v_uid
                  order by r.referred_at desc limit 100) x)
    )
    from public.players p where p.user_id = v_uid
  );
end $$;

-- Who owns a referral code (the landing shows "invited by <gang>"). Gang names are public anyway.
create or replace function public.referral_lookup(p_code text)
returns text language sql stable security definer set search_path = public, pg_temp
as $$ select gang_name from public.players where referral_code = public.ref_code(p_code) and gang_name is not null $$;

-- Gangs founded before referrals existed get their code now (first come keeps the plain name).
do $$
declare r record; v_code text; n int;
begin
  for r in select user_id, gang_name from public.players
            where gang_name is not null and referral_code is null order by gang_founded_at nulls last
  loop
    v_code := public.ref_code(r.gang_name);
    if char_length(v_code) < 3 then v_code := 'gang-' || left(r.user_id::text, 8); end if;
    n := 1;
    while exists (select 1 from public.players where referral_code = case when n = 1 then v_code else v_code || '-' || n end) loop
      n := n + 1;
    end loop;
    update public.players set referral_code = case when n = 1 then v_code else v_code || '-' || n end where user_id = r.user_id;
  end loop;
end $$;


-- -----------------------------------------------------------------------------------------------------
-- 10b. PUBLIC $AMMO STATS (for the token page: totals and an anonymous burn feed, no private data)
-- -----------------------------------------------------------------------------------------------------

create or replace function public.ammo_stats()
returns jsonb language sql stable security definer set search_path = public, pg_temp
as $$
  with spends as (
    select t.at, -t.ammo as amount, p.wallet,
           case
             when t.type in ('medkit', 'heal') then 'medkit'
             when t.type = 'shop' and t.title ilike '%vest%' then 'vest'
             when t.type = 'shop' then 'weapon'
             when t.type = 'fuse' then 'fusion'
             when t.type = 'claimAll' then 'claimAll'
           end as category,
           t.title
      from public.player_transactions t
      join public.players p on p.user_id = t.user_id
     where t.ammo < 0 and t.type in ('medkit', 'heal', 'shop', 'fuse', 'claimAll')
  )
  select jsonb_build_object(
    'spent_total',    (select ammo_spent_total from public.platform_state where id = 1),
    'pending_burn',   (select ammo_pending_burn from public.platform_state where id = 1),
    'burned_onchain', (select ammo_burned_onchain from public.platform_state where id = 1),
    'spent_24h',      (select coalesce(sum(amount), 0) from spends where at > now() - interval '24 hours'),
    'spent_1h',       (select coalesce(sum(amount), 0) from spends where at > now() - interval '1 hour'),
    'spends',         (select count(*) from spends),
    'by_category',    (select coalesce(jsonb_object_agg(category, jsonb_build_object('amount', amount, 'count', n)), '{}'::jsonb)
                         from (select category, sum(amount) as amount, count(*) as n from spends group by category) c),
    'hourly_24h',     (select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'amount', amount) order by h), '[]'::jsonb)
                         from (select date_trunc('hour', at) as h, sum(amount) as amount
                                 from spends where at > now() - interval '24 hours' group by 1) x),
    'recent',         (select coalesce(jsonb_agg(r order by r.at desc), '[]'::jsonb)
                         from (select at, amount, category, title as label,
                                      case when wallet is null then 'player'
                                           else left(wallet, 4) || '…' || right(wallet, 4) end as who
                                 from spends order by at desc limit 30) r),
    'burns',          (select coalesce(jsonb_agg(b order by b.created_at desc), '[]'::jsonb)
                         from (select amount, signature, created_at from public.burn_batches where status = 'confirmed'
                                order by created_at desc limit 20) b)
  )
$$;


-- -----------------------------------------------------------------------------------------------------
-- 11. NEW USERS → PLAYER ROW
-- -----------------------------------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  insert into public.players (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Sign in with Solana: link the wallet as soon as the identity exists.
create or replace function public.handle_new_identity()
returns trigger language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_wallet text := substring(new.provider_id from '^web3:solana:([1-9A-HJ-NP-Za-km-z]{32,44})$');
begin
  if new.provider = 'web3' and v_wallet is not null then
    insert into public.players (user_id, wallet) values (new.user_id, v_wallet)
    on conflict (user_id) do update set wallet = coalesce(public.players.wallet, excluded.wallet);
  end if;
  return new;
end $$;

drop trigger if exists on_auth_identity_created on auth.identities;
create trigger on_auth_identity_created after insert on auth.identities
  for each row execute function public.handle_new_identity();


-- -----------------------------------------------------------------------------------------------------
-- 12. WHO CAN CALL WHAT
-- -----------------------------------------------------------------------------------------------------
-- Supabase grants EXECUTE on new functions to everyone by default, so lock everything down first and
-- then open only what each role needs.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.proname in (
         'cfg', 'is_admin', 'lock_me', 'assert_open', 'require_gang', 'log_tx', 'spend_ammo', 'ammo_price_usd',
         'usd_to_ammo', 'sample_shot_gap', 'g_calc', 'ensure_player', 'found_gang', 'quote_boxes', 'buy_boxes',
         'open_box', 'deploy', 'claim', 'claim_all', 'fuse', 'buy_item', 'heal', 'equip_weapon', 'equip_vest',
         'create_deposit_intent', 'request_withdrawal_usdc', 'request_withdrawal_ammo', 'assert_admin',
         'admin_set_maintenance', 'admin_announce', 'admin_clear_announcement', 'admin_grant_dc',
         'admin_grant_boxes', 'admin_grant_items', 'admin_recent_log', 'link_wallet', 'confirm_deposit', 'mark_withdrawal',
         'record_price', 'record_burn', 'handle_new_user', 'handle_new_identity', 'wallet_of', 'ammo_stats',
         'acquire_lease', 'start_burn', 'finish_burn', 'ref_code', 'my_referrals', 'referral_lookup')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- read helpers used by the views / the app (no side effects)
grant execute on function public.g_calc(public.gangsters, timestamptz) to anon, authenticated;
grant execute on function public.ammo_price_usd() to anon, authenticated;
grant execute on function public.usd_to_ammo(numeric) to anon, authenticated;
grant execute on function public.quote_boxes(int) to anon, authenticated;
grant execute on function public.cfg() to anon, authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.ammo_stats() to anon, authenticated;

-- player actions
grant execute on function public.ensure_player() to authenticated;
grant execute on function public.found_gang(int, text, text) to authenticated;
grant execute on function public.my_referrals() to authenticated;
grant execute on function public.referral_lookup(text) to anon, authenticated;
grant execute on function public.ref_code(text) to anon, authenticated;
grant execute on function public.buy_boxes(int) to authenticated;
grant execute on function public.open_box(bigint, text) to authenticated;
grant execute on function public.deploy(bigint[]) to authenticated;
grant execute on function public.claim(bigint) to authenticated;
grant execute on function public.claim_all(bigint[]) to authenticated;
grant execute on function public.fuse(int) to authenticated;
grant execute on function public.buy_item(text, int) to authenticated;
grant execute on function public.heal(bigint[]) to authenticated;
grant execute on function public.equip_weapon(bigint, text) to authenticated;
grant execute on function public.equip_vest(bigint) to authenticated;
grant execute on function public.create_deposit_intent(text, text) to authenticated;
grant execute on function public.request_withdrawal_usdc(numeric) to authenticated;
grant execute on function public.request_withdrawal_ammo(numeric) to authenticated;

-- admin actions (each one checks public.admins itself)
grant execute on function public.admin_set_maintenance(boolean, text) to authenticated;
grant execute on function public.admin_announce(text, text, text, timestamptz) to authenticated;
grant execute on function public.admin_clear_announcement() to authenticated;
grant execute on function public.admin_grant_dc(text, numeric) to authenticated;
grant execute on function public.admin_grant_boxes(text, int) to authenticated;
grant execute on function public.admin_grant_items(text, text, int) to authenticated;
grant execute on function public.admin_recent_log(int) to authenticated;

-- tables and views: reads go through RLS; no direct writes for app users
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to anon, authenticated;
grant select on public.my_gangsters, public.token_price to anon, authenticated;


-- -----------------------------------------------------------------------------------------------------
-- 13. ADMINS · add your admin wallet(s) here (Solana addresses), then run this line again when needed
-- -----------------------------------------------------------------------------------------------------
-- insert into public.admins (wallet) values ('YOUR_SOLANA_WALLET_ADDRESS') on conflict do nothing;
