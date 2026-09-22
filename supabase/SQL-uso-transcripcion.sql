-- ============================================================
-- EscribAI · Control de consumo de transcripción profesional
-- Ejecutar una sola vez en Supabase → SQL Editor
-- ============================================================

create table if not exists uso_transcripcion (
  id        bigserial primary key,
  user_id   uuid not null references auth.users(id) on delete cascade,
  email     text,
  segundos  integer not null default 0,
  origen    text,                       -- 'archivo' | 'mejorar'
  creado    timestamptz not null default now()
);

create index if not exists uso_transcripcion_user_mes
  on uso_transcripcion (user_id, creado desc);

alter table uso_transcripcion enable row level security;

-- Cada usuario solo puede ver su propio consumo.
-- La Edge Function escribe con la clave de servicio, así que no necesita política de insert.
drop policy if exists "ver mi propio consumo" on uso_transcripcion;
create policy "ver mi propio consumo"
  on uso_transcripcion for select
  using (auth.uid() = user_id);

-- Minutos consumidos por un usuario en el mes en curso.
create or replace function minutos_mes(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(ceil(sum(segundos)::numeric / 60), 0)::integer
  from uso_transcripcion
  where user_id = uid
    and creado >= date_trunc('month', now());
$$;

grant execute on function minutos_mes(uuid) to authenticated;
