type RealtimePayload = Record<string, unknown>;
type MemberStreamListener = (event: { event: string; data: RealtimePayload }) => void;

export class MemberRealtimeService {
  private static listeners = new Map<string, Set<MemberStreamListener>>();

  static subscribe(memberId: string, listener: MemberStreamListener) {
    const bucket = MemberRealtimeService.listeners.get(memberId) || new Set<MemberStreamListener>();
    bucket.add(listener);
    MemberRealtimeService.listeners.set(memberId, bucket);

    return () => {
      const current = MemberRealtimeService.listeners.get(memberId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        MemberRealtimeService.listeners.delete(memberId);
      }
    };
  }

  static publish(memberId: string, data: RealtimePayload, event = "message") {
    const bucket = MemberRealtimeService.listeners.get(memberId);
    if (!bucket?.size) return;

    for (const listener of bucket) {
      listener({ event, data });
    }
  }
}
