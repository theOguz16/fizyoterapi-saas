export type ClinicActivationCompletedStep = "clinic" | "package" | "working_hours" | "qr";

const NEXT_ROUTES = {
  clinic: "/(admin)/packages",
  package: "/(admin)/working-hours",
  working_hours: "/(admin)/clinic-qr",
  qr: "/(admin)/subscription",
} as const;

export function isClinicActivationFlow(value?: string | string[] | null) {
  return (Array.isArray(value) ? value[0] : value) === "1";
}

export function getClinicActivationNextRoute(step: ClinicActivationCompletedStep) {
  return {
    pathname: NEXT_ROUTES[step],
    params: {
      activation: "1",
      backTo: "/(admin)/dashboard",
    },
  } as const;
}
