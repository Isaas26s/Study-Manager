import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Highlighter,
  PenLine, Type, Trash2, Save, RotateCcw, Maximize,
} from 'lucide-react';
import { getPdfAnnotations, savePdfAnnotations, isElectron } from '../lib/dataService';

// PDF.js setup
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface Annotation {
  id: string;
  page: number;
  type: 'highlight' | 'drawing' | 'text';
  color: string;
  rects?: { x: number; y: number; w: number; h: number }[];
  points?: { x: number; y: number }[];
  strokeWidth?: number;
  text?: string;
  position?: { x: number; y: number };
}

interface PdfViewerProps {
  filePath: string;
  lessonId: number;
  isDrive?: boolean;
  driveFileId?: string;
}

const HIGHLIGHT_COLORS = [
  { name: 'Amarelo', value: 'rgba(255, 215, 0, 0.35)' },
  { name: 'Verde', value: 'rgba(57, 255, 20, 0.3)' },
  { name: 'Azul', value: 'rgba(0, 180, 255, 0.3)' },
  { name: 'Rosa', value: 'rgba(255, 80, 180, 0.3)' },
  { name: 'Laranja', value: 'rgba(255, 140, 0, 0.35)' },
];

const PEN_COLORS = [
  { name: 'Vermelho', value: '#ff3b3b' },
  { name: 'Azul', value: '#00b4ff' },
  { name: 'Verde', value: '#39ff14' },
  { name: 'Amarelo', value: '#ffd700' },
  { name: 'Branco', value: '#ffffff' },
];

