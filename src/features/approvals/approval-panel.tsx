import { motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, Circle, Clock3, FileText, Fingerprint, Handshake, RotateCcw, ShieldCheck, ShieldX } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { canonicalJSON } from '@shared/snapshot';
import { roleLabel, ROLES, type OrderView, type Role, type VersionView } from '@shared/types';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/overlay';
import { Badge } from '@/components/ui/primitives';
import { ago, cn, dateTime, sha256Hex } from '@/lib/utils';
import { BlockerSummary } from '../clarification/radar-panel';

export function FingerprintLine({ hash, full }: { hash: string; full?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 font-mono text-xs text-muted-foreground">
      <Fingerprint className="size-3.5 shrink-0" aria-hidden />
      <span className={cn(full ? 'break-all' : 'truncate')} title={hash}>
        {full ? hash : `${hash.slice(0, 16)}…`}
      </span>
    </span>
  );
}

/** Recompute SHA-256 of the canonical snapshot in the browser and compare with the stored fingerprint. */
export function VerifyFingerprint({ version }: { version: VersionView }) {
  const [state, setState] = useState<'idle' | 'ok' | 'bad' | 'na'>('idle');
  const run = async () => {
    if (version.hashAlgorithm !== 'sha256-canonical-json-v2') return setState('na');
    setState((await sha256Hex(canonicalJSON(version.snapshot))) === version.snapshotHash ? 'ok' : 'bad');
  };
  if (state === 'ok')
    return (
      <Badge tone="success">
        <ShieldCheck aria-hidden /> Verified in your browser
      </Badge>
    );
  if (state === 'bad')
    return (
      <Badge tone="danger">
        <ShieldX aria-hidden /> Fingerprint mismatch
      </Badge>
    );
  return (
    <Button size="sm" variant="ghost" onClick={run}>
      <ShieldCheck /> {state === 'na' ? 'Legacy version' : 'Verify fingerprint'}
    </Button>
  );
}

