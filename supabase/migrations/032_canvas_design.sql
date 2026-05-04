-- 032_canvas_design.sql
-- Añade columna opcional canvas_design para el editor visual libre.
-- DEFAULT NULL → todos los eventos existentes mantienen comportamiento actual.
-- Si canvas_design IS NULL la invitación pública usa la plantilla/tema como siempre.

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS canvas_design JSONB DEFAULT NULL;

COMMENT ON COLUMN public.events.canvas_design IS
  'Diseño libre del editor visual. NULL = usar plantilla/tema estándar. '
  'Estructura: { version, refWidth, refHeight, background, elements[], updatedAt }';
