import { Monitor, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTheme, type ThemePreference } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '../ui/overlay';

/** BriefRoom mark: a reference frame with a numbered annotation marker on its corner. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8', className)} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="8" className="fill-primary" />
      <rect x="7.5" y="9.5" width="14" height="14" rx="3" fill="none" className="stroke-primary-foreground" strokeWidth="2.2" />
      <path d="M11 19.5l3-3.4 2.4 2.4 2-2.2" fill="none" className="stroke-primary-foreground" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
      <circle cx="22.5" cy="9.5" r="5" className="fill-accent stroke-primary" strokeWidth="2" />
      <text x="22.5" y="12" textAnchor="middle" fontSize="7" fontWeight="800" className="fill-accent-foreground" fontFamily="Manrope, system-ui, sans-serif">
        1
      </text>
    </svg>
  );
}

export function Logo({ to = '/', className, compact }: { to?: string; className?: string; compact?: boolean }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5 rounded-md font-display text-[19px] font-semibold tracking-[-0.02em] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} aria-label="BriefRoom home">
      <LogoMark />
      {!compact && <span>BriefRoom</span>}
    </Link>
  );
}

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

/** Accessible theme selector (menu with radio items). */
export function ThemeToggle({ className }: { className?: string }) {
  const { preference, resolved, setPreference } = useTheme();
  const Icon = preference === 'system' ? Monitor : resolved === 'dark' ? Moon : Sun;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn('grid size-10 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)}
        aria-label={`Theme: ${preference}${preference === 'system' ? ` (${resolved})` : ''}. Change theme`}
      >
        <Icon className="size-[18px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={preference} onValueChange={(v) => setPreference(v as ThemePreference)}>
          {OPTIONS.map((o) => (
            <DropdownMenuRadioItem key={o.value} value={o.value}>
              <o.icon className="text-muted-foreground" />
              {o.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Segmented variant for settings surfaces and the design-system page. */
export function ThemeSegmented() {
  const { preference, setPreference } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-border bg-surface-secondary p-1">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={preference === o.value}
          onClick={() => setPreference(o.value)}
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            preference === o.value && 'bg-surface text-foreground shadow-xs',
          )}
        >
          <o.icon className="size-4" aria-hidden />
          <span className="max-sm:sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  );
}
