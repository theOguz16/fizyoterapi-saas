"use client";

import { useMemo, useRef, type ReactNode } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import trLocale from "@fullcalendar/core/locales/tr";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import styles from "../../trainer/bookings/trainer-booking-calendar.module.css";

export default function AdminCombinedBookingCalendar({
  calendarLoading,
  weekLabel,
  startTime,
  endTime,
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
  slotMinutes: number;
  slotDurationText: string;
  businessHours: Array<{ daysOfWeek: number[]; startTime: string; endTime: string }>;
  calendarEvents: EventInput[];
  openBookingDetail: (info: EventClickArg) => void;
  renderEventContent: (arg: { event: { title: string; start: Date | null; end: Date | null; extendedProps: Record<string, unknown> } }) => ReactNode;
  handleDatesSet: (info: { start: Date; end: Date; view: { title: string } }) => void;
}) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const calendarHeightPx = useMemo(() => {
    const toMinutes = (value: string) => {
      const [hour, minute] = value.split(":").map((part) => Number(part) || 0);
      return hour * 60 + minute;
    };

    const safeSlotMinutes = Math.max(15, slotMinutes || 60);
    const visibleMinutes = Math.max(safeSlotMinutes, toMinutes(endTime) - toMinutes(startTime));
    const slotCount = Math.max(1, Math.ceil(visibleMinutes / safeSlotMinutes));

    return Math.min(1080, Math.max(620, 148 + slotCount * 44));
  }, [endTime, slotMinutes, startTime]);

  const cardHeightPx = useMemo(() => calendarHeightPx + 112, [calendarHeightPx]);

  return (
    <Card className={`surface-card ${styles.calendarCard} flex flex-col`} style={{ minHeight: `${cardHeightPx}px` }}>
      <CardHeader className="border-b border-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Birleşik Haftalık Takvim</CardTitle>
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
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-[420px] w-full" />
          </div>
        ) : null}
        <div className={`min-h-0 flex-1 ${calendarLoading ? "pointer-events-none opacity-60" : ""}`}>
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin]}
            locale={trLocale}
            initialView="timeGridWeek"
            headerToolbar={false}
            allDaySlot={false}
            nowIndicator
            height="100%"
            expandRows
            firstDay={1}
            hiddenDays={[]}
            dayHeaderFormat={{ weekday: "short", day: "2-digit", month: "2-digit" }}
            slotMinTime={`${startTime}:00`}
            slotMaxTime={`${endTime}:00`}
            slotDuration={slotDurationText}
            snapDuration={slotDurationText}
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            businessHours={businessHours}
            editable={false}
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
