const { net } = require('electron');

const DRIVE_FOLDER_REGEX = /\/folders\/([a-zA-Z0-9_-]+)/;
const DRIVE_FILE_REGEX = /\/d\/([a-zA-Z0-9_-]+)/;

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.avi', '.mov'];
const VIDEO_MIMETYPES = [
  'video/mp4',
  'video/x-matroska',
  'video/webm',
  'video/x-msvideo',
  'video/quicktime',
];
const PDF_MIMETYPES = ['application/pdf'];

/**
 * Extract folder ID from a Google Drive URL
 */
function extractFolderId(url) {
  const match = url.match(DRIVE_FOLDER_REGEX);
  return match ? match[1] : null;
}

/**
 * List files in a Google Drive folder using the API
 */
async function listDriveFolder(folderId, apiKey) {
  const allFiles = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      key: apiKey,
      fields: 'nextPageToken,files(id,name,mimeType,size,modifiedTime)',
      pageSize: '1000',
      orderBy: 'name',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
    const response = await netFetch(url);

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Drive] API Error:', response.status, errText);
      if (response.status === 403 || response.status === 401) {
        throw new Error('API Key inválida ou sem permissão. Verifique sua chave nas Configurações.');
      }
      if (response.status === 404) {
        throw new Error('Pasta não encontrada. Verifique se o link está correto e a pasta é compartilhada.');
      }
      throw new Error(`Erro da API do Google Drive: ${response.status}`);
    }

    const data = await response.json();
    if (data.files) allFiles.push(...data.files);
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

/**
 * Recursively list files up to 2 levels deep (folder → subfolder → files)
 */
async function scanDriveFolder(folderId, apiKey, depth = 0) {
  const files = await listDriveFolder(folderId, apiKey);
  const lessons = [];

  // Separate folders from files
  const folders = files.filter((f) => f.mimeType === 'application/vnd.google-apps.folder');
  const mediaFiles = files.filter((f) => f.mimeType !== 'application/vnd.google-apps.folder');

  let sortOrder = 0;

  // Process files at this level
  for (const file of mediaFiles) {
    const fileType = getFileType(file.mimeType, file.name);
    if (!fileType) continue;

    sortOrder++;
    lessons.push({
      moduleName: null,
      title: cleanFileName(file.name),
      filePath: file.id, // Store Drive file ID
      fileType,
      sortOrder,
      driveFileId: file.id,
    });
  }

  // Process subfolders (only 1 level deep)
  if (depth < 1) {
    for (const folder of folders) {
      const subFiles = await listDriveFolder(folder.id, apiKey);
      const subMediaFiles = subFiles.filter(
        (f) => f.mimeType !== 'application/vnd.google-apps.folder'
      );

      for (const file of subMediaFiles) {
        const fileType = getFileType(file.mimeType, file.name);
        if (!fileType) continue;

        sortOrder++;
        lessons.push({
          moduleName: folder.name,
          title: cleanFileName(file.name),
          filePath: file.id,
          fileType,
          sortOrder,
          driveFileId: file.id,
        });
      }
    }
  }

  return lessons;
}

/**
 * Get a streamable/downloadable URL for a Drive file
 */
function getDriveStreamUrl(fileId, apiKey) {
  return `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;
}

/**
 * Get the folder name from Drive API
 */
async function getDriveFolderName(folderId, apiKey) {
  const url = `https://www.googleapis.com/drive/v3/files/${folderId}?key=${apiKey}&fields=name`;
  const response = await netFetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  return data.name;
}

// ─── Helpers ─────────────────────────────────────────────────

function getFileType(mimeType, fileName) {
  if (VIDEO_MIMETYPES.some((m) => mimeType.startsWith(m))) return 'video';
  if (PDF_MIMETYPES.includes(mimeType)) return 'pdf';
  // Fallback: check extension
  const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (ext === '.pdf') return 'pdf';
  return null;
}

function cleanFileName(name) {
  // Remove file extension
  const lastDot = name.lastIndexOf('.');
  if (lastDot > 0) return name.substring(0, lastDot);
  return name;
}

async function netFetch(url) {
  return net.fetch(url);
}

module.exports = {
  extractFolderId,
  scanDriveFolder,
  getDriveStreamUrl,
  getDriveFolderName,
};
