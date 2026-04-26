import { useState, useEffect, useRef } from 'react';
import { Plus, Check, Trash2, ChevronDown, ChevronRight, Edit3, X, GripVertical } from 'lucide-react';
import {
  getPlannerSections,
  createPlannerSection,
  updatePlannerSection,
  deletePlannerSection,
  getAllPlannerItems,
  createPlannerItem,
  togglePlannerItem,
  deletePlannerItem,
  updatePlannerItem,
} from '../lib/dataService';
import type { PlannerSection, PlannerItem } from '../lib/dataService';

export function Planner() {
  const [sections, setSections] = useState<PlannerSection[]>([]);
  const [items, setItems] = useState<PlannerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showNewSection, setShowNewSection] = useState(false);
  const [newItemTitles, setNewItemTitles] = useState<Record<string, string>>({});
  const [addingToSection, setAddingToSection] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState('');

  const newSectionInputRef = useRef<HTMLInputElement>(null);
  const newItemInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (showNewSection && newSectionInputRef.current) {
      newSectionInputRef.current.focus();
    }
  }, [showNewSection]);

  useEffect(() => {
    if (addingToSection && newItemInputRef.current) {
      newItemInputRef.current.focus();
    }
  }, [addingToSection]);

  async function loadData() {
    setLoading(true);
    const [s, i] = await Promise.all([
      getPlannerSections(),
      getAllPlannerItems(),
    ]);
    setSections(s);
    setItems(i);
    setLoading(false);
  }

  // ── Section CRUD ─────────────────────────────────────────────

  async function handleCreateSection() {
    if (!newSectionTitle.trim()) return;
    const section = await createPlannerSection(newSectionTitle.trim());
    if (section) {
      setSections((prev) => [...prev, section]);
    }
    setNewSectionTitle('');
    setShowNewSection(false);
  }

  async function handleUpdateSection(sectionId: string) {
    if (!editingSectionTitle.trim()) return;
    await updatePlannerSection(sectionId, editingSectionTitle.trim());
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, title: editingSectionTitle.trim() } : s))
    );
    setEditingSection(null);
  }

  async function handleDeleteSection(sectionId: string) {
    await deletePlannerSection(sectionId);
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    setItems((prev) => prev.filter((i) => i.section_id !== sectionId));
  }

  // ── Item CRUD ────────────────────────────────────────────────

  async function handleCreateItem(sectionId: string) {
    const title = newItemTitles[sectionId]?.trim();
    if (!title) return;
    const item = await createPlannerItem(sectionId, title);
    if (item) {
      setItems((prev) => [...prev, item]);
    }
    setNewItemTitles((prev) => ({ ...prev, [sectionId]: '' }));
  }

  async function handleToggleItem(itemId: string, current: boolean) {
    const newVal = !current;
    await togglePlannerItem(itemId, newVal);
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, completed: newVal } : i))
    );
  }

  async function handleDeleteItem(itemId: string) {
    await deletePlannerItem(itemId);
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  async function handleUpdateItem(itemId: string) {
    if (!editingItemTitle.trim()) return;
    await updatePlannerItem(itemId, editingItemTitle.trim());
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, title: editingItemTitle.trim() } : i))
    );
    setEditingItem(null);
  }

  // ── Progress calc ────────────────────────────────────────────

  function getSectionProgress(sectionId: string) {
    const sectionItems = items.filter((i) => i.section_id === sectionId);
    const total = sectionItems.length;
    const completed = sectionItems.filter((i) => i.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }

  function getOverallProgress() {
    const total = items.length;
    const completed = items.filter((i) => i.completed).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, pct };
  }

  // ── Collapse toggle ──────────────────────────────────────────

  function toggleCollapse(sectionId: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  // ── Render ───────────────────────────────────────────────────

  const overall = getOverallProgress();

  if (loading) {
    return (
      <div className="animate-in">
        <div className="page-header">
          <h1 className="page-title">&gt;_ Planner</h1>
        </div>
        <p style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="animate-in">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">&gt;_ Planner</h1>
          <p className="page-subtitle">Organize seus estudos em sessões personalizadas</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowNewSection(true)}
          id="add-section-btn"
        >
          <Plus size={16} />
          Nova Sessão
        </button>
      </div>

      {/* Overall progress bar */}
      {items.length > 0 && (
        <div className="planner-overall-progress" style={{ marginBottom: 28 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}>
              Progresso Geral
            </span>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              fontWeight: 700,
              color: overall.pct === 100 ? 'var(--green)' : 'var(--accent)',
            }}>
              {overall.completed}/{overall.total} — {overall.pct}%
            </span>
          </div>
          <div className="progress-bar" style={{ height: 8 }}>
            <div className="progress-fill" style={{ width: `${overall.pct}%` }} />
          </div>
        </div>
      )}

      {/* New section form */}
      {showNewSection && (
        <div className="card" style={{ marginBottom: 16, padding: 16, borderColor: 'var(--border-accent)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={newSectionInputRef}
              type="text"
              value={newSectionTitle}
              onChange={(e) => setNewSectionTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSection();
                if (e.key === 'Escape') setShowNewSection(false);
              }}
              placeholder="Nome da sessão (ex: Python Básico, Redes, CTF...)"
              className="planner-input"
              id="new-section-input"
            />
            <button className="btn btn-primary btn-sm" onClick={handleCreateSection}>
              <Plus size={14} />
              Criar
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowNewSection(false)}>
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {sections.length === 0 && !showNewSection && (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">Seu planner está vazio</div>
          <div className="empty-state-text">
            Crie sessões para organizar suas tarefas de estudo.
            Cada sessão pode ter sub-itens que você vai marcando conforme avança.
          </div>
          <button className="btn btn-primary" onClick={() => setShowNewSection(true)}>
            <Plus size={16} />
            Criar Primeira Sessão
          </button>
        </div>
      )}

      {/* Sections */}
      <div className="planner-sections">
        {sections.map((section) => {
          const progress = getSectionProgress(section.id);
          const isCollapsed = collapsedSections.has(section.id);
          const sectionItems = items.filter((i) => i.section_id === section.id);

          return (
            <div key={section.id} className="planner-section">
              {/* Section header */}
              <div
                className="planner-section-header"
                onClick={() => toggleCollapse(section.id)}
              >
                <div className="planner-section-left">
                  <span className="planner-collapse-icon">
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  </span>

                  {editingSection === section.id ? (
                    <input
                      type="text"
                      value={editingSectionTitle}
                      onChange={(e) => setEditingSectionTitle(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') handleUpdateSection(section.id);
                        if (e.key === 'Escape') setEditingSection(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={() => handleUpdateSection(section.id)}
                      className="planner-input planner-input-inline"
                      autoFocus
                    />
                  ) : (
                    <span className="planner-section-title">{section.title}</span>
                  )}
                </div>

                <div className="planner-section-right" onClick={(e) => e.stopPropagation()}>
                  <span className="planner-section-progress">
                    {progress.completed}/{progress.total} — {progress.pct}%
                  </span>
                  <button
                    className="planner-icon-btn"
                    onClick={() => {
                      setEditingSection(section.id);
                      setEditingSectionTitle(section.title);
                    }}
                    title="Renomear sessão"
                  >
                    <Edit3 size={13} />
                  </button>
                  <button
                    className="planner-icon-btn planner-icon-btn-danger"
                    onClick={() => {
                      if (confirm(`Excluir a sessão "${section.title}" e todos os itens?`)) {
                        handleDeleteSection(section.id);
                      }
                    }}
                    title="Excluir sessão"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Section progress bar */}
              <div className="progress-bar" style={{ margin: '0 16px 4px', height: 4 }}>
                <div className="progress-fill" style={{ width: `${progress.pct}%` }} />
              </div>

              {/* Section items */}
              {!isCollapsed && (
                <div className="planner-items">
                  {sectionItems.map((item) => (
                    <div
                      key={item.id}
                      className={`planner-item ${item.completed ? 'planner-item-done' : ''}`}
                    >
                      <div className="planner-item-left">
                        <GripVertical size={12} className="planner-grip" />
                        <div
                          className={`planner-checkbox ${item.completed ? 'planner-checkbox-checked' : ''}`}
                          onClick={() => handleToggleItem(item.id, item.completed)}
                        >
                          {item.completed && <Check size={12} />}
                        </div>

                        {editingItem === item.id ? (
                          <input
                            type="text"
                            value={editingItemTitle}
                            onChange={(e) => setEditingItemTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateItem(item.id);
                              if (e.key === 'Escape') setEditingItem(null);
                            }}
                            onBlur={() => handleUpdateItem(item.id)}
                            className="planner-input planner-input-inline"
                            autoFocus
                          />
                        ) : (
                          <span
                            className={`planner-item-text ${item.completed ? 'planner-item-text-done' : ''}`}
                            onDoubleClick={() => {
                              setEditingItem(item.id);
                              setEditingItemTitle(item.title);
                            }}
                          >
                            {item.title}
                          </span>
                        )}
                      </div>

                      <div className="planner-item-actions">
                        <button
                          className="planner-icon-btn"
                          onClick={() => {
                            setEditingItem(item.id);
                            setEditingItemTitle(item.title);
                          }}
                        >
                          <Edit3 size={12} />
                        </button>
                        <button
                          className="planner-icon-btn planner-icon-btn-danger"
                          onClick={() => handleDeleteItem(item.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add new item */}
                  {addingToSection === section.id ? (
                    <div className="planner-new-item">
                      <input
                        ref={newItemInputRef}
                        type="text"
                        value={newItemTitles[section.id] || ''}
                        onChange={(e) =>
                          setNewItemTitles((prev) => ({ ...prev, [section.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleCreateItem(section.id);
                            // Keep adding mode open for quick batch adds
                          }
                          if (e.key === 'Escape') setAddingToSection(null);
                        }}
                        placeholder="Nome do item (Enter para adicionar, Esc para fechar)"
                        className="planner-input"
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setAddingToSection(null)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      className="planner-add-item-btn"
                      onClick={() => setAddingToSection(section.id)}
                    >
                      <Plus size={14} />
                      Adicionar item
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
