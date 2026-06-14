export type QueryKeyTarget = {
  queryKey: readonly unknown[];
  exact?: boolean;
};

export type QueryInvalidateInput = readonly (readonly unknown[] | QueryKeyTarget)[];

function isQueryKeyTarget(target: readonly unknown[] | QueryKeyTarget): target is QueryKeyTarget {
  return !Array.isArray(target);
}

export function normalizeInvalidateTargets(invalidates: QueryInvalidateInput | undefined): QueryKeyTarget[] {
  if (!invalidates?.length) return [];
  return invalidates.map((target) => isQueryKeyTarget(target)
    ? { queryKey: target.queryKey, exact: target.exact ?? true }
    : { queryKey: target, exact: true });
}
