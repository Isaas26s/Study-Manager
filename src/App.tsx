import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { OfflineBanner } from './components/OfflineBanner';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Courses } from './pages/Courses';
import { CourseDetail } from './pages/CourseDetail';
import { Planner } from './pages/Planner';
import { Routine } from './pages/Routine';
import { getSetting, setSetting, isElectron as checkIsElectron } from './lib/dataService';
import './types/electron.d.ts';

type Page = 'dashboard' | 'courses' | 'course-detail' | 'planner' | 'routine';

// ── Loading screen ───────────────────────────────────────────────
function LoadingScreen() {
  return (
    <div className="login-page">
      <div className="login-bg-grid" aria-hidden="true" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'relative', zIndex: 1 }}>
        <div style={{ width: 48, height: 48, border: '3px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontSize: 12, letterSpacing: 1 }}>
          CARREGANDO...
        </span>
      </div>
    </div>
  );
}

// ── Main app (requires authentication) ──────────────────────────
function AppContent() {
  const { session, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [hardcoreMode, setHardcoreMode] = useState(false);

  useEffect(() => {
    getSetting('hardcore_mode').then((val) => {
      setHardcoreMode(val === 'true');
    });
  }, []);

  // Show spinner while checking session
  if (loading) return <LoadingScreen />;

  // Not authenticated → show Login
  if (!session) return <Login />;

  const navigateToCourseDetail = (courseId: string) => {
    setSelectedCourseId(courseId);
    setCurrentPage('course-detail');
  };

  const navigateBack = () => {
    setCurrentPage('courses');
    setSelectedCourseId(null);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} />;
      case 'courses':
        return <Courses onSelectCourse={navigateToCourseDetail} />;
      case 'course-detail':
        return selectedCourseId ? (
          <CourseDetail courseId={selectedCourseId} onBack={navigateBack} />
        ) : null;
      case 'planner':
        return <Planner />;
      case 'routine':
        return <Routine />;
      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  const isElectronApp = checkIsElectron();

  return (
    <div className="app-layout" data-hardcore={hardcoreMode}>
      <OfflineBanner />
      {/* TitleBar only renders in Electron (desktop) */}
      {isElectronApp && <TitleBar />}
      <div className="app-body">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          hardcoreMode={hardcoreMode}
          onToggleHardcore={async () => {
            const newVal = !hardcoreMode;
            setHardcoreMode(newVal);
            await setSetting('hardcore_mode', String(newVal));
          }}
        />
        <main className="main-content">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

// ── Root export wraps everything in AuthProvider ─────────────────
function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;

