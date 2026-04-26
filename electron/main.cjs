const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { initDatabase, getDb } = require('./database.cjs');
const { scanCourseFolder } = require('./scanner.cjs');
const { extractFolderId, scanDriveFolder, getDriveStreamUrl, getDriveFolderName } = require('./google-drive.cjs');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0d0d0d',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '..', 'public', 'icon.png'),
  });

  // Dev vs Production — app.isPackaged is the reliable Electron check
  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    mainWindow.loadURL('http://localhost:5173');
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  initDatabase();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── Window Controls ──────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());

// ─── Folder Dialog ────────────────────────────────────────────────
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecionar pasta do curso',
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// ─── Courses ──────────────────────────────────────────────────────
ipcMain.handle('courses:getAll', () => {
  const db = getDb();
  return db.prepare('SELECT * FROM courses ORDER BY added_at DESC').all();
});

ipcMain.handle('courses:add', async (_event, folderPath) => {
  const db = getDb();
  const courseName = path.basename(folderPath);

  // Check if course already exists
  const existing = db.prepare('SELECT id FROM courses WHERE folder_path = ?').get(folderPath);
  if (existing) return { error: 'Curso já adicionado', courseId: existing.id };

  const result = db.prepare('INSERT INTO courses (name, folder_path, source_type) VALUES (?, ?, ?)').run(courseName, folderPath, 'local');
  const courseId = result.lastInsertRowid;

  // Scan folder for lessons
  const lessons = scanCourseFolder(folderPath);
  const insertLesson = db.prepare(
    'INSERT INTO lessons (course_id, module_name, title, file_path, file_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)'
  );

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertLesson.run(courseId, item.moduleName, item.title, item.filePath, item.fileType, item.sortOrder);
    }
  });
  insertMany(lessons);

  return { courseId, name: courseName, lessonsCount: lessons.length };
});

ipcMain.handle('courses:remove', (_event, courseId) => {
  const db = getDb();
  db.prepare('DELETE FROM progress WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id = ?)').run(courseId);
  db.prepare('DELETE FROM lessons WHERE course_id = ?').run(courseId);
  db.prepare('DELETE FROM courses WHERE id = ?').run(courseId);
  return { success: true };
});

ipcMain.handle('courses:getLessons', (_event, courseId) => {
  const db = getDb();
  const lessons = db.prepare(`
    SELECT l.*, COALESCE(p.status, 'not_started') as status, COALESCE(p.position_sec, 0) as position_sec, p.notes
    FROM lessons l
    LEFT JOIN progress p ON p.lesson_id = l.id
    WHERE l.course_id = ?
    ORDER BY l.module_name, l.sort_order
  `).all(courseId);
  return lessons;
});

ipcMain.handle('courses:getProgress', (_event, courseId) => {
  const db = getDb();
  const total = db.prepare('SELECT COUNT(*) as count FROM lessons WHERE course_id = ? AND file_type = ?').get(courseId, 'video');
  const completed = db.prepare(`
    SELECT COUNT(*) as count FROM lessons l
    JOIN progress p ON p.lesson_id = l.id
    WHERE l.course_id = ? AND l.file_type = ? AND p.status = 'completed'
  `).get(courseId, 'video');
  return {
    total: total.count,
    completed: completed.count,
    percentage: total.count > 0 ? Math.round((completed.count / total.count) * 100) : 0,
  };
});

// ─── Progress ─────────────────────────────────────────────────────
ipcMain.handle('progress:update', (_event, lessonId, data) => {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM progress WHERE lesson_id = ?').get(lessonId);
  if (existing) {
    const sets = [];
    const values = [];
    if (data.status !== undefined) { sets.push('status = ?'); values.push(data.status); }
    if (data.position_sec !== undefined) { sets.push('position_sec = ?'); values.push(data.position_sec); }
    if (data.notes !== undefined) { sets.push('notes = ?'); values.push(data.notes); }
    if (data.status === 'completed') { sets.push('completed_at = CURRENT_TIMESTAMP'); }
    values.push(lessonId);
    db.prepare(`UPDATE progress SET ${sets.join(', ')} WHERE lesson_id = ?`).run(...values);
  } else {
    db.prepare(
      'INSERT INTO progress (lesson_id, status, position_sec, notes) VALUES (?, ?, ?, ?)'
    ).run(lessonId, data.status || 'not_started', data.position_sec || 0, data.notes || null);
  }
  return { success: true };
});

// ─── Planner ──────────────────────────────────────────────────────
// NOTE: The Planner now uses Supabase (planner_sections + planner_items)
// directly from the renderer process. No IPC handlers needed.

// ─── Streak ───────────────────────────────────────────────────────
ipcMain.handle('streak:get', () => {
  const db = getDb();
  return db.prepare('SELECT * FROM streak WHERE id = 1').get();
});

ipcMain.handle('streak:check', () => {
  const db = getDb();
  const streak = db.prepare('SELECT * FROM streak WHERE id = 1').get();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (streak.last_study_date !== today && streak.last_study_date !== yesterday) {
    // Streak broken
    db.prepare('UPDATE streak SET current_streak = 0 WHERE id = 1').run();
    return { ...streak, current_streak: 0 };
  }
  return streak;
});

