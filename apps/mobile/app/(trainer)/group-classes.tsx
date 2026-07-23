import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  createTrainerGroupClassApi,
  deleteTrainerGroupClassApi,
  getTrainerGroupClassFormOptionsApi,
  getTrainerGroupClassesApi,
  updateTrainerGroupClassApi,
  type GroupClassSession,
  type TrainerAssignedPackage,
} from "@/lib/mobile-api";
import { buildSlotStartMinutes, normalizeBusinessHours } from "@/lib/scheduling/business-hours.normalize";
import { formatGroupClassDateTime, formatGroupClassPrice, getGroupClassAudienceLabel, getGroupClassScheduleLabel } from "@/lib/group-classes";
import { showErrorAlert, showInfoAlert } from "@/lib/user-feedback";
import { AppShell } from "@/theme/components/app-shell";
import { SurfaceCard } from "@/theme/components/surface-card";
import { MetricCard } from "@/theme/components/metric-card";
import { ScrollPanel } from "@/theme/components/scroll-panel";
import { ActionButton } from "@/theme/components/action-button";
import { SectionTitle } from "@/theme/components/section-title";
import { FormField } from "@/theme/components/form-field";
import { SelectionChip } from "@/theme/components/selection-chip";
import { AppIcon } from "@/theme/components/app-icon";
import { ConnectivityBanner } from "@/components/connectivity-banner";
import { tokens } from "@/theme/tokens";
import { StatusBadge } from "@/theme/components/status-badge";
import { bookingStatusLabel } from "@/lib/labels";

const AUDIENCE_OPTIONS = [
  { label: "Salondaki herkese açık", value: "SALON_MEMBERS" as const },
  { label: "Sadece davetliler", value: "INVITED_MEMBERS" as const },
];

const SCHEDULE_MODE_OPTIONS = [
  { label: "Tek tarih", value: "SPECIAL" as const },
  { label: "Tekrarlı plan", value: "RECURRING" as const },
];

const DAY_OPTIONS = [
  { value: 1, shortLabel: "Pzt", fullLabel: "Pazartesi" },
  { value: 2, shortLabel: "Sal", fullLabel: "Salı" },
  { value: 3, shortLabel: "Çar", fullLabel: "Çarşamba" },
  { value: 4, shortLabel: "Per", fullLabel: "Perşembe" },
  { value: 5, shortLabel: "Cum", fullLabel: "Cuma" },
  { value: 6, shortLabel: "Cmt", fullLabel: "Cumartesi" },
  { value: 7, shortLabel: "Paz", fullLabel: "Pazar" },
] as const;

type ScheduleMode = "SPECIAL" | "RECURRING";
type PickerType = "date" | "time" | null;

type DateOption = {
  value: string;
  label: string;
  helper: string;
  isoDay: number;
};

type GroupClassFormState = {
  id: string;
  lesson_name: string;
  package_id: string;
  package_title: string;
  lesson_category: string;
  schedule_mode: ScheduleMode;
  date: string;
  time: string;
  recurrence_days: number[];
  price: string;
  capacity: string;
  notification_scope: "SALON_MEMBERS" | "INVITED_MEMBERS";
  invited_member_ids: string[];
};

function formatIsoDateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });
}

function toMinutes(value: string) {
  const [hour, minute] = value.split(":").map((item) => Number(item || 0));
  return hour * 60 + minute;
}

function toIsoDate(date: string, time: string, minutes: number) {
  const [hour, minute] = time.split(":").map((part) => Number(part || 0));
  const start = new Date(`${date}T00:00:00`);
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + minutes * 60 * 1000);
  return {
    starts_at: start.toISOString(),
    ends_at: end.toISOString(),
  };
}

