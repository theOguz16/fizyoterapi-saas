// Mobile API account domain endpointleri.
import { httpRequest } from "../http-client";
import type { SessionEnvelope } from "./types";

export async function getMyClinicRequestApi() {
  return httpRequest<SessionEnvelope["managed_clinic"] | null>("/account/clinic-request");
}

export async function createClinicRequestApi(payload: {
  clinic_name: string;
  city: string;
  district: string;
  phone: string;
  about_text?: string;
  owner_is_practitioner?: boolean;
}) {
  return httpRequest<SessionEnvelope["managed_clinic"]>("/account/clinic-request", {
    method: "POST",
    body: payload,
  });
}
