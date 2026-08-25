-- Execute no SQL Editor do projeto Supabase.
-- O bot usa somente uma chave secreta de servidor. anon/authenticated não recebem acesso.

create table if not exists public.freight_reports (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null check (phone_number ~ '^[0-9]{10,15}$'),
  source_message_id text not null unique,
  cidade_origem text not null check (length(btrim(cidade_origem)) > 0),
  cidade_destino text not null check (length(btrim(cidade_destino)) > 0),
  diarias integer not null check (diarias >= 0),
  litros_oleo numeric(12, 3) not null check (litros_oleo >= 0),
  valor_oleo numeric(14, 2) not null check (valor_oleo >= 0),
  custo_adicional numeric(14, 2) not null check (custo_adicional >= 0),
  created_at timestamptz not null default now()
);

create index if not exists freight_reports_phone_created_idx
  on public.freight_reports (phone_number, created_at desc);

create table if not exists public.whatsapp_bot_sessions (
  phone_number text primary key check (phone_number ~ '^[0-9]{10,15}$'),
  state text not null default 'idle'
    check (state in ('idle', 'menu', 'awaiting_report', 'awaiting_confirmation')),
  pending_report jsonb,
  pending_source_message_id text,
  updated_at timestamptz not null default now(),
  constraint whatsapp_bot_sessions_pending_check check (
    (
      state = 'awaiting_confirmation'
      and pending_report is not null
      and jsonb_typeof(pending_report) = 'object'
      and pending_source_message_id is not null
    )
    or
    (
      state <> 'awaiting_confirmation'
      and pending_report is null
      and pending_source_message_id is null
    )
  )
);

create table if not exists public.processed_whatsapp_messages (
  message_id text primary key,
  phone_number text not null check (phone_number ~ '^[0-9]{10,15}$'),
  processed_at timestamptz not null default now()
);

create index if not exists processed_whatsapp_messages_processed_idx
  on public.processed_whatsapp_messages (processed_at desc);

create table if not exists public.whatsapp_baileys_auth (
  session_id text not null,
  auth_key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (session_id, auth_key)
);

alter table public.freight_reports enable row level security;
alter table public.whatsapp_bot_sessions enable row level security;
alter table public.processed_whatsapp_messages enable row level security;
alter table public.whatsapp_baileys_auth enable row level security;

revoke all on table public.freight_reports from anon, authenticated;
revoke all on table public.whatsapp_bot_sessions from anon, authenticated;
revoke all on table public.processed_whatsapp_messages from anon, authenticated;
revoke all on table public.whatsapp_baileys_auth from anon, authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on table public.freight_reports to service_role;
grant select, insert, update, delete on table public.whatsapp_bot_sessions to service_role;
grant select, insert, update, delete on table public.processed_whatsapp_messages to service_role;
grant select, insert, update, delete on table public.whatsapp_baileys_auth to service_role;

comment on table public.freight_reports is 'Relatórios confirmados pelo único número autorizado no bot TruckPlan.';
comment on table public.whatsapp_bot_sessions is 'Estado persistente e relatório temporário aguardando confirmação.';
comment on table public.processed_whatsapp_messages is 'Chaves de idempotência dos eventos recebidos do WhatsApp.';
comment on table public.whatsapp_baileys_auth is 'Credenciais e chaves Signal do dispositivo vinculado; acesso exclusivo do serviço.';
