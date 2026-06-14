import nodemailer from "nodemailer";

export type DemoLeadEmailInput = {
  fullName: string;
  email: string;
  clinicName: string;
  phone: string;
  city?: string | null;
  clinicType?: string | null;
  primaryNeed?: string | null;
  note?: string | null;
  attribution?: string | null;
  pagePath?: string | null;
};

export type DemoLeadEmailResult = {
  configured: boolean;
  adminDelivered: boolean;
  applicantDelivered: boolean;
  errors: string[];
};

function clean(value: string | null | undefined) {
  return String(value || "").trim();
}

function escapeHtml(value: string | null | undefined) {
  return clean(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readConfig() {
  const host = clean(process.env.SMTP_HOST);
  const user = clean(process.env.SMTP_USER);
  const pass = clean(process.env.SMTP_PASS);
  const fromEmail = clean(process.env.SMTP_FROM_EMAIL) || user;
  const adminEmail = clean(process.env.DEMO_LEAD_RECIPIENT_EMAIL);
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false";

  if (!host || !user || !pass || !fromEmail || !adminEmail || !Number.isInteger(port) || port <= 0) {
    return null;
  }

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName: clean(process.env.SMTP_FROM_NAME) || "Fizyoflow",
    adminEmail,
  };
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Bilinmeyen SMTP hatası";
}

export class DemoLeadEmailService {
  static isConfigured() {
    return Boolean(readConfig());
  }

  static async send(input: DemoLeadEmailInput): Promise<DemoLeadEmailResult> {
    const config = readConfig();
    if (!config) {
      return { configured: false, adminDelivered: false, applicantDelivered: false, errors: [] };
    }

    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 12_000,
    });
    const from = { name: config.fromName, address: config.fromEmail };
    const submittedAt = new Intl.DateTimeFormat("tr-TR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Europe/Istanbul",
    }).format(new Date());
    const detailRows = [
      ["Ad Soyad", input.fullName],
      ["E-posta", input.email],
      ["Telefon", input.phone],
      ["Klinik", input.clinicName],
      ["Şehir / İlçe", input.city],
      ["Klinik tipi", input.clinicType],
      ["Öncelikli ihtiyaç", input.primaryNeed],
      ["Not", input.note],
      ["Kaynak", input.attribution],
      ["Sayfa", input.pagePath],
      ["Tarih", submittedAt],
    ].filter(([, value]) => clean(value));
    const adminHtml = `
      <div style="font-family:Arial,sans-serif;max-width:640px;color:#17201b">
        <h1 style="font-size:24px;margin:0 0 18px">Yeni Fizyoflow demo talebi</h1>
        <table style="width:100%;border-collapse:collapse">
          ${detailRows.map(([label, value]) => `<tr><td style="padding:9px 12px;border-bottom:1px solid #e5ebe7;font-weight:700;width:170px">${escapeHtml(label)}</td><td style="padding:9px 12px;border-bottom:1px solid #e5ebe7">${escapeHtml(value)}</td></tr>`).join("")}
        </table>
      </div>`;
    const applicantHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;color:#17201b;line-height:1.6">
        <h1 style="font-size:24px;margin:0 0 14px">Demo talebinizi aldık</h1>
        <p>Merhaba ${escapeHtml(input.fullName)},</p>
        <p><strong>${escapeHtml(input.clinicName)}</strong> için ilettiğiniz Fizyoflow demo talebi bize ulaştı. Seans, paket ve check-in akışınızı konuşmak için kısa süre içinde sizinle iletişime geçeceğiz.</p>
        <p style="color:#5d6d63">Bu e-posta, fizyoflow.com üzerindeki demo formu kullanıldığı için gönderildi.</p>
      </div>`;

    const [adminResult, applicantResult] = await Promise.allSettled([
      transporter.sendMail({
        from,
        to: config.adminEmail,
        replyTo: input.email,
        subject: `Yeni demo talebi: ${input.clinicName}`,
        text: detailRows.map(([label, value]) => `${label}: ${clean(value)}`).join("\n"),
        html: adminHtml,
      }),
      transporter.sendMail({
        from,
        to: input.email,
        replyTo: config.adminEmail,
        subject: "Fizyoflow demo talebinizi aldık",
        text: `Merhaba ${input.fullName},\n\n${input.clinicName} için ilettiğiniz Fizyoflow demo talebi bize ulaştı. Kısa süre içinde sizinle iletişime geçeceğiz.\n\nFizyoflow`,
        html: applicantHtml,
      }),
    ]);
    const errors: string[] = [];
    if (adminResult.status === "rejected") errors.push(`admin: ${errorMessage(adminResult.reason)}`);
    if (applicantResult.status === "rejected") errors.push(`applicant: ${errorMessage(applicantResult.reason)}`);

    return {
      configured: true,
      adminDelivered: adminResult.status === "fulfilled",
      applicantDelivered: applicantResult.status === "fulfilled",
      errors,
    };
  }
}
