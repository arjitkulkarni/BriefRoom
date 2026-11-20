/**
 * Visual brief: reference images + region pins.
 * Drag on the image to select a region (tap on phones), say what to do with it, optionally pick a colour.
 */
import { useEffect, useRef, useState } from 'react';
import { PIN_KINDS, type Pin, type PinKind, type Ref, type Role } from '../../shared/types';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function PinOverlay({ pins, focusId, onPick }: { pins: Pin[]; focusId?: string | null; onPick?: (p: Pin) => void }) {
  return (
    <>
      {pins.map((p) => {
        const k = PIN_KINDS[p.kind];
        return (
          <div
            key={p.id}
            className={`pinbox ${p.resolved ? 'resolved' : ''} ${focusId === p.id ? 'focus' : ''}`}
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, width: `${p.w * 100}%`, height: `${p.h * 100}%`, borderColor: k.color, pointerEvents: onPick ? 'auto' : 'none', cursor: onPick ? 'pointer' : undefined }}
            onPointerDown={(e) => {
              if (!onPick) return;
              e.stopPropagation();
              onPick(p);
            }}
            title={`#${p.n} ${k.label}${p.note ? `: ${p.note}` : ''}`}
          >
            <span className="num" style={{ background: k.color }}>
              {p.n}
            </span>
            {p.color && <span className="sw" style={{ background: p.color }} />}
          </div>
        );
      })}
    </>
  );
}

