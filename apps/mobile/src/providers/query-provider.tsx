import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useState } from "react";

type QueryKeyList = readonly (readonly unknown[])[];

export function MobileQueryProvider({ children }: { children: any }) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      mutationCache: new MutationCache({
        onSuccess: async (_data, _variables, _context, mutation) => {
          const invalidates = mutation.meta?.invalidates as
            | QueryKeyList
            | undefined;

          if (invalidates?.length) {
            await Promise.all(
              invalidates.map((queryKey) =>
                queryClient.invalidateQueries({
                  queryKey,
                  exact: true,
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