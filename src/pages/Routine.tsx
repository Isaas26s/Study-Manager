import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, CheckCircle2 } from 'lucide-react';
import { saveSession, incrementStreak } from '../lib/dataService';

interface Block {
  id: string;
  label: string;
  title: string;
  goalMinutes: number;
  elapsed: number; // seconds
  running: boolean;
  done: boolean;
}

const INITIAL_BLOCKS: Block[] = [
  { id: 'main', label: 'Bloco 1', title: 'Conteúdo Principal (Python)', goalMinutes: 60, elapsed: 0, running: false, done: false },
  { id: 'logic', label: 'Bloco 2', title: 'Reforço (Lógica)', goalMinutes: 30, elapsed: 0, running: false, done: false },
  { id: 'cyber', label: 'Bloco 3', title: 'Cyber / Redes / Linux', goalMinutes: 60, elapsed: 0, running: false, done: false },
  { id: 'practice', label: 'Bloco 4', title: 'Prática / Projeto', goalMinutes: 30, elapsed: 0, running: false, done: false },
];

export function Routine() {
  const [blocks, setBlocks] = useState<Block[]>(INITIAL_BLOCKS);
  const [allDone, setAllDone] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    setBlocks((prev) => {
      const next = prev.map((b) => {
        if (!b.running || b.done) return b;
        const newElapsed = b.elapsed + 1;
        const isDone = newElapsed >= b.goalMinutes * 60;
        return { ...b, elapsed: newElapsed, done: isDone, running: isDone ? false : b.running };
      });
      return next;
    });
  }, []);

  useEffect(() => {
    const anyRunning = blocks.some((b) => b.running);
    if (anyRunning && !intervalRef.current) {
      intervalRef.current = setInterval(tick, 1000);
    } else if (!anyRunning && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [blocks, tick]);

  useEffect(() => {
    const done = blocks.every((b) => b.done);
    if (done && !allDone) {
      setAllDone(true);
      // Save session and increment streak
      const totalMin = Math.floor(blocks.reduce((a, b) => a + b.elapsed, 0) / 60);
      saveSession(totalMin, blocks.map((b) => b.id));
      incrementStreak();
    }
  }, [blocks, allDone]);

  function toggleBlock(blockId: string) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === blockId && !b.done) {
          return { ...b, running: !b.running };
        }
        return b;
      })
    );
  }

  function resetBlock(blockId: string) {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id === blockId) {
          return { ...b, elapsed: 0, running: false, done: false };
        }
        return b;
      })
    );
    setAllDone(false);
  }

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function getProgress(block: Block): number {
    const goal = block.goalMinutes * 60;
    return goal > 0 ? Math.min((block.elapsed / goal) * 100, 100) : 0;
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <h1 className="page-title">&gt;_ Rotina Diária</h1>
        <p className="page-subtitle">Complete os 4 blocos para manter sua streak</p>
      </div>

      {allDone && (
        <div style={{
          background: 'var(--green-glow)',
          border: '1px solid rgba(57,255,20,0.3)',
          borderRadius: 'var(--radius)',
          padding: 20,
          textAlign: 'center',
          marginBottom: 20,
        }}>
          <CheckCircle2 size={32} style={{ color: 'var(--green)', marginBottom: 8 }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>
            Parabéns! 🎉
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Todos os blocos concluídos! Sua streak foi atualizada.
          </div>
        </div>
      )}

      <div className="timer-grid">
        {blocks.map((block) => (
          <div
            key={block.id}
            className={`timer-card ${block.running ? 'active' : ''} ${block.done ? 'done' : ''}`}
          >
            <div className="timer-label">{block.label}</div>
            <div className="timer-title">{block.title}</div>
            <div className="timer-display">{formatTime(block.elapsed)}</div>
            <div className="timer-goal">Meta: {block.goalMinutes} min</div>
            <div className="progress-bar" style={{ marginBottom: 14 }}>
              <div className="progress-fill" style={{ width: `${getProgress(block)}%` }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {block.done ? (
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--green)' }} disabled>
                  <CheckCircle2 size={14} /> Concluído
                </button>
              ) : (
                <button className="btn btn-primary btn-sm" onClick={() => toggleBlock(block.id)}>
                  {block.running ? <Pause size={14} /> : <Play size={14} />}
                  {block.running ? 'Pausar' : 'Iniciar'}
                </button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => resetBlock(block.id)}>
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
