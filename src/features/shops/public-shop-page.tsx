import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, CheckCircle2, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { TEMPLATES } from '@shared/templates';
import type { ShopPublic } from '@shared/types';
import { ErrorState, FullPageMessage, PageLoader } from '@/components/feedback/states';
import { Logo, ThemeToggle } from '@/components/layout/brand';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/form';
import { api } from '@/lib/api';
import { saveCustomerKey } from '@/lib/keys';
import { cn } from '@/lib/utils';
import { CATEGORY_ICON } from './start-shop-page';

const schema = z.object({
  customerName: z.string().trim().min(1, 'Tell the seller your name.').max(40),
  title: z.string().trim().max(80),
  template: z.string(),
});
type Values = z.infer<typeof schema>;

/** The page a seller shares in their bio. A customer starts their own private brief here. */
export default function PublicShopPage() {
  const { shopId = '' } = useParams();
  const nav = useNavigate();
  const [shop, setShop] = useState<ShopPublic | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { register, handleSubmit, watch, setValue, formState, reset } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { customerName: '', title: '', template: 'cake' } });
  const template = watch('template');

  useEffect(() => {
    api
      .shop(shopId)
      .then(({ shop }) => {
        setShop(shop);
        reset({ customerName: '', title: '', template: shop.category });
        document.title = `${shop.name} · Custom orders on BriefRoom`;
      })
      .catch((e) => setLoadError(e.message));
  }, [shopId, reset]);

  const submit = handleSubmit(async (v) => {
    if (!shop) return;
    setSubmitError(null);
    try {
      const r = await api.createOrder(shop.id, v);
      saveCustomerKey(r.orderId, r.customerKey);
      nav(`/o/${r.orderId}`);
    } catch (e) {
      setSubmitError((e as Error).message);
    }
  });

  if (loadError) return <FullPageMessage title="Shop not found">{loadError}</FullPageMessage>;
  if (!shop) return <PageLoader label="Opening the shop…" />;
  const Icon = CATEGORY_ICON[shop.category as keyof typeof CATEGORY_ICON] ?? CATEGORY_ICON.cake;

  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex h-16 max-w-xl items-center justify-between px-4">
        <span className="text-xs font-semibold text-muted-foreground">Custom orders by</span>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-xl px-4 pb-16">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground">
            <Icon className="size-7" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-3xl font-semibold tracking-[-0.02em] text-foreground">{shop.name}</h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              by {shop.ownerName}
              {shop.city && (
                <>
                  <MapPin className="ml-1 size-3.5" aria-hidden /> {shop.city}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-foreground">Let’s design your order together</h2>
          <ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
            {['Share photos of what you like', 'Mark exactly what to keep or change', 'Approve one final version with the seller'].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-success-text" aria-hidden /> {t}
              </li>
            ))}
          </ul>
          <form onSubmit={submit} noValidate className="mt-6 grid gap-5">
            <Field label="Your name" required error={formState.errors.customerName?.message}>
              {(id, d) => <Input id={id} aria-describedby={d} aria-invalid={Boolean(formState.errors.customerName)} autoFocus autoComplete="given-name" placeholder="e.g. Priya" {...register('customerName')} />}
            </Field>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-[13px] font-semibold text-foreground">What would you like?</legend>
              <div className="grid grid-cols-2 gap-2" role="radiogroup">
                {Object.values(TEMPLATES).map((t) => {
                  const I = CATEGORY_ICON[t.id as keyof typeof CATEGORY_ICON];
                  return (
                    <button key={t.id} type="button" role="radio" aria-checked={template === t.id} onClick={() => setValue('template', t.id)} className={cn('flex min-h-12 items-center gap-2.5 rounded-lg border px-3 text-left text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', template === t.id ? 'border-primary bg-primary-soft text-foreground' : 'border-border text-muted-foreground hover:bg-surface-secondary')}>
                      <I className="size-5 shrink-0" aria-hidden />
                      {t.name.replace(/^(Custom|Printed) /, '')}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <Field label="Occasion or title" help="Optional — helps the seller find your order.">
              {(id, d) => <Input id={id} aria-describedby={d} placeholder="e.g. Mom’s 50th birthday" {...register('title')} />}
            </Field>
            {submitError && <ErrorState title="Could not start your brief">{submitError}</ErrorState>}
            <Button type="submit" size="lg" loading={formState.isSubmitting}>
              Start my brief <ArrowRight />
            </Button>
            <p className="text-center text-xs text-muted-foreground">No signup. Your private brief link is saved on this device.</p>
          </form>
        </div>
        <p className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          Powered by <Logo className="text-sm" />
        </p>
      </main>
    </div>
  );
}
