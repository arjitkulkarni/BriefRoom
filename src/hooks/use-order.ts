/**
 * Authoritative order state for the workspace.
 * - Every mutation returns the fresh server view, which replaces local state.
 * - Live: a BR:* Nexconn message for this order triggers a debounced re-fetch.
 * - Fallback (no Nexconn): re-fetch when the tab regains focus. No interval polling.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { OrderView } from '@shared/types';
import { api, ApiError, type OrderResponse } from '@/lib/api';

export function useOrder(orderId: string, accessKey: string | null) {
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const orderRef = useRef<OrderView | null>(null);
  orderRef.current = order;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback((next: OrderView) => {
    setOrder((prev) => (prev && prev.revision > next.revision && prev.id === next.id ? prev : next));
  }, []);

  const refresh = useCallback(async () => {
    if (!accessKey) return;
    try {
      const { order } = await api.order(orderId, accessKey);
      apply(order);
      setError(null);
    } catch (e) {
      if (!orderRef.current) setError(e as ApiError);
    }
  }, [orderId, accessKey, apply]);

  /** Debounced refresh used by live events (several events often arrive together). */
  const scheduleRefresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(), 180);
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const onFocus = () => document.visibilityState === 'visible' && scheduleRefresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [refresh, scheduleRefresh]);

  /** Run a command; the response carries the new authoritative view. Errors become toasts unless `silent`. */
  const run = useCallback(
    async <R,>(label: string, fn: (key: string) => Promise<OrderResponse<R>>, opts: { success?: string; silent?: boolean } = {}): Promise<OrderResponse<R> | null> => {
      if (!accessKey) return null;
      setBusy(label);
      try {
        const r = await fn(accessKey);
        apply(r.order);
        if (opts.success) toast.success(opts.success);
        return r;
      } catch (e) {
        if (!opts.silent) toast.error((e as Error).message);
        if (opts.silent) throw e;
        return null;
      } finally {
        setBusy(null);
      }
    },
    [accessKey, apply],
  );

  return { order, error, busy, refresh, scheduleRefresh, run, setOrder: apply };
}
