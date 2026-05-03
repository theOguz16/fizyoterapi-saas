"use client";

import { useEffect, useState } from "react";
import { useRequireRole } from "@/lib/require-role";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ActionButton } from "@/components/ui/action-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { MetricCard } from "@/components/ui/metric-card";
import { getApiBase } from "@/lib/api-base";

type Role = "ADMIN" | "TRAINER" | "MEMBER";

type SessionData = {
  accessToken: string;
  user: {
    email: string;
    role: Role;
    tenantSlug: string;
  };
};

type CheckinResultData = {
  attendanceId: string;
  memberId: string;
  result: string;
  creditsDeducted: number;
  remainingCredits?: number;
  userPackageId?: string | null;
  warning?: string;
  idempotent: boolean;
};

type CheckinResultPayload = {
  data: CheckinResultData;
};

type LogItem = {
  id: string;
  member_id: string;
  trainer_id: string;
  session_id?: string | null;
  result: string;
  credits_deducted: number;
  created_at: string;
};

type LogPayload = {
  data?: LogItem[];
};

export default function TrainerCheckinPage() {
  const apiBase = getApiBase();

  const [status, setStatus] = useState<"loading" | "ready" | "unauthorized">("loading");
  const [session, setSession] = useState<SessionData | null>(null);
  const [feedback, setFeedback] = useState("");
  const [lastResult, setLastResult] = useState<CheckinResultData | null>(null);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logsMessage, setLogsMessage] = useState("");
  const [busy, setBusy] = useState<"qr" | "manual" | "logs" | null>(null);

  const [qrForm, setQrForm] = useState({
    qr_code: "",
    session_id: "",
  });

  const [manualForm, setManualForm] = useState({
    member_id: "",
    manual_code: "",
    session_id: "",
  });

  useEffect(() => {
    if (!feedback) return;
    const normalized = feedback.toLowerCase();
    if (
      normalized.includes("hata") ||
      normalized.includes("failed") ||
      normalized.includes("unauthorized") ||
      normalized.includes("forbidden")
    ) {
      toast.error(feedback);
      return;
    }
    toast.success(feedback);
  }, [feedback]);

  const { loading: roleLoading, user: authUser } = useRequireRole("TRAINER");

  useEffect(() => {
    if (roleLoading) {
      setStatus("loading");
      return;
    }
    if (!authUser) {
      setStatus("unauthorized");
      return;
    }

    setSession({
      accessToken: "__cookie_session__",
      user: {
        role: authUser.role,
        tenantSlug: authUser.tenantSlug,
        email: authUser.email,
      },
    });
    setStatus("ready");
  }, [authUser, roleLoading]);

  async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
    if (!session?.accessToken) {
      throw new Error("Oturum bulunamadı");
    }

    const res = await fetch(`${apiBase}${path}`, {
      credentials: "include",
      ...init,
      headers: {
        ...(init?.headers || {}),
      },
    });

    const payload = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(payload.error?.message || "İstek başarısız");
    }
    return payload as T;
  }

  async function submitQr() {
    setFeedback("");
    setLogsMessage("");
    setLastResult(null);

    const qrCode = qrForm.qr_code.trim();
    const sessionId = qrForm.session_id.trim();
    if (!qrCode) {
      setFeedback("QR kodu zorunludur.");
      return;
    }

    try {
      setBusy("qr");
      const payload = await apiRequest<CheckinResultPayload>("/trainer/checkin/qr", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          qr_code: qrCode,
          session_id: sessionId || undefined,
        }),
      });
      setLastResult(payload.data);
      setFeedback("QR check-in tamamlandı.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "QR check-in başarısız.");
    } finally {
      setBusy(null);
    }
  }

  async function submitManual() {
    setFeedback("");
    setLogsMessage("");
    setLastResult(null);

    const memberId = manualForm.member_id.trim();
    const manualCode = manualForm.manual_code.trim();
    const sessionId = manualForm.session_id.trim();

    if (!memberId && !manualCode) {
      setFeedback("Üye ID veya manuel kod girmelisiniz.");
      return;
    }

    try {
      setBusy("manual");
      const payload = await apiRequest<CheckinResultPayload>("/trainer/checkin/manual", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          member_id: memberId || undefined,
          manual_code: manualCode || undefined,
          session_id: sessionId || undefined,
        }),
      });
      setLastResult(payload.data);
      setFeedback("Manuel check-in tamamlandı.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Manuel check-in başarısız.");
    } finally {
      setBusy(null);
    }
  }

  async function loadLogs() {
    setLogsMessage("");
    setFeedback("");

    const memberId = manualForm.member_id.trim();
    const query = new URLSearchParams();
    query.set("limit", "20");
    if (memberId) {
      query.set("member_id", memberId);
    }

    try {
      setBusy("logs");
      const payload = await apiRequest<LogPayload>(`/trainer/checkin/logs?${query.toString()}`);
      setLogs(payload.data || []);
      setLogsMessage(`Loglar yüklendi (${(payload.data || []).length})`);
    } catch (error) {
      setLogs([]);
      setLogsMessage(error instanceof Error ? error.message : "Log servisi hazır değil.");
    } finally {
      setBusy(null);
    }
  }

  if (status === "loading") {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <p className="text-sm text-muted-foreground">Oturum kontrol ediliyor...</p>
      </main>
    );
  }
  if (status === "unauthorized") return null;

  return (
    <AppShell>
      <PageHeader
        title="Eğitmen Check-in"
        description="QR veya manuel doğrulama ile üye katılımını kaydedin."
        actions={
          <ActionButton action="refresh" size="sm" onClick={loadLogs} disabled={busy !== null}>
            Son Logları Getir
          </ActionButton>
        }
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Log Sayısı" value={logs.length} tone="sky" icon={<i className="fa-solid fa-clipboard-check" aria-hidden="true" />} />
        <MetricCard label="Son İşlem" value={lastResult?.result || "-"} tone="emerald" icon={<i className="fa-solid fa-bolt" aria-hidden="true" />} />
        <MetricCard label="Kalan Kredi" value={typeof lastResult?.remainingCredits === "number" ? lastResult.remainingCredits : "-"} tone="slate" icon={<i className="fa-solid fa-ticket" aria-hidden="true" />} />
        <MetricCard label="Uyarı" value={lastResult?.warning ? "Var" : "Yok"} tone="amber" icon={<i className="fa-solid fa-triangle-exclamation" aria-hidden="true" />} />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle>QR Check-in</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <FormField label="QR Kod" required hint="Üyenin QR kartındaki kodu okutun veya yapıştırın.">
              <Input
                placeholder="Örn: MEM-ABCD12"
                value={qrForm.qr_code}
                onChange={(e) => setQrForm((prev) => ({ ...prev, qr_code: e.target.value }))}
              />
            </FormField>
            <FormField label="Seans ID (Opsiyonel)" hint="Mevcut seansla eşlemek için doldurabilirsiniz.">
              <Input
                placeholder="Seans ID (opsiyonel)"
                value={qrForm.session_id}
                onChange={(e) => setQrForm((prev) => ({ ...prev, session_id: e.target.value }))}
              />
            </FormField>
            <ActionButton action="approve" onClick={submitQr} disabled={busy !== null}>
              {busy === "qr" ? "Gönderiliyor..." : "QR ile Check-in Yap"}
            </ActionButton>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Manuel Check-in</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <FormField label="Üye ID (Opsiyonel)" hint="Sistem üye ID’si ile check-in başlatır.">
              <Input
                placeholder="Üye ID"
                value={manualForm.member_id}
                onChange={(e) => setManualForm((prev) => ({ ...prev, member_id: e.target.value }))}
              />
            </FormField>
            <FormField label="Manuel Kod (Opsiyonel)" hint="Üye manuel koduyla da doğrulama yapılabilir.">
              <Input
                placeholder="Manuel kod"
                value={manualForm.manual_code}
                onChange={(e) => setManualForm((prev) => ({ ...prev, manual_code: e.target.value }))}
              />
            </FormField>
            <FormField label="Seans ID (Opsiyonel)">
              <Input
                placeholder="Seans ID"
                value={manualForm.session_id}
                onChange={(e) => setManualForm((prev) => ({ ...prev, session_id: e.target.value }))}
              />
            </FormField>
            <ActionButton action="approve" onClick={submitManual} disabled={busy !== null}>
              {busy === "manual" ? "Gönderiliyor..." : "Manuel Check-in Yap"}
            </ActionButton>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr,1fr]">
        <Card className="surface-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Check-in Logları</CardTitle>
            <ActionButton action="refresh" onClick={loadLogs} disabled={busy !== null}>
              {busy === "logs" ? "Yükleniyor..." : "Logları Getir"}
            </ActionButton>
          </CardHeader>
          <CardContent className="grid gap-3">
            {logsMessage ? <p className="text-sm text-muted-foreground">{logsMessage}</p> : null}
            {logs.length === 0 ? (
              <EmptyState
                icon={<i className="fa-solid fa-clipboard-list" aria-hidden="true" />}
                title="Log bulunamadı"
                description="QR ya da manuel check-in işlemi sonrası kayıtlar burada görünür."
              />
            ) : (
              logs.map((log) => (
                <article key={log.id} className="list-row text-sm">
                  <p className="font-medium">{log.result} • {log.credits_deducted} kredi</p>
                  <p className="text-muted-foreground">
                    {log.member_id} | {new Date(log.created_at).toLocaleString("tr-TR")}
                  </p>
                </article>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader>
            <CardTitle>Son Check-in Sonucu</CardTitle>
          </CardHeader>
          <CardContent>
            {!lastResult ? (
              <EmptyState
                icon={<i className="fa-solid fa-circle-info" aria-hidden="true" />}
                title="Henüz işlem yapılmadı"
                description="İlk check-in sonrası sonuç özeti bu kartta görünür."
              />
            ) : (
              <div className="section-band grid gap-2 text-sm">
                <p><strong>Sonuç:</strong> {lastResult.result}</p>
                <p><strong>Kullanılan Kredi:</strong> {lastResult.creditsDeducted}</p>
                {typeof lastResult.remainingCredits === "number" ? <p><strong>Kalan Kredi:</strong> {lastResult.remainingCredits}</p> : null}
                {lastResult.warning ? <p className="text-amber-700"><strong>Uyarı:</strong> {lastResult.warning}</p> : null}
              </div>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