export default function RefCanvas({
  refs,
  pins,
  role,
  locked,
  activeRefId,
  focusPinId,
  onSelectRef,
  onUpload,
  onRemoveRef,
  onAddPin,
  onTogglePin,
  onRemovePin,
  onFocusPin,
}: {
  refs: Ref[];
  pins: Pin[];
  role: Role;
  locked: boolean;
  activeRefId: string | null;
  focusPinId: string | null;
  onSelectRef: (id: string) => void;
  onUpload: (files: FileList) => Promise<void>;
  onRemoveRef: (id: string) => void;
  onAddPin: (p: { refId: string; kind: PinKind; note: string; color?: string } & Rect) => Promise<void>;
  onTogglePin: (p: Pin) => void;
  onRemovePin: (p: Pin) => void;
  onFocusPin: (id: string | null) => void;
}) {
  const ref = refs.find((r) => r.id === activeRefId) ?? refs[0] ?? null;
  const wrap = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; rect: Rect } | null>(null);
  const [pending, setPending] = useState<Rect | null>(null);
  const [kind, setKind] = useState<PinKind>('change');
  const [note, setNote] = useState('');
  const [color, setColor] = useState('#f4a7c0');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setPending(null);
    setDrag(null);
  }, [ref?.id]);

  const pos = (e: React.PointerEvent) => {
    const b = wrap.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)) };
  };

  const down = (e: React.PointerEvent) => {
    if (locked || !ref) return;
    onFocusPin(null);
    const p = pos(e);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ x0: p.x, y0: p.y, rect: { x: p.x, y: p.y, w: 0, h: 0 } });
    setPending(null);
  };
  const move = (e: React.PointerEvent) => {
    if (!drag) return;
    const p = pos(e);
    setDrag({ ...drag, rect: { x: Math.min(drag.x0, p.x), y: Math.min(drag.y0, p.y), w: Math.abs(p.x - drag.x0), h: Math.abs(p.y - drag.y0) } });
  };
  const up = () => {
    if (!drag) return;
    let r = drag.rect;
    if (r.w < 0.03 || r.h < 0.03) {
      // tap -> default box centred on the tap point
      const s = 0.18;
      r = { x: Math.min(1 - s, Math.max(0, drag.x0 - s / 2)), y: Math.min(1 - s, Math.max(0, drag.y0 - s / 2)), w: s, h: s };
    }
    setDrag(null);
    setPending(r);
    setNote('');
  };

  const save = async () => {
    if (!pending || !ref) return;
    setBusy(true);
    try {
      await onAddPin({ refId: ref.id, ...pending, kind, note: note.trim(), color: kind === 'colour' ? color : undefined });
      setPending(null);
      setNote('');
    } finally {
      setBusy(false);
    }
  };

  const refPins = ref ? pins.filter((p) => p.refId === ref.id) : [];

  return (
    <div>
      <div className="refs-strip">
        {refs.map((r) => (
          <button key={r.id} className={`ref-thumb ${ref?.id === r.id ? 'on' : ''}`} onClick={() => onSelectRef(r.id)} title={r.caption || 'Reference'}>
            <img src={r.url} alt={r.caption || 'Reference image'} />
            {pins.some((p) => p.refId === r.id) && <span className="cnt">{pins.filter((p) => p.refId === r.id).length}</span>}
          </button>
        ))}
        {!locked && (
          <button className="ref-add" onClick={() => fileInput.current?.click()} disabled={uploading}>
            {uploading ? 'Uploading…' : '＋ Add photo'}
          </button>
        )}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={async (e) => {
            if (!e.target.files?.length) return;
            setUploading(true);
            try {
              await onUpload(e.target.files);
            } finally {
              setUploading(false);
              e.target.value = '';
            }
          }}
        />
      </div>

      {!ref ? (
        <div className="card empty" style={{ padding: 40 }}>
          <div className="big">🖼️</div>
          <b>Start with "something like this"</b>
          <div style={{ marginTop: 4 }}>Upload a reference photo, or long-press a photo in the chat and choose "Add to brief".</div>
          {!locked && (
            <button className="btn" style={{ marginTop: 14 }} onClick={() => fileInput.current?.click()}>
              Upload reference photo
            </button>
          )}
        </div>
      ) : (
        <>
          <div
            ref={wrap}
            className={`canvas-wrap ${locked ? '' : 'drawing'}`}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => setDrag(null)}
          >
            <img src={ref.url} alt={ref.caption || 'Reference'} draggable={false} />
            <PinOverlay pins={refPins} focusId={focusPinId} onPick={(p) => onFocusPin(p.id)} />
            {(drag?.rect || pending) && (
              <div
                className="draftbox"
                style={{
                  left: `${(drag?.rect ?? pending)!.x * 100}%`,
                  top: `${(drag?.rect ?? pending)!.y * 100}%`,
                  width: `${(drag?.rect ?? pending)!.w * 100}%`,
                  height: `${(drag?.rect ?? pending)!.h * 100}%`,
                }}
              />
            )}
          </div>
          <div className="row canvas-hint wrap">
            <span>{locked ? 'This brief is locked.' : 'Drag over any part of the photo (or tap) to say exactly what to keep, change or remove.'}</span>
            <span className="spacer" />
            {!locked && (
              <button className="btn ghost sm" onClick={() => confirm('Remove this reference and its pins?') && onRemoveRef(ref.id)}>
                Remove photo
              </button>
            )}
          </div>

          {pending && (
            <div className="card composer-pop">
              <div className="label">What should happen in this area?</div>
              <div className="kinds">
                {(Object.keys(PIN_KINDS) as PinKind[]).map((k) => (
                  <button key={k} className={`kind ${kind === k ? 'on' : ''}`} style={{ color: kind === k ? PIN_KINDS[k].color : undefined }} onClick={() => setKind(k)}>
                    {PIN_KINDS[k].emoji} {PIN_KINDS[k].label}
                  </button>
                ))}
              </div>
              {kind === 'colour' && (
                <div className="row" style={{ marginTop: 12 }}>
                  <input type="color" value={color} onChange={(e) => setColor(e.target.value)} style={{ width: 44, height: 36, border: 0, background: 'none' }} />
                  <input className="input" style={{ maxWidth: 160 }} value={color} onChange={(e) => setColor(e.target.value)} aria-label="Colour" />
                </div>
              )}
              <input
                className="input"
                style={{ marginTop: 12 }}
                autoFocus
                placeholder={kind === 'question' ? 'Ask the other side…' : 'Add a note (e.g. "same flowers but in pastel pink")'}
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />
              <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
                <button className="btn ghost sm" onClick={() => setPending(null)}>
                  Cancel
                </button>
                <button className="btn sm" onClick={save} disabled={busy}>
                  {busy ? 'Pinning…' : 'Pin it & tell them'}
                </button>
              </div>
            </div>
          )}

          <div className="pin-list">
            {refPins.length === 0 && <div className="faint" style={{ fontSize: 13 }}>No pins on this photo yet.</div>}
            {refPins.map((p) => {
              const k = PIN_KINDS[p.kind];
              return (
                <div key={p.id} className={`pin-item ${p.resolved ? 'resolved' : ''}`} onClick={() => onFocusPin(p.id)} style={focusPinId === p.id ? { borderColor: k.color } : undefined}>
                  <span className="num" style={{ background: k.color }}>
                    {p.n}
                  </span>
                  <div className="body">
                    <div>
                      <b>
                        {k.emoji} {k.label}
                      </b>
                      {p.color && (
                        <>
                          {' · '}
                          <span className="swatch" style={{ background: p.color }} />
                          <span className="mono">{p.color}</span>
                        </>
                      )}
                    </div>
                    {p.note && <div>{p.note}</div>}
                    <div className="meta">
                      by {p.by === role ? 'you' : p.by}
                      {p.resolved ? ' · resolved' : ''}
                    </div>
                  </div>
                  {!locked && (
                    <div className="row" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
                      <button className="btn ghost sm" onClick={() => onTogglePin(p)}>
                        {p.resolved ? 'Reopen' : '✓ Resolved'}
                      </button>
                      <button className="btn ghost sm" onClick={() => onRemovePin(p)} aria-label="Delete pin">
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
