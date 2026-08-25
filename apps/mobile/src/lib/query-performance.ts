export const QUERY_TIMING = {
  live: 20_000,
  home: 60_000,
  list: 2 * 60_000,
  reference: 10 * 60_000,
  garbageCollection: 24 * 60 * 60_000,
} as const;

type ActiveQueryCandidate = {
  isActive: () => boolean;
  isStale: () => boolean;
};

export function shouldRefetchAfterReconnect(query: ActiveQueryCandidate) {
  return query.isActive() && query.isStale();
}
