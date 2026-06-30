-- Master report table
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  report_id text unique,
  date_key date not null,
  theme_key text not null,
  theme_label text,
  filename text,
  created_at timestamptz default now()
);

-- Sentiment summary per report
create table if not exists sentiment (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  pos numeric, neu numeric, neg numeric,
  pos_count int, neu_count int, neg_count int,
  risk_level text
);

-- Per-platform breakdown
create table if not exists platforms (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  platform text,
  posts int, comments int, users int,
  sent_pos numeric, sent_neu numeric, sent_neg numeric
);

-- Alert posts
create table if not exists alert_posts (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  url text, text text, tipo text, platform text,
  time text, score text, razon text, engagement int, username text
);

-- Opportunity posts
create table if not exists opportunity_posts (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  url text, text text, impacto text, platform text,
  time text, score text, razon text, engagement int, username text
);

-- Complaint categories + items as jsonb
create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  titulo text, porcentaje numeric,
  items jsonb
);

-- News items
create table if not exists news_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  rating text, group_titulo text,
  titulo text, fuente text, fecha text, link text
);

-- Trending topics
create table if not exists trending_topics (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  rank int, titulo text, description text,
  views bigint, likes bigint, pos_pct numeric, neg_pct numeric
);

-- Influencers
create table if not exists influencers (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  rank int, username text, platform text,
  followers bigint, sentiment text, categoria text, url text
);

-- Timeline events
create table if not exists timeline_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  event_date date, main text, sentiment text, engagement text, posts int
);

-- Pros and cons (one row per item)
create table if not exists pros_cons (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  type text, -- 'pro', 'con', 'neutral'
  item text
);

-- Reconocimientos
create table if not exists reconocimientos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  titulo text, description text
);

-- Keywords
create table if not exists keywords (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  word text, count int
);

-- Emojis
create table if not exists emojis (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  emoji text, count int
);

-- Comments topics
create table if not exists comments_topics (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  titulo text, porcentaje numeric, items jsonb
);

-- Voice segments
create table if not exists voice_segments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  label text, narrativa text, sentimiento text
);

-- Narrative gap (one row per report, stored as jsonb for flexibility)
create table if not exists narrative_gap (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  oficial jsonb, contraste jsonb, resumen jsonb
);

-- Enable RLS and allow anon full access (internal dashboard)
alter table reports enable row level security;
alter table sentiment enable row level security;
alter table platforms enable row level security;
alter table alert_posts enable row level security;
alter table opportunity_posts enable row level security;
alter table complaints enable row level security;
alter table news_items enable row level security;
alter table trending_topics enable row level security;
alter table influencers enable row level security;
alter table timeline_events enable row level security;
alter table pros_cons enable row level security;
alter table reconocimientos enable row level security;
alter table keywords enable row level security;
alter table emojis enable row level security;
alter table comments_topics enable row level security;
alter table voice_segments enable row level security;
alter table narrative_gap enable row level security;

-- Policies: allow anon read/insert/delete
do $$ declare t text; begin
  foreach t in array array['reports','sentiment','platforms','alert_posts','opportunity_posts',
    'complaints','news_items','trending_topics','influencers','timeline_events',
    'pros_cons','reconocimientos','keywords','emojis','comments_topics','voice_segments','narrative_gap']
  loop
    execute format('create policy "anon_all" on %I for all to anon using (true) with check (true)', t);
  end loop;
end $$;


-- =================================================================================
-- NEW TABLES: SCARPE POSTS, COMMENTS AND PERSISTENT ALLIES/CRITICS (VOICES)
-- =================================================================================

-- 1. Scraped posts table (To store every individual post parsed from Apify scrapers)
create table if not exists scraped_posts (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  url text,
  text text,
  username text,
  platform text,
  published_date timestamptz,
  likes int default 0,
  comments_count int default 0,
  shares int default 0,
  retweets int default 0,
  bookmarks int default 0,
  views bigint default 0,
  followers int default 0,
  thumbnail text,
  sentiment text, -- 'positive', 'neutral', 'negative'
  theme_key text,
  created_at timestamptz default now()
);

-- 2. Scraped comments table (To store individual comments belonging to scraped posts)
create table if not exists scraped_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references scraped_posts(id) on delete cascade,
  text text,
  author text,
  published_time timestamptz,
  likes int default 0,
  replies int default 0,
  views int default 0,
  url text,
  created_at timestamptz default now()
);

-- 3. Persistent allies and contrarios (voices) per report
create table if not exists allies_critics_voices (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports(id) on delete cascade,
  username text not null,
  platform text,
  sentiment text, -- 'positive', 'neutral', 'negative'
  followers int default 0,
  posts_count int default 0,
  total_engagement int default 0,
  likes_count int default 0,
  comments_count int default 0,
  tier text, -- 'macro', 'medio', 'micro'
  keywords jsonb, -- array of triggered words, e.g. ["chisme", "crítica"]
  profile_url text,
  theme_key text,
  last_active timestamptz default now(),
  created_at timestamptz default now(),
  constraint unique_voice_per_report unique (report_id, username, platform)
);

-- Enable Row Level Security (RLS) on new tables
alter table scraped_posts enable row level security;
alter table scraped_comments enable row level security;
alter table allies_critics_voices enable row level security;

-- Policies: allow anon read/insert/update/delete (full access) for internal dashboard
create policy "anon_all_scraped_posts" on scraped_posts for all to anon using (true) with check (true);
create policy "anon_all_scraped_comments" on scraped_comments for all to anon using (true) with check (true);
create policy "anon_all_allies_critics_voices" on allies_critics_voices for all to anon using (true) with check (true);
