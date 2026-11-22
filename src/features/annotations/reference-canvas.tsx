/**
 * The reference canvas — BriefRoom's centrepiece.
 * - Image keeps its aspect ratio (fit-contain) and is never stretched.
 * - Markers are positioned with percentages of the image box, from normalised coordinates,
 *   so they stay on the same pixels at any size, zoom or device.
 * - Zoom 100–400 % with native scroll for panning (works with touch, trackpad and keyboard).
 */
import { motion, useReducedMotion } from 'motion/react';
import { Check, Minus, Plus, Scan } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { ANNOTATION_KIND_META, type AnnotationView, type ReferenceView } from '@shared/types';
import { fitContain, rectFromPoints, toNormalised, type NRect } from '@shared/geometry';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/overlay';
import { cn } from '@/lib/utils';
import { MarkerBadge, TONE_CLASSES, toneOf } from './annotation-meta';

export type CanvasTool = 'select' | 'rect' | 'point';
export interface PendingRegion extends NRect {
  shape: 'rect' | 'point';
}

interface Props {
  reference: ReferenceView;
  annotations: AnnotationView[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  tool: CanvasTool;
  canEdit: boolean;
  pending: PendingRegion | null;
  onRegion: (r: PendingRegion) => void;
  className?: string;
}

const ZOOMS = [1, 1.5, 2, 3, 4];

export function ReferenceCanvas({ reference, annotations, selectedId, onSelect, tool, canEdit, pending, onRegion, className }: Props) {
  const viewport = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [drag, setDrag] = useState<{ start: { x: number; y: number }; rect: NRect } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const reduce = useReducedMotion();
  const drawing = canEdit && tool !== 'select';

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    setZoom(1);
    setLoaded(false);
  }, [reference.id]);

  const pad = 24;
  const fit = fitContain(reference.width, reference.height, Math.max(0, box.w - pad * 2), Math.max(0, box.h - pad * 2));
  const w = Math.round(fit.width * zoom);
  const h = Math.round(fit.height * zoom);

  // Bring the selected marker into view (selection may come from the list, the chat or the radar).
  useEffect(() => {
    if (!selectedId) return;
    const el = stage.current?.querySelector<HTMLElement>(`[data-annotation="${selectedId}"]`);
    el?.scrollIntoView({ block: 'center', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
  }, [selectedId, zoom, reduce]);

  const changeZoom = useCallback((dir: 1 | -1) => {
    setZoom((z) => {
      const i = ZOOMS.findIndex((v) => v >= z - 0.001);
      return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, i + dir))];
    });
  }, []);

  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return; // plain wheel scrolls/pans
      e.preventDefault();
      changeZoom(e.deltaY < 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [changeZoom]);

  const norm = (e: RPointerEvent) => {
    const r = stage.current!.getBoundingClientRect();
    return toNormalised(e.clientX, e.clientY, { left: r.left, top: r.top, width: r.width, height: r.height });
  };

  const onDown = (e: RPointerEvent) => {
    if (!drawing || e.button !== 0) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = norm(e);
    setDrag({ start: p, rect: { x: p.x, y: p.y, w: 0, h: 0 } });
  };
  const onMove = (e: RPointerEvent) => {
    if (!drag) return;
    setDrag({ ...drag, rect: rectFromPoints(drag.start, norm(e)) });
  };
  /** Smallest annotation under a normalised point (so nested regions stay selectable). */
  const hitTest = (p: { x: number; y: number }) => {
    const box = stage.current?.getBoundingClientRect();
    const tolX = box ? 16 / box.width : 0.03;
    const tolY = box ? 16 / box.height : 0.03;
    return annotations
      .filter((a) => (a.shape === 'point' ? Math.abs(a.x - p.x) <= tolX && Math.abs(a.y - p.y) <= tolY : p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h))
      .sort((a, b) => a.w * a.h - b.w * b.h)[0];
  };

  const onUp = () => {
    if (!drag) return;
    const r = drag.rect;
    setDrag(null);
    const isClick = r.w < 0.02 && r.h < 0.02;
    // A click (not a drag) on an existing annotation selects it, even while a drawing tool is active.
    if (isClick) {
      const hit = hitTest(drag.start);
      if (hit) return onSelect(hit.id === selectedId ? null : hit.id);
    }
    if (tool === 'point') return onRegion({ shape: 'point', x: drag.start.x, y: drag.start.y, w: 0, h: 0 });
    if (r.w < 0.02 || r.h < 0.02) {
      // A tap with the rectangle tool marks a default-size region centred on the tap.
      const s = 0.16;
      return onRegion({ shape: 'rect', x: Math.min(1 - s, Math.max(0, drag.start.x - s / 2)), y: Math.min(1 - s, Math.max(0, drag.start.y - s / 2)), w: s, h: s });
    }
    onRegion({ shape: 'rect', ...r });
  };

  const draft = drag?.rect ?? (pending?.shape === 'rect' ? pending : null);
  const draftPoint = !drag && pending?.shape === 'point' ? pending : null;
  const hasSelection = Boolean(selectedId);

  return (
    <div className={cn('relative flex min-h-0 flex-col', className)}>
      <div
        ref={viewport}
        className={cn('canvas-surface relative min-h-0 flex-1 overflow-auto overscroll-contain rounded-lg border border-border', zoom > 1 && 'cursor-grab')}
        role="region"
        aria-label={`Reference image ${reference.caption || ''} with ${annotations.length} annotations`}
      >
        <div className="grid min-h-full min-w-full place-items-center" style={{ padding: pad }}>
          <div
            ref={stage}
            className={cn('relative select-none overflow-hidden rounded-md shadow-lg ring-1 ring-black/5', drawing && 'cursor-crosshair touch-none')}
            style={{ width: w || undefined, height: h || undefined }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => setDrag(null)}
            onClick={(e) => !drawing && e.target === e.currentTarget && onSelect(null)}
          >
            {!loaded && <div className="absolute inset-0 animate-pulse bg-skeleton motion-reduce:animate-none" aria-hidden />}
            <img
              src={reference.url}
              alt={reference.caption ? `Reference: ${reference.caption}` : 'Reference image'}
              draggable={false}
              onLoad={() => setLoaded(true)}
              className={cn('pointer-events-none absolute inset-0 size-full object-contain transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
            />
            {hasSelection && annotations.find((a) => a.id === selectedId)?.shape === 'point' && <div className="pointer-events-none absolute inset-0 bg-canvas-dim" aria-hidden />}

            {annotations.map((a) => {
              const sel = a.id === selectedId;
              const t = TONE_CLASSES[toneOf(a.kind)];
              const resolved = a.status === 'resolved';
              const label = `#${a.number} ${ANNOTATION_KIND_META[a.kind].label}${a.note ? `: ${a.note}` : ''}${resolved ? ' (resolved)' : ''}`;
              if (a.shape === 'point')
                return (
                  <Tooltip key={a.id} content={label}>
                    <button
                      type="button"
                      data-annotation={a.id}
                      aria-label={label}
                      aria-pressed={sel}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(sel ? null : a.id);
                      }}
                      className={cn('absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring', hasSelection && !sel && 'opacity-55')}
                      style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%` }}
                    >
                      <motion.span initial={reduce ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: sel ? 1.25 : 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 28 }} className="block">
                        <MarkerBadge number={a.number} kind={a.kind} resolved={resolved} className={cn('size-7 text-xs', sel && 'ring-4 ring-ring')} />
                      </motion.span>
                    </button>
                  </Tooltip>
                );
              return (
                <button
                  key={a.id}
                  type="button"
                  data-annotation={a.id}
                  aria-label={label}
                  aria-pressed={sel}
                  onPointerDown={(e) => drawing || e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(sel ? null : a.id);
                  }}
                  className={cn(
                    'group absolute rounded-[6px] border-2 transition-[box-shadow,opacity,background-color] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring',
                    t.border,
                    resolved ? 'border-dashed bg-transparent' : 'bg-marker-fill',
                    // Spotlight: the selected region stays bright, everything around it dims (shadow clipped by the stage).
                    sel ? 'z-20 bg-transparent shadow-[0_0_0_3px_var(--marker-ring),0_0_0_9999px_var(--canvas-dim)]' : 'z-10 hover:bg-marker-fill-hover',
                    hasSelection && !sel && 'opacity-45',
                    drawing && 'pointer-events-none',
                  )}
                  style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: `${a.h * 100}%` }}
                >
                  <span className="absolute -left-3 -top-3 flex items-center">
                    <MarkerBadge number={a.number} kind={a.kind} resolved={resolved} />
                    {resolved && (
                      <span className="-ml-1 grid size-4 place-items-center rounded-full bg-success text-success-foreground ring-2 ring-marker-ring">
                        <Check className="size-2.5" aria-hidden />
                      </span>
                    )}
                  </span>
                  {a.color && <span className="absolute bottom-1 right-1 size-4 rounded-[4px] border-2 border-white shadow" style={{ background: a.color }} aria-hidden />}
                </button>
              );
            })}

            {draft && (draft.w > 0 || draft.h > 0) && (
              <div className="pointer-events-none absolute z-30 rounded-[6px] border-2 border-dashed border-primary bg-primary/15" style={{ left: `${draft.x * 100}%`, top: `${draft.y * 100}%`, width: `${draft.w * 100}%`, height: `${draft.h * 100}%` }} />
            )}
            {draftPoint && (
              <span className="pointer-events-none absolute z-30 size-7 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full border-2 border-dashed border-primary bg-primary/20 motion-reduce:animate-none" style={{ left: `${draftPoint.x * 100}%`, top: `${draftPoint.y * 100}%` }} />
            )}
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1 rounded-lg border border-border bg-surface-elevated/95 p-1 shadow-md backdrop-blur">
        <Button variant="ghost" size="icon-sm" className="pointer-events-auto" onClick={() => changeZoom(-1)} disabled={zoom <= 1} aria-label="Zoom out">
          <Minus />
        </Button>
        <span className="w-11 text-center text-xs font-semibold tabular-nums text-muted-foreground" aria-live="polite">
          {Math.round(zoom * 100)}%
        </span>
        <Button variant="ghost" size="icon-sm" className="pointer-events-auto" onClick={() => changeZoom(1)} disabled={zoom >= 4} aria-label="Zoom in">
          <Plus />
        </Button>
        <Button variant="ghost" size="icon-sm" className="pointer-events-auto" onClick={() => setZoom(1)} disabled={zoom === 1} aria-label="Fit image">
          <Scan />
        </Button>
      </div>
    </div>
  );
}
