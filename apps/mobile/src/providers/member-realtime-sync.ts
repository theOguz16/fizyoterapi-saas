import { useEffect } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { subscribeToMemberRealtime } from "@/lib/member-realtime";

const MEMBER_REALTIME_QUERY_KEYS = [
  ["member-bookings-calendar"],
  ["member-availability-calendar"],
  ["member-home-calendar"],
  ["member-home"],
  ["member-availability"],
] as const;

export function useMemberRealtimeSync(input: {
  enabled: boolean;
  queryClient: QueryClient;
  refreshSession: () => Promise<void>;
}) {
  const { enabled, queryClient, refreshSession } = input;

  useEffect(() => {
    if (!enabled) return;

    return subscribeToMemberRealtime((payload) => {
      const type = String(payload.data?.type || "").toLowerCase();
      const entity = String(payload.data?.entity || "").toLowerCase();

      if (payload.event !== "connected" && type !== "calendar_sync" && entity !== "calendar") return;

      if (type === "calendar_sync" || entity === "calendar") {
        void refreshSession().catch(() => null);
      }

      for (const queryKey of MEMBER_REALTIME_QUERY_KEYS) {
        void queryClient.invalidateQueries({ queryKey });
      }
    });
  }, [enabled, queryClient, refreshSession]);
}
