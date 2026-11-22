import { CircleAlert, Lock, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { isFilled, templateFor, type Field as TField } from '@shared/templates';
import { roleLabel, type OrderView, type Role, type Spec, type SpecValue } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/form';
import { Switch } from '@/components/ui/primitives';
import { ago, cn } from '@/lib/utils';

function Colours({ id, value, onChange, disabled }: { id: string; value: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  const [pick, setPick] = useState('#f4ebd9');
  return (
    <div className="flex flex-wrap items-center gap-2" id={id}>
      {value.map((c, i) => (
        <span key={c + i} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-1.5 py-1 font-mono text-xs text-foreground">
          <span className="size-5 rounded-sm border border-border-strong" style={{ background: c }} aria-hidden />
          {c}
          {!disabled && (
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="rounded text-muted-foreground hover:text-foreground" aria-label={`Remove colour ${c}`}>
              <X className="size-3.5" />
            </button>
          )}
        </span>
      ))}
      {!disabled && value.length < 8 && (
        <span className="inline-flex items-center gap-1.5">
          <label className="relative size-8 cursor-pointer overflow-hidden rounded-md border border-border-strong">
            <input type="color" value={pick} onChange={(e) => setPick(e.target.value)} className="absolute -inset-2 size-12 cursor-pointer" aria-label="Choose a colour to add" />
          </label>
          <Button type="button" variant="outline" size="sm" onClick={() => !value.includes(pick) && onChange([...value, pick])}>
            <Plus /> Add
          </Button>
        </span>
      )}
      {disabled && value.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
    </div>
  );
}

function FieldControl({ f, id, describedBy, value, set, disabled, invalid }: { f: TField; id: string; describedBy?: string; value: SpecValue | undefined; set: (v: SpecValue) => void; disabled: boolean; invalid: boolean }) {
  const common = { id, 'aria-describedby': describedBy, 'aria-invalid': invalid || undefined, disabled };
  switch (f.type) {
    case 'select':
      return (
        <NativeSelect {...common} value={String(value ?? '')} onChange={(e) => set(e.target.value)}>
          <option value="">Choose…</option>
          {f.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </NativeSelect>
      );
    case 'bool':
      return (
        <div className="flex h-10 items-center gap-2">
          <Switch id={id} checked={value === true} onCheckedChange={(v) => set(v)} disabled={disabled} aria-describedby={describedBy} />
          <span className="text-sm text-foreground">{value === true ? 'Yes' : 'No'}</span>
        </div>
      );
    case 'textarea':
      return <Textarea {...common} rows={2} value={String(value ?? '')} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />;
    case 'colors':
      return <Colours id={id} value={Array.isArray(value) ? (value as string[]) : []} onChange={set} disabled={disabled} />;
    case 'number':
    case 'money':
      return (
        <div className="relative">
          {f.type === 'money' && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>}
          <Input {...common} type="number" min={0} inputMode="numeric" className={f.type === 'money' ? 'pl-7' : undefined} value={value === undefined || value === '' ? '' : String(value)} placeholder={f.placeholder} onChange={(e) => set(e.target.value === '' ? '' : Number(e.target.value))} />
        </div>
      );
    case 'date':
      return <Input {...common} type="date" value={String(value ?? '')} onChange={(e) => set(e.target.value)} />;
    default:
      return <Input {...common} value={String(value ?? '')} placeholder={f.placeholder} maxLength={f.max ?? 500} onChange={(e) => set(e.target.value)} />;
  }
}

export function SpecEditor({ order, role, locked, saving, onSave }: { order: OrderView; role: Role; locked: boolean; saving: boolean; onSave: (patch: Spec) => Promise<boolean> }) {
  const t = templateFor(order.template);
  const [local, setLocal] = useState<Spec>(order.spec);
  const serverKey = JSON.stringify(order.spec);
  useEffect(() => setLocal(order.spec), [serverKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = useMemo(() => t.fields.filter((f) => JSON.stringify(local[f.key] ?? '') !== JSON.stringify(order.spec[f.key] ?? '')).map((f) => f.key), [local, order.spec, t]);
  const missing = t.fields.filter((f) => f.required && !isFilled(local[f.key]));

  const save = async () => {
    const patch: Spec = {};
    for (const k of dirty) patch[k] = local[k] ?? '';
    await onSave(patch);
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="grid gap-5 p-4">
        {missing.length > 0 && !locked && (
          <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning-bg px-3 py-2.5 text-[13px] text-warning-text" role="status">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <b>{missing.length} required</b> before a version can be proposed: {missing.map((f) => f.label).join(', ')}.
            </span>
          </p>
        )}
        {t.groups.map((g) => (
          <fieldset key={g} className="grid gap-4 rounded-lg glass-panel p-4">
            <legend className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{g}</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              {t.fields
                .filter((f) => f.group === g)
                .map((f) => {
                  const sellerOnly = Boolean(f.sellerOnly) && role !== 'seller';
                  const meta = order.specMeta[f.key];
                  const invalid = Boolean(f.required && !isFilled(local[f.key]) && !locked);
                  return (
                    <Field
                      key={f.key}
                      className={cn((f.type === 'textarea' || f.type === 'colors') && 'sm:col-span-2', dirty.includes(f.key) && 'rounded-md ring-2 ring-primary/30 ring-offset-4 ring-offset-surface')}
                      label={f.label}
                      required={f.required}
                      help={sellerOnly ? 'Set by the seller' : (f.help ?? (meta ? `Last changed by ${meta.updatedByRole === role ? 'you' : roleLabel(meta.updatedByRole)} ${ago(meta.updatedAt)}` : undefined))}
                      aside={sellerOnly ? <Lock className="size-3.5 text-muted-foreground" aria-label="Seller only" /> : null}
                    >
                      {(id, describedBy) => (
                        <div data-spec-field={f.key}>
                          <FieldControl f={f} id={id} describedBy={describedBy} value={local[f.key]} set={(v) => setLocal((s) => ({ ...s, [f.key]: v }))} disabled={locked || sellerOnly} invalid={invalid} />
                        </div>
                      )}
                    </Field>
                  );
                })}
            </div>
          </fieldset>
        ))}
      </div>
      {!locked && (
        <div className="sticky bottom-0 mt-auto flex items-center justify-end gap-2 border-t border-divider bg-surface/95 px-4 py-3 backdrop-blur">
          <span className="mr-auto text-xs text-muted-foreground" aria-live="polite">
            {dirty.length ? `${dirty.length} unsaved change${dirty.length > 1 ? 's' : ''}` : 'All changes saved'}
          </span>
          {dirty.length > 0 && (
            <Button variant="ghost" onClick={() => setLocal(order.spec)}>
              Discard
            </Button>
          )}
          <Button onClick={save} disabled={!dirty.length} loading={saving}>
            Save & notify
          </Button>
        </div>
      )}
    </div>
  );
}