function ApprovalStates({ version, order, role }: { version: VersionView; order: OrderView; role: Role }) {
  const names = Object.fromEntries(order.participants.map((p) => [p.role, p.name])) as Record<Role, string>;
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {ROLES.map((r) => {
        const d = version.approvals.find((a) => a.role === r);
        return (
          <li key={r} className={cn('flex items-center gap-2.5 rounded-md border px-3 py-2', d?.decision === 'approved' ? 'border-success/30 bg-success-bg' : d ? 'border-destructive/30 bg-destructive-bg' : 'border-border bg-surface')}>
            {d?.decision === 'approved' ? <CheckCircle2 className="size-5 text-success-text" aria-hidden /> : d ? <RotateCcw className="size-5 text-destructive-text" aria-hidden /> : <Circle className="size-5 text-muted-foreground" aria-hidden />}
            <div className="min-w-0 text-[13px]">
              <p className="font-semibold text-foreground">
                {r === role ? 'You' : names[r]} <span className="font-normal text-muted-foreground">· {roleLabel(r)}</span>
              </p>
              <p className="text-muted-foreground">{d ? `${d.decision === 'approved' ? 'Approved' : 'Requested changes'} ${ago(d.createdAt)}` : 'Not decided yet'}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function AgreementCard({ order, version }: { order: OrderView; version: VersionView }) {
  const reduce = useReducedMotion();
  return (
    <motion.section initial={reduce ? false : { opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} className="overflow-hidden rounded-xl border border-success/40 bg-surface shadow-sm" aria-label="Order agreed">
      <div className="flex items-center gap-3 bg-success-bg px-4 py-3">
        <span className="grid size-9 place-items-center rounded-full bg-success text-success-foreground">
          <Handshake className="size-5" aria-hidden />
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-success-text">Order agreed</p>
          <p className="font-semibold text-foreground">Both approved version {version.number}</p>
        </div>
      </div>
      <div className="grid gap-3 p-4">
        <ApprovalStates version={version} order={order} role={order.role} />
        <div className="grid gap-1.5 rounded-md bg-surface-secondary p-3">
          <p className="text-xs font-semibold text-muted-foreground">Agreement fingerprint (SHA-256 of the frozen version)</p>
          <FingerprintLine hash={version.snapshotHash} full />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <VerifyFingerprint version={version} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">The fingerprint proves which exact version both of you approved. It is a record, not a legal contract.</p>
        <Button asChild variant="success">
          <Link to={`/o/${order.id}/work-order`}>
            <FileText /> Open the work order
          </Link>
        </Button>
      </div>
    </motion.section>
  );
}

export function ApprovalCard({ order, version, busy, onApprove, onRequestChanges, onCompare }: { order: OrderView; version: VersionView; busy: string | null; onApprove: () => Promise<void>; onRequestChanges: (reason: string) => Promise<boolean>; onCompare?: () => void }) {
  const [changesOpen, setChangesOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState('');
  const mine = version.approvals.find((a) => a.role === order.role);
  const canDecide = version.status === 'proposed' && !mine && order.latestVersionId === version.id;
  return (
    <section className="rounded-xl border border-info/35 bg-surface shadow-xs" aria-label={`Version ${version.number} awaiting approval`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-divider px-4 py-3">
        <Clock3 className="size-4 text-info-text" aria-hidden />
        <p className="font-semibold text-foreground">Version {version.number} needs both approvals</p>
        <Badge tone="info" className="ml-auto">
          Proposed by {version.proposedByRole === order.role ? 'you' : roleLabel(version.proposedByRole)}
        </Badge>
      </div>
      <div className="grid gap-3 p-4">
        <FingerprintLine hash={version.snapshotHash} />
        {version.note && <p className="text-sm text-foreground">“{version.note}”</p>}
        <ApprovalStates version={version} order={order} role={order.role} />
        {order.draftDirty && <p className="rounded-md bg-warning-bg px-3 py-2 text-xs text-warning-text">The draft has changed since version {version.number} was proposed. Approving binds you to version {version.number} exactly as frozen — not to later edits.</p>}
        {canDecide ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={() => setChangesOpen(true)}>
              <RotateCcw /> Request changes
            </Button>
            <Button variant="success" className="flex-1" onClick={() => setConfirmOpen(true)}>
              <CheckCircle2 /> Approve version {version.number}
            </Button>
          </div>
        ) : mine ? (
          <p className="text-sm text-muted-foreground">You {mine.decision === 'approved' ? 'approved' : 'requested changes on'} this version. Waiting for the other side.</p>
        ) : null}
        {onCompare && (
          <Button variant="ghost" size="sm" className="justify-self-start" onClick={onCompare}>
            See what changed
          </Button>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve version {version.number}?</DialogTitle>
            <DialogDescription>You are saying yes to exactly this: the photo, marks, details, price and delivery. The order is confirmed once you both approve the same version.</DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-surface-secondary p-3">
            <FingerprintLine hash={version.snapshotHash} full />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="success"
              loading={busy === 'decide'}
              onClick={async () => {
                await onApprove();
                setConfirmOpen(false);
              }}
            >
              Approve version {version.number}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={changesOpen} onOpenChange={setChangesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>What should change in version {version.number}?</DialogTitle>
            <DialogDescription>Be specific — this becomes part of the record and the other side updates the brief from it.</DialogDescription>
          </DialogHeader>
          <Textarea autoFocus rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Make it 2 kg and use the warmer ivory from #1" aria-label="Requested changes" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setChangesOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!reason.trim()}
              loading={busy === 'decide'}
              onClick={async () => {
                if (await onRequestChanges(reason)) {
                  setReason('');
                  setChangesOpen(false);
                }
              }}
            >
              Send change request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export function ProposeDialog({ order, open, onOpenChange, busy, onPropose, onBlocker }: { order: OrderView; open: boolean; onOpenChange: (v: boolean) => void; busy: string | null; onPropose: (note: string) => Promise<boolean>; onBlocker: (b: OrderView['blockers'][number]) => void }) {
  const [note, setNote] = useState('');
  const latest = order.versions.find((v) => v.id === order.latestVersionId) ?? null;
  const next = (latest?.number ?? 0) + 1;
  const blocked = order.blockers.length > 0;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send version {next} for approval</DialogTitle>
          <DialogDescription>
            This saves a locked copy of the photo, marks, details and price as version {next}. You both check it and press Approve. If anything changes later, it becomes version {next + 1}.
          </DialogDescription>
        </DialogHeader>
        {blocked ? (
          <BlockerSummary
            blockers={order.blockers}
            onFocus={(b) => {
              onOpenChange(false);
              onBlocker(b);
            }}
          />
        ) : (
          <>
            {!order.draftDirty && latest && <p className="rounded-md bg-surface-secondary px-3 py-2 text-sm text-muted-foreground">Nothing has changed since version {latest.number}.</p>}
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} placeholder="Optional note, e.g. “Switched to 2 kg, price updated”" aria-label="Note for this version" />
          </>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {blocked ? 'Close' : 'Cancel'}
          </Button>
          {!blocked && (
            <Button
              loading={busy === 'propose'}
              disabled={!order.draftDirty && Boolean(latest) && latest!.status === 'proposed'}
              onClick={async () => {
                if (await onPropose(note)) {
                  setNote('');
                  onOpenChange(false);
                }
              }}
            >
              Freeze & send version {next}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VersionHistory({ order, selectedId, onSelect }: { order: OrderView; selectedId: string | null; onSelect: (v: VersionView) => void }) {
  const versions = [...order.versions].reverse();
  const tone = { proposed: 'info', changes_requested: 'danger', superseded: 'muted', agreed: 'success' } as const;
  const label = { proposed: 'Awaiting approval', changes_requested: 'Changes requested', superseded: 'Superseded', agreed: 'Agreed' };
  return (
    <ol className="grid gap-2" aria-label="Version history">
      {versions.map((v) => (
        <li key={v.id}>
          <button
            onClick={() => onSelect(v)}
            aria-current={selectedId === v.id}
            className={cn('grid w-full gap-1.5 rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selectedId === v.id ? 'border-primary/50 bg-primary-soft' : 'border-border bg-surface hover:bg-surface-secondary')}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-foreground">Version {v.number}</span>
              <Badge tone={tone[v.status]}>{label[v.status]}</Badge>
              <span className="ml-auto text-xs text-muted-foreground">{dateTime(v.createdAt)}</span>
            </div>
            <FingerprintLine hash={v.snapshotHash} />
            {v.note && <p className="text-[13px] text-foreground">“{v.note}”</p>}
            <p className="text-xs text-muted-foreground">
              {v.diff ? `${v.diff.summary.length} change${v.diff.summary.length === 1 ? '' : 's'} from v${v.number - 1}` : 'First version'} · {v.approvals.filter((a) => a.decision === 'approved').length}/2 approvals
            </p>
          </button>
        </li>
      ))}
    </ol>
  );
}
