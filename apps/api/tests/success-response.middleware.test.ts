import { describe, expect, it, vi } from "vitest";
import { RESPONSE_ENVELOPE_HEADER, successResponseEnvelope } from "../middlewares/success-response.middleware";

function createResponse(statusCode = 200) {
  const response: any = {
    statusCode,
  };
  response.json = vi.fn(() => response);
  return response;
}

describe("success response envelope middleware", () => {
  it("wraps legacy successful payloads when the mobile contract is requested", () => {
    const req = { headers: { [RESPONSE_ENVELOPE_HEADER]: "1" } } as any;
    const res = createResponse();
    const originalJson = res.json;

    successResponseEnvelope(req, res, vi.fn());
    res.json([{ id: "row-1" }]);

    expect(originalJson).toHaveBeenCalledWith({ data: [{ id: "row-1" }] });
  });

  it("preserves existing envelopes without nesting data twice", () => {
    const req = { headers: { [RESPONSE_ENVELOPE_HEADER]: "1" } } as any;
    const res = createResponse();
    const originalJson = res.json;

    successResponseEnvelope(req, res, vi.fn());
    res.json({ data: { id: "detail-1" }, message: "Tamam" });

    expect(originalJson).toHaveBeenCalledWith({ data: { id: "detail-1" }, message: "Tamam" });
  });

  it("moves complete pagination fields into standard metadata", () => {
    const req = { headers: { [RESPONSE_ENVELOPE_HEADER]: "1" } } as any;
    const res = createResponse();
    const originalJson = res.json;

    successResponseEnvelope(req, res, vi.fn());
    res.json({ data: [{ id: "row-1" }], page: 2, limit: 20, total: 45 });

    expect(originalJson).toHaveBeenCalledWith({
      data: [{ id: "row-1" }],
      meta: {
        pagination: {
          page: 2,
          page_size: 20,
          total: 45,
          total_pages: 3,
        },
      },
    });
  });

  it("does not alter error responses or clients that did not request the contract", () => {
    const unversionedResponse = createResponse();
    const unversionedJson = unversionedResponse.json;
    successResponseEnvelope({ headers: {} } as any, unversionedResponse, vi.fn());
    unversionedResponse.json({ ok: true });
    expect(unversionedJson).toHaveBeenCalledWith({ ok: true });

    const errorResponse = createResponse(422);
    const errorJson = errorResponse.json;
    successResponseEnvelope(
      { headers: { [RESPONSE_ENVELOPE_HEADER]: "1" } } as any,
      errorResponse,
      vi.fn()
    );
    errorResponse.json({ error: { code: "VALIDATION_ERROR" } });
    expect(errorJson).toHaveBeenCalledWith({ error: { code: "VALIDATION_ERROR" } });
  });
});
