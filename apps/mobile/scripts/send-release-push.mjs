import fs from "node:fs";
import path from "node:path";

const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPT_URL = "https://exp.host/--/api/v2/push/getReceipts";

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`${name} zorunludur.`);
  return value;
}

function headers() {
  const result = { "content-type": "application/json", accept: "application/json" };
  if (process.env.EXPO_ACCESS_TOKEN) result.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  return result;
}

function writeJson(filePath, value) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(process.cwd(), filePath), "utf8"));
}

function maskToken(token) {
  return token.length > 12 ? `${token.slice(0, 8)}...${token.slice(-6)}` : "masked";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function send() {
  const token = required("PUSH_E2E_EXPO_TOKEN");
  const role = required("PUSH_E2E_ROLE").toUpperCase();
  const state = required("PUSH_E2E_STATE").toLowerCase();
  const href = required("PUSH_E2E_HREF");
  const title = required("PUSH_E2E_NOTIFICATION_TITLE");
  const ticketPath = required("PUSH_E2E_TICKET_PATH");
  const sentAt = new Date().toISOString();
  const response = await fetch(SEND_URL, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      to: token,
      sound: "default",
      title,
      body: `${role} ${state} gerçek cihaz push doğrulaması`,
      data: { href, role, type: `RELEASE_PUSH_${state.toUpperCase()}`, release_test: true },
    }),
  });
  const payload = await response.json().catch(() => ({}));
  const ticket = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
  if (!response.ok || ticket?.status !== "ok" || !ticket?.id) {
    throw new Error(`Expo ticket alınamadı: HTTP ${response.status} ${JSON.stringify(payload).slice(0, 500)}`);
  }
  writeJson(ticketPath, {
    provider: "EXPO",
    providerTicketStatus: ticket.status,
    ticketId: ticket.id,
    token: maskToken(token),
    role,
    state,
    href,
    title,
    sentAt,
  });
  console.log(JSON.stringify({ status: "ticket_accepted", ticketId: ticket.id, role, state }));
}

async function receipt() {
  const ticketPath = required("PUSH_E2E_TICKET_PATH");
  const receiptPath = required("PUSH_E2E_RECEIPT_PATH");
  const ticket = readJson(ticketPath);
  const attempts = Number(process.env.PUSH_E2E_RECEIPT_ATTEMPTS || 36);
  const intervalMs = Number(process.env.PUSH_E2E_RECEIPT_INTERVAL_MS || 5_000);

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const response = await fetch(RECEIPT_URL, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ ids: [ticket.ticketId] }),
    });
    const payload = await response.json().catch(() => ({}));
    const result = payload?.data?.[ticket.ticketId];
    if (result) {
      const evidence = {
        provider: "EXPO",
        ticketId: ticket.ticketId,
        checkedAt: new Date().toISOString(),
        attempt,
        receipt: result,
      };
      writeJson(receiptPath, evidence);
      if (!response.ok || result.status !== "ok") {
        throw new Error(`Push receipt başarısız: ${JSON.stringify(evidence)}`);
      }
      console.log(JSON.stringify({ status: "delivered", ticketId: ticket.ticketId, attempt }));
      return;
    }
    await sleep(intervalMs);
  }
  throw new Error(`Expo receipt ${attempts} sorguda oluşmadı: ${ticket.ticketId}`);
}

const mode = process.argv[2];
if (mode === "send") await send();
else if (mode === "receipt") await receipt();
else throw new Error("Kullanım: node scripts/send-release-push.mjs <send|receipt>");
