import {
  dehydrate,
  hydrate,
  MutationCache,
  QueryClient,
  QueryClientProvider,
  QueryCache,
} from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { addMobileBreadcrumb, captureMobileException } from "@/lib/sentry";
import { shouldPersistQueryKey } from "@/lib/query-cache-policy";
import { normalizeInvalidateTargets, type QueryInvalidateInput } from "@/lib/query-invalidation";
import { showErrorAlert } from "@/lib/user-feedback";
import { normalizeApiError, queryRetryDelay, shouldRetryQuery } from "@/lib/api-error";
import { QUERY_TIMING } from "@/lib/query-performance";

const QUERY_CACHE_KEY = "fizyoflow.query_cache.v1";
const QUERY_CACHE_MAX_AGE = 12 * 60 * 60 * 1000;

type QueryClientProviderChildren = ComponentProps<typeof QueryClientProvider>["children"];

export function MobileQueryProvider({ children }: { children: QueryClientProviderChildren }) {
  const [cacheRestored, setCacheRestored] = useState(false);
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => {
          const scope = String(query.queryKey[0] || "unknown");
          const normalized = normalizeApiError(error);
          addMobileBreadcrumb({ category: "api", message: `query_failed:${scope}`, level: "error", data: { error_kind: normalized.kind, status: normalized.status, code: normalized.code } });
          captureMobileException(error, { query_scope: scope, error_kind: normalized.kind, status: normalized.status, code: normalized.code });
        },
      }),
      mutationCache: new MutationCache({
        onError: (error, _variables, _context, mutation) => {
          const invalidates = mutation.meta?.invalidates as QueryInvalidateInput | undefined;
          const scope = String(normalizeInvalidateTargets(invalidates)[0]?.queryKey?.[0] || "mutation");
          const normalized = normalizeApiError(error);
          addMobileBreadcrumb({ category: "api", message: `mutation_failed:${scope}`, level: "error", data: { error_kind: normalized.kind, status: normalized.status, code: normalized.code } });
          captureMobileException(error, { mutation_scope: scope, error_kind: normalized.kind, status: normalized.status, code: normalized.code });
          if (typeof mutation.options.onError !== "function") {
            showErrorAlert("İşlem tamamlanamadı", error, "İşlem tamamlanamadı. Lütfen tekrar deneyin.");
          }
        },
        onSuccess: (_data, _variables, _context, mutation) => {
          const invalidates = normalizeInvalidateTargets(mutation.meta?.invalidates as QueryInvalidateInput | undefined);

          if (invalidates?.length) {
            void Promise.all(
              invalidates.map((target) =>
                queryClient.invalidateQueries({
                  queryKey: target.queryKey,
                  exact: target.exact,
                  refetchType: "active",
                })
              )
            ).catch((error) => {
              addMobileBreadcrumb({ category: "api", message: "mutation_invalidation_failed", level: "error" });
              captureMobileException(error, { mutation_scope: "invalidation" });
            });
            return;
          }

          // Metadata'sı olmayan mutation'lar bütün uygulama cache'ini düşürmez.
          // Bu mutation'lar local cache güncellemesini veya hedef invalidasyonu açıkça tanımlar.
        },
      }),

      defaultOptions: {
        queries: {
          retry: shouldRetryQuery,
          retryDelay: queryRetryDelay,
          staleTime: QUERY_TIMING.home,
          gcTime: QUERY_TIMING.garbageCollection,
          refetchOnReconnect: false,
          refetchOnWindowFocus: false,
        },
        mutations: {
          retry: false,
        },
      },
    });

    return queryClient;
  });

  useEffect(() => {
    let mounted = true;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    let unsubscribe: () => void = () => {};

    void AsyncStorage.getItem(QUERY_CACHE_KEY)
      .then((raw) => {
        if (!mounted || !raw) return;
        try {
          const parsed = JSON.parse(raw) as { savedAt?: number; state?: unknown };
          if (parsed.savedAt && Date.now() - parsed.savedAt <= QUERY_CACHE_MAX_AGE && parsed.state) {
            hydrate(client, parsed.state as any);
          }
        } catch {
          void AsyncStorage.removeItem(QUERY_CACHE_KEY);
        }
      })
      .finally(() => {
        if (!mounted) return;
        setCacheRestored(true);
        unsubscribe = client.getQueryCache().subscribe((event) => {
          if (event.type !== "updated" && event.type !== "removed") return;
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            const state = dehydrate(client, {
              shouldDehydrateQuery: (query) => query.state.status === "success" && shouldPersistQueryKey(query.queryKey),
            });
            void AsyncStorage.setItem(QUERY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
          }, 1_000);
        });
      });

    return () => {
      mounted = false;
      if (saveTimer) clearTimeout(saveTimer);
      unsubscribe();
    };
  }, [client]);

  return <QueryClientProvider client={client}>{cacheRestored ? children : null}</QueryClientProvider>;
}
