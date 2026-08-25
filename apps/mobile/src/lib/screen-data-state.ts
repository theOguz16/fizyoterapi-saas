export type ScreenDataState =
  | "initial-loading"
  | "content"
  | "refreshing"
  | "empty"
  | "offline-empty"
  | "error-empty"
  | "stale-error";

export function resolveScreenDataState(input: {
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  hasData: boolean;
  isEmpty: boolean;
  isOffline: boolean;
}): ScreenDataState {
  if (!input.hasData && input.isLoading) return "initial-loading";
  if (!input.hasData && input.isOffline) return "offline-empty";
  if (!input.hasData && input.isError) return "error-empty";
  if (input.hasData && input.isError) return "stale-error";
  if (input.hasData && input.isFetching) return "refreshing";
  if (input.isEmpty) return "empty";
  return "content";
}
