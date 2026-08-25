export type InAppNoticeTone = "success" | "info";

export type InAppNotice = {
  id: number;
  title: string;
  message: string;
  tone: InAppNoticeTone;
  durationMs: number;
  testID?: string;
};

type InAppNoticeListener = (notice: InAppNotice) => void;

const listeners = new Set<InAppNoticeListener>();
let noticeId = 0;

export function publishInAppNotice(
  title: string,
  message: string,
  tone: InAppNoticeTone = "success",
  durationMs = 3600,
  testID?: string
) {
  const notice: InAppNotice = {
    id: ++noticeId,
    title,
    message,
    tone,
    durationMs,
    testID,
  };

  listeners.forEach((listener) => listener(notice));
}

export function subscribeToInAppNotices(listener: InAppNoticeListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
