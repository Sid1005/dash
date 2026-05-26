-- Pending Telegram confirmations (food parse preview -> yes/no). Serverless-safe store.

create table public.telegram_pending (
  chat_id bigint primary key,
  action jsonb not null,
  date text not null,
  created_at timestamptz not null default now()
);

create index telegram_pending_created_at_idx on public.telegram_pending (created_at);

alter table public.telegram_pending enable row level security;
-- Intentionally no policies: only service role (server webhooks) reads/writes.
