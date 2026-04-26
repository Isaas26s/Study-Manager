import { useState, useEffect } from 'react';
import { Flame, Clock, Trophy, Target } from 'lucide-react';
import { getStreak, getSessionStats, getPlannerSections, getAllPlannerItems } from '../lib/dataService';
import type { StreakInfo, SessionStatsInfo, PlannerSection } from '../lib/dataService';

interface DashboardProps {
  onNavigate: (page: 'dashboard' | 'courses' | 'planner' | 'routine') => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [stats, setStats] = useState<SessionStatsInfo | null>(null);
  const [sections, setSections] = useState<PlannerSection[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [completedItems, setCompletedItems] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [s, st, sec, items] = await Promise.all([
      getStreak(),
      getSessionStats(),
      getPlannerSections(),
      getAllPlannerItems(),
    ]);
    setStreak(s);
    setStats(st);
    setSections(sec);
    setTotalItems(items.length);
    setCompletedItems(items.filter((i) => i.completed).length);
  }

  const totalHours = stats ? Math.floor(stats.totalMinutes / 60) : 0;
  const totalMin = stats ? stats.totalMinutes % 60 : 0;
  const plannerPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">&gt;_ Dashboard</h1>
        <p className="page-subtitle">Seu progresso de estudos em Cybersecurity</p>
      </div>

      <div className="metric-grid">
        <div className="metric-card">
          <span className="metric-label">Streak Atual</span>
          <span className="metric-value">
            <Flame size={24} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
            {streak?.current_streak ?? 0}
          </span>
          <span className="metric-sub">Melhor: {streak?.best_streak ?? 0} dias</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Tempo Total</span>
          <span className="metric-value">
            <Clock size={24} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
            {totalHours}h{totalMin > 0 ? ` ${totalMin}m` : ''}
          </span>
          <span className="metric-sub">{stats?.totalDays ?? 0} dias de estudo</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Planner</span>
          <span className="metric-value">
            <Trophy size={24} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
            {plannerPct}%
          </span>
          <span className="metric-sub">{completedItems}/{totalItems} itens concluídos</span>
        </div>
      </div>

      {sections.length > 0 && (
        <div className="mission-card">
          <div className="mission-week">
            <Target size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'text-bottom' }} />
            Sessões Ativas — {sections.length} sessão{sections.length !== 1 ? 'ões' : ''}
          </div>
          <div className="mission-text">
            Progresso geral: {completedItems} de {totalItems} itens concluídos ({plannerPct}%)
          </div>
        </div>
      )}

      <div className="section-title">Acesso Rápido</div>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-primary" onClick={() => onNavigate('courses')}>
          <BookOpenIcon /> Meus Cursos
        </button>
        <button className="btn btn-ghost" onClick={() => onNavigate('planner')}>
          <ListIcon /> Planner
        </button>
        <button className="btn btn-ghost" onClick={() => onNavigate('routine')}>
          <TimerIcon /> Iniciar Rotina
        </button>
      </div>
    </div>
  );
}

// Inline mini icons
function BookOpenIcon() { return <span>📚</span>; }
function ListIcon() { return <span>📋</span>; }
function TimerIcon() { return <span>⏱️</span>; }
