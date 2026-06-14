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

const QUERY_CACHE_KEY = "fizyoflow.query_cache.v1";
const QUERY_CACHE_MAX_AGE = 12 * 60 * 60 * 1000;

type QueryClientProviderChildren = ComponentProps<typeof QueryClientProvider>["children"];

export function MobileQueryProvider({ children }: { children: QueryClientProviderChildren }) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      queryCache: new QueryCache({
        onError: (error, query) => {
          const scope = String(query.queryKey[0] || "unknown");
          addMobileBreadcrumb({ category: "api", message: `query_failed:${scope}`, level: "error" });
          captureMobileException(error, { query_scope: scope });
        },
      }),
      mutationCache: new MutationCache({
        onError: (error, _variables, _context, mutation) => {
          const invalidates = mutation.meta?.invalidates as QueryInvalidateInput | undefined;
          const scope = String(normalizeInvalidateTargets(invalidates)[0]?.queryKey?.[0] || "mutation");
          addMobileBreadcrumb({ category: "api", message: `mutation_failed:${scope}`, level: "error" });
          captureMobileException(error, { mutation_scope: scope });
        },
        onSuccess: async (_data, _variables, _context, mutation) => {
          const invalidates = normalizeInvalidateTargets(mutation.meta?.invalidates as QueryInvalidateInput | undefined);

          if (invalidates?.length) {
            await Promise.all(
              invalidates.map((target) =>
                queryClient.invalidateQueries({
                  queryKey: target.queryKey,
                  exact: target.exact,
                  refetchType: "all",
                })
              )
            );
            return;
          }

          await queryClient.invalidateQueries();
        },
      }),

      defaultOptions: {
        queries: {
          retry: 1,
          staleTime: 30_000,
        },
      },
    });

    return queryClient;
  });

  useEffect(() => {
    let mounted = true;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;

    void AsyncStorage.getItem(QUERY_CACHE_KEY).then((raw) => {
      if (!mounted || !raw) return;
      try {
        const parsed = JSON.parse(raw) as { savedAt?: number; state?: unknown };
        if (!parsed.savedAt || Date.now() - parsed.savedAt > QUERY_CACHE_MAX_AGE || !parsed.state) return;
        hydrate(client, parsed.state as any);
      } catch {
        void AsyncStorage.removeItem(QUERY_CACHE_KEY);
      }
    });

    const unsubscribe = client.getQueryCache().subscribe(() => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const state = dehydrate(client, {
          shouldDehydrateQuery: (query) => query.state.status === "success" && shouldPersistQueryKey(query.queryKey),
        });
        void AsyncStorage.setItem(QUERY_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), state }));
      }, 400);
    });

    return () => {
      mounted = false;
      if (saveTimer) clearTimeout(saveTimer);
      unsubscribe();
    };
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
