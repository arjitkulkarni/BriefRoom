import { useEffect, useMemo, useState } from 'react';
import { templateFor, type Field } from '../../shared/templates';
import type { Role, Spec } from '../../shared/types';

function ColorsInput({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  const [pick, setPick] = useState('#f4a7c0');
  return (
    <div className="colors">
      {value.map((c, i) => (
        <span key={c + i} className="c" style={{ background: c }} title={disabled ? c : `${c} - click to remove`} onClick={() => !disabled && onChange(value.filter((_, j) => j !== i))} />
      ))}
      {!disabled && value.length < 8 && (
        <>
          <input type="color" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Pick colour" />
          <button type="button" className="btn ghost sm" onClick={() => onChange([...value, pick])}>
            + Add
          </button>
        </>
      )}
      {value.length === 0 && disabled && <span className="faint">—</span>}
    </div>
  );
}

function FieldInput({ f, value, set, disabled }: { f: Field; value: unknown; set: (v: unknown) => void; disabled: boolean }) {
  switch (f.type) {
    case 'select':
      return (
        <select className="select" value={String(value ?? '')} onChange={(e) => set(e.target.value)} disabled={disabled}>
          <option value="">Choose…</option>
          {f.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
    case 'bool':
      return (
        <label className="row" style={{ height: 42 }}>
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => set(e.target.checked)} disabled={disabled} /> Yes
        </label>
      );
    case 'textarea':
      return <textarea className="textarea" rows={2} value={String(value ?? '')} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} disabled={disabled} />;
    case 'colors':
      return <ColorsInput value={Array.isArray(value) ? (value as string[]) : []} onChange={set} disabled={disabled} />;
    case 'number':
    case 'money':
      return <input className="input" type="number" min={0} inputMode="numeric" value={value === undefined ? '' : String(value)} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} disabled={disabled} />;
    case 'date':
      return <input className="input" type="date" value={String(value ?? '')} onChange={(e) => set(e.target.value)} disabled={disabled} />;
    default:
      return <input className="input" value={String(value ?? '')} placeholder={f.placeholder} maxLength={f.max ?? 500} onChange={(e) => set(e.target.value)} disabled={disabled} />;
  }
}

export default function SpecForm({ template, spec, role, locked, onSave }: { template: string; spec: Spec; role: Role; locked: boolean; onSave: (patch: Spec) => Promise<void> }) {
  const t = templateFor(template);
  const [local, setLocal] = useState<Spec>(spec);
  const [busy, setBusy] = useState(false);
  const serverKey = JSON.stringify(spec);
  useEffect(() => setLocal(spec), [serverKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirtyKeys = useMemo(() => t.fields.filter((f) => JSON.stringify(local[f.key] ?? '') !== JSON.stringify(spec[f.key] ?? '')).map((f) => f.key), [local, spec, t]);

  const save = async () => {
    setBusy(true);
    try {
      const patch: Spec = {};
      dirtyKeys.forEach((k) => (patch[k] = local[k]));
      await onSave(patch);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {t.groups.map((g) => (
        <div className="card spec-group" key={g}>
          <h3>{g}</h3>
          <div className="spec-fields">
            {t.fields
              .filter((f) => f.group === g)
              .map((f) => {
                const sellerOnly = f.sellerOnly && role !== 'seller';
                return (
                  <div key={f.key} className={f.type === 'textarea' || f.type === 'colors' ? 'full' : ''}>
                    <label className="label">
                      {f.label} {f.required && <span className="req">*</span>}
                      {sellerOnly && <span className="faint"> · set by seller</span>}
                    </label>
                    <FieldInput f={f} value={local[f.key]} disabled={locked || Boolean(sellerOnly)} set={(v) => setLocal((s) => ({ ...s, [f.key]: v as any }))} />
                  </div>
                );
              })}
          </div>
        </div>
      ))}
      {!locked && (
        <div className="savebar">
          {dirtyKeys.length > 0 && (
            <button className="btn ghost" onClick={() => setLocal(spec)}>
              Discard
            </button>
          )}
          <button className="btn" onClick={save} disabled={busy || dirtyKeys.length === 0}>
            {busy ? 'Saving…' : dirtyKeys.length ? `Save ${dirtyKeys.length} change${dirtyKeys.length > 1 ? 's' : ''} & notify` : 'All changes saved'}
          </button>
        </div>
      )}
    </div>
  );
}