ipcMain.handle('streak:increment', () => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const streak = db.prepare('SELECT * FROM streak WHERE id = 1').get();

  if (streak.last_study_date === today) {
    return streak; // Already studied today
  }

  const newStreak = streak.current_streak + 1;
  const bestStreak = Math.max(streak.best_streak, newStreak);
  db.prepare('UPDATE streak SET last_study_date = ?, current_streak = ?, best_streak = ? WHERE id = 1').run(today, newStreak, bestStreak);
  return { last_study_date: today, current_streak: newStreak, best_streak: bestStreak };
});

// ─── Study Sessions ──────────────────────────────────────────────
ipcMain.handle('sessions:save', (_event, data) => {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  const existing = db.prepare('SELECT * FROM study_sessions WHERE date = ?').get(today);
  if (existing) {
    db.prepare('UPDATE study_sessions SET duration_min = duration_min + ?, blocks_completed = ? WHERE date = ?')
      .run(data.duration_min, JSON.stringify(data.blocks_completed), today);
  } else {
    db.prepare('INSERT INTO study_sessions (date, duration_min, blocks_completed) VALUES (?, ?, ?)')
      .run(today, data.duration_min, JSON.stringify(data.blocks_completed));
  }
  return { success: true };
});

ipcMain.handle('sessions:getStats', () => {
  const db = getDb();
  const totalTime = db.prepare('SELECT COALESCE(SUM(duration_min), 0) as total FROM study_sessions').get();
  const totalDays = db.prepare('SELECT COUNT(DISTINCT date) as days FROM study_sessions').get();
  return { totalMinutes: totalTime.total, totalDays: totalDays.days };
});

// ─── Google Drive ─────────────────────────────────────────────────
ipcMain.handle('drive:addCourse', async (_event, driveUrl) => {
  const db = getDb();
  const folderId = extractFolderId(driveUrl);
  if (!folderId) return { error: 'URL inválida. Cole um link de pasta do Google Drive.' };

  // Check if already added
  const existing = db.prepare('SELECT id FROM courses WHERE drive_folder_id = ?').get(folderId);
  if (existing) return { error: 'Este curso do Drive já foi adicionado.', courseId: existing.id };

  // Get API key
  const apiKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'google_api_key'").get();
  const apiKey = apiKeyRow?.value;
  if (!apiKey) return { error: 'Configure sua Google API Key nas Configurações antes de adicionar cursos do Drive.' };

  try {
    // Get folder name
    const folderName = await getDriveFolderName(folderId, apiKey) || 'Curso do Drive';

    // Scan Drive folder
    const lessons = await scanDriveFolder(folderId, apiKey);
    if (lessons.length === 0) return { error: 'Nenhum vídeo ou arquivo encontrado nesta pasta do Drive.' };

    // Insert course
    const result = db.prepare(
      'INSERT INTO courses (name, folder_path, source_type, drive_folder_id) VALUES (?, ?, ?, ?)'
    ).run(folderName, driveUrl, 'drive', folderId);
    const courseId = result.lastInsertRowid;

    // Insert lessons
    const insertLesson = db.prepare(
      'INSERT INTO lessons (course_id, module_name, title, file_path, file_type, sort_order, drive_file_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    const insertMany = db.transaction((items) => {
      for (const item of items) {
        insertLesson.run(courseId, item.moduleName, item.title, item.filePath, item.fileType, item.sortOrder, item.driveFileId);
      }
    });
    insertMany(lessons);

    return { courseId, name: folderName, lessonsCount: lessons.length };
  } catch (err) {
    console.error('[Drive] Error adding course:', err);
    return { error: err.message || 'Erro ao acessar o Google Drive.' };
  }
});

ipcMain.handle('drive:getStreamUrl', (_event, driveFileId) => {
  const db = getDb();
  const apiKeyRow = db.prepare("SELECT value FROM settings WHERE key = 'google_api_key'").get();
  const apiKey = apiKeyRow?.value;
  if (!apiKey) return null;
  return getDriveStreamUrl(driveFileId, apiKey);
});

// ─── Settings ─────────────────────────────────────────────────────
ipcMain.handle('settings:get', (_event, key) => {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
});

ipcMain.handle('settings:set', (_event, key, value) => {
  const db = getDb();
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
  return { success: true };
});

// ─── PDF File Reading ─────────────────────────────────────────────
ipcMain.handle('file:readAsBuffer', async (_event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  } catch (err) {
    console.error('[File] Error reading:', err);
    return null;
  }
});

// ─── PDF Annotations ─────────────────────────────────────────────
ipcMain.handle('pdf:getAnnotations', (_event, lessonId) => {
  const db = getDb();
  const row = db.prepare('SELECT annotations FROM pdf_annotations WHERE lesson_id = ?').get(lessonId);
  return row ? row.annotations : null;
});

ipcMain.handle('pdf:saveAnnotations', (_event, lessonId, annotationsJson) => {
  const db = getDb();
  const existing = db.prepare('SELECT lesson_id FROM pdf_annotations WHERE lesson_id = ?').get(lessonId);
  if (existing) {
    db.prepare('UPDATE pdf_annotations SET annotations = ?, updated_at = CURRENT_TIMESTAMP WHERE lesson_id = ?').run(annotationsJson, lessonId);
  } else {
    db.prepare('INSERT INTO pdf_annotations (lesson_id, annotations) VALUES (?, ?)').run(lessonId, annotationsJson);
  }
  return { success: true };
});
