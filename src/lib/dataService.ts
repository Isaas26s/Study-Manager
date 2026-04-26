/**
 * Data Service — Abstraction Layer
 *
 * In Electron (desktop): delegates to window.electronAPI (SQLite)
 * In Web/PWA (iPad):     delegates to Supabase
 *
 * All pages should import from here instead of calling electronAPI directly.
 */

import { supabase } from './supabase';

// ── Helpers ─────────────────────────────────────────────────────

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.electronAPI;
}

// ── Types ───────────────────────────────────────────────────────

export interface CourseItem {
  id: string;
  name: string;
  source_type: 'local' | 'drive';
  folder_path: string;
  drive_folder_id: string | null;
  added_at: string;
}

export interface CourseProgressData {
  total: number;
  completed: number;
  percentage: number;
}

export interface LessonItem {
  id: string;
  course_id: string;
  module_name: string | null;
  title: string;
  file_path: string;
  file_type: 'video' | 'pdf' | 'other';
  sort_order: number;
  drive_file_id: string | null;
  status: 'not_started' | 'in_progress' | 'completed';
  position_sec: number;
  notes: string | null;
}

export interface StreakInfo {
  current_streak: number;
  best_streak: number;
  last_study_date: string | null;
}

export interface SessionStatsInfo {
  totalMinutes: number;
  totalDays: number;
}

// ── Planner Types (Supabase custom planner) ─────────────────────

export interface PlannerSection {
  id: string;
  user_id: string;
  title: string;
  sort_order: number;
  created_at: string;
}

export interface PlannerItem {
  id: string;
  section_id: string;
  user_id: string;
  title: string;
  completed: boolean;
  sort_order: number;
  created_at: string;
}

// ── Courses ─────────────────────────────────────────────────────

export async function getCourses(): Promise<CourseItem[]> {
  if (isElectron()) {
    const raw = await window.electronAPI.getCourses();
    return raw.map((c) => ({
      id: String(c.id),
      name: c.name,
      source_type: c.source_type,
      folder_path: c.folder_path,
      drive_folder_id: c.drive_folder_id,
      added_at: c.added_at,
    }));
  }

  // Supabase
  const { data } = await supabase
    .from('courses')
    .select('*')
    .order('added_at', { ascending: false });
  return (data || []).map((c: Record<string, unknown>) => ({
    id: String(c.id),
    name: c.name as string,
    source_type: c.source_type as 'local' | 'drive',
    folder_path: c.folder_path as string || '',
    drive_folder_id: c.drive_folder_id as string | null,
    added_at: c.added_at as string,
  }));
}

