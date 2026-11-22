import { zodResolver } from '@hookform/resolvers/zod';
import { Armchair, ArrowRight, CakeSlice, Check, Copy, Gem, KeyRound, Shirt } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { TEMPLATES } from '@shared/templates';
import { ErrorState } from '@/components/feedback/states';
import { Logo, ThemeToggle } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { copyWithToast } from '@/lib/clipboard';
import { api, shareBase } from '@/lib/api';
import { saveSellerKey } from '@/lib/keys';
import { cn } from '@/lib/utils';

export const CATEGORY_ICON = { cake: CakeSlice, merch: Shirt, furniture: Armchair, jewellery: Gem } as const;

const schema = z.object({
  name: z.string().trim().min(2, 'Give your shop a name (at least 2 characters).').max(60),
  ownerName: z.string().trim().min(1, 'Add your name so customers know who they are talking to.').max(40),
  city: z.string().trim().max(40),
  category: z.enum(['cake', 'merch', 'furniture', 'jewellery']),
});
type Values = z.infer<typeof schema>;

export default function StartShopPage() {
  const nav = useNavigate();
  const [created, setCreated] = useState<{ id: string; link: string } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', ownerName: '', city: '', category: 'cake' } });
  const category = watch('category');

  const submit = handleSubmit(async (v) => {
    setServerError(null);
    try {
      const { shop, sellerKey } = await api.createShop(v);
      saveSellerKey(shop.id, sellerKey);
      setCreated({ id: shop.id, link: `${await shareBase()}/seller/${shop.id}#k=${sellerKey}` });
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <ThemeToggle />
      </header>
      <main className="mx-auto grid max-w-5xl gap-10 px-4 pb-16 pt-6 sm:px-6 lg:grid-cols-[1fr_420px]">
        <div className="hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Seller setup</p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.02em] text-foreground">Set up your studio in a minute.</h1>
          <p className="mt-4 text-lg text-muted-foreground">You get a dashboard for every custom order and a shop link for your Instagram bio. Customers never need an account.</p>
          <div className="mt-8 overflow-hidden rounded-2xl border border-border shadow-lg">
            <img src="/images/craft-piping.jpg" alt="A baker piping buttercream onto a cake" className="aspect-[4/3] w-full object-cover" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
          {created ? (
            <div className="grid gap-5">
              <span className="grid size-12 place-items-center rounded-full bg-success-bg text-success-text">
                <Check className="size-6" aria-hidden />
              </span>
              <div>
                <h2 className="font-display text-2xl font-semibold text-foreground">Your shop is ready</h2>
                <p className="mt-1 text-sm text-muted-foreground">BriefRoom has no passwords. This private link is your key to the dashboard — save it (or open it on another device) to manage orders from anywhere.</p>
              </div>
              <div className="rounded-lg border border-warning/40 bg-warning-bg p-3">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-warning-text">
                  <KeyRound className="size-3.5" aria-hidden /> Private dashboard link — don’t share it
                </p>
                <p className="mt-2 break-all font-mono text-xs text-foreground">{created.link}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" className="flex-1" onClick={() => void copyWithToast(created.link, 'Dashboard link copied')}>
                  <Copy /> Copy link
                </Button>
                <Button className="flex-1" onClick={() => nav(`/seller/${created.id}`)}>
                  Open dashboard <ArrowRight />
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="grid gap-5">
              <div>
                <h2 className="font-display text-2xl font-semibold text-foreground lg:hidden">Set up your studio</h2>
                <h2 className="hidden text-lg font-bold text-foreground lg:block">Create your shop</h2>
                <p className="mt-1 text-sm text-muted-foreground">Free to start. You can change these later.</p>
              </div>
              <Field label="Shop name" required error={formState.errors.name?.message}>
                {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={Boolean(formState.errors.name)} autoFocus placeholder="e.g. Sugar & Sprinkles" {...register('name')} />}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Your name" required error={formState.errors.ownerName?.message}>
                  {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={Boolean(formState.errors.ownerName)} placeholder="e.g. Neha" {...register('ownerName')} />}
                </Field>
                <Field label="City">{(id, d) => <Input id={id} aria-describedby={d} placeholder="e.g. Pune" {...register('city')} />}</Field>
              </div>
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-[13px] font-semibold text-foreground">What do you make?</legend>
                <div className="grid grid-cols-2 gap-2" role="radiogroup">
                  {Object.values(TEMPLATES).map((t) => {
                    const Icon = CATEGORY_ICON[t.id as keyof typeof CATEGORY_ICON];
                    return (
                      <button
                        key={t.id}
                        type="button"
                        role="radio"
                        aria-checked={category === t.id}
                        onClick={() => setValue('category', t.id as Values['category'])}
                        className={cn('flex min-h-12 items-center gap-2.5 rounded-lg border px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', category === t.id ? 'border-primary bg-primary-soft text-foreground' : 'border-border text-muted-foreground hover:bg-surface-secondary hover:text-foreground')}
                      >
                        <Icon className="size-5 shrink-0" aria-hidden />
                        {t.name.replace(/^(Custom|Printed) /, '')}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {serverError && <ErrorState title="Could not create the shop">{serverError}</ErrorState>}
              <Button type="submit" size="lg" loading={formState.isSubmitting}>
                Create my shop <ArrowRight />
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Already have one? Open your private dashboard link, or go <Link to="/" className="font-semibold text-foreground underline-offset-2 hover:underline">home</Link>.
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
