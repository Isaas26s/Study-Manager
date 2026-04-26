const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls (frameless)
  windowMinimize: () => ipcRenderer.send('window:minimize'),
  windowMaximize: () => ipcRenderer.send('window:maximize'),
  windowClose: () => ipcRenderer.send('window:close'),

  // Folder dialog
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),

  // Courses
  getCourses: () => ipcRenderer.invoke('courses:getAll'),
  addCourse: (folderPath) => ipcRenderer.invoke('courses:add', folderPath),
  removeCourse: (courseId) => ipcRenderer.invoke('courses:remove', courseId),
  getLessons: (courseId) => ipcRenderer.invoke('courses:getLessons', courseId),
  getCourseProgress: (courseId) => ipcRenderer.invoke('courses:getProgress', courseId),

  // Progress
  updateProgress: (lessonId, data) => ipcRenderer.invoke('progress:update', lessonId, data),

  // Planner: now uses Supabase directly from renderer (no IPC needed)

  // Streak
  getStreak: () => ipcRenderer.invoke('streak:get'),
  checkStreak: () => ipcRenderer.invoke('streak:check'),
  incrementStreak: () => ipcRenderer.invoke('streak:increment'),

  // Study Sessions
  saveSession: (data) => ipcRenderer.invoke('sessions:save', data),
  getSessionStats: () => ipcRenderer.invoke('sessions:getStats'),

  // Settings
  getSetting: (key) => ipcRenderer.invoke('settings:get', key),
  setSetting: (key, value) => ipcRenderer.invoke('settings:set', key, value),

  // Google Drive
  addDriveCourse: (driveUrl) => ipcRenderer.invoke('drive:addCourse', driveUrl),
  getDriveStreamUrl: (driveFileId) => ipcRenderer.invoke('drive:getStreamUrl', driveFileId),

  // PDF
  readFileAsBuffer: (filePath) => ipcRenderer.invoke('file:readAsBuffer', filePath),
  getPdfAnnotations: (lessonId) => ipcRenderer.invoke('pdf:getAnnotations', lessonId),
  savePdfAnnotations: (lessonId, annotationsJson) => ipcRenderer.invoke('pdf:saveAnnotations', lessonId, annotationsJson),
});
