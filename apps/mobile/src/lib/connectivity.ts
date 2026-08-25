export type ConnectivityStatus = "online" | "offline" | "unknown";

export type ConnectivitySnapshot = {
  status: ConnectivityStatus;
  isConnected: boolean;
  isInternetReachable: boolean | null;
  wasOffline: boolean;
  reconnectedAt: number | null;
  lastChangedAt: number;
  message: string | null;
};

type ConnectivityListener = (snapshot: ConnectivitySnapshot) => void;

let snapshot: ConnectivitySnapshot = {
  status: "unknown",
  isConnected: true,
  isInternetReachable: null,
  wasOffline: false,
  reconnectedAt: null,
  lastChangedAt: Date.now(),
  message: null,
};

const listeners = new Set<ConnectivityListener>();
let forcedE2EStatus: ConnectivityStatus | null = null;

function emit(next: ConnectivitySnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener(snapshot));
}

export function getConnectivitySnapshot() {
  return snapshot;
}

export function subscribeConnectivity(listener: ConnectivityListener) {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function markNetworkFailure(message?: string | null) {
  if (snapshot.status === "offline" && snapshot.message === (message || snapshot.message)) return;
  emit({
    status: "offline",
    isConnected: false,
    isInternetReachable: false,
    wasOffline: true,
    reconnectedAt: snapshot.reconnectedAt,
    lastChangedAt: Date.now(),
    message: message || "Bağlantı kurulamadı. İnternetini kontrol edip tekrar deneyebilirsin.",
  });
}

export function markNetworkSuccess() {
  // The E2E offline route must survive successful background requests until
  // the matching online route explicitly releases the override.
  if (forcedE2EStatus === "offline") return;
  if (snapshot.status === "online") return;
  const reconnected = snapshot.status === "offline" || snapshot.wasOffline;
  emit({
    status: "online",
    isConnected: true,
    isInternetReachable: true,
    wasOffline: reconnected,
    reconnectedAt: reconnected ? Date.now() : snapshot.reconnectedAt,
    lastChangedAt: Date.now(),
    message: null,
  });
}

export function forceConnectivityStatusForE2E(status: "online" | "offline") {
  if (status === "offline") {
    forcedE2EStatus = "offline";
    markNetworkFailure("Bağlantı kurulamadı. İnternetini kontrol edip tekrar deneyebilirsin.");
    return;
  }

  forcedE2EStatus = null;
  markNetworkSuccess();
}

/** Reset the in-memory signal between isolated Maestro flows. */
export function resetConnectivityForE2E() {
  forcedE2EStatus = null;
  emit({
    status: "unknown",
    isConnected: true,
    isInternetReachable: null,
    wasOffline: false,
    reconnectedAt: null,
    lastChangedAt: Date.now(),
    message: null,
  });
}
