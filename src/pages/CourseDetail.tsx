import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Play, Pause, Volume2, Maximize, StickyNote } from 'lucide-react';
import { PdfViewer } from '../components/PdfViewer';
import {
  getCourses,
  getLessons,
  updateLessonProgress,
  getDriveStreamUrl,
  isElectron,
} from '../lib/dataService';
import type { CourseItem, LessonItem } from '../lib/dataService';

interface CourseDetailProps {
  courseId: string;
  onBack: () => void;
}

export function CourseDetail({ courseId, onBack }: CourseDetailProps) {
  const [course, setCourse] = useState<CourseItem | null>(null);
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [activeLesson, setActiveLesson] = useState<LessonItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [useDriveEmbed, setUseDriveEmbed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    loadCourseData();
  }, [courseId]);

  async function loadCourseData() {
    const courses = await getCourses();
    const c = courses.find((x) => x.id === courseId);
    setCourse(c || null);
    const l = await getLessons(courseId);
    setLessons(l);
  }

  async function selectLesson(lesson: LessonItem) {
    // Save current position before switching
    if (activeLesson && videoRef.current) {
      await savePosition();
    }
    setActiveLesson(lesson);
    setNotes(lesson.notes || '');
    setIsPlaying(false);
    setShowNotes(false);
    setUseDriveEmbed(false);

    // Resolve video source
    if (lesson.file_type === 'video') {
      if (lesson.drive_file_id) {
        const url = await getDriveStreamUrl(lesson.drive_file_id);
        if (url && url.includes('/preview')) {
          // Web mode: use iframe embed
          setVideoSrc(url);
          setUseDriveEmbed(true);
        } else {
          setVideoSrc(url || '');
        }
      } else if (isElectron()) {
        // Local file only works in Electron
        setVideoSrc(`file://${lesson.file_path.replace(/\\/g, '/')}`);
      } else {
        setVideoSrc('');
      }
    } else {
      setVideoSrc('');
    }

    // Mark as in_progress when opened
    if (lesson.status === 'not_started') {
      await updateLessonProgress(lesson.id, { status: 'in_progress' });
      loadCourseData();
    }
  }

  async function savePosition() {
    if (!activeLesson || !videoRef.current) return;
    const currentTime = Math.floor(videoRef.current.currentTime);
    const duration = videoRef.current.duration;
    const progress = duration > 0 ? currentTime / duration : 0;
    const status = progress >= 0.9 ? 'completed' : currentTime > 0 ? 'in_progress' : 'not_started';
    await updateLessonProgress(activeLesson.id, {
      position_sec: currentTime,
      status,
    });
  }

  async function saveNotes() {
    if (!activeLesson) return;
    await updateLessonProgress(activeLesson.id, { notes });
  }

  function handleTimeUpdate() {
    // Auto-complete logic could go here
  }

  function handleVideoEnd() {
    savePosition();
    setIsPlaying(false);
  }

  function handleLoadedMetadata() {
    if (videoRef.current && activeLesson && activeLesson.position_sec > 0) {
      videoRef.current.currentTime = activeLesson.position_sec;
    }
  }

  function togglePlay() {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
      savePosition();
    }
  }

  // Mark lesson as completed manually
  async function markCompleted(lessonId: string) {
    await updateLessonProgress(lessonId, { status: 'completed' });
    setLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, status: 'completed' } : l))
    );
  }

  // Group lessons by module
  const grouped: Record<string, LessonItem[]> = {};
  for (const l of lessons) {
    const key = l.module_name || '__root__';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(l);
  }

  const fileTypeIcon = (type: string) => {
    if (type === 'video') return '🎬';
    if (type === 'pdf') return '📄';
    return '📝';
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <span className="lesson-badge badge-completed">✓</span>;
      case 'in_progress': return <span className="lesson-badge badge-in-progress">▶</span>;
      default: return <span className="lesson-badge badge-not-started">—</span>;
    }
  };

  return (
    <div className="animate-in">
      <div className="back-link" onClick={onBack}>
        <ArrowLeft size={14} />
        Voltar para Meus Cursos
      </div>

      <div className="page-header">
        <h1 className="page-title">{course?.name || 'Curso'}
          {course?.source_type === 'drive' && (
            <span style={{
              marginLeft: 10,
              fontSize: 11,
              background: 'rgba(0,229,255,0.15)',
              border: '1px solid rgba(0,229,255,0.3)',
              borderRadius: 12,
              padding: '2px 10px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent)',
              verticalAlign: 'middle',
            }}>☁️ DRIVE</span>
          )}
        </h1>
        <p className="page-subtitle">{lessons.length} aula{lessons.length !== 1 ? 's' : ''}</p>
      </div>

      <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 200px)' }}>
        {/* Player area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {activeLesson && activeLesson.file_type === 'video' ? (
            <>
              <div style={{
                flex: 1,
                background: '#000',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
                position: 'relative',
                minHeight: 300,
              }}>
                {useDriveEmbed ? (
                  // Drive video embed (web/PWA mode)
                  <iframe
                    src={videoSrc}
                    style={{ width: '100%', height: '100%', border: 'none' }}
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                  />
                ) : videoSrc ? (
                  <video
                    ref={videoRef}
                    key={activeLesson.id}
                    src={videoSrc}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    onTimeUpdate={handleTimeUpdate}
                    onEnded={handleVideoEnd}
                    onLoadedMetadata={handleLoadedMetadata}
                    onPause={() => { setIsPlaying(false); savePosition(); }}
                    onPlay={() => setIsPlaying(true)}
                    controls
                  />
                ) : (
                  <div className="empty-state" style={{ height: '100%' }}>
                    <div className="empty-state-icon">🎬</div>
                    <div className="empty-state-text">
                      Vídeo local — abra no app Desktop para assistir
                    </div>
                  </div>
                )}
              </div>
              {/* Controls bar */}
              {!useDriveEmbed && videoSrc && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 0',
                }}>
                  <button className="btn btn-ghost btn-sm" onClick={togglePlay}>
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.volume = videoRef.current.volume > 0 ? 0 : 1;
                    }
                  }}>
                    <Volume2 size={14} />
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => {
                    videoRef.current?.requestFullscreen();
                  }}>
                    <Maximize size={14} />
                  </button>
                  <div style={{ flex: 1 }} />
                  <button
                    className={`btn btn-sm ${showNotes ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setShowNotes(!showNotes)}
                  >
                    <StickyNote size={14} />
                    Notas
                  </button>
                </div>
              )}

              {/* Drive embed controls */}
              {useDriveEmbed && (
                <div style={{ display: 'flex', gap: 8, padding: '10px 0', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => markCompleted(activeLesson.id)}
                  >
                    ✓ Marcar como Concluída
                  </button>
                  <button
                    className={`btn btn-sm ${showNotes ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setShowNotes(!showNotes)}
                  >
                    <StickyNote size={14} />
                    Notas
                  </button>
                </div>
              )}

              {/* Notes panel */}
              {showNotes && (
                <div style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: 14,
                  marginTop: 4,
                }}>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={saveNotes}
                    placeholder="Suas anotações para esta aula..."
                    style={{
                      width: '100%',
                      minHeight: 80,
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)',
                      padding: 10,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-sans)',
                      fontSize: 13,
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>
              )}
            </>
          ) : activeLesson && activeLesson.file_type === 'pdf' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 300 }}>
              <PdfViewer
                key={activeLesson.id}
                filePath={activeLesson.file_path}
                lessonId={Number(activeLesson.id)}
                isDrive={!!activeLesson.drive_file_id}
                driveFileId={activeLesson.drive_file_id || undefined}
              />
            </div>
          ) : activeLesson ? (
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="empty-state-icon">{fileTypeIcon(activeLesson.file_type)}</div>
              <div className="empty-state-title">{activeLesson.title}</div>
              <div className="empty-state-text">
                Tipo de arquivo: {activeLesson.file_type.toUpperCase()}
                <br />Abra o arquivo externamente para visualizar.
              </div>
            </div>
          ) : (
            <div className="empty-state" style={{ flex: 1 }}>
              <div className="empty-state-icon">🎬</div>
              <div className="empty-state-title">Selecione uma aula</div>
              <div className="empty-state-text">
                Escolha uma aula na lista ao lado para começar a assistir.
              </div>
            </div>
          )}
        </div>

        {/* Lesson sidebar */}
        <div style={{
          width: 320,
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}>
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}>
            Aulas
          </div>
          <div className="lesson-list" style={{ overflow: 'auto', flex: 1, padding: '4px 8px' }}>
            {Object.entries(grouped).map(([module, moduleLessons]) => (
              <div key={module}>
                {module !== '__root__' && (
                  <div className="module-header">📁 {module}</div>
                )}
                {moduleLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="lesson-item"
                    style={activeLesson?.id === lesson.id ? {
                      background: 'var(--accent-soft)',
                      borderColor: 'var(--border-accent)',
                    } : {}}
                    onClick={() => selectLesson(lesson)}
                  >
                    <span className="lesson-icon">{fileTypeIcon(lesson.file_type)}</span>
                    <span className="lesson-title" title={lesson.title}>{lesson.title}</span>
                    {statusBadge(lesson.status)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
