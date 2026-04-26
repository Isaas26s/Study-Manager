export interface ElectronAPI {
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
  openFolderDialog: () => Promise<string | null>;
  getCourses: () => Promise<Course[]>;
  addCourse: (folderPath: string) => Promise<{ courseId?: number; name?: string; lessonsCount?: number; error?: string }>;
  removeCourse: (courseId: number) => Promise<{ success: boolean }>;
  getLessons: (courseId: number) => Promise<Lesson[]>;
  getCourseProgress: (courseId: number) => Promise<CourseProgress>;
  updateProgress: (lessonId: number, data: Partial<ProgressData>) => Promise<{ success: boolean }>;
  // Planner: now uses Supabase directly (no Electron bridge needed)
  getStreak: () => Promise<StreakData>;
  checkStreak: () => Promise<StreakData>;
  incrementStreak: () => Promise<StreakData>;
  saveSession: (data: { duration_min: number; blocks_completed: string[] }) => Promise<{ success: boolean }>;
  getSessionStats: () => Promise<SessionStats>;
  getSetting: (key: string) => Promise<string | null>;
  setSetting: (key: string, value: string) => Promise<{ success: boolean }>;
  addDriveCourse: (driveUrl: string) => Promise<{ courseId?: number; name?: string; lessonsCount?: number; error?: string }>;
  getDriveStreamUrl: (driveFileId: string) => Promise<string | null>;
  // PDF
  readFileAsBuffer: (filePath: string) => Promise<ArrayBuffer | null>;
  getPdfAnnotations: (lessonId: number) => Promise<string | null>;
  savePdfAnnotations: (lessonId: number, annotationsJson: string) => Promise<{ success: boolean }>;
}

export interface Course {
  id: number;
  name: string;
  folder_path: string;
  source_type: 'local' | 'drive';
  drive_folder_id: string | null;
  added_at: string;
}

export interface Lesson {
  id: number;
  course_id: number;
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

export interface CourseProgress {
  total: number;
  completed: number;
  percentage: number;
}

export interface ProgressData {
  status: string;
  position_sec: number;
  notes: string;
}

// Old PlannerTask and Mission types removed — Planner now uses Supabase directly

export interface StreakData {
  id: number;
  last_study_date: string | null;
  current_streak: number;
  best_streak: number;
}

export interface SessionStats {
  totalMinutes: number;
  totalDays: number;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
