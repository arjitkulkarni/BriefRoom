import { cva, type VariantProps } from 'class-variance-authority';
import { Separator as SeparatorPrimitive, Switch as SwitchPrimitive } from 'radix-ui';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ Badge (status chips: tone + text, optional icon) */

export const badgeVariants = cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold [&_svg]:size-3.5', {
  variants: {
    tone: {
      neutral: 'border-border bg-surface-secondary text-muted-foreground',
      info: 'border-info/25 bg-info-bg text-info-text',
      success: 'border-success/25 bg-success-bg text-success-text',
      warning: 'border-warning/30 bg-warning-bg text-warning-text',
      danger: 'border-destructive/25 bg-destructive-bg text-destructive-text',
      muted: 'border-border bg-muted text-muted-foreground',
      primary: 'border-primary/25 bg-primary-soft text-primary-text',
      outline: 'border-border-strong bg-transparent text-foreground',
    },
  },
  defaultVariants: { tone: 'neutral' },
});
export function Badge({ className, tone, ...p }: HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...p} />;
}

/* ------------------------------------------------------------------ Card */

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-lg border border-border bg-surface shadow-xs', className)} {...p} />;
}
export function CardHeader({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-start justify-between gap-3 px-5 pt-5', className)} {...p} />;
}
export function CardTitle({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-[15px] font-bold tracking-[-0.01em] text-foreground', className)} {...p} />;
}
export function CardDescription({ className, ...p }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('mt-1 text-sm text-muted-foreground', className)} {...p} />;
}
export function CardContent({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-5 pt-4', className)} {...p} />;
}

/* ------------------------------------------------------------------ misc */

export function Separator({ className, orientation = 'horizontal', ...p }: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return <SeparatorPrimitive.Root orientation={orientation} className={cn('shrink-0 bg-divider', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)} {...p} />;
}

export function Skeleton({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-skeleton motion-reduce:animate-none', className)} {...p} />;
}

export function Switch({ className, ...p }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-border-strong transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary',
        className,
      )}
      {...p}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-5 rounded-full bg-white shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

export function Kbd({ className, ...p }: HTMLAttributes<HTMLElement>) {
  return <kbd className={cn('rounded border border-border-strong bg-surface-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground', className)} {...p} />;
}