function toLocalDateKey(value?: string | null) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toLocalTimeKey(value?: string | null) {
  const date = new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function buildEmptyForm(): GroupClassFormState {
  return {
    id: "",
    lesson_name: "",
    package_id: "",
    package_title: "",
    lesson_category: "GRUP",
    schedule_mode: "SPECIAL",
    date: "",
    time: "",
    recurrence_days: [],
    price: "",
    capacity: "12",
    notification_scope: "SALON_MEMBERS",
    invited_member_ids: [],
  };
}

function formatCurrencyValue(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Hesaplanamadı";
  return `${value.toLocaleString("tr-TR", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })} TL`;
}

function buildTimeOptions(businessHours: ReturnType<typeof normalizeBusinessHours>) {
  if (!businessHours.start_time || !businessHours.end_time) {
  return [];
}

  const startMinutes = toMinutes(businessHours.start_time);
  const endMinutes = toMinutes(businessHours.end_time);

  const hasLunchBreak = Boolean(businessHours.lunch_break_start && businessHours.lunch_break_end);
  const lunchStartMinutes = hasLunchBreak ? toMinutes(businessHours.lunch_break_start!) : -1;
  const lunchEndMinutes = hasLunchBreak ? toMinutes(businessHours.lunch_break_end!) : -1;
  const slots = buildSlotStartMinutes(
    startMinutes,
    endMinutes,
    Number(businessHours.slot_minutes || 60),
    Number(businessHours.break_duration_minutes || 0)
  );

  return slots
    .filter((slotStart) => {
      const slotEnd = slotStart + Number(businessHours.slot_minutes || 60);
      return !(slotStart < lunchEndMinutes && slotEnd > lunchStartMinutes);
    })
    .map((slotStart) => {
      const slotEnd = slotStart + Number(businessHours.slot_minutes || 60);
      const startHour = String(Math.floor(slotStart / 60)).padStart(2, "0");
      const startMinute = String(slotStart % 60).padStart(2, "0");
      const endHour = String(Math.floor(slotEnd / 60)).padStart(2, "0");
      const endMinute = String(slotEnd % 60).padStart(2, "0");
      return {
        value: `${startHour}:${startMinute}`,
        helper: `${startHour}:${startMinute} - ${endHour}:${endMinute}`,
      };
    });
}

function buildUpcomingWorkingDates(workingDays: number[], count = 21): DateOption[] {
  const rows: DateOption[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0); 

  for (let offset = 0; rows.length < count && offset < 45; offset += 1) {
    const date = new Date(cursor);
    date.setDate(cursor.getDate() + offset);
    const nativeDay = date.getDay();
    const isoDay = nativeDay === 0 ? 7 : nativeDay;
    if (!workingDays.includes(isoDay)) continue;

    // GÜVENLİ FORMATLAMA: toISOString yerine yerel tarihi manuel formatlıyoruz
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const value = `${yyyy}-${mm}-${dd}`;

    rows.push({
      value,
      label: formatIsoDateLabel(value),
      helper: DAY_OPTIONS.find((item) => item.value === isoDay)?.shortLabel || "",
      isoDay,
    });
  }

  return rows;
}

function buildRecurrenceLabel(days: number[]) {
  const uniqueDays = Array.from(new Set(days)).sort((a, b) => a - b);
  const labels = uniqueDays
    .map((day) => DAY_OPTIONS.find((item) => item.value === day)?.fullLabel)
    .filter(Boolean) as string[];

  if (labels.length === 0) return "";
  if (labels.length === 1) return `Her ${labels[0]}`;
  return `Her ${labels.join(", ")}`;
}

function parseRecurrenceDays(label?: string | null) {
  const normalized = String(label || "").toLocaleLowerCase("tr-TR");
  return DAY_OPTIONS.filter((item) => normalized.includes(item.fullLabel.toLocaleLowerCase("tr-TR"))).map((item) => item.value);
}

function getNextDateForWorkingDay(isoDay: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0); 
  const todayIsoDay = date.getDay() === 0 ? 7 : date.getDay();
  const diff = isoDay >= todayIsoDay ? isoDay - todayIsoDay : 7 - todayIsoDay + isoDay;
  date.setDate(date.getDate() + diff);
  
  // GÜVENLİ FORMATLAMA
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  
  return `${yyyy}-${mm}-${dd}`;
}

function sanitizeNumber(value: string) {
  return value.replace(/[^\d]/g, "");
}