export async function getCourseProgress(courseId: string): Promise<CourseProgressData> {
  if (isElectron()) {
    return await window.electronAPI.getCourseProgress(Number(courseId));
  }

  const { data } = await supabase
    .from('lessons')
    .select('status')
    .eq('course_id', courseId);
  const lessons = data || [];
  const total = lessons.length;
  const completed = lessons.filter((l: Record<string, unknown>) => l.status === 'completed').length;
  return {
    total,
    completed,
    percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

export async function addDriveCourse(driveUrl: string): Promise<{ courseId?: string; name?: string; lessonsCount?: number; error?: string }> {
  if (isElectron()) {
    const result = await window.electronAPI.addDriveCourse(driveUrl);
    if (result.error) return { error: result.error };
    return { courseId: String(result.courseId), name: result.name, lessonsCount: result.lessonsCount };
  }

  // In web mode: parse the Drive folder ID and create course record in Supabase
  const match = driveUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (!match) return { error: 'URL do Google Drive inválida. Cole o link de uma pasta.' };

  const folderId = match[1];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Você precisa estar logado.' };

  // Get API key from Supabase settings
  const { data: settingData } = await supabase
    .from('user_settings')
    .select('value')
    .eq('user_id', user.id)
    .eq('key', 'google_api_key')
    .single();

  const apiKey = settingData?.value;
  if (!apiKey) return { error: 'Configure sua Google API Key primeiro.' };

  // Helper: list all files in a Drive folder (non-recursive at this level)
  async function listDriveFiles(parentId: string): Promise<Array<{ id: string; name: string; mimeType: string }>> {
    const allFiles: Array<{ id: string; name: string; mimeType: string }> = [];
    let pageToken = '';

    do {
      const q = encodeURIComponent(`'${parentId}' in parents and trashed = false`);
      const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType)');
      let url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=name&pageSize=1000&key=${apiKey}`;
      if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

      const res = await fetch(url);
      if (!res.ok) {
        const errBody = await res.text();
        console.error('[Drive API] Error listing files:', res.status, errBody);
        break;
      }

      const data = await res.json();
      if (data.files) allFiles.push(...data.files);
      pageToken = data.nextPageToken || '';
    } while (pageToken);

    return allFiles;
  }

  // Helper: recursively collect media files from folder and subfolders
  async function collectMediaFiles(
    parentId: string,
    moduleName: string | null = null
  ): Promise<Array<{ id: string; name: string; mimeType: string; module: string | null }>> {
    const files = await listDriveFiles(parentId);
    const mediaFiles: Array<{ id: string; name: string; mimeType: string; module: string | null }> = [];

    for (const f of files) {
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        // Recurse into subfolder — use folder name as module
        const subFiles = await collectMediaFiles(f.id, f.name);
        mediaFiles.push(...subFiles);
      } else if (isMediaFile(f.mimeType)) {
        mediaFiles.push({ ...f, module: moduleName });
      }
    }

    return mediaFiles;
  }

  // Helper: check if MIME type is a supported media file
  function isMediaFile(mimeType: string): boolean {
    return (
      mimeType.startsWith('video/') ||
      mimeType === 'application/pdf' ||
      mimeType === 'application/vnd.google-apps.video' ||
      mimeType === 'application/vnd.google-apps.document'
    );
  }

  // Helper: determine file type from MIME
  function getFileType(mimeType: string): string {
    if (mimeType.startsWith('video/') || mimeType === 'application/vnd.google-apps.video') return 'video';
    if (mimeType === 'application/pdf') return 'pdf';
    return 'other';
  }

  try {
    // 1. Fetch folder metadata
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?fields=name&key=${apiKey}`
    );
    if (!metaRes.ok) {
      const errText = await metaRes.text();
      console.error('[Drive API] Folder meta error:', metaRes.status, errText);
      throw new Error('Não foi possível acessar a pasta. Verifique se está compartilhada e se a API Key está correta.');
    }
    const meta = await metaRes.json();

    // 2. Create course in Supabase
    const { data: course, error } = await supabase
      .from('courses')
      .insert({
        user_id: user.id,
        name: meta.name,
        source_type: 'drive',
        folder_path: driveUrl,
        drive_folder_id: folderId,
      })
      .select()
      .single();

    if (error) return { error: error.message };

    // 3. Collect all media files (recursively enters subfolders)
    const mediaFiles = await collectMediaFiles(folderId);

    console.log(`[Drive Import] Found ${mediaFiles.length} media files in "${meta.name}"`);

    if (mediaFiles.length === 0) {
      return {
        courseId: course.id,
        name: meta.name,
        lessonsCount: 0,
        error: `Curso "${meta.name}" criado, mas nenhum arquivo de vídeo ou PDF encontrado na pasta. Verifique se a pasta contém arquivos de mídia e está compartilhada como "Qualquer pessoa com o link".`,
      };
    }

    // 4. Insert lessons
    const lessons = mediaFiles.map((f, i) => ({
      course_id: course.id,
      user_id: user.id,
      module_name: f.module,
      title: f.name.replace(/\.[^.]+$/, ''),
      file_path: f.name,
      file_type: getFileType(f.mimeType),
      sort_order: i,
      drive_file_id: f.id,
      status: 'not_started',
      position_sec: 0,
    }));

    const { error: insertError } = await supabase.from('lessons').insert(lessons);
    if (insertError) {
      console.error('[Supabase] Error inserting lessons:', insertError);
      return { error: `Curso criado mas erro ao salvar aulas: ${insertError.message}` };
    }

    return { courseId: course.id, name: meta.name, lessonsCount: lessons.length };
  } catch (err) {
    console.error('[Drive Import] Error:', err);
    return { error: String(err instanceof Error ? err.message : err) };
  }
}

export async function addLocalCourse(): Promise<{ courseId?: string; name?: string; error?: string }> {
  if (isElectron()) {
    const folderPath = await window.electronAPI.openFolderDialog();
    if (!folderPath) return { error: 'cancelled' };
    const result = await window.electronAPI.addCourse(folderPath);
    if (result.error) return { error: result.error };
    return { courseId: String(result.courseId), name: result.name };
  }

  return { error: 'Adicionar pasta local só funciona no app Desktop (Windows). No iPad/Web, use o Google Drive.' };
}

export async function removeCourse(courseId: string): Promise<void> {
  if (isElectron()) {
    await window.electronAPI.removeCourse(Number(courseId));
    return;
  }
  await supabase.from('lessons').delete().eq('course_id', courseId);
  await supabase.from('courses').delete().eq('id', courseId);
}

// ── Lessons ─────────────────────────────────────────────────────

export async function getLessons(courseId: string): Promise<LessonItem[]> {
  if (isElectron()) {
    const raw = await window.electronAPI.getLessons(Number(courseId));
    return raw.map((l) => ({
      id: String(l.id),
      course_id: String(l.course_id),
      module_name: l.module_name,
      title: l.title,
      file_path: l.file_path,
      file_type: l.file_type,
      sort_order: l.sort_order,
      drive_file_id: l.drive_file_id,
      status: l.status,
      position_sec: l.position_sec,
      notes: l.notes,
    }));
  }

  const { data } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', courseId)
    .order('sort_order');

  return (data || []).map((l: Record<string, unknown>) => ({
    id: String(l.id),
    course_id: String(l.course_id),
    module_name: l.module_name as string | null,
    title: l.title as string,
    file_path: l.file_path as string,
    file_type: l.file_type as 'video' | 'pdf' | 'other',
    sort_order: l.sort_order as number,
    drive_file_id: l.drive_file_id as string | null,
    status: l.status as 'not_started' | 'in_progress' | 'completed',
    position_sec: l.position_sec as number || 0,
    notes: l.notes as string | null,
  }));
}

export async function updateLessonProgress(
  lessonId: string,
  data: { status?: string; position_sec?: number; notes?: string }
): Promise<void> {
  if (isElectron()) {
    await window.electronAPI.updateProgress(Number(lessonId), data as { status: string; position_sec: number; notes: string });
    return;
  }

  await supabase
    .from('lessons')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', lessonId);
}

export async function getDriveStreamUrl(driveFileId: string): Promise<string | null> {
  if (isElectron()) {
    return await window.electronAPI.getDriveStreamUrl(driveFileId);
  }

  // In web/PWA, use direct Google Drive embed URL
  return `https://drive.google.com/file/d/${driveFileId}/preview`;
}

// ── Streak ──────────────────────────────────────────────────────

export async function getStreak(): Promise<StreakInfo> {
  if (isElectron()) {
    const s = await window.electronAPI.checkStreak();
    return {
      current_streak: s.current_streak,
      best_streak: s.best_streak,
      last_study_date: s.last_study_date,
    };
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { current_streak: 0, best_streak: 0, last_study_date: null };

  const { data } = await supabase
    .from('streak')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!data) return { current_streak: 0, best_streak: 0, last_study_date: null };

  return {
    current_streak: data.current_streak || 0,
    best_streak: data.best_streak || 0,
    last_study_date: data.last_study_date,
  };
}

export async function incrementStreak(): Promise<void> {
  if (isElectron()) {
    await window.electronAPI.incrementStreak();
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('streak')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!existing) {
    await supabase.from('streak').insert({
      user_id: user.id,
      current_streak: 1,
      best_streak: 1,
      last_study_date: today,
    });
    return;
  }

  if (existing.last_study_date === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const newStreak = existing.last_study_date === yesterday
    ? existing.current_streak + 1
    : 1;
  const newBest = Math.max(newStreak, existing.best_streak);

  await supabase
    .from('streak')
    .update({
      current_streak: newStreak,
      best_streak: newBest,
      last_study_date: today,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id);
}

// ── Sessions ────────────────────────────────────────────────────

export async function getSessionStats(): Promise<SessionStatsInfo> {
  if (isElectron()) {
    return await window.electronAPI.getSessionStats();
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { totalMinutes: 0, totalDays: 0 };

  const { data } = await supabase
    .from('study_sessions')
    .select('duration_min, date')
    .eq('user_id', user.id);

  const sessions = data || [];
  const totalMinutes = sessions.reduce((a: number, s: Record<string, unknown>) => a + (s.duration_min as number || 0), 0);
  const uniqueDays = new Set(sessions.map((s: Record<string, unknown>) => s.date));
  return { totalMinutes, totalDays: uniqueDays.size };
}

export async function saveSession(durationMin: number, blocksCompleted: string[]): Promise<void> {
  if (isElectron()) {
    await window.electronAPI.saveSession({ duration_min: durationMin, blocks_completed: blocksCompleted });
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('study_sessions').insert({
    user_id: user.id,
    date: new Date().toISOString().split('T')[0],
    duration_min: durationMin,
    blocks_completed: blocksCompleted,
  });
}

// ── Settings ────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  if (isElectron()) {
    return await window.electronAPI.getSetting(key);
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('user_settings')
    .select('value')
    .eq('user_id', user.id)
    .eq('key', key)
    .single();

  return data?.value || null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  if (isElectron()) {
    await window.electronAPI.setSetting(key, value);
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      key,
      value,
    }, { onConflict: 'user_id,key' });
}

// ── Planner (Supabase custom sections + items) ──────────────────

export async function getPlannerSections(): Promise<PlannerSection[]> {
  if (isElectron()) {
    // Electron: also use Supabase if connected, fallback to empty
    // For now, use Supabase when available
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('planner_sections')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order');

  return (data || []) as PlannerSection[];
}

export async function createPlannerSection(title: string): Promise<PlannerSection | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get next sort order
  const { data: existing } = await supabase
    .from('planner_sections')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order + 1) : 0;

  const { data, error } = await supabase
    .from('planner_sections')
    .insert({
      user_id: user.id,
      title,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) return null;
  return data as PlannerSection;
}

export async function updatePlannerSection(sectionId: string, title: string): Promise<void> {
  await supabase
    .from('planner_sections')
    .update({ title })
    .eq('id', sectionId);
}

export async function deletePlannerSection(sectionId: string): Promise<void> {
  await supabase.from('planner_items').delete().eq('section_id', sectionId);
  await supabase.from('planner_sections').delete().eq('id', sectionId);
}

export async function getPlannerItems(sectionId: string): Promise<PlannerItem[]> {
  const { data } = await supabase
    .from('planner_items')
    .select('*')
    .eq('section_id', sectionId)
    .order('sort_order');

  return (data || []) as PlannerItem[];
}

export async function getAllPlannerItems(): Promise<PlannerItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('planner_items')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order');

  return (data || []) as PlannerItem[];
}

export async function createPlannerItem(sectionId: string, title: string): Promise<PlannerItem | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get next sort order for this section
  const { data: existing } = await supabase
    .from('planner_items')
    .select('sort_order')
    .eq('section_id', sectionId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? (existing[0].sort_order + 1) : 0;

  const { data, error } = await supabase
    .from('planner_items')
    .insert({
      section_id: sectionId,
      user_id: user.id,
      title,
      completed: false,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) return null;
  return data as PlannerItem;
}

export async function togglePlannerItem(itemId: string, completed: boolean): Promise<void> {
  await supabase
    .from('planner_items')
    .update({ completed })
    .eq('id', itemId);
}

export async function deletePlannerItem(itemId: string): Promise<void> {
  await supabase
    .from('planner_items')
    .delete()
    .eq('id', itemId);
}

export async function updatePlannerItem(itemId: string, title: string): Promise<void> {
  await supabase
    .from('planner_items')
    .update({ title })
    .eq('id', itemId);
}

// ── PDF Annotations (synced via Supabase) ───────────────────────

export async function getPdfAnnotations(lessonId: string): Promise<string | null> {
  if (isElectron() && window.electronAPI.getPdfAnnotations) {
    // Try Electron first for local PDFs
    const local = await window.electronAPI.getPdfAnnotations(Number(lessonId));
    if (local) return local;
  }

  // Also check Supabase (synced annotations)
  const { data } = await supabase
    .from('pdf_annotations')
    .select('annotations_json')
    .eq('lesson_id', lessonId)
    .single();

  return data?.annotations_json || null;
}

export async function savePdfAnnotations(lessonId: string, annotationsJson: string): Promise<void> {
  // Save to Electron if available
  if (isElectron() && window.electronAPI.savePdfAnnotations) {
    await window.electronAPI.savePdfAnnotations(Number(lessonId), annotationsJson);
  }

  // Always save to Supabase for sync
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('pdf_annotations')
    .upsert({
      lesson_id: lessonId,
      user_id: user.id,
      annotations_json: annotationsJson,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'lesson_id,user_id' });
}

// ── Add Course to Planner ───────────────────────────────────────

export async function addCourseToPlanner(courseId: string, courseName: string): Promise<PlannerSection | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Create a planner section with the course name
  const section = await createPlannerSection(`📚 ${courseName}`);
  if (!section) return null;

  // Get all lessons for this course
  const lessons = await getLessons(courseId);

  // Create a planner item for each lesson
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    const prefix = lesson.file_type === 'video' ? '🎬' : lesson.file_type === 'pdf' ? '📄' : '📝';
    const modulePart = lesson.module_name ? `[${lesson.module_name}] ` : '';
    const title = `${prefix} ${modulePart}${lesson.title}`;

    await supabase.from('planner_items').insert({
      section_id: section.id,
      user_id: user.id,
      title,
      completed: lesson.status === 'completed',
      sort_order: i,
    });
  }

  return section;
}

