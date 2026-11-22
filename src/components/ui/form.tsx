import { ChevronDown } from 'lucide-react';
import { Label as LabelPrimitive } from 'radix-ui';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const control =
  'w-full rounded-md border border-input bg-surface px-3 text-[15px] text-foreground shadow-xs transition-[border-color,box-shadow] placeholder:text-placeholder focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:text-muted-foreground aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20 sm:text-sm';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(control, 'h-10', className)} {...p} />);
Input.displayName = 'Input';

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => (
  <textarea ref={ref} className={cn(control, 'min-h-20 resize-y py-2 leading-relaxed', className)} {...p} />
));
Textarea.displayName = 'Textarea';

/** Native select (best on mobile, fully accessible), styled to match inputs. */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => (
  <div className="relative">
    <select ref={ref} className={cn(control, 'h-10 cursor-pointer appearance-none pr-9', className)} {...p}>
      {children}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
  </div>
));
NativeSelect.displayName = 'NativeSelect';

export function Label({ className, ...p }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-[13px] font-semibold text-foreground', className)} {...p} />;
}

/** Label + control + help/error, wired with ids for screen readers. */
export function Field({ label, help, error, required, children, className, aside }: { label: ReactNode; help?: ReactNode; error?: ReactNode; required?: boolean; children: (id: string, describedBy?: string) => ReactNode; className?: string; aside?: ReactNode }) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required && (
            <span className="ml-0.5 text-destructive" aria-hidden>
              *
            </span>
          )}
          {required && <span className="sr-only"> (required)</span>}
        </Label>
        {aside}
      </div>
      {children(id, [helpId, errId].filter(Boolean).join(' ') || undefined)}
      {error ? (
        <p id={errId} className="text-[13px] font-medium text-destructive-text">
          {error}
        </p>
      ) : help ? (
        <p id={helpId} className="text-[13px] text-muted-foreground">
          {help}
        </p>
      ) : null}
    </div>
  );
}