function toTestIdSegment(value: string) {
  return String(value || "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function packageDisplayName(pkg?: TrainerAssignedPackage | null) {
  if (!pkg) return "Paket seç";
  return pkg.service_name || pkg.title || pkg.package_name || "Paket seç";
}

export default function TrainerGroupClassesScreen() {
  const [form, setForm] = useState<GroupClassFormState>(buildEmptyForm());
  const [memberQuery, setMemberQuery] = useState("");
  const [activePicker, setActivePicker] = useState<PickerType>(null);

  const groupClassesQuery = useQuery({
    queryKey: ["trainer-group-classes"],
    queryFn: getTrainerGroupClassesApi,
  });
  const formOptionsQuery = useQuery({
    queryKey: ["trainer-group-class-form-options"],
    queryFn: getTrainerGroupClassFormOptionsApi,
  });

  const rows = useMemo(() => (Array.isArray(groupClassesQuery.data) ? groupClassesQuery.data : []), [groupClassesQuery.data]);
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const pendingDelta = Number(String(b.status || "").toUpperCase() === "PENDING") - Number(String(a.status || "").toUpperCase() === "PENDING");
        if (pendingDelta !== 0) return pendingDelta;
        return new Date(b.starts_at || 0).getTime() - new Date(a.starts_at || 0).getTime();
      }),
    [rows]
  );
  const allPackages = Array.isArray(formOptionsQuery.data?.packages) ? formOptionsQuery.data.packages : [];

  const packages = allPackages.filter((pkg) => {
  const lessonMode = String(pkg.lesson_mode || "").toUpperCase();
  const packageType = String(pkg.package_type || "").toUpperCase();
  const capacity = Number(pkg.capacity || 0);

  return lessonMode === "GROUP" || packageType === "GROUP" || capacity > 2;
});
  const members = useMemo(
    () => (Array.isArray(formOptionsQuery.data?.members) ? formOptionsQuery.data.members : []),
    [formOptionsQuery.data?.members]
  );
  const businessHours = useMemo(
    () => normalizeBusinessHours(formOptionsQuery.data?.business_hours),
    [formOptionsQuery.data?.business_hours]
  );
  const timeOptions = useMemo(() => buildTimeOptions(businessHours), [businessHours]);
  const dateOptions = useMemo(() => buildUpcomingWorkingDates(businessHours.working_days, 24), [businessHours.working_days]);
  const occupiedSlotKeys = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach((row) => {
      if (form.id && String(row.id) === form.id) return;
      const dateKey = toLocalDateKey(row.starts_at);
      const timeKey = toLocalTimeKey(row.starts_at);
      if (dateKey && timeKey) {
        keys.add(`${dateKey}T${timeKey}`);
      }
    });
    return keys;
  }, [form.id, rows]);
  const availableTimeOptions = useMemo(
    () => timeOptions.filter((option) => !occupiedSlotKeys.has(`${form.date}T${option.value}`)),
    [form.date, occupiedSlotKeys, timeOptions]
  );
  const workingDayOptions = useMemo(
    () => DAY_OPTIONS.filter((item) => businessHours.working_days.includes(item.value)),
    [businessHours.working_days]
  );
  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === form.package_id) || null,
    [form.package_id, packages]
  );
  const selectedDate = dateOptions.find((item) => item.value === form.date) || null;
  const selectedTime = timeOptions.find((item) => item.value === form.time) || null;
  const pricePerPerson = Number(form.price || selectedPackage?.display_price || 0);
  const capacityValue = Number(form.capacity || selectedPackage?.capacity || 0);
  const trainerCommissionRate = Number(selectedPackage?.trainer_commission_rate || 25);
  const plannedTotalRevenue =
    Number.isFinite(pricePerPerson) && Number.isFinite(capacityValue) ? pricePerPerson * capacityValue : null;
  const trainerPlannedEarning =
    plannedTotalRevenue !== null ? plannedTotalRevenue * (trainerCommissionRate / 100) : null;
  const filteredMembers = useMemo(() => {
    const normalizedQuery = memberQuery.trim().toLocaleLowerCase("tr-TR");
    if (!normalizedQuery) return members;
    return members.filter((member) =>
      [member.full_name, member.email, member.phone]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("tr-TR")
        .includes(normalizedQuery)
    );
  }, [memberQuery, members]);

  useEffect(() => {
    if (!form.package_id && packages.length > 0) {
      const firstPackage = packages[0];
      setForm((prev) => ({
        ...prev,
        package_id: firstPackage.id,
        package_title: packageDisplayName(firstPackage),
        lesson_name: prev.lesson_name || packageDisplayName(firstPackage),
        lesson_category: String(firstPackage.lesson_category || "GRUP"),
        price: prev.price || (firstPackage.display_price ? String(firstPackage.display_price) : ""),
        capacity: prev.capacity === "12" || !prev.capacity ? String(firstPackage.capacity || 12) : prev.capacity,
      }));
    }
  }, [form.package_id, packages]);

  useEffect(() => {
    if ((!form.date || !dateOptions.some((item) => item.value === form.date)) && dateOptions.length > 0) {
      setForm((prev) => ({ ...prev, date: dateOptions[0].value }));
    }
  }, [dateOptions, form.date]);

  useEffect(() => {
    const currentTimeIsAvailable = availableTimeOptions.some((item) => item.value === form.time);
    if ((!form.time || !currentTimeIsAvailable) && availableTimeOptions.length > 0) {
      setForm((prev) => ({ ...prev, time: availableTimeOptions[0].value }));
    }
  }, [availableTimeOptions, form.time]);

  useEffect(() => {
    if (form.recurrence_days.length === 0 && workingDayOptions.length > 0) {
      setForm((prev) => ({ ...prev, recurrence_days: [workingDayOptions[0].value] }));
    }
  }, [form.recurrence_days.length, workingDayOptions]);

  const recurringCount = useMemo(
    () => rows.filter((row) => String(row.recurrence_label || "").trim()).length,
    [rows]
  );
  const specialDateCount = rows.length - recurringCount;

  const saveMutation = useMutation({
  mutationFn: async () => {
    const scheduleMode = form.schedule_mode;
    const recurrenceDays =
      scheduleMode === "RECURRING"
        ? Array.from(new Set(form.recurrence_days)).sort((a, b) => a - b)
        : [];

    const resolvedDate =
      scheduleMode === "SPECIAL"
        ? form.date
        : recurrenceDays.length > 0
          ? getNextDateForWorkingDay(recurrenceDays[0])
          : "";

    if (!form.package_id) {
      throw new Error("Önce paketi seçmelisin.");
    }

    if (!selectedPackage) {
      throw new Error("Seçilen paket bulunamadı.");
    }

    const selectedLessonMode = String(selectedPackage.lesson_mode || "").toUpperCase();
    const selectedPackageType = String(selectedPackage.package_type || "").toUpperCase();
    const selectedCapacity = Number(selectedPackage.capacity || 0);

    if (selectedLessonMode !== "GROUP" && selectedPackageType !== "GROUP" && selectedCapacity <= 2) {
      throw new Error("Grup dersi sadece grup dersine uygun paketlerle açılabilir.");
    }

    if (!resolvedDate) {
      throw new Error(
        scheduleMode === "SPECIAL"
          ? "Grup dersi tarihi seçilmedi."
          : "En az bir çalışma günü seçmelisin."
      );
    }

    if (!form.time) {
      throw new Error("Başlangıç saati seçilmedi.");
    }

    if (!form.capacity.trim() || Number(form.capacity) <= 0) {
      throw new Error("Kontenjan 1 veya daha büyük olmalı.");
    }

    const { starts_at, ends_at } = toIsoDate(
      resolvedDate,
      form.time,
      Number(businessHours.slot_minutes || 60)
    );

    const payload = {
      title: form.lesson_name.trim() || form.package_title || packageDisplayName(selectedPackage),
      starts_at,
      ends_at,
      related_package_id: form.package_id || null,
      lesson_category: form.lesson_category || selectedPackage?.lesson_category || "GRUP",
      price: form.price || null,
      capacity: Number(form.capacity || 0),
      notification_scope: form.notification_scope,
      requires_admin_approval: true,
      invited_member_count:
        form.notification_scope === "INVITED_MEMBERS"
          ? form.invited_member_ids.length
          : 0,
      invited_member_ids:
        form.notification_scope === "INVITED_MEMBERS"
          ? form.invited_member_ids
          : [],
      recurrence_label:
        scheduleMode === "RECURRING" ? buildRecurrenceLabel(recurrenceDays) : null,
      special_date: scheduleMode === "SPECIAL" ? resolvedDate : null,
    };

    if (form.id) {
      return updateTrainerGroupClassApi(form.id, payload);
    }

    return createTrainerGroupClassApi(payload);
  },

  meta: {
    invalidates: [
      ["trainer-group-classes"],
      ["trainer-home-group-classes"],
      ["trainer-bookings"],
      ["trainer-bookings-calendar"],
      ["trainer-today"],
      ["trainer-today-calendar"],

      ["member-group-classes"],
      ["member-home-group-classes"],
      ["member-bookings"],
      ["member-bookings-calendar"],
      ["member-home"],
      ["member-home-v2"],

      ["admin-sessions"],
      ["admin-bookings"],
      ["admin-bookings-calendar"],
      ["admin-dashboard"],
      ["admin-dashboard-v2"],
      ["admin-approvals-v2"],
    ],
  },

  onSuccess: () => {
    const fallbackPackage = selectedPackage || packages[0] || null;

    setForm({
      ...buildEmptyForm(),
      package_id: fallbackPackage?.id || "",
      package_title: packageDisplayName(fallbackPackage),
      lesson_name: packageDisplayName(fallbackPackage),
      lesson_category: String(fallbackPackage?.lesson_category || "GRUP"),
      price: fallbackPackage?.display_price ? String(fallbackPackage.display_price) : "",
      date: dateOptions[0]?.value || "",
      time: timeOptions[0]?.value || "",
      recurrence_days: workingDayOptions[0] ? [workingDayOptions[0].value] : [],
    });

    setMemberQuery("");

    showInfoAlert(
      form.id ? "Güncelleme onaya gönderildi" : "Grup dersi onaya gönderildi",
      form.id
        ? "Değişiklikler admin onayından sonra takvime yansıyacak."
        : "Yeni grup dersi admin onayından sonra takvime yansıyacak."
    );
  },

  onError: (error: unknown) => {
    showErrorAlert(
      "Grup dersi kaydedilemedi",
      error,
      "Takvim ve davet ayarları kaydedilirken hata oluştu."
    );
  },
});

  const deleteMutation = useMutation({
  mutationFn: (id: string) => deleteTrainerGroupClassApi(id),

  meta: {
    invalidates: [
      ["trainer-group-classes"],
      ["trainer-home-group-classes"],
      ["trainer-bookings"],
      ["trainer-bookings-calendar"],
      ["trainer-today"],
      ["trainer-today-calendar"],

      ["member-group-classes"],
      ["member-home-group-classes"],
      ["member-bookings"],
      ["member-bookings-calendar"],
      ["member-home"],
      ["member-home-v2"],
      ["member-my-packages-list"],

      ["admin-sessions"],
      ["admin-bookings"],
      ["admin-bookings-calendar"],
      ["admin-dashboard"],
      ["admin-dashboard-v2"],
      ["admin-approvals-v2"],
    ],
  },

  onSuccess: () => {
    showInfoAlert(
      "Silme talebi gönderildi",
      "Eğitmen silmek istiyor talebi admin onayına gönderildi. Admin onaylayana kadar ders aktif kalır."
    );
  },

  onError: (error: unknown) => {
    showErrorAlert(
      "Grup dersi silinemedi",
      error,
      "Seans silinirken hata oluştu."
    );
  },
});

  function startEditing(row: GroupClassSession) {
    const startsAt = new Date(row.starts_at);
    const date = row.special_date || row.starts_at.slice(0, 10);
    const parsedRecurrenceDays = parseRecurrenceDays(row.recurrence_label);
    const fallbackRecurrenceDay = (() => {
      const nativeDay = startsAt.getDay();
      return nativeDay === 0 ? 7 : nativeDay;
    })();

    setForm({
      id: row.id,
      lesson_name: row.lesson_name || row.title || "",
      package_id: String(row.related_package_id || ""),
      package_title: packageDisplayName(packages.find((item) => item.id === row.related_package_id) || null),
      lesson_category: String(row.lesson_category || packages.find((item) => item.id === row.related_package_id)?.lesson_category || "GRUP"),
      schedule_mode: row.recurrence_label ? "RECURRING" : "SPECIAL",
      date,
      time: startsAt.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      recurrence_days: parsedRecurrenceDays.length > 0 ? parsedRecurrenceDays : [fallbackRecurrenceDay],
      price: row.price === null || row.price === undefined ? "" : String(row.price),
      capacity: String(row.capacity || ""),
      notification_scope: row.notification_scope || "SALON_MEMBERS",
      invited_member_ids: Array.isArray(row.invited_member_ids) ? row.invited_member_ids : [],
    });
  }

