-- Perfil persistente de Pepe para el asistente de voz (Orwell).
-- Hechos duraderos extraídos de las conversaciones: temas que le preocupan,
-- preferencias de trato, pendientes. Los lee voice-relay.js al abrir cada sesión.
create table if not exists voice_profile (
  id uuid primary key default gen_random_uuid(),
  fact text not null,
  category text default 'general',
  active boolean default true,
  created_at timestamptz default now()
);
