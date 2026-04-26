import {
  LayoutDashboard,
  BookOpen,
  ListChecks,
  Timer,
  Zap,
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: 'dashboard' | 'courses' | 'planner' | 'routine') => void;
  hardcoreMode: boolean;
  onToggleHardcore: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'courses', label: 'Meus Cursos', icon: BookOpen },
  { id: 'planner', label: 'Planner', icon: ListChecks },
  { id: 'routine', label: 'Rotina Diária', icon: Timer },
] as const;

export function Sidebar({ currentPage, onNavigate, hardcoreMode, onToggleHardcore }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🎯</div>
        <div className="sidebar-logo-text">
          Study Manager
          <span>Cyber Planner</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <div
            key={item.id}
            className={`nav-item ${currentPage === item.id || (currentPage === 'course-detail' && item.id === 'courses') ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon className="nav-icon" size={18} />
            {item.label}
          </div>
        ))}
      </nav>
      <div style={{ padding: '0 8px', marginTop: 'auto' }}>
        <div
          className={`nav-item ${hardcoreMode ? 'active' : ''}`}
          onClick={onToggleHardcore}
          style={hardcoreMode ? { color: 'var(--red)', borderColor: 'rgba(255,59,59,0.3)' } : {}}
        >
          <Zap size={18} className="nav-icon" />
          Modo Hardcore
          <span style={{
            marginLeft: 'auto',
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: hardcoreMode ? 'var(--red)' : 'var(--text-muted)',
          }}>
            {hardcoreMode ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>
    </aside>
  );
}
