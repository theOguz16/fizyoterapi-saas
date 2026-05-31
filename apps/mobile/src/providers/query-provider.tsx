import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { useState } from "react";

type QueryKeyTarget = {
  queryKey: readonly unknown[];
  exact?: boolean;
};

type QueryInvalidateInput = readonly (readonly unknown[] | QueryKeyTarget)[];

function isQueryKeyTarget(target: readonly unknown[] | QueryKeyTarget): target is QueryKeyTarget {
  return !Array.isArray(target);
}

export function normalizeInvalidateTargets(invalidates: QueryInvalidateInput | undefined): QueryKeyTarget[] {
  if (!invalidates?.length) return [];

  return invalidates.map((target) => {
    if (isQueryKeyTarget(target)) {
      return {
        queryKey: target.queryKey,
        exact: target.exact ?? true,
      };
    }

    return {
      queryKey: target,
      exact: true,
    };
  });
}

type QueryClientProviderChildren = ComponentProps<typeof QueryClientProvider>["children"];

export function MobileQueryProvider({ children }: { children: QueryClientProviderChildren }) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      mutationCache: new MutationCache({
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

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
