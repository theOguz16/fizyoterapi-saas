// Mobile API analytics domain endpointleri.
import { httpRequest } from "../http-client";
import type { ProductEventPayload } from "./types";

export async function submitProductEventApi(payload: ProductEventPayload, authenticated: boolean) {
  return httpRequest<{ accepted: boolean }>(authenticated ? "/mobile/product-events" : "/public/product-events", {
    method: "POST",
    body: payload,
    auth: authenticated,
  });
}
