-- ============================================================
-- EscribAI · Analítica sin cookies
--
-- Guarda SOLO eventos anónimos: qué pasó, en qué página y cuándo.
-- No hay identificador de usuario, ni IP, ni cookie, ni almacenamiento
-- en el navegador. Por eso no necesita banner de consentimiento.
--
-- Pega este archivo entero en Supabase -> SQL Editor -> Run.
-- ============================================================

create table if not exists eventos (
  id      bigserial primary key,
  evento  text        not null,
  pagina  text,
  origen  text,                 -- de dónde venía la visita (dominio, sin ruta)
  disp    text,                 -- movil | escritorio
  creado  timestamptz not null default now()
);

create index if not exists eventos_creado_idx on eventos (creado desc);
create index if not exists eventos_evento_idx on eventos (evento, creado desc);

-- Nadie puede leer ni escribir desde el navegador: solo entra por la
-- edge function, que usa la clave de servicio.
alter table eventos enable row level security;

-- ------------------------------------------------------------
-- Embudo de los últimos 30 días.
-- Para verlo: SQL Editor -> select * from embudo();
-- ------------------------------------------------------------
create or replace function embudo(dias int default 30)
returns table(evento text, veces bigint)
language sql
security definer
set search_path = public
as $fn$
  select e.evento, count(*)::bigint as veces
  from eventos e
  where e.creado >= now() - (dias || ' days')::interval
  group by e.evento
  order by veces desc;
$fn$;

revoke all on function embudo(int) from public;
revoke all on function embudo(int) from anon;
revoke all on function embudo(int) from authenticated;

-- ------------------------------------------------------------
-- Visitas por día, para ver la tendencia.
-- Para verlo: select * from visitas_por_dia();
-- ------------------------------------------------------------
create or replace function visitas_por_dia(dias int default 30)
returns table(dia date, visitas bigint, pruebas bigint, registros bigint)
language sql
security definer
set search_path = public
as $fn$
  select
    (e.creado at time zone 'Europe/Madrid')::date as dia,
    count(*) filter (where e.evento = 'visita')::bigint,
    count(*) filter (where e.evento = 'prueba_inicio')::bigint,
    count(*) filter (where e.evento = 'registro')::bigint
  from eventos e
  where e.creado >= now() - (dias || ' days')::interval
  group by 1
  order by 1 desc;
$fn$;

revoke all on function visitas_por_dia(int) from public;
revoke all on function visitas_por_dia(int) from anon;
revoke all on function visitas_por_dia(int) from authenticated;
