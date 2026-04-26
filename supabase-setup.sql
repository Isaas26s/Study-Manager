-- ═══════════════════════════════════════════════════════════════
-- Study Manager — Tabelas do Supabase
-- Execute este SQL no SQL Editor do Supabase Dashboard
-- ═══════════════════════════════════════════════════════════════

-- ── Cursos ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT DEFAULT 'drive',
  folder_path TEXT DEFAULT '',
  drive_folder_id TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Aulas/Lições ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lessons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  module_name TEXT,
  title TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT DEFAULT 'video',
  sort_order INTEGER DEFAULT 0,
  drive_file_id TEXT,
  status TEXT DEFAULT 'not_started',
  position_sec INTEGER DEFAULT 0,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Streak ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS streak (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  last_study_date DATE,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sessões de Estudo ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  duration_min INTEGER DEFAULT 0,
  blocks_completed JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Configurações do Usuário ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  key TEXT NOT NULL,
  value TEXT,
  UNIQUE(user_id, key)
);

-- ── Planner: Sessões (seções) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS planner_sections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Planner: Itens (sub-itens de cada seção) ────────────────────
CREATE TABLE IF NOT EXISTS planner_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  section_id UUID REFERENCES planner_sections(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Anotações de PDF (sync PC ↔ iPad) ───────────────────────────
CREATE TABLE IF NOT EXISTS pdf_annotations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  annotations_json TEXT DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lesson_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════
-- Row Level Security (RLS)
-- Cada usuário só vê seus próprios dados
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE planner_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pdf_annotations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users access own courses" ON courses
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own lessons" ON lessons
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own streak" ON streak
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own sessions" ON study_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own settings" ON user_settings
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own planner sections" ON planner_sections
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own planner items" ON planner_items
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users access own pdf annotations" ON pdf_annotations
  FOR ALL USING (auth.uid() = user_id);
