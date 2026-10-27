-- =====================================================================
-- ConsteAi — Modelos de acta (aprender el estilo del despacho)
--
-- El cliente sube dos o tres actas suyas, la IA deduce cómo escribe y
-- guardamos SOLO esa deducción: el tono, las secciones, las fórmulas.
-- Las actas de ejemplo NO se guardan en ningún sitio. Se analizan y se
-- descartan en la misma llamada. Eso nos quita de encima el tratamiento
-- de datos personales de terceros (vecinos, importes, direcciones) que
-- vendrían dentro de esas actas.
-- =====================================================================

create table if not exists public.estilos_acta (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  nombre       text not null,
  analisis     jsonb not null,
  muestras     smallint not null default 0,
  creado       timestamptz not null default now(),
  actualizado  timestamptz not null default now()
);

create index if not exists estilos_acta_user_idx
  on public.estilos_acta (user_id, actualizado desc);

alter table public.estilos_acta enable row level security;

-- Cada cuenta ve y toca únicamente sus propios modelos. Sin excepción.
drop policy if exists estilos_propios_select on public.estilos_acta;
create policy estilos_propios_select on public.estilos_acta
  for select using (auth.uid() = user_id);

drop policy if exists estilos_propios_insert on public.estilos_acta;
create policy estilos_propios_insert on public.estilos_acta
  for insert with check (auth.uid() = user_id);

drop policy if exists estilos_propios_update on public.estilos_acta;
create policy estilos_propios_update on public.estilos_acta
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists estilos_propios_delete on public.estilos_acta;
create policy estilos_propios_delete on public.estilos_acta
  for delete using (auth.uid() = user_id);

-- Tope por cuenta: evita que una cuenta llene la tabla.
create or replace function public.limite_estilos()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare n int;
begin
  select count(*) into n from public.estilos_acta where user_id = new.user_id;
  if n >= 20 then
    raise exception 'limite_estilos';
  end if;
  return new;
end;
$$;

drop trigger if exists estilos_acta_limite on public.estilos_acta;
create trigger estilos_acta_limite
  before insert on public.estilos_acta
  for each row execute function public.limite_estilos();

revoke all on function public.limite_estilos() from public;
revoke all on function public.limite_estilos() from anon;
revoke all on function public.limite_estilos() from authenticated;