function confirmDelete(row: GroupClassSession) {
  const lessonName = row.lesson_name || row.title || "bu grup dersi";

  if (process.env.EXPO_PUBLIC_E2E_MODE === "1") {
    deleteMutation.mutate(String(row.id));
    return;
  }

  Alert.alert(
    "Grup dersini silmek istiyor musun?",
    `${lessonName} için silme talebi admin onayına gönderilecek. Onaylanmadan ders kalıcı olarak kaldırılmaz.`,
    [
      {
        text: "Vazgeç",
        style: "cancel",
      },
      {
        text: "Silme talebi gönder",
        style: "destructive",
        onPress: () => deleteMutation.mutate(String(row.id)),
      },
    ]
  );
}

  function toggleInvitedMember(memberId: string) {
    setForm((prev) => ({
      ...prev,
      invited_member_ids: prev.invited_member_ids.includes(memberId)
        ? prev.invited_member_ids.filter((row) => row !== memberId)
        : [...prev.invited_member_ids, memberId],
    }));
  }

  function toggleRecurrenceDay(day: number) {
    setForm((prev) => {
      const nextDays = prev.recurrence_days.includes(day)
        ? prev.recurrence_days.filter((item) => item !== day)
        : [...prev.recurrence_days, day].sort((a, b) => a - b);
      return {
        ...prev,
        recurrence_days: nextDays.length > 0 ? nextDays : prev.recurrence_days,
      };
    });
  }

  return (
    <>
      <AppShell
        title="Grup dersleri"
        subtitle="Takvimi çalışma günlerine göre seç, uygun paketi bağla ve salon üyelerini davet panelinden yönet."
        icon="calendar"
        refreshing={groupClassesQuery.isRefetching || formOptionsQuery.isRefetching}
        onRefresh={() => {
          void groupClassesQuery.refetch();
          void formOptionsQuery.refetch();
        }}
        showBackButton
      >
        <View style={styles.metricsRow}>
          <View style={styles.metricCell}>
            <MetricCard label="Tekrarlı" value={recurringCount} hint="Rutin plan" icon="clock" />
          </View>
          <View style={styles.metricCell}>
            <MetricCard label="Özel tarih" value={specialDateCount} hint="Tek seferlik" icon="today" />
          </View>
        </View>

        <SurfaceCard>
          <SectionTitle
            title={form.id ? "Grup dersini güncelle" : "İçerik ve paket"}
            subtitle="Grup dersi hangi paketle açılacaksa onu seç. Toplam ücret ve eğitmen payı aşağıda otomatik hesaplanır."
          />
          <FormField
            label="Ders adı"
            inputId="trainer-group-classes-name-input"
            value={form.lesson_name}
            onChangeText={(value) => setForm((prev) => ({ ...prev, lesson_name: value }))}
            placeholder="Örn. Akşam Reformer Grubu"
          />
          <Text style={styles.label}>Paket seç</Text>
          {packages.length === 0 ? (
          <Text style={styles.helperText}>
            Grup dersi açmaya uygun paket bulunmuyor. Admin panelinden GROUP olan bir paket oluşturmalısın.
          </Text>
        ) : null}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {packages.map((option) => {
              const active = form.package_id === option.id;
              return (
                <Pressable
                  key={option.id}
                  testID={`trainer-group-classes-package-${option.id}`}
                  onPress={() =>
                    setForm((prev) => ({
                      ...prev,
                      package_id: option.id,
                      package_title: packageDisplayName(option),
                      lesson_name:
                        !prev.lesson_name || prev.lesson_name === prev.package_title || prev.lesson_name === packageDisplayName(selectedPackage)
                          ? packageDisplayName(option)
                          : prev.lesson_name,
                      lesson_category: String(option.lesson_category || prev.lesson_category || "GRUP"),
                      price:
                        !prev.price || prev.price === String(selectedPackage?.display_price || "")
                          ? option.display_price
                            ? String(option.display_price)
                            : ""
                          : prev.price,
                      capacity: String(option.capacity || prev.capacity || 12),
                    }))
                  }
                  style={[styles.packageCard, active ? styles.packageCardActive : null]}
                >
                  <Text style={[styles.packageTitle, active ? styles.packageTitleActive : null]}>{packageDisplayName(option)}</Text>
                  <Text style={[styles.packageMeta, active ? styles.packageMetaActive : null]}>
                    {option.lesson_category_label || option.lesson_category || "Grup"} • {formatGroupClassPrice(option.display_price)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </SurfaceCard>

        <SurfaceCard>
          <SectionTitle
            title="Takvim seçimi"
            subtitle="Salonun çalıştığı günlerden ve saat bloklarından seç. Manuel tarih/saat girişi yok."
          />
          <Text style={styles.label}>Plan tipi</Text>
          <View style={styles.chips}>
            {SCHEDULE_MODE_OPTIONS.map((option) => (
              <SelectionChip
                key={option.value}
                testID={`trainer-group-classes-schedule-mode-${option.value.toLocaleLowerCase("en-US")}`}
                label={option.label}
                active={form.schedule_mode === option.value}
                onPress={() => setForm((prev) => ({ ...prev, schedule_mode: option.value }))}
              />
            ))}
          </View>

          {form.schedule_mode === "SPECIAL" ? (
            <PickerField
              label="Tarih"
              testID="trainer-group-classes-date-picker"
              value={selectedDate?.label || "Takvimden tarih seç"}
              helper="Salonun açık olduğu tarihler gösterilir."
              onPress={() => setActivePicker("date")}
            />
          ) : (
            <>
              <Text style={styles.label}>Tekrarlanan günler</Text>
              <View style={styles.chips}>
                {workingDayOptions.map((option) => (
                  <SelectionChip
                    key={option.value}
                    testID={`trainer-group-classes-recurrence-day-${option.value}`}
                    label={option.shortLabel}
                    active={form.recurrence_days.includes(option.value)}
                    onPress={() => toggleRecurrenceDay(option.value)}
                  />
                ))}
              </View>
              <Text style={styles.helperText}>
                {buildRecurrenceLabel(form.recurrence_days) || "En az bir çalışma günü seç."}
              </Text>
            </>
          )}

          <PickerField
            label="Başlangıç saati"
            testID="trainer-group-classes-time-picker"
            value={selectedTime?.helper || "Saat bloğu seç"}
            helper={
              availableTimeOptions.length > 0
                ? "Dolu saatler gizlenir; yalnız uygun bloklar listelenir."
                : "Bu tarihte uygun saat kalmadı. Farklı bir tarih seç."
            }
            onPress={() => setActivePicker("time")}
          />

            <View style={styles.inline}>
              <FormField
              label="Kişi başı ücret"
              value={form.price}
              onChangeText={(value) => setForm((prev) => ({ ...prev, price: sanitizeNumber(value) }))}
              placeholder="200"
              keyboardType="number-pad"
            />
            <FormField
              inputId="trainer-group-classes-capacity-input"
              label="Kontenjan"
              value={form.capacity}
              onChangeText={(value) => setForm((prev) => ({ ...prev, capacity: sanitizeNumber(value) }))}
              placeholder="12"
              keyboardType="number-pad"
            />
          </View>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>Toplam tahsilat</Text>
              <Text style={styles.summaryValue}>{formatCurrencyValue(plannedTotalRevenue)}</Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryLabel}>Eğitmen payı</Text>
              <Text style={styles.summaryValue}>
                {formatCurrencyValue(trainerPlannedEarning)} • %{trainerCommissionRate.toFixed(0)}
              </Text>
            </View>
          </View>
        </SurfaceCard>

        <SurfaceCard>
          <SectionTitle
            title="Davet ve görünürlük"
            subtitle="Admin onayı her zaman zorunlu. Açık ders ya da davetli akışında salon kullanıcılarını buradan yönetebilirsin."
          />
          <Text style={styles.label}>Bildirim kapsamı</Text>
          <View style={styles.chips}>
            {AUDIENCE_OPTIONS.map((option) => (
              <SelectionChip
                key={option.value}
                testID={`trainer-group-classes-audience-${option.value.toLocaleLowerCase("en-US")}`}
                label={option.label}
                active={form.notification_scope === option.value}
                onPress={() => setForm((prev) => ({ ...prev, notification_scope: option.value }))}
              />
            ))}
          </View>

          {form.notification_scope === "INVITED_MEMBERS" ? (
            <>
              <FormField
                label="Salon üyesi ara"
                inputId="trainer-group-classes-member-search"
                value={memberQuery}
                onChangeText={setMemberQuery}
                placeholder="İsim, e-posta veya telefon"
              />
              <Text style={styles.helperText}>
                Seçili davetli: {form.invited_member_ids.length} / {members.length}
              </Text>
              <ScrollPanel  maxHeight={320}>
                <View style={styles.memberList}>
                  {filteredMembers.map((member) => {
                    const selected = form.invited_member_ids.includes(member.id);
                    return (
                      <View key={member.id} style={[styles.memberRow, selected ? styles.memberRowSelected : null]}>
                        <View style={styles.memberContent}>
                          <Text style={styles.memberName}>{member.full_name || member.email || "Salon üyesi"}</Text>
                          <Text style={styles.memberMeta}>
                            {[member.email, member.phone].filter(Boolean).join(" • ") || "İletişim bilgisi yok"}
                          </Text>
                        </View>
                        <Pressable
                          testID={`trainer-group-classes-member-toggle-${toTestIdSegment(member.email || member.full_name || member.id)}`}
                          onPress={() => toggleInvitedMember(member.id)}
                          style={[styles.memberAction, selected ? styles.memberActionSelected : null]}
                        >
                          <Text style={[styles.memberActionLabel, selected ? styles.memberActionLabelSelected : null]}>
                            {selected ? "-" : "+"}
                          </Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </ScrollPanel>
            </>
          ) : (
            <Text style={styles.helperText}>
              Bu ders yayınlandığında salondaki uygun üyeler açık sınıf olarak görebilir.
            </Text>
          )}

          <View style={styles.actions}>
            <ActionButton
              testID="trainer-group-classes-submit"
              label={form.id ? "Güncellemeyi kaydet" : "Grup dersini aç"}
              icon="calendar"
              onPress={() => saveMutation.mutate()}
              loading={saveMutation.isPending}
            />
            {form.id ? (
              <ActionButton
                label="Yeni kayıt başlat"
                icon="notes"
                variant="ghost"
                onPress={() =>
                  setForm({
                    ...buildEmptyForm(),
                    package_id: packages[0]?.id || "",
                    package_title: packageDisplayName(packages[0] || null),
                    lesson_name: packageDisplayName(packages[0] || null),
                    lesson_category: String(packages[0]?.lesson_category || "GRUP"),
                    price: packages[0]?.display_price ? String(packages[0].display_price) : "",
                    date: dateOptions[0]?.value || "",
                    time: timeOptions[0]?.value || "",
                    recurrence_days: workingDayOptions[0] ? [workingDayOptions[0].value] : [],
                  })
                }
              />
            ) : null}
          </View>
        </SurfaceCard>

        <SurfaceCard>
          <SectionTitle title="Aktif kayıtlar" subtitle="Gerçek grup ders kayıtlarını düzenle, yayını ve davet kurgusunu güncelle." />
          {sortedRows.length === 0 ? (
            <Text style={styles.empty}>Henüz açılmış grup dersi görünmüyor.</Text>
          ) : (
            <ScrollPanel testID="trainer-group-classes-list" maxHeight={460}>
              {sortedRows.map((row) => (
                <SurfaceCard key={row.id} tone="default">
                  {/* BAŞLIK VE DURUM ROZETİ YAN YANA */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                   <Text 
                    testID={`trainer-group-classes-item-${toTestIdSegment(row.lesson_name || row.title || row.id)}`}
                    style={[styles.title, { flex: 1 }]}
                  >
                    {row.lesson_name || row.title || "Grup dersi"}
                  </Text>
                    <StatusBadge 
                     label={
                      row.status === "PENDING"
                        ? "Onay bekliyor"
                        : row.status === "SCHEDULED"
                          ? "Yayında"
                          : bookingStatusLabel(row.status)
                    }
                      tone={row.status === "PENDING" ? "warning" : row.status === "SCHEDULED" ? "success" : "danger"} 
                    />
                  </View>      
                  <Text style={styles.copy}>{formatGroupClassDateTime(row.starts_at)}</Text>
                  <Text style={styles.copy}>Plan: {getGroupClassScheduleLabel(row)}</Text>
                  <Text style={styles.copy}>Paket: {row.package_title || packages.find((item) => item.id === row.related_package_id)?.title || "Bağlı paket yok"}</Text>
                  <Text style={styles.copy}>Bildirim: {getGroupClassAudienceLabel(row.notification_scope)}</Text>
                  <Text style={styles.copy}>Kişi başı ücret: {formatGroupClassPrice(row.price)}</Text>
                  <Text style={styles.copy}>Toplam tahsilat: {formatCurrencyValue(Number(row.planned_total_revenue || 0))}</Text>
                  <Text style={styles.copy}>
                    Eğitmen payı: {formatCurrencyValue(Number(row.trainer_planned_earning || 0))} • %{Number(row.trainer_commission_rate || 25).toFixed(0)}
                  </Text>
                  <Text style={styles.copy}>Davetli: {Number(row.invited_member_count || 0)} • Katılan: {Number(row.joined_member_count || 0)}</Text>
                  <Text style={styles.hint}>Katılım ve ücret kesinleştirme admin onayıyla tamamlanır.</Text>
                  <View style={styles.actions}>
                    <ActionButton
                      testID={`trainer-group-classes-edit-${toTestIdSegment(row.lesson_name || row.title || row.id)}`}
                      label="Düzenle"
                      icon="notes"
                      variant="ghost"
                      onPress={() => startEditing(row)}
                    />
                    <ActionButton
                      testID={`trainer-group-classes-delete-${toTestIdSegment(row.lesson_name || row.title || row.id)}`}
                      label="Sil"
                      icon="risk"
                      variant="danger"
                      onPress={() => confirmDelete(row)}
                      loading={deleteMutation.isPending}
                    />
                  </View>
                </SurfaceCard>
              ))}
            </ScrollPanel>
          )}
        </SurfaceCard>
      </AppShell>

      <SelectionSheet
        visible={activePicker === "date"}
        testIDPrefix="trainer-group-classes-date-option"
        title="Tarih seç"
        subtitle="Salonun çalıştığı günlerden birini seç."
        onClose={() => setActivePicker(null)}
        rows={dateOptions.map((option) => ({
          key: option.value,
          label: option.label,
          helper: option.helper,
          active: form.date === option.value,
          onPress: () => {
            setForm((prev) => ({ ...prev, date: option.value }));
            setActivePicker(null);
          },
        }))}
      />

      <SelectionSheet
        visible={activePicker === "time"}
        testIDPrefix="trainer-group-classes-time-option"
        title="Saat seç"
        subtitle="Çalışma saatlerine uygun slotlardan seçim yap."
        onClose={() => setActivePicker(null)}
        rows={availableTimeOptions.map((option) => ({
          key: option.value,
          label: option.helper,
          helper: "",
          active: form.time === option.value,
          onPress: () => {
            setForm((prev) => ({ ...prev, time: option.value }));
            setActivePicker(null);
          },
        }))}
      />
    </>
  );
}

function PickerField({
  label,
  testID,
  value,
  helper,
  onPress,
}: {
  label: string;
  testID?: string;
  value: string;
  helper: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        testID={testID}
        onPress={onPress}
        style={({ pressed }) => [styles.pickerField, pressed ? styles.pickerFieldPressed : null]}
      >
        <View style={styles.pickerFieldContent}>
          <Text style={styles.pickerFieldValue}>{value}</Text>
          <Text style={styles.pickerFieldHelper}>{helper}</Text>
        </View>
        <AppIcon name="arrow-right" size="sm" tone="neutral" variant="plain" />
      </Pressable>
    </View>
  );
}

function SelectionSheet({
  visible,
  testIDPrefix,
  title,
  subtitle,
  onClose,
  rows,
}: {
  visible: boolean;
  testIDPrefix: string;
  title: string;
  subtitle: string;
  onClose: () => void;
  rows: Array<{ key: string; label: string; helper: string; active: boolean; onPress: () => void }>;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheetSafe}>
        <View style={styles.sheetHeader}>
          <Pressable onPress={onClose} style={styles.sheetClose}>
            <AppIcon name="arrow-left" size="sm" tone="neutral" variant="plain" />
          </Pressable>
          <View style={styles.sheetTitleWrap}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Text style={styles.sheetSubtitle}>{subtitle}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.sheetList}>
          {rows.map((row, index) => (
            <Pressable
              key={row.key}
              testID={`${testIDPrefix}-${index}`}
              onPress={row.onPress}
              style={({ pressed }) => [styles.sheetRow, row.active ? styles.sheetRowActive : null, pressed ? styles.sheetRowPressed : null]}
            >
              <View style={styles.sheetRowContent}>
                <Text style={[styles.sheetRowLabel, row.active ? styles.sheetRowLabelActive : null]}>{row.label}</Text>
                {row.helper ? <Text style={[styles.sheetRowHelper, row.active ? styles.sheetRowHelperActive : null]}>{row.helper}</Text> : null}
              </View>
              <Text style={[styles.sheetRowCheck, row.active ? styles.sheetRowCheckActive : null]}>{row.active ? "Seçili" : "Seç"}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <ConnectivityBanner />
    </Modal>
  );
}

const styles = StyleSheet.create({
  metricsRow: {
    flexDirection: "row",
    gap: tokens.spacing.xs,
  },
  metricCell: {
    flex: 1,
    minWidth: 0,
  },
  summaryGrid: {
    gap: tokens.spacing.sm,
  },
  summaryPill: {
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceRaised,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  summaryLabel: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
    marginBottom: 4,
  },
  summaryValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  inline: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    alignItems: "flex-start",
  },
  label: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  helperText: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    lineHeight: 18,
    fontFamily: tokens.fontFamily.regular,
  },
  chips: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    flexWrap: "wrap",
  },
  packageCard: {
    width: 220,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceRaised,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    gap: 6,
  },
  packageCardActive: {
    borderColor: tokens.colors.primaryStrong,
    backgroundColor: tokens.colors.primarySoft,
  },
  packageTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  packageTitleActive: {
    color: tokens.colors.primaryStrong,
  },
  packageMeta: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  packageMetaActive: {
    color: tokens.colors.primaryStrong,
  },
  fieldWrap: {
    gap: tokens.spacing.xs + 2,
  },
  fieldLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.semibold,
  },
  pickerField: {
    minHeight: 56,
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceRaised,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
    ...tokens.shadow.soft,
  },
  pickerFieldPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.995 }],
  },
  pickerFieldContent: {
    flex: 1,
    gap: 4,
  },
  pickerFieldValue: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  pickerFieldHelper: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  memberList: {
    gap: tokens.spacing.sm,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceRaised,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  memberRowSelected: {
    borderColor: tokens.colors.primaryStrong,
    backgroundColor: tokens.colors.primarySoft,
  },
  memberContent: {
    flex: 1,
    gap: 4,
  },
  memberName: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  memberMeta: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  memberAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.surfaceSoft,
  },
  memberActionSelected: {
    borderColor: tokens.colors.primaryStrong,
    backgroundColor: tokens.colors.primary,
  },
  memberActionLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.bold,
  },
  memberActionLabelSelected: {
    color: "#FFFFFF",
  },
  actions: {
    gap: tokens.spacing.sm,
  },
  title: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.semibold,
  },
  copy: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.regular,
  },
  hint: {
    color: tokens.colors.primaryStrong,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.medium,
  },
  empty: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.regular,
  },
  sheetSafe: {
    flex: 1,
    backgroundColor: tokens.colors.background,
    paddingTop: tokens.spacing.xl,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.md,
  },
  sheetClose: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: tokens.colors.surfaceRaised,
  },
  sheetTitleWrap: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    color: tokens.colors.text,
    fontSize: tokens.font.lg,
    fontFamily: tokens.fontFamily.semibold,
  },
  sheetSubtitle: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.sm,
    fontFamily: tokens.fontFamily.regular,
  },
  sheetList: {
    paddingHorizontal: tokens.spacing.lg,
    paddingBottom: tokens.spacing.xxl,
    gap: tokens.spacing.sm,
  },
  sheetRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacing.md,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    backgroundColor: tokens.colors.surfaceRaised,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  sheetRowActive: {
    borderColor: tokens.colors.primaryStrong,
    backgroundColor: tokens.colors.primarySoft,
  },
  sheetRowPressed: {
    opacity: 0.96,
  },
  sheetRowContent: {
    flex: 1,
    gap: 4,
  },
  sheetRowLabel: {
    color: tokens.colors.text,
    fontSize: tokens.font.md,
    fontFamily: tokens.fontFamily.semibold,
  },
  sheetRowLabelActive: {
    color: tokens.colors.primaryStrong,
  },
  sheetRowHelper: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.regular,
  },
  sheetRowHelperActive: {
    color: tokens.colors.primaryStrong,
  },
  sheetRowCheck: {
    color: tokens.colors.textMuted,
    fontSize: tokens.font.xs,
    fontFamily: tokens.fontFamily.semibold,
  },
  sheetRowCheckActive: {
    color: tokens.colors.primaryStrong,
  },
});
