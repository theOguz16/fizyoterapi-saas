// src/lib/scheduling/calendar-query-keys.ts

export const calendarKeys = {
  all: ["calendar"] as const,

  businessHours: () => [...calendarKeys.all, "business-hours"] as const,

  admin: {
    settings: () => ["admin-settings"] as const,
    settingsCalendar: () => ["admin-settings-calendar"] as const,
    bookings: () => ["admin-bookings-calendar"] as const,
    sessions: () => ["admin-sessions-calendar"] as const,
    workingHours: () => ["admin-working-hours"] as const,
  },

  trainer: {
    today: () => ["trainer-today"] as const,
    todayCalendar: () => ["trainer-today-calendar"] as const,
    bookings: () => ["trainer-bookings-calendar"] as const,
    availabilities: () => ["trainer-availabilities-calendar"] as const,
    groupClasses: () => ["trainer-group-classes"] as const,
  },

  member: {
    home: () => ["member-home"] as const,
    homeV2: () => ["member-home-v2"] as const,
    homeCalendar: () => ["member-home-calendar"] as const,
    bookings: () => ["member-bookings-calendar"] as const,
    availability: () => ["member-availability-calendar"] as const,
  },

  options: {
    salonDays: () => ["salon-day-options"] as const,
    salonTrainers: () => ["salon-trainer-options"] as const,
  },
};

export const businessHoursInvalidates = [
  calendarKeys.businessHours(),

  calendarKeys.admin.settings(),
  calendarKeys.admin.settingsCalendar(),
  calendarKeys.admin.bookings(),
  calendarKeys.admin.sessions(),
  calendarKeys.admin.workingHours(),

  calendarKeys.trainer.today(),
  calendarKeys.trainer.todayCalendar(),
  calendarKeys.trainer.bookings(),
  calendarKeys.trainer.availabilities(),
  calendarKeys.trainer.groupClasses(),

  calendarKeys.member.home(),
  calendarKeys.member.homeV2(),
  calendarKeys.member.homeCalendar(),
  calendarKeys.member.bookings(),
  calendarKeys.member.availability(),

  calendarKeys.options.salonDays(),
  calendarKeys.options.salonTrainers(),

  ["admin-dashboard"],
  ["admin-dashboard-v2"],
  ["public-salons"],
  ["shared-clinics"],
] as const;