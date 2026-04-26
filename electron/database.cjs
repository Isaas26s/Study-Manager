const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

let db = null;

function getDbPath() {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'db.sqlite');
}

function initDatabase() {
  const dbPath = getDbPath();
  console.log('[DB] Initializing database at:', dbPath);
  db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      folder_path TEXT NOT NULL,
      source_type TEXT DEFAULT 'local',
      drive_folder_id TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER,
      module_name TEXT,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT,
      sort_order INTEGER,
      drive_file_id TEXT,
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );

    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER UNIQUE,
      status TEXT DEFAULT 'not_started',
      position_sec INTEGER DEFAULT 0,
      completed_at DATETIME,
      notes TEXT,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id)
    );

    CREATE TABLE IF NOT EXISTS planner_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phase INTEGER,
      week_start INTEGER,
      week_end INTEGER,
      task_order INTEGER,
      task_text TEXT,
      task_type TEXT,
      status TEXT DEFAULT 'not_started'
    );

    CREATE TABLE IF NOT EXISTS missions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week INTEGER,
      description TEXT,
      completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      duration_min INTEGER DEFAULT 0,
      blocks_completed TEXT
    );

    CREATE TABLE IF NOT EXISTS streak (
      id INTEGER PRIMARY KEY DEFAULT 1,
      last_study_date TEXT,
      current_streak INTEGER DEFAULT 0,
      best_streak INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS pdf_annotations (
      lesson_id INTEGER PRIMARY KEY,
      annotations TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id)
    );
  `);

  // ─── Migrations for existing databases ──────────────────────
  try { db.exec('ALTER TABLE courses ADD COLUMN source_type TEXT DEFAULT "local"'); } catch (_e) { /* already exists */ }
  try { db.exec('ALTER TABLE courses ADD COLUMN drive_folder_id TEXT'); } catch (_e) { /* already exists */ }
  try { db.exec('ALTER TABLE lessons ADD COLUMN drive_file_id TEXT'); } catch (_e) { /* already exists */ }
  try { db.exec('CREATE TABLE IF NOT EXISTS pdf_annotations (lesson_id INTEGER PRIMARY KEY, annotations TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (lesson_id) REFERENCES lessons(id))'); } catch (_e) { /* already exists */ }

  // Seed streak row if not exists
  const streakRow = db.prepare('SELECT id FROM streak WHERE id = 1').get();
  if (!streakRow) {
    db.prepare('INSERT INTO streak (id, last_study_date, current_streak, best_streak) VALUES (1, NULL, 0, 0)').run();
  }

  // Seed default settings
  const themeSetting = db.prepare("SELECT key FROM settings WHERE key = 'theme'").get();
  if (!themeSetting) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('theme', 'dark')").run();
    db.prepare("INSERT INTO settings (key, value) VALUES ('hardcore_mode', 'false')").run();
    db.prepare("INSERT INTO settings (key, value) VALUES ('google_api_key', '')").run();
  }

  // NOTE: planner_tasks and missions tables are legacy.
  // The Planner now uses Supabase (planner_sections + planner_items).

  console.log('[DB] Database initialized successfully');
}

// Legacy seed functions removed — Planner now uses Supabase (planner_sections + planner_items)

function getDb() {
  if (!db) throw new Error('Database not initialized');
  return db;
}

module.exports = { initDatabase, getDb };
