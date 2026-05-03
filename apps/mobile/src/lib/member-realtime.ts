import { getApiBase, getAuthToken } from "./http-client";

type MessageHandler = (payload: { event: string; data: Record<string, unknown> | null }) => void;

function parseEventChunk(chunk: string) {
  const lines = chunk.split("\n");
  let event = "message";
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim() || "message";
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }

  const rawData = dataLines.join("\n");
  if (!rawData) {
    return { event, data: null };
  }

  try {
    return { event, data: JSON.parse(rawData) as Record<string, unknown> };
  } catch {
    return { event, data: { raw: rawData } };
  }
}

export function subscribeToMemberRealtime(onMessage: MessageHandler) {
  let active = true;
  let xhr: XMLHttpRequest | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let processedLength = 0;
  let reconnectDelay = 1000;

  const connect = () => {
    const token = getAuthToken();
    if (!active || !token) return;

    xhr = new XMLHttpRequest();
    xhr.open("GET", `${getApiBase()}/member/realtime/stream`, true);
    xhr.setRequestHeader("Accept", "text/event-stream");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.onreadystatechange = () => {
      if (!xhr || xhr.readyState < 3) return;
      const responseText = xhr.responseText || "";
      const nextChunk = responseText.slice(processedLength);
      processedLength = responseText.length;

      const chunks = nextChunk.split("\n\n").filter(Boolean);
      for (const chunk of chunks) {
        const parsed = parseEventChunk(chunk);
        if (parsed.event === "heartbeat") continue;
        onMessage(parsed);
      }

      if (xhr.readyState === 4 && active) {
        reconnectTimer = setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 10000);
        processedLength = 0;
      }
    };

    xhr.onerror = () => {
      if (!active) return;
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, 10000);
      processedLength = 0;
    };

    xhr.send();
  };

  connect();

  return () => {
    active = false;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (xhr) xhr.abort();
  };
}
