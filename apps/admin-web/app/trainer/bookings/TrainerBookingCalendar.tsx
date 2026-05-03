"use client";

import { useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import trLocale from "@fullcalendar/core/locales/tr";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./trainer-booking-calendar.module.css";

export default function TrainerBookingCalendar({
  calendarLoading,
  weekLabel,
  startTime,
  endTime,
  lunchStart,
  lunchEnd,
  workingDays,
  slotMinutes,
  slotDurationText,
  businessHours,
  calendarEvents,
  openBookingDetail,
  renderEventContent,
  handleDatesSet,
}: {
  calendarLoading: boolean;
  weekLabel: string;
  startTime: string;
  endTime: string;
  lunchStart: string;
  lunchEnd: string;
  workingDays: number[];
  slotMinutes: number;
  slotDurationText: string;
  businessHours: Array<{ daysOfWeek: number[]; startTime: string; endTime: string }>;
  calendarEvents: EventInput[];
  openBookingDetail: (info: EventClickArg) => void;
  renderEventContent: (arg: { event: { title: string; start: Date | null; end: Date | null; extendedProps?: Record<string, unknown> } }) => React.ReactNode;
  handleDatesSet: (info: { start: Date; end: Date; view: { title: string } }) => void;
}) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const workingDaySet = useMemo(() => new Set(workingDays), [workingDays]);

  const calendarHeightPx = useMemo(() => {
    const toMinutes = (value: string) => {
      const [hour, minute] = value.split(":").map((part) => Number(part) || 0);
      return hour * 60 + minute;
    };

    const safeSlotMinutes = Math.max(15, slotMinutes || 60);
    const visibleMinutes = Math.max(safeSlotMinutes, toMinutes(endTime) - toMinutes(startTime));
    const slotCount = Math.max(1, Math.ceil(visibleMinutes / safeSlotMinutes));

    return Math.min(920, Math.max(280, 124 + slotCount * 36));
  }, [endTime, slotMinutes, startTime]);

  const cardHeightPx = useMemo(() => calendarHeightPx + 112, [calendarHeightPx]);
  const lunchStartMinutes = useMemo(() => {
    const [hour, minute] = lunchStart.split(":").map((part) => Number(part) || 0);
    return hour * 60 + minute;
  }, [lunchStart]);
  const lunchEndMinutes = useMemo(() => {
    const [hour, minute] = lunchEnd.split(":").map((part) => Number(part) || 0);
    return hour * 60 + minute;
  }, [lunchEnd]);

  function isWorkingDay(date: Date) {
    return workingDaySet.has(date.getDay());
  }

  function isLunchRange(date: Date) {
    const totalMinutes = date.getHours() * 60 + date.getMinutes();
    return lunchStartMinutes < lunchEndMinutes && totalMinutes >= lunchStartMinutes && totalMinutes < lunchEndMinutes;
  }

  return (
    <Card
      id="weekly-booking-calendar"
      className={`surface-card ${styles.calendarCard} flex h-full flex-col`}
      style={{ minHeight: `${cardHeightPx}px` }}
    >
      <CardHeader className="border-b border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Haftalık Takvim</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{weekLabel || "Takvim yükleniyor..."}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => calendarRef.current?.getApi().prev()}
              aria-label="Geçmiş haftaya git"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => calendarRef.current?.getApi().today()}>
              Bu Hafta
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => calendarRef.current?.getApi().next()}
              aria-label="Gelecek haftaya git"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-4 pb-4 pt-3 sm:px-5">
        {calendarLoading ? (
          <div className="mb-2 grid gap-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-[420px] w-full" />
          </div>
        ) : null}
        <div className={`min-h-0 flex-1 ${calendarLoading ? "pointer-events-none opacity-60" : ""}`}>
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, interactionPlugin]}
            locale={trLocale}
            initialView="timeGridWeek"
            headerToolbar={false}
            allDaySlot={false}
            nowIndicator
            droppable={false}
            selectable={false}
            height="100%"
            expandRows
            firstDay={1}
            hiddenDays={[]}
            dayHeaderClassNames={(arg) => (isWorkingDay(arg.date) ? [styles.dayHeaderOpen] : [styles.dayHeaderClosed])}
            dayCellClassNames={(arg) => (isWorkingDay(arg.date) ? [styles.dayColumnOpen] : [styles.dayColumnClosed])}
            dayHeaderContent={(arg) => (
              <div className={styles.dayHeaderContent}>
                <span>{arg.date.toLocaleDateString("tr-TR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                {!isWorkingDay(arg.date) ? <span className={styles.dayHeaderBadge}>Kapalı</span> : null}
              </div>
            )}
            slotMinTime={`${startTime}:00`}
            slotMaxTime={`${endTime}:00`}
            slotDuration={slotDurationText}
            snapDuration={slotDurationText}
            slotLaneClassNames={(arg) => {
              const date = arg.date;
              if (!date) return [];
              if (!isWorkingDay(date)) return [styles.slotLaneClosed];
              if (isLunchRange(date)) return [styles.slotLaneLunch];
              return [styles.slotLaneOpen];
            }}
            slotLabelContent={(arg) => {
              const date = arg.date;
              if (!date) return null;
              const label = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
              const isLunchStart = isWorkingDay(date) && date.getHours() * 60 + date.getMinutes() === lunchStartMinutes;
              return (
                <div className={styles.slotLabelWrap}>
                  <span>{label}</span>
                  {isLunchStart ? <span className={styles.slotLunchBadge}>Öğle Arası</span> : null}
                </div>
              );
            }}
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            businessHours={businessHours}
            editable={false}
            eventDrop={() => undefined}
            eventResize={() => undefined}
            eventClick={openBookingDetail}
            eventContent={renderEventContent}
            datesSet={handleDatesSet}
            events={calendarEvents}
            buttonText={{ today: "Bugün" }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
