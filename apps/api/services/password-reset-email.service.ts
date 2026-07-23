import nodemailer from "nodemailer";

function clean(value: unknown) {
  return String(value || "").trim();
}

function readConfig() {
  const host = clean(process.env.SMTP_HOST);
  const user = clean(process.env.SMTP_USER);
  const pass = clean(process.env.SMTP_PASS);
  const fromEmail = clean(process.env.SMTP_FROM_EMAIL) || user;
  const port = Number(process.env.SMTP_PORT || 465);
  const secure = String(process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false";
  if (!host || !user || !pass || !fromEmail || !Number.isInteger(port) || port <= 0) return null;
  return { host, user, pass, fromEmail, port, secure, fromName: clean(process.env.SMTP_FROM_NAME) || "FizyoFlow" };
}

export class PasswordResetEmailService {
  static isConfigured() {
    return Boolean(readConfig());
  }

  static async send(input: { email: string; token: string }) {
    const config = readConfig();
    if (!config) return { configured: false, delivered: false };
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 12_000,
    });
    const deepLink = `fizyoflow://reset-password?token=${encodeURIComponent(input.token)}`;
    await transporter.sendMail({
      from: { name: config.fromName, address: config.fromEmail },
      to: input.email,
      subject: "FizyoFlow şifre yenileme",
      text: `Şifreni yenilemek için FizyoFlow uygulamasında şu doğrulama kodunu kullan:\n\n${input.token}\n\nBu kod 30 dakika geçerlidir ve yalnızca bir kez kullanılabilir. Bu isteği sen yapmadıysan e-postayı yok sayabilirsin.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:600px;color:#17201b;line-height:1.6"><h1>Şifreni yenile</h1><p>FizyoFlow uygulamasına dönüp aşağıdaki tek kullanımlık kodu gir:</p><p style="font-family:monospace;font-size:18px;word-break:break-all"><strong>${input.token}</strong></p><p><a href="${deepLink}">FizyoFlow uygulamasında aç</a></p><p>Bu kod 30 dakika geçerlidir. Bu isteği sen yapmadıysan e-postayı yok sayabilirsin.</p></div>`,
    });
    return { configured: true, delivered: true };
  }
}
