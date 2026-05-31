type ConnectivityStatus = "online" | "offline" | "unknown";

type ConnectivitySnapshot = {
  status: ConnectivityStatus;
  lastChangedAt: number;
  message: string | null;
};

type ConnectivityListener = (snapshot: ConnectivitySnapshot) => void;

let snapshot: ConnectivitySnapshot = {
  status: "unknown",
  lastChangedAt: Date.now(),
  message: null,
};

const listeners = new Set<ConnectivityListener>();

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
    lastChangedAt: Date.now(),
    message: message || "Bağlantı kurulamadı. İnternetini kontrol edip tekrar deneyebilirsin.",
  });
}

export function markNetworkSuccess() {
  if (snapshot.status === "online") return;
  emit({
    status: "online",
    lastChangedAt: Date.now(),
    message: null,
  });
}
