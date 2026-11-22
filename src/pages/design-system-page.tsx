/** Internal visual QA reference: every token and component in the active theme. */
import { Bell, CheckCircle2, Clock3, Inbox, Plus, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { ANNOTATION_KINDS, ORDER_STATUSES } from '@shared/types';
import { ConnectionPill, EmptyState, ErrorState, StatusBadge } from '@/components/feedback/states';
import { Logo, ThemeSegmented } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { Field, Input, NativeSelect, Textarea } from '@/components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Popover, PopoverContent, PopoverTrigger, Tabs, TabsContent, TabsList, TabsTrigger, Tooltip } from '@/components/ui/overlay';
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Kbd, Skeleton, Switch } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/use-theme';
import { KindChip, MarkerBadge } from '@/features/annotations/annotation-meta';
import { FingerprintLine } from '@/features/approvals/approval-panel';

const SWATCHES: [string, string][] = [
  ['background', 'bg-background'], ['surface', 'bg-surface'], ['surface-secondary', 'bg-surface-secondary'], ['surface-tertiary', 'bg-surface-tertiary'], ['surface-elevated', 'bg-surface-elevated'],
  ['primary', 'bg-primary'], ['primary-soft', 'bg-primary-soft'], ['secondary', 'bg-secondary'], ['accent', 'bg-accent'], ['muted', 'bg-muted'],
  ['border', 'bg-border'], ['border-strong', 'bg-border-strong'], ['success', 'bg-success'], ['success-bg', 'bg-success-bg'], ['warning', 'bg-warning'], ['warning-bg', 'bg-warning-bg'],
  ['destructive', 'bg-destructive'], ['destructive-bg', 'bg-destructive-bg'], ['info', 'bg-info'], ['info-bg', 'bg-info-bg'], ['canvas', 'bg-canvas'], ['bubble-own', 'bg-bubble-own'],
  ['ann-keep', 'bg-ann-keep'], ['ann-change', 'bg-ann-change'], ['ann-remove', 'bg-ann-remove'], ['ann-question', 'bg-ann-question'], ['ann-add', 'bg-ann-add'],
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-divider py-8" aria-labelledby={title}>
      <h2 id={title} className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  const { resolved } = useTheme();
  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
        <Logo />
        <span className="hidden text-sm font-semibold text-muted-foreground sm:inline">Design system · {resolved} theme</span>
        <span className="ml-auto" />
        <ThemeSegmented />
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
        <h1 className="font-display text-4xl font-semibold tracking-[-0.02em] text-foreground">BriefRoom design system</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Internal QA reference for <code className="font-mono text-sm">design.md</code>. Switch themes above — every component here reads the same semantic tokens.
        </p>

        <Block title="Colour tokens">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {SWATCHES.map(([name, cls]) => (
              <div key={name} className="overflow-hidden rounded-lg border border-border bg-surface">
                <div className={`h-14 ${cls}`} />
                <p className="px-2 py-1.5 font-mono text-[11px] text-muted-foreground">--{name}</p>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Typography">
          <p className="font-display text-5xl font-semibold leading-none tracking-[-0.03em] text-foreground">Display · Fraunces</p>
          <p className="font-display text-3xl font-semibold tracking-[-0.02em] text-foreground">Page title · Fraunces 600</p>
          <p className="text-xl font-bold tracking-[-0.01em] text-foreground">Section heading · Manrope 700</p>
          <p className="text-[15px] text-foreground">Body · Manrope 15/1.55 — the quick brown fox agrees to exactly what was approved.</p>
          <p className="text-[13px] text-muted-foreground">Caption / metadata · Manrope 13 muted</p>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Overline</p>
          <FingerprintLine hash="3f9a1c07d24e8b55c0f1e6a9b3d7742e18c5a90f6be2d13474a8e0c95f21b6d3" full />
        </Block>

        <Block title="Buttons">
          <div className="flex flex-wrap items-center gap-2">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="success">Approve</Button>
            <Button variant="destructive">
              <Trash2 /> Delete
            </Button>
            <Button variant="link">Link</Button>
            <Button size="icon" aria-label="Add">
              <Plus />
            </Button>
            <Button loading>Saving</Button>
            <Button disabled>Disabled</Button>
            <Button size="sm">Small</Button>
            <Button size="lg">Large</Button>
          </div>
        </Block>

        <Block title="Inputs">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Text input" help="Helper text">
              {(id, d) => <Input id={id} aria-describedby={d} placeholder="Placeholder" />}
            </Field>
            <Field label="Invalid input" required error="This field is required">
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid defaultValue="" />}
            </Field>
            <Field label="Disabled">{(id) => <Input id={id} disabled defaultValue="Locked after agreement" />}</Field>
            <Field label="Select">
              {(id) => (
                <NativeSelect id={id} defaultValue="">
                  <option value="">Choose…</option>
                  <option>1 kg</option>
                  <option>1.5 kg</option>
                </NativeSelect>
              )}
            </Field>
            <Field label="Date">{(id) => <Input id={id} type="date" />}</Field>
            <Field label="Switch">{(id) => <Switch id={id} defaultChecked />}</Field>
            <Field label="Textarea" className="sm:col-span-2 lg:col-span-3">
              {(id) => <Textarea id={id} placeholder="Describe the change…" />}
            </Field>
          </div>
        </Block>

        <Block title="Tabs, menus, dialogs, tooltips">
          <Tabs defaultValue="chat" className="max-w-md">
            <TabsList>
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="radar">Radar</TabsTrigger>
              <TabsTrigger value="details">Details</TabsTrigger>
            </TabsList>
            <TabsContent value="chat" className="pt-3 text-sm text-muted-foreground">
              Chat panel content
            </TabsContent>
            <TabsContent value="radar" className="pt-3 text-sm text-muted-foreground">
              Radar panel content
            </TabsContent>
            <TabsContent value="details" className="pt-3 text-sm text-muted-foreground">
              Details panel content
            </TabsContent>
          </Tabs>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Dropdown</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <Search /> Search
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Bell /> Notify
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline">Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Approve version 2?</DialogTitle>
                  <DialogDescription>You are approving this exact frozen version.</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="ghost">Cancel</Button>
                  <Button variant="success">Approve</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">Popover</Button>
              </PopoverTrigger>
              <PopoverContent className="text-sm">Popover content uses surface-elevated.</PopoverContent>
            </Popover>
            <Tooltip content="Tooltips are supplementary">
              <Button variant="outline">Tooltip</Button>
            </Tooltip>
            <Button variant="outline" onClick={() => toast.success('Version 2 sent for approval')}>
              Success toast
            </Button>
            <Button variant="outline" onClick={() => toast.error('Could not reach the server')}>
              Error toast
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Keyboard: <Kbd>J</Kbd> <Kbd>K</Kbd> annotations · <Kbd>R</Kbd> area · <Kbd>P</Kbd> pin · <Kbd>Esc</Kbd> cancel
          </p>
        </Block>

        <Block title="Status badges & connection">
          <div className="flex flex-wrap gap-2">
            {ORDER_STATUSES.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {(['connected', 'connecting', 'reconnecting', 'kicked', 'error', 'disabled'] as const).map((s) => (
              <ConnectionPill key={s} state={s} />
            ))}
          </div>
        </Block>

        <Block title="Annotation markers">
          <div className="flex flex-wrap items-center gap-3">
            {ANNOTATION_KINDS.map((k, i) => (
              <span key={k} className="flex items-center gap-2">
                <MarkerBadge number={i + 1} kind={k} />
                <KindChip kind={k} />
              </span>
            ))}
          </div>
          <div className="canvas-surface relative h-48 rounded-lg border border-border">
            <div className="absolute left-[10%] top-[20%] h-24 w-40 rounded-[6px] border-2 border-ann-change bg-marker-fill">
              <span className="absolute -left-3 -top-3">
                <MarkerBadge number={1} kind="colour" />
              </span>
            </div>
            <div className="absolute left-[45%] top-[30%] h-20 w-32 rounded-[6px] border-2 border-dashed border-ann-keep">
              <span className="absolute -left-3 -top-3">
                <MarkerBadge number={2} kind="keep" resolved />
              </span>
            </div>
            <span className="absolute left-[78%] top-[45%] -translate-x-1/2 -translate-y-1/2">
              <MarkerBadge number={3} kind="question" className="size-7" />
            </span>
          </div>
        </Block>

        <Block title="Conversation">
          <div className="grid max-w-md gap-2">
            <div className="max-w-[80%] rounded-lg rounded-bl-sm border border-bubble-other-border bg-bubble-other px-3 py-2 text-sm text-foreground">Should I keep the leaves green?</div>
            <div className="max-w-[80%] justify-self-end rounded-lg rounded-br-sm border border-bubble-own-border bg-bubble-own px-3 py-2 text-sm text-foreground">Yes, keep them green.</div>
            <div className="rounded-lg border border-border bg-activity p-3 text-sm">
              <p className="text-xs font-semibold text-muted-foreground">Neha · seller</p>
              <p className="font-medium text-foreground">Neha proposed version 2</p>
              <FingerprintLine hash="3f9a1c07d24e8b55c0f1e6a9b3d7742e18c5a90f6be2d13474a8e0c95f21b6d3" />
            </div>
          </div>
        </Block>

        <Block title="Cards">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Clarification</CardTitle>
                  <CardDescription>Exact shade of ivory for #1?</CardDescription>
                </div>
                <ShieldAlert className="size-5 text-warning-text" aria-hidden />
              </CardHeader>
              <CardContent>
                <Badge tone="warning">Blocks next version</Badge>
              </CardContent>
            </Card>
            <Card className="border-info/35">
              <CardHeader>
                <div>
                  <CardTitle>Version 2</CardTitle>
                  <CardDescription>Awaiting approval · 1/2</CardDescription>
                </div>
                <Clock3 className="size-5 text-info-text" aria-hidden />
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button variant="success" size="sm">
                  Approve version 2
                </Button>
              </CardContent>
            </Card>
            <Card className="border-success/40">
              <CardHeader>
                <div>
                  <CardTitle>Order agreed</CardTitle>
                  <CardDescription>Both approved version 2</CardDescription>
                </div>
                <CheckCircle2 className="size-5 text-success-text" aria-hidden />
              </CardHeader>
              <CardContent>
                <FingerprintLine hash="3f9a1c07d24e8b55c0f1e6a9b3d7742e18c5a90f6be2d13474a8e0c95f21b6d3" />
              </CardContent>
            </Card>
          </div>
        </Block>

        <Block title="Empty, loading and error states">
          <div className="grid gap-4 md:grid-cols-3">
            <EmptyState icon={Inbox} title="No briefs yet" action={<Button size="sm">Create a brief</Button>}>
              Create one or share your shop link.
            </EmptyState>
            <div className="grid content-start gap-2 rounded-lg border border-border bg-surface p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
            <ErrorState title="Chat could not connect" action={<Button size="sm" variant="outline">Try again</Button>}>
              Could not reach the Nexconn data centre.
            </ErrorState>
          </div>
        </Block>
      </main>
    </div>
  );
}
