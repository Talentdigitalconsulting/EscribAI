-- =====================================================================
-- ConsteAi — Plan Despacho (varios usuarios comparten comunidades,
-- modelos de acta, actas y una bolsa común de horas)
--
-- Reglas de aislamiento, en una frase: cada persona ve lo suyo y lo de
-- SU despacho, nunca lo de otro. Todo lo que diga «despacho_id» pasa
-- por mi_despacho(), que devuelve el despacho del usuario autenticado
-- o NULL. Un NULL nunca casa con nada: sin despacho no se ve nada
-- compartido.
--
-- Precio: 149 €/mes con 5 asientos. Horas: 8 h por asiento, en bolsa
-- común (un despacho de 5 tiene 40 h/mes entre todos).
-- =====================================================================

-- ---------------------------------------------------------------- tablas
create table if not exists public.despachos (
  id              uuid primary key default gen_random_uuid(),
  nombre          text not null,
  propietario     uuid not null references auth.users(id) on delete cascade,
  asientos        smallint not null default 5,
  plan_hasta      timestamptz,             -- null = creado pero sin pagar
  stripe_customer text,
  creado          timestamptz not null default now()
);

create table if not exists public.miembros (
  despacho_id uuid not null references public.despachos(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text,
  rol         text not null default 'miembro' check (rol in ('admin','miembro')),
  unido       timestamptz not null default now(),
  primary key (despacho_id, user_id)
);
-- Una persona pertenece como mucho a un despacho.
create unique index if not exists miembros_una_persona_idx on public.miembros (user_id);

create table if not exists public.invitaciones (
  id          uuid primary key default gen_random_uuid(),
  despacho_id uuid not null references public.despachos(id) on delete cascade,
  email       text not null,
  token       text not null unique,
  creado      timestamptz not null default now(),
  caduca      timestamptz not null,
  usado       boolean not null default false
);
create index if not exists invitaciones_despacho_idx on public.invitaciones (despacho_id, usado);

-- Organizaciones (comunidades) compartidas por el despacho. El id es el
-- mismo que usa la app en local, para que todo cuadre.
create table if not exists public.orgs_despacho (
  id              text primary key,
  despacho_id     uuid not null references public.despachos(id) on delete cascade,
  datos           jsonb not null,
  actualizado     timestamptz not null default now(),
  actualizado_por uuid
);
create index if not exists orgs_despacho_idx on public.orgs_despacho (despacho_id, actualizado desc);

alter table public.actas             add column if not exists despacho_id uuid references public.despachos(id) on delete set null;
alter table public.estilos_acta      add column if not exists despacho_id uuid references public.despachos(id) on delete set null;
alter table public.uso_transcripcion add column if not exists despacho_id uuid;

create index if not exists actas_despacho_idx    on public.actas (despacho_id, fecha desc);
create index if not exists estilos_despacho_idx  on public.estilos_acta (despacho_id);
create index if not exists uso_despacho_idx      on public.uso_transcripcion (despacho_id, creado desc);

-- ---------------------------------------------------------- funciones
-- El despacho del usuario autenticado, o NULL. SECURITY DEFINER para
-- poder leer miembros desde dentro de las políticas sin recursión.
create or replace function public.mi_despacho()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select despacho_id from public.miembros where user_id = auth.uid() limit 1
$$;

-- El plan que de verdad aplica a una persona: el de su despacho si está
-- al día, y si no, el de su propio perfil. Lo usan las funciones Edge.
create or replace function public.plan_efectivo(uid uuid)
returns table (plan text, vigente boolean, despacho_id uuid, asientos int, cuota_min int)
language plpgsql
security definer
stable
set search_path = public
as $$
declare d record; p record;
begin
  select de.id, de.asientos, de.plan_hasta into d
    from public.miembros m join public.despachos de on de.id = m.despacho_id
   where m.user_id = uid limit 1;
  if d.id is not null and d.plan_hasta is not null and d.plan_hasta > now() then
    return query select 'despacho'::text, true, d.id, d.asientos::int, (d.asientos * 480)::int;
    return;
  end if;
  select pe.plan, pe.plan_hasta into p from public.perfiles pe where pe.id = uid;
  return query select
    coalesce(p.plan, 'demo')::text,
    (p.plan_hasta is null or p.plan_hasta > now()),
    d.id,                          -- puede ser un despacho sin pagar: se devuelve para avisar
    coalesce(d.asientos, 0)::int,
    case coalesce(p.plan,'demo')
      when 'pro_mes'  then 600
      when 'pro_anyo' then 600
      when 'pro'      then 600
      when 'empresas' then 3000
      else 0 end;
end;
$$;

-- Un usuario no puede colar un despacho ajeno en una fila suya.
create or replace function public.vigila_despacho_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and new.despacho_id is not null
     and new.despacho_id is distinct from public.mi_despacho() then
    raise exception 'despacho_ajeno';
  end if;
  return new;
end;
$$;

drop trigger if exists actas_vigila_despacho on public.actas;
create trigger actas_vigila_despacho before insert or update on public.actas
  for each row execute function public.vigila_despacho_id();

drop trigger if exists estilos_vigila_despacho on public.estilos_acta;
create trigger estilos_vigila_despacho before insert or update on public.estilos_acta
  for each row execute function public.vigila_despacho_id();

drop trigger if exists orgs_vigila_despacho on public.orgs_despacho;
create trigger orgs_vigila_despacho before insert or update on public.orgs_despacho
  for each row execute function public.vigila_despacho_id();

revoke all on function public.plan_efectivo(uuid) from public, anon, authenticated;
revoke all on function public.vigila_despacho_id() from public, anon, authenticated;
grant execute on function public.mi_despacho() to authenticated;

-- ----------------------------------------------------------- políticas
alter table public.despachos     enable row level security;
alter table public.miembros      enable row level security;
alter table public.invitaciones  enable row level security;
alter table public.orgs_despacho enable row level security;

-- despachos: lo ves si eres miembro; lo editas si eres el propietario.
drop policy if exists despacho_ver on public.despachos;
create policy despacho_ver on public.despachos for select using (id = public.mi_despacho());
drop policy if exists despacho_editar on public.despachos;
create policy despacho_editar on public.despachos for update
  using (propietario = auth.uid()) with check (propietario = auth.uid());

-- miembros: ves a tus compañeros. Altas y bajas solo por la función.
drop policy if exists miembros_ver on public.miembros;
create policy miembros_ver on public.miembros for select using (despacho_id = public.mi_despacho());

-- invitaciones: el cliente no las lee nunca (llevan el token). Solo la función.

-- orgs_despacho: todo el despacho puede ver, crear, editar y borrar.
drop policy if exists orgs_despacho_todo on public.orgs_despacho;
create policy orgs_despacho_todo on public.orgs_despacho for all
  using (despacho_id = public.mi_despacho()) with check (despacho_id = public.mi_despacho());

-- actas y estilos del despacho: además de las políticas «lo mío» que ya
-- existen, se añade «lo de mi despacho». Las políticas se suman.
drop policy if exists actas_despacho_ver on public.actas;
create policy actas_despacho_ver on public.actas for select using (despacho_id = public.mi_despacho());
drop policy if exists actas_despacho_editar on public.actas;
create policy actas_despacho_editar on public.actas for update
  using (despacho_id = public.mi_despacho()) with check (despacho_id = public.mi_despacho());
drop policy if exists actas_despacho_borrar on public.actas;
create policy actas_despacho_borrar on public.actas for delete using (despacho_id = public.mi_despacho());

drop policy if exists estilos_despacho_ver on public.estilos_acta;
create policy estilos_despacho_ver on public.estilos_acta for select using (despacho_id = public.mi_despacho());
drop policy if exists estilos_despacho_borrar on public.estilos_acta;
create policy estilos_despacho_borrar on public.estilos_acta for delete using (despacho_id = public.mi_despacho());

select 'despacho listo' as resultado;
