-- ============================================================
-- EscribAI · Biblioteca de actas por organización
--
-- Cada acta guardada pasa a pertenecer a una organización, para
-- poder mostrarlas agrupadas en carpetas: Comunidad -> año -> reunión.
--
-- YA EJECUTADO el 26/09/2026. Se conserva aquí por si hubiera que
-- levantar el proyecto de cero.
--
-- IMPORTANTE: a la nube solo sube TEXTO (acta, transcripción y
-- resumen). El audio de las reuniones nunca sale del navegador donde
-- se grabó: se guarda en IndexedDB, en el equipo del cliente. Así no
-- custodiamos grabaciones de terceros ni se dispara el almacenamiento.
-- ============================================================

alter table actas add column if not exists org_id     text;
alter table actas add column if not exists org_nombre text;

create index if not exists actas_biblioteca_idx
  on actas (user_id, org_nombre, fecha desc);

-- Comprobación
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'actas'
order by ordinal_position;
