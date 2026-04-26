import { useState, useEffect } from 'react';
import { FolderPlus, Trash2, Cloud, Link2, Loader2, ListChecks } from 'lucide-react';
import {
  getCourses,
  getCourseProgress,
  addDriveCourse,
  addLocalCourse,
  removeCourse,
  getSetting,
  setSetting,
  isElectron,
  addCourseToPlanner,
} from '../lib/dataService';
import type { CourseItem, CourseProgressData } from '../lib/dataService';

interface CoursesProps {
  onSelectCourse: (courseId: string) => void;
}

interface CourseWithProgress extends CourseItem {
  progress: CourseProgressData;
}

export function Courses({ onSelectCourse }: CoursesProps) {
  const [courses, setCourses] = useState<CourseWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [driveUrl, setDriveUrl] = useState('');
  const [driveLoading, setDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState('');
  const [showApiKeySetup, setShowApiKeySetup] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    loadCourses();
    loadApiKey();
  }, []);

  async function loadCourses() {
    const raw = await getCourses();
    const withProgress = await Promise.all(
      raw.map(async (c) => {
        const progress = await getCourseProgress(c.id);
        return { ...c, progress };
      })
    );
    setCourses(withProgress);
    setLoading(false);
  }

  async function loadApiKey() {
    const key = await getSetting('google_api_key');
    if (key) setApiKey(key);
  }

  async function handleAddCourse() {
    const result = await addLocalCourse();
    if (result.error === 'cancelled') return;
    if (result.error) {
      alert(result.error);
      return;
    }
    await loadCourses();
  }

  async function handleAddDriveCourse() {
    if (!driveUrl.trim()) return;

    // Check if API key is set
    const currentKey = await getSetting('google_api_key');
    if (!currentKey) {
      setShowApiKeySetup(true);
      setDriveError('');
      return;
    }

    setDriveLoading(true);
    setDriveError('');

    const result = await addDriveCourse(driveUrl.trim());
    setDriveLoading(false);

    if (result.error && !result.courseId) {
      // Full error — course not created
      setDriveError(result.error);
      return;
    }

    if (result.error && result.courseId) {
      // Partial — course created but issue with lessons
      setDriveError(result.error);
      await loadCourses();
      return;
    }

    // Success
    setDriveUrl('');
    setShowDriveModal(false);
    await loadCourses();
  }

  async function handleSaveApiKey() {
    if (!apiKey.trim()) return;
    await setSetting('google_api_key', apiKey.trim());
    setShowApiKeySetup(false);
    setDriveError('');
    // Retry the drive add
    if (driveUrl.trim()) {
      handleAddDriveCourse();
    }
  }

  async function handleRemoveCourse(e: React.MouseEvent, courseId: string) {
    e.stopPropagation();
    await removeCourse(courseId);
    await loadCourses();
  }

  if (loading) {
    return (
      <div className="animate-in">
        <div className="page-header">
          <h1 className="page-title">&gt;_ Meus Cursos</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">&gt;_ Meus Cursos</h1>
          <p className="page-subtitle">{courses.length} curso{courses.length !== 1 ? 's' : ''} adicionado{courses.length !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => setShowDriveModal(true)}>
            <Cloud size={16} />
            Google Drive
          </button>
          {isElectron() && (
            <button className="btn btn-primary" onClick={handleAddCourse}>
              <FolderPlus size={16} />
              Pasta Local
            </button>
          )}
        </div>
      </div>

      {/* Drive URL Modal */}
      {showDriveModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
        }} onClick={() => { setShowDriveModal(false); setShowApiKeySetup(false); setDriveError(''); }}>
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 28,
            width: 520,
            maxWidth: '90%',
          }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 16, marginBottom: 4, color: 'var(--text-primary)' }}>
              <Cloud size={18} style={{ display: 'inline', marginRight: 8, verticalAlign: 'text-bottom', color: 'var(--accent)' }} />
              Adicionar do Google Drive
            </h2>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Cole o link de uma pasta compartilhada do Google Drive
            </p>

            {!showApiKeySetup ? (
              <>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Link2 size={14} style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                    }} />
                    <input
                      type="text"
                      value={driveUrl}
                      onChange={(e) => setDriveUrl(e.target.value)}
                      placeholder="https://drive.google.com/drive/folders/..."
                      onKeyDown={(e) => e.key === 'Enter' && handleAddDriveCourse()}
                      style={{
                        width: '100%',
                        padding: '10px 12px 10px 34px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-xs)',
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        fontFamily: 'var(--font-mono)',
                        outline: 'none',
                      }}
                    />
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={handleAddDriveCourse}
                    disabled={driveLoading || !driveUrl.trim()}
                    style={{ opacity: driveLoading || !driveUrl.trim() ? 0.5 : 1 }}
                  >
                    {driveLoading ? <Loader2 size={14} className="spin" /> : <Cloud size={14} />}
                    {driveLoading ? 'Importando...' : 'Importar'}
                  </button>
                </div>

                {driveError && (
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--red-glow)',
                    border: '1px solid rgba(255,59,59,0.3)',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: 12,
                    color: 'var(--red)',
                    marginBottom: 12,
                  }}>
                    {driveError}
                  </div>
                )}

                <div style={{
                  padding: 14,
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  lineHeight: 1.6,
                }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>💡 Como funciona:</strong><br />
                  1. A pasta do Drive precisa estar <strong>compartilhada</strong> (qualquer pessoa com o link)<br />
                  2. O app lista os vídeos e PDFs da pasta automaticamente<br />
                  3. Os vídeos são reproduzidos diretamente do Google Drive
                  <br /><br />
                  <span
                    style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
                    onClick={() => setShowApiKeySetup(true)}
                  >
                    ⚙️ Configurar / Alterar API Key
                  </span>
                </div>
              </>
            ) : (
              /* API Key Setup */
              <>
                <div style={{
                  padding: 14,
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--border-accent)',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  lineHeight: 1.8,
                  marginBottom: 14,
                }}>
                  <strong>🔑 Configuração Inicial (uma vez só):</strong><br />
                  1. Acesse <strong>console.cloud.google.com</strong><br />
                  2. Crie um projeto (ou use um existente)<br />
                  3. Ative a <strong>Google Drive API</strong><br />
                  4. Em <strong>Credenciais</strong> → <strong>Criar Credenciais</strong> → <strong>Chave de API</strong><br />
                  5. Copie a chave e cole abaixo
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Cole sua Google API Key aqui..."
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xs)',
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                    }}
                  />
                  <button className="btn btn-primary" onClick={handleSaveApiKey} disabled={!apiKey.trim()}>
                    Salvar
                  </button>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 10 }}
                  onClick={() => setShowApiKeySetup(false)}
                >
                  ← Voltar
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📂</div>
          <div className="empty-state-title">Nenhum curso adicionado</div>
          <div className="empty-state-text">
            {isElectron()
              ? 'Adicione cursos de uma pasta local ou cole um link do Google Drive.'
              : 'Cole um link de pasta do Google Drive para importar um curso.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setShowDriveModal(true)}>
              <Cloud size={16} />
              Google Drive
            </button>
            {isElectron() && (
              <button className="btn btn-ghost" onClick={handleAddCourse}>
                <FolderPlus size={16} />
                Pasta Local
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="card-grid">
          {courses.map((course) => (
            <div
              key={course.id}
              className="course-card"
              onClick={() => onSelectCourse(course.id)}
            >
              <div className="course-card-header">
                <div className="course-card-icon">
                  {course.source_type === 'drive' ? '☁️' : '📁'}
                </div>
                {course.source_type === 'drive' && (
                  <div style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    background: 'rgba(0,229,255,0.15)',
                    border: '1px solid rgba(0,229,255,0.3)',
                    borderRadius: 12,
                    padding: '2px 8px',
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent)',
                  }}>
                    DRIVE
                  </div>
                )}
              </div>
              <div className="course-card-body">
                <div className="course-card-name" title={course.name}>{course.name}</div>
                <div className="course-card-meta">
                  <span>{course.progress.total} aulas</span>
                  <span className="course-card-percentage">{course.progress.percentage}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${course.progress.percentage}%` }} />
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const section = await addCourseToPlanner(course.id, course.name);
                      if (section) alert(`✅ "${course.name}" adicionado ao Planner com ${course.progress.total} itens!`);
                    }}
                    title="Adicionar ao Planner"
                  >
                    <ListChecks size={14} />
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => handleRemoveCourse(e, course.id)}
                    title="Remover curso"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
