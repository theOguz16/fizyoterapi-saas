import nodemailer from "nodemailer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoLeadEmailService } from "../services/demo-lead-email.service";

const ENV_KEYS = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM_EMAIL",
  "SMTP_FROM_NAME",
  "DEMO_LEAD_RECIPIENT_EMAIL",
] as const;

afterEach(() => {
  vi.restoreAllMocks();
  ENV_KEYS.forEach((key) => delete process.env[key]);
});

describe("DemoLeadEmailService", () => {
  it("SMTP yapılandırılmadığında gönderimi güvenli biçimde atlar", async () => {
    const result = await DemoLeadEmailService.send({
      fullName: "Ayşe Yılmaz",
      email: "ayse@example.com",
      clinicName: "Denge Fizyo",
      phone: "05551112233",
    });

    expect(result).toEqual({
      configured: false,
      adminDelivered: false,
      applicantDelivered: false,
      errors: [],
    });
  });

  it("yönetici bildirimini ve başvuru onayını gönderir", async () => {
    process.env.SMTP_HOST = "smtp.hostinger.test";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_SECURE = "true";
    process.env.SMTP_USER = "hello@fizyoflow.com";
    process.env.SMTP_PASS = "secret";
    process.env.SMTP_FROM_EMAIL = "hello@fizyoflow.com";
    process.env.DEMO_LEAD_RECIPIENT_EMAIL = "owner@fizyoflow.com";
    const sendMail = vi.fn().mockResolvedValue({ messageId: "message-1" });
    const createTransport = vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as any);

    const result = await DemoLeadEmailService.send({
      fullName: "Ayşe Yılmaz",
      email: "ayse@example.com",
      clinicName: "Denge Fizyo",
      phone: "05551112233",
      note: "Demo istiyoruz",
    });

    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: "smtp.hostinger.test",
      port: 465,
      secure: true,
    }));
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "owner@fizyoflow.com",
      replyTo: "ayse@example.com",
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "ayse@example.com",
      replyTo: "owner@fizyoflow.com",
    }));
    expect(result).toEqual({
      configured: true,
      adminDelivered: true,
      applicantDelivered: true,
      errors: [],
    });
  });
});
