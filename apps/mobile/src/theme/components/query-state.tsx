import type { AppIconName } from "./app-icon";
import { ScreenErrorState, ScreenLoading } from "./data-states";

type Props = { mode: "loading" | "error"; title?: string; description?: string; icon?: AppIconName; error?: unknown; onRetry?: () => void };

export function QueryState({ mode, title, description, error, onRetry }: Props) {
  if (mode === "loading") return <ScreenLoading title={title} />;
  return <ScreenErrorState error={error} title={title} description={description} onRetry={onRetry} />;
}
