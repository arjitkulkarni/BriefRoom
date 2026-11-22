import { AlertTriangle, CheckCircle2, CircleDashed, CircleDot, Clock3, FileCheck2, HelpCircle, PencilRuler, RotateCcw, WifiOff, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ORDER_STATUS_META, type OrderStatus } from '@shared/types';
import { cn } from '@/lib/utils';
import { Badge } from '../ui/primitives';
import { Logo } from '../layout/brand';

export function EmptyState({ icon: Icon = CircleDashed, title, children, action, className }: { icon?: LucideIcon; title: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface/60 px-6 py-10 text-center', className)}>
      <span className="grid size-12 place-items-center rounded-full bg-primary-soft text-primary-text">
        <Icon className="size-6" aria-hidden />
      </span>
      <div className="max-w-sm">
        <p className="font-semibold text-foreground">{title}</p>
        {children && <div className="mt-1 text-sm text-muted-foreground">{children}</div>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', children, action, className }: { title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive-bg p-4 text-sm', className)}>
      <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive-text" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-destructive-text">{title}</p>
        {children && <div className="mt-0.5 text-foreground/80">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function FullPageMessage({ title, children, action }: { title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-surface p-8 text-center shadow-sm">
        <Logo className="justify-center" />
        <h1 className="mt-6 font-display text-2xl font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
        {children && <div className="mt-2 text-sm text-muted-foreground">{children}</div>}
        {action && <div className="mt-6 flex justify-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <div className="size-9 animate-spin rounded-full border-[3px] border-border-strong border-t-primary motion-reduce:animate-none" aria-hidden />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

const STATUS_ICON: Record<OrderStatus, LucideIcon> = {
  collecting: PencilRuler,
  awaiting_clarification: HelpCircle,
  awaiting_approval: Clock3,
  changes_requested: RotateCcw,
  agreed: CheckCircle2,
  completed: FileCheck2,
};
const TONE = { neutral: 'neutral', warning: 'warning', info: 'info', danger: 'danger', success: 'success', muted: 'muted' } as const;

/** Order status: icon + text + tone — never colour alone. */
export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const meta = ORDER_STATUS_META[status];
  const Icon = STATUS_ICON[status];
  return (
    <Badge tone={TONE[meta.tone]} className={className}>
      <Icon aria-hidden />
      {meta.label}
    </Badge>
  );
}

/** Nexconn connection state, shown wherever chat or live sync matters. */
export function ConnectionPill({ state, className }: { state: 'disabled' | 'connecting' | 'connected' | 'reconnecting' | 'kicked' | 'error' | 'idle'; className?: string }) {
  const map = {
    connected: { tone: 'success' as const, icon: CircleDot, label: 'Live' },
    connecting: { tone: 'neutral' as const, icon: CircleDashed, label: 'Connecting…' },
    idle: { tone: 'neutral' as const, icon: CircleDashed, label: 'Connecting…' },
    reconnecting: { tone: 'warning' as const, icon: CircleDashed, label: 'Reconnecting…' },
    kicked: { tone: 'warning' as const, icon: WifiOff, label: 'Open elsewhere' },
    error: { tone: 'danger' as const, icon: WifiOff, label: 'Chat offline' },
    disabled: { tone: 'muted' as const, icon: WifiOff, label: 'Live sync off' },
  }[state];
  return (
    <Badge tone={map.tone} className={className} role="status" aria-live="polite">
      <map.icon aria-hidden className={state === 'connecting' || state === 'reconnecting' ? 'animate-spin motion-reduce:animate-none' : undefined} />
      {map.label}
    </Badge>
  );
}
