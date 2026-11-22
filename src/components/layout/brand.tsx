import { Monitor, Moon, Sun } from 'lucide-react';
import { useId } from 'react';
import { Link } from 'react-router-dom';
import { useTheme, type ThemePreference } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '../ui/overlay';

/**
 * BriefRoom mark (official artwork: public/brand/*.svg). Light theme: cream tile, ink line; dark theme: ink tile,
 * cream line; the annotation ring is gold in both. Brand colours are fixed artwork, not UI tokens.
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 256 256" className={cn('size-8', className)} aria-hidden>
      <defs>
        <linearGradient id={`gold-l-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F5C94C" />
          <stop offset="1" stopColor="#D99A00" />
        </linearGradient>
        <linearGradient id={`gold-d-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFE58A" />
          <stop offset="1" stopColor="#FFC928" />
        </linearGradient>
      </defs>
      <rect x="18" y="18" width="220" height="220" rx="56" strokeWidth="12" className="fill-[#FFFDF8] stroke-[#282421] dark:fill-[#171615] dark:stroke-[#F6F2EA]" />
      <path d="M66 175 L109 134 L142 161 L192 101" fill="none" strokeWidth="17" strokeLinecap="round" strokeLinejoin="round" className="stroke-[#282421] dark:stroke-[#F6F2EA]" />
      <path d="M171 101 H192 V122" fill="none" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" className="stroke-[#282421] dark:stroke-[#F6F2EA]" />
      <circle cx="201" cy="65" r="25" strokeWidth="7" fill={`url(#gold-l-${id})`} className="stroke-[#FFFDF8] dark:hidden" />
      <circle cx="201" cy="65" r="25" strokeWidth="7" fill={`url(#gold-d-${id})`} className="hidden stroke-[#171615] dark:block" />
      <circle cx="201" cy="65" r="7" className="fill-[#282421] dark:fill-[#171615]" />
    </svg>
  );
}

/** Lockup: mark + two-tone wordmark ("Brief" ink/cream, "Room" gold), as in the brand files. */
export function Logo({ to = '/', className, compact }: { to?: string; className?: string; compact?: boolean }) {
  return (
    <Link to={to} className={cn('inline-flex items-center gap-2.5 rounded-md font-display text-[19px] font-semibold tracking-[-0.02em] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', className)} aria-label="BriefRoom home">
      <LogoMark />
      {!compact && (
        <span>
          Brief<span className="text-[#B47B00] dark:bg-[linear-gradient(135deg,#FFE58A,#FFC928)] dark:bg-clip-text dark:text-transparent">Room</span>
        </span>
      )}
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