export function PdfViewer({ filePath, lessonId, isDrive, driveFileId }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [useEmbed, setUseEmbed] = useState(false);

  const [activeTool, setActiveTool] = useState<'none' | 'highlight' | 'draw' | 'text'>('none');
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0].value);
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);
  const [penWidth, setPenWidth] = useState(3);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentDrawPoints, setCurrentDrawPoints] = useState<{ x: number; y: number }[]>([]);
  const [highlightStart, setHighlightStart] = useState<{ x: number; y: number } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputPos, setTextInputPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [textInputValue, setTextInputValue] = useState('');
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);

  // ─── Load PDF ───────────────────────────────────────────────
  useEffect(() => { loadPdf(); }, [filePath]);

  async function loadPdf() {
    setLoading(true);
    setError('');
    setUseEmbed(false);

    try {
      let src: string | Uint8Array | undefined;

      if (isDrive && driveFileId) {
        if (isElectron() && window.electronAPI) {
          // Desktop: stream via electron
          const url = await window.electronAPI.getDriveStreamUrl(driveFileId);
          if (!url) throw new Error('Não foi possível obter URL do Drive');
          const resp = await fetch(url);
          const buffer = await resp.arrayBuffer();
          src = new Uint8Array(buffer);
        } else {
          // Web/iPad: use Google Drive embed (can't fetch PDF cross-origin)
          setUseEmbed(true);
          setLoading(false);
          return;
        }
      } else if (isElectron() && window.electronAPI?.readFileAsBuffer) {
        // Local file via electron
        const fileData = await window.electronAPI.readFileAsBuffer(filePath);
        if (!fileData) throw new Error('Não foi possível ler o arquivo');
        src = new Uint8Array(fileData);
      } else {
        // Web mode, local file — can't read
        setError('PDFs locais só podem ser abertos no app Desktop. PDFs do Drive funcionam automaticamente.');
        setLoading(false);
        return;
      }

      if (!src) throw new Error('Sem dados do PDF');
      const doc = await pdfjsLib.getDocument({ data: src }).promise;
      setPdfDoc(doc);
      setTotalPages(doc.numPages);
      setCurrentPage(1);
    } catch (err: unknown) {
      console.error('[PDF] Error loading:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar PDF');
    } finally {
      setLoading(false);
    }
  }

  // ─── Load annotations ──────────────────────────────────────
  useEffect(() => { loadAnnotations(); }, [lessonId]);

  async function loadAnnotations() {
    const saved = await getPdfAnnotations(String(lessonId));
    if (saved) {
      try { setAnnotations(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }

  async function saveAnnotationsHandler() {
    await savePdfAnnotations(String(lessonId), JSON.stringify(annotations));
    setHasUnsavedChanges(false);
  }

  // ─── Render page ────────────────────────────────────────────
  useEffect(() => { renderPage(); }, [pdfDoc, currentPage, scale]);
  useEffect(() => { renderAnnotations(); }, [annotations, currentPage, pageWidth, pageHeight]);

  async function renderPage() {
    if (!pdfDoc || !canvasRef.current) return;
    const page = await pdfDoc.getPage(currentPage);
    const viewport = page.getViewport({ scale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    setPageWidth(viewport.width);
    setPageHeight(viewport.height);
    if (overlayCanvasRef.current) {
      overlayCanvasRef.current.width = viewport.width;
      overlayCanvasRef.current.height = viewport.height;
    }
    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  function renderAnnotations() {
    if (!overlayCanvasRef.current || pageWidth === 0) return;
    const ctx = overlayCanvasRef.current.getContext('2d')!;
    ctx.clearRect(0, 0, pageWidth, pageHeight);
    const pageAnns = annotations.filter(a => a.page === currentPage);

    for (const ann of pageAnns) {
      if (ann.type === 'highlight' && ann.rects) {
        ctx.fillStyle = ann.color;
        for (const r of ann.rects) {
          ctx.fillRect(r.x * pageWidth, r.y * pageHeight, r.w * pageWidth, r.h * pageHeight);
        }
      }
      if (ann.type === 'drawing' && ann.points && ann.points.length > 1) {
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = ann.strokeWidth || 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(ann.points[0].x * pageWidth, ann.points[0].y * pageHeight);
        for (let i = 1; i < ann.points.length; i++) {
          ctx.lineTo(ann.points[i].x * pageWidth, ann.points[i].y * pageHeight);
        }
        ctx.stroke();
      }
      if (ann.type === 'text' && ann.position && ann.text) {
        const px = ann.position.x * pageWidth;
        const py = ann.position.y * pageHeight;
        ctx.font = '13px Inter, sans-serif';
        const lines = ann.text.split('\n');
        const lineHeight = 18;
        const maxWidth = Math.max(...lines.map(l => ctx.measureText(l).width));
        const boxW = maxWidth + 16;
        const boxH = lines.length * lineHeight + 12;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.beginPath();
        roundRect(ctx, px, py, boxW, boxH, 6);
        ctx.fill();
        ctx.strokeStyle = ann.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        roundRect(ctx, px, py, boxW, boxH, 6);
        ctx.stroke();
        ctx.fillStyle = '#e8e8ef';
        ctx.font = '13px Inter, sans-serif';
        for (let i = 0; i < lines.length; i++) {
          ctx.fillText(lines[i], px + 8, py + 16 + i * lineHeight);
        }
      }
    }

    if (isDrawing && currentDrawPoints.length > 1) {
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(currentDrawPoints[0].x * pageWidth, currentDrawPoints[0].y * pageHeight);
      for (let i = 1; i < currentDrawPoints.length; i++) {
        ctx.lineTo(currentDrawPoints[i].x * pageWidth, currentDrawPoints[i].y * pageHeight);
      }
      ctx.stroke();
    }
  }

  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function genId() { return Math.random().toString(36).substring(2, 9); }

  // ─── Mouse handlers ────────────────────────────────────────
  const getRelativePos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = overlayCanvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
  }, []);

  function handleOverlayMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (activeTool === 'none') return;
    const pos = getRelativePos(e);
    if (activeTool === 'draw') { setIsDrawing(true); setCurrentDrawPoints([pos]); }
    if (activeTool === 'highlight') { setHighlightStart(pos); setIsDrawing(true); }
    if (activeTool === 'text') {
      const rect = overlayCanvasRef.current!.getBoundingClientRect();
      setTextInputPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setTextInputValue('');
      setShowTextInput(true);
      setTimeout(() => textInputRef.current?.focus(), 50);
    }
  }

  function handleOverlayMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const pos = getRelativePos(e);
    if (activeTool === 'draw') { setCurrentDrawPoints(prev => [...prev, pos]); renderAnnotations(); }
    if (activeTool === 'highlight' && highlightStart) {
      renderAnnotations();
      const ctx = overlayCanvasRef.current?.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = highlightColor;
      ctx.fillRect(
        Math.min(highlightStart.x, pos.x) * pageWidth, Math.min(highlightStart.y, pos.y) * pageHeight,
        Math.abs(pos.x - highlightStart.x) * pageWidth, Math.abs(pos.y - highlightStart.y) * pageHeight
      );
    }
  }

  function handleOverlayMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const pos = getRelativePos(e);
    if (activeTool === 'draw' && currentDrawPoints.length > 1) {
      setAnnotations(prev => [...prev, { id: genId(), page: currentPage, type: 'drawing', color: penColor, points: [...currentDrawPoints, pos], strokeWidth: penWidth }]);
      setHasUnsavedChanges(true);
    }
    if (activeTool === 'highlight' && highlightStart) {
      const x = Math.min(highlightStart.x, pos.x), y = Math.min(highlightStart.y, pos.y);
      const w = Math.abs(pos.x - highlightStart.x), h = Math.abs(pos.y - highlightStart.y);
      if (w > 0.005 && h > 0.005) {
        setAnnotations(prev => [...prev, { id: genId(), page: currentPage, type: 'highlight', color: highlightColor, rects: [{ x, y, w, h }] }]);
        setHasUnsavedChanges(true);
      }
    }
    setIsDrawing(false); setCurrentDrawPoints([]); setHighlightStart(null);
  }

  function submitTextAnnotation() {
    if (!textInputValue.trim()) { setShowTextInput(false); return; }
    setAnnotations(prev => [...prev, {
      id: genId(), page: currentPage, type: 'text', color: '#00e5ff',
      text: textInputValue.trim(), position: { x: textInputPos.x / pageWidth, y: textInputPos.y / pageHeight },
    }]);
    setHasUnsavedChanges(true); setShowTextInput(false); setTextInputValue('');
  }

  function undoLast() {
    const pageAnns = annotations.filter(a => a.page === currentPage);
    if (pageAnns.length === 0) return;
    setAnnotations(prev => prev.filter(a => a.id !== pageAnns[pageAnns.length - 1].id));
    setHasUnsavedChanges(true);
  }

  function clearPageAnnotations() {
    setAnnotations(prev => prev.filter(a => a.page !== currentPage));
    setHasUnsavedChanges(true);
  }

  function prevPage() { if (currentPage > 1) setCurrentPage(p => p - 1); }
  function nextPage() { if (currentPage < totalPages) setCurrentPage(p => p + 1); }
  function zoomIn() { setScale(s => Math.min(s + 0.25, 4)); }
  function zoomOut() { setScale(s => Math.max(s - 0.25, 0.5)); }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (showTextInput) return;
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') prevPage();
      if (e.key === 'ArrowRight' || e.key === 'PageDown') nextPage();
      if (e.key === '+' || e.key === '=') zoomIn();
      if (e.key === '-') zoomOut();
      if (e.ctrlKey && e.key === 'z') undoLast();
      if (e.ctrlKey && e.key === 's') { e.preventDefault(); saveAnnotationsHandler(); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [currentPage, totalPages, showTextInput, annotations]);

  function selectTool(tool: 'none' | 'highlight' | 'draw' | 'text') {
    setActiveTool(activeTool === tool ? 'none' : tool);
    setShowColorPicker(false); setShowTextInput(false);
  }

  // ─── EMBED MODE (Drive PDFs on iPad) ───────────────────────
  if (useEmbed && driveFileId) {
    return (
      <div className="pdf-viewer" ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <iframe
          src={`https://drive.google.com/file/d/${driveFileId}/preview`}
          style={{ flex: 1, width: '100%', border: 'none', borderRadius: 'var(--radius)' }}
          allow="autoplay"
          allowFullScreen
        />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="pdf-viewer-loading">
        <div className="pdf-loading-spinner" />
        <span>Carregando PDF...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-viewer-error">
        <span className="pdf-error-icon">⚠️</span>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="pdf-viewer" ref={containerRef}>
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-group">
          <button className="pdf-tool-btn" onClick={prevPage} disabled={currentPage <= 1}><ChevronLeft size={16} /></button>
          <span className="pdf-page-indicator">{currentPage} / {totalPages}</span>
          <button className="pdf-tool-btn" onClick={nextPage} disabled={currentPage >= totalPages}><ChevronRight size={16} /></button>
        </div>
        <div className="pdf-toolbar-divider" />
        <div className="pdf-toolbar-group">
          <button className="pdf-tool-btn" onClick={zoomOut}><ZoomOut size={16} /></button>
          <span className="pdf-zoom-label">{Math.round(scale * 100)}%</span>
          <button className="pdf-tool-btn" onClick={zoomIn}><ZoomIn size={16} /></button>
          <button className="pdf-tool-btn" onClick={() => setScale(1.5)}><Maximize size={14} /></button>
        </div>
        <div className="pdf-toolbar-divider" />
        <div className="pdf-toolbar-group">
          <button className={`pdf-tool-btn ${activeTool === 'highlight' ? 'active' : ''}`} onClick={() => selectTool('highlight')}><Highlighter size={16} /></button>
          <button className={`pdf-tool-btn ${activeTool === 'draw' ? 'active' : ''}`} onClick={() => selectTool('draw')}><PenLine size={16} /></button>
          <button className={`pdf-tool-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => selectTool('text')}><Type size={16} /></button>
        </div>
        {(activeTool === 'highlight' || activeTool === 'draw') && (
          <>
            <div className="pdf-toolbar-divider" />
            <div className="pdf-toolbar-group">
              <button className="pdf-tool-btn pdf-color-toggle" onClick={() => setShowColorPicker(!showColorPicker)}>
                <span className="pdf-color-dot" style={{ background: activeTool === 'highlight' ? highlightColor : penColor }} />
              </button>
              {activeTool === 'draw' && (
                <select className="pdf-width-select" value={penWidth} onChange={(e) => setPenWidth(Number(e.target.value))}>
                  <option value={2}>Fino</option>
                  <option value={3}>Médio</option>
                  <option value={5}>Grosso</option>
                  <option value={8}>Extra</option>
                </select>
              )}
            </div>
          </>
        )}
        <div style={{ flex: 1 }} />
        <div className="pdf-toolbar-group">
          <button className="pdf-tool-btn" onClick={undoLast}><RotateCcw size={15} /></button>
          <button className="pdf-tool-btn pdf-tool-danger" onClick={clearPageAnnotations}><Trash2 size={15} /></button>
          <button className={`pdf-tool-btn pdf-save-btn ${hasUnsavedChanges ? 'unsaved' : ''}`} onClick={saveAnnotationsHandler}>
            <Save size={15} />{hasUnsavedChanges && <span className="pdf-unsaved-dot" />}
          </button>
        </div>
      </div>

      {showColorPicker && (
        <div className="pdf-color-picker">
          {(activeTool === 'highlight' ? HIGHLIGHT_COLORS : PEN_COLORS).map(c => (
            <button key={c.value} className={`pdf-color-option ${(activeTool === 'highlight' ? highlightColor : penColor) === c.value ? 'selected' : ''}`}
              onClick={() => { if (activeTool === 'highlight') setHighlightColor(c.value); else setPenColor(c.value); setShowColorPicker(false); }}>
              <span className="pdf-color-swatch" style={{ background: c.value }} />
              <span className="pdf-color-name">{c.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="pdf-canvas-container">
        <div className="pdf-canvas-wrapper" style={{ width: pageWidth, height: pageHeight }}>
          <canvas ref={canvasRef} className="pdf-canvas" />
          <canvas ref={overlayCanvasRef} className="pdf-overlay-canvas"
            style={{ cursor: activeTool === 'none' ? 'default' : activeTool === 'text' ? 'text' : 'crosshair' }}
            onMouseDown={handleOverlayMouseDown} onMouseMove={handleOverlayMouseMove}
            onMouseUp={handleOverlayMouseUp}
            onMouseLeave={() => { if (isDrawing) handleOverlayMouseUp({ clientX: 0, clientY: 0 } as React.MouseEvent<HTMLCanvasElement>); }}
          />
          {showTextInput && (
            <div className="pdf-text-input-overlay" style={{ left: textInputPos.x, top: textInputPos.y }}>
              <textarea ref={textInputRef} className="pdf-text-input" value={textInputValue}
                onChange={(e) => setTextInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitTextAnnotation(); } if (e.key === 'Escape') setShowTextInput(false); }}
                placeholder="Digite sua anotação..." rows={3} />
              <div className="pdf-text-input-actions">
                <button className="btn btn-primary btn-sm" onClick={submitTextAnnotation}>Salvar</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowTextInput(false)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {annotations.filter(a => a.page === currentPage).length > 0 && (
        <div className="pdf-annotation-count">
          {annotations.filter(a => a.page === currentPage).length} anotaç{annotations.filter(a => a.page === currentPage).length === 1 ? 'ão' : 'ões'} nesta página
        </div>
      )}
    </div>
  );
}
