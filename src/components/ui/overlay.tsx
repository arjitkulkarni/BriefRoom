/**
 * Overlay primitives (Radix). All portal into <body>, which inherits data-theme from <html>,
 * so dialogs, menus, tooltips and popovers always use the active theme's tokens.
 */
import { X } from 'lucide-react';
import { Dialog as D, DropdownMenu as M, Popover as P, Tabs as T, Tooltip as TT } from 'radix-ui';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ Dialog */

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

const overlayCls = 'fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0';

export function DialogContent({ className, children, hideClose, ...p }: ComponentProps<typeof D.Content> & { hideClose?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className={overlayCls} />
      <D.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border border-border bg-surface-elevated p-6 shadow-xl focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97]',
          className,
        )}
        {...p}
      >
        {children}
        {!hideClose && (
          <D.Close className="absolute right-3 top-3 grid size-9 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </D.Close>
        )}
      </D.Content>
    </D.Portal>
  );
}
export const DialogHeader = ({ className, ...p }: ComponentProps<'div'>) => <div className={cn('grid gap-1.5 pr-8', className)} {...p} />;
export const DialogFooter = ({ className, ...p }: ComponentProps<'div'>) => <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...p} />;
export const DialogTitle = ({ className, ...p }: ComponentProps<typeof D.Title>) => <D.Title className={cn('text-lg font-bold tracking-[-0.01em] text-foreground', className)} {...p} />;
export const DialogDescription = ({ className, ...p }: ComponentProps<typeof D.Description>) => <D.Description className={cn('text-sm text-muted-foreground', className)} {...p} />;

/** Sheet: bottom sheet on phones, right-side panel from `sm` up. */
export function SheetContent({ className, children, side = 'right', title, description, ...p }: ComponentProps<typeof D.Content> & { side?: 'right' | 'bottom'; title: ReactNode; description?: ReactNode }) {
  return (
    <D.Portal>
      <D.Overlay className={overlayCls} />
      <D.Content
        className={cn(
          'fixed z-50 flex flex-col border-border bg-surface-elevated shadow-xl focus:outline-none data-[state=open]:animate-in',
          side === 'bottom'
            ? 'inset-x-0 bottom-0 max-h-[88dvh] rounded-t-xl border-t pb-[env(safe-area-inset-bottom)] data-[state=open]:slide-in-from-bottom'
            : 'inset-y-0 right-0 h-dvh w-[min(440px,100vw)] border-l data-[state=open]:slide-in-from-right',
          className,
        )}
        {...p}
      >
        <div className="flex items-start justify-between gap-3 border-b border-divider px-5 py-4">
          <div>
            <D.Title className="text-base font-bold text-foreground">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </D.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

/* ------------------------------------------------------------------ Dropdown menu */

export const DropdownMenu = M.Root;
export const DropdownMenuTrigger = M.Trigger;
export const DropdownMenuGroup = M.Group;
export function DropdownMenuContent({ className, sideOffset = 6, ...p }: ComponentProps<typeof M.Content>) {
  return (
    <M.Portal>
      <M.Content
        sideOffset={sideOffset}
        className={cn('z-50 min-w-48 overflow-hidden rounded-lg border border-border bg-surface-elevated p-1 text-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97]', className)}
        {...p}
      />
    </M.Portal>
  );
}
export function DropdownMenuItem({ className, ...p }: ComponentProps<typeof M.Item>) {
  return (
    <M.Item
      className={cn(
        'relative flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-muted data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        className,
      )}
      {...p}
    />
  );
}
export const DropdownMenuLabel = ({ className, ...p }: ComponentProps<typeof M.Label>) => <M.Label className={cn('px-2.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground', className)} {...p} />;
export const DropdownMenuSeparator = ({ className, ...p }: ComponentProps<typeof M.Separator>) => <M.Separator className={cn('-mx-1 my-1 h-px bg-divider', className)} {...p} />;
export const DropdownMenuRadioGroup = M.RadioGroup;
export function DropdownMenuRadioItem({ className, children, ...p }: ComponentProps<typeof M.RadioItem>) {
  return (
    <M.RadioItem
      className={cn('relative flex cursor-pointer select-none items-center gap-2 rounded-md py-2 pl-2.5 pr-8 text-sm outline-none data-[highlighted]:bg-muted data-[state=checked]:font-semibold [&_svg]:size-4', className)}
      {...p}
    >
      {children}
      <M.ItemIndicator className="absolute right-2.5 size-2 rounded-full bg-primary" />
    </M.RadioItem>
  );
}

/* ------------------------------------------------------------------ Tooltip */

export const TooltipProvider = TT.Provider;
export function Tooltip({ children, content, side = 'top' }: { children: ReactNode; content: ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <TT.Root>
      <TT.Trigger asChild>{children}</TT.Trigger>
      <TT.Portal>
        <TT.Content side={side} sideOffset={6} className="z-50 max-w-64 rounded-md bg-tooltip px-2.5 py-1.5 text-xs font-medium text-tooltip-foreground shadow-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0">
          {content}
        </TT.Content>
      </TT.Portal>
    </TT.Root>
  );
}

/* ------------------------------------------------------------------ Popover */

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export function PopoverContent({ className, sideOffset = 8, ...p }: ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content sideOffset={sideOffset} collisionPadding={12} className={cn('z-50 w-80 rounded-lg border border-border bg-surface-elevated p-4 text-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.97]', className)} {...p} />
    </P.Portal>
  );
}

/* ------------------------------------------------------------------ Tabs */

export const Tabs = T.Root;
export function TabsList({ className, ...p }: ComponentProps<typeof T.List>) {
  return <T.List className={cn('inline-flex h-10 items-center gap-1 rounded-lg bg-surface-secondary p-1 text-muted-foreground', className)} {...p} />;
}
export function TabsTrigger({ className, ...p }: ComponentProps<typeof T.Trigger>) {
  return (
    <T.Trigger
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 text-[13px] font-semibold transition-all hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring border border-transparent data-[state=active]:border-[var(--primary-edge)] data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[var(--primary-glow)] [&_svg]:size-4',
        className,
      )}
      {...p}
    />
  );
}
export const TabsContent = ({ className, ...p }: ComponentProps<typeof T.Content>) => <T.Content className={cn('focus-visible:outline-none', className)} {...p} />;
