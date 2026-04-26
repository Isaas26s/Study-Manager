const fs = require('fs');
const path = require('path');

const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.webm', '.avi', '.mov'];
const PDF_EXTENSIONS = ['.pdf'];

function getFileType(ext) {
  if (VIDEO_EXTENSIONS.includes(ext.toLowerCase())) return 'video';
  if (PDF_EXTENSIONS.includes(ext.toLowerCase())) return 'pdf';
  return 'other';
}

/**
 * Scans a course folder up to 2 levels deep.
 * Structure A: Course/ -> files (no modules)
 * Structure B: Course/ -> Module/ -> files
 */
function scanCourseFolder(folderPath) {
  const lessons = [];
  let globalOrder = 0;

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    // Separate files and directories
    const files = entries.filter((e) => e.isFile());
    const dirs = entries.filter((e) => e.isDirectory());

    // Sort naturally (numeric aware)
    const naturalSort = (a, b) => {
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    };

    // Top-level files (no module)
    files.sort(naturalSort);
    for (const file of files) {
      const ext = path.extname(file.name);
      const fileType = getFileType(ext);
      if (fileType === 'other') continue; // Skip non-media/pdf files at root

      globalOrder++;
      lessons.push({
        moduleName: null,
        title: path.basename(file.name, ext),
        filePath: path.join(folderPath, file.name),
        fileType,
        sortOrder: globalOrder,
      });
    }

    // Subdirectories as modules (1 level deep)
    dirs.sort(naturalSort);
    for (const dir of dirs) {
      const modulePath = path.join(folderPath, dir.name);
      let moduleFiles;
      try {
        moduleFiles = fs.readdirSync(modulePath, { withFileTypes: true })
          .filter((e) => e.isFile());
      } catch {
        continue;
      }

      moduleFiles.sort(naturalSort);
      for (const file of moduleFiles) {
        const ext = path.extname(file.name);
        const fileType = getFileType(ext);
        if (fileType === 'other') continue;

        globalOrder++;
        lessons.push({
          moduleName: dir.name,
          title: path.basename(file.name, ext),
          filePath: path.join(modulePath, file.name),
          fileType,
          sortOrder: globalOrder,
        });
      }
    }
  } catch (err) {
    console.error('[Scanner] Error scanning folder:', err);
  }

  return lessons;
}

module.exports = { scanCourseFolder };
