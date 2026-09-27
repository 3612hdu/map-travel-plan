import React, { useEffect, useRef, useState } from 'react';

const HANDLE_HEIGHT = 36;

export const MapDetailSheet: React.FC<{
  children: React.ReactNode;
  label: string;
  resetKey: string;
}> = ({ children, label, resetKey }) => {
  const [progress, setProgress] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 1024px)').matches);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; y: number; height: number; max: number; progress: number } | null>(null);
  const suppressClick = useRef(false);
  const collapsed = mobile && progress === 0;

  useEffect(() => {
    const query = window.matchMedia('(max-width: 1024px)');
    const update = () => { setMobile(query.matches); setProgress(1); };
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    setProgress(1);
    contentRef.current?.scrollTo({ top: 0 });
  }, [resetKey]);

  const startDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!mobile || !event.isPrimary || event.button !== 0) return;
    const sheet = sheetRef.current;
    if (!sheet?.parentElement) return;
    suppressClick.current = false;
    dragRef.current = {
      pointerId: event.pointerId, y: event.clientY,
      height: sheet.getBoundingClientRect().height,
      max: sheet.parentElement.clientHeight * 0.54, progress,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const moveDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = drag.y - event.clientY;
    if (Math.abs(delta) > 5) suppressClick.current = true;
    const range = Math.max(1, drag.max - HANDLE_HEIGHT);
    setProgress(Math.min(1, Math.max(0, (drag.height + delta - HANDLE_HEIGHT) / range)));
  };

  const endDrag = (event: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (cancelled) setProgress(drag.progress);
    else if (suppressClick.current) {
      const delta = drag.y - event.clientY;
      setProgress(Math.abs(delta) > 30 ? (delta > 0 ? 1 : 0) : (progress >= 0.5 ? 1 : 0));
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div ref={sheetRef} className={`map-detail-sheet${dragging ? ' is-dragging' : ''}${collapsed ? ' is-collapsed' : ''}`}
      style={{ '--sheet-progress': progress } as React.CSSProperties}>
      <button type="button" className="map-sheet-handle" aria-controls="map-sheet-content"
        aria-expanded={!collapsed} aria-label={collapsed ? '展开行程信息' : '收起行程信息'}
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={(event) => endDrag(event)}
        onPointerCancel={(event) => endDrag(event, true)} onLostPointerCapture={(event) => endDrag(event, true)}
        onClick={(event) => {
          if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
          setProgress(progress === 0 ? 1 : 0);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault(); setProgress(event.key === 'ArrowUp' ? 1 : 0);
          }
        }}>
        <span aria-hidden="true" />
      </button>
      <div id="map-sheet-content" className="center-bottom-panel" ref={contentRef}
        tabIndex={collapsed ? -1 : 0} aria-label={label} aria-hidden={collapsed} inert={collapsed}>
        {children}
      </div>
    </div>
  );
};
