import type { NextFunction, Request, Response } from "express";

export const RESPONSE_ENVELOPE_HEADER = "x-fizyoflow-response-envelope";

type SuccessEnvelope = {
  data: unknown;
  message?: string;
  meta?: Record<string, unknown>;
};

function isSuccessEnvelope(body: unknown): body is SuccessEnvelope {
  return Boolean(body && typeof body === "object" && !Array.isArray(body) && Object.prototype.hasOwnProperty.call(body, "data"));
}

function normalizePagination(envelope: SuccessEnvelope & Record<string, unknown>): SuccessEnvelope {
  const page = Number(envelope.page);
  const pageSize = Number(envelope.page_size ?? envelope.pageSize ?? envelope.limit);
  const total = Number(envelope.total);
  const explicitTotalPages = Number(envelope.total_pages ?? envelope.totalPages);

  if (!Number.isFinite(page) || !Number.isFinite(pageSize) || !Number.isFinite(total) || pageSize <= 0) {
    return envelope;
  }

  const pagination = {
    page,
    page_size: pageSize,
    total,
    total_pages: Number.isFinite(explicitTotalPages) ? explicitTotalPages : Math.ceil(total / pageSize),
  };

  const { page: _page, page_size: _pageSize, pageSize: _pageSizeCamel, limit: _limit, total: _total, total_pages: _totalPages, totalPages: _totalPagesCamel, ...rest } = envelope;
  return {
    ...rest,
    meta: {
      ...(envelope.meta || {}),
      pagination,
    },
  };
}

// Mobil istemci envelope v1 istediginde legacy basarili cevaplari tek kontrata getirir.
// Hata cevaplari mevcut error middleware semasinda kalir; web istemcileri etkilenmez.
export function successResponseEnvelope(req: Request, res: Response, next: NextFunction) {
  if (String(req.headers[RESPONSE_ENVELOPE_HEADER] || "") !== "1") {
    next();
    return;
  }

  const sendJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (res.statusCode >= 400) {
      return sendJson(body);
    }

    if (isSuccessEnvelope(body)) {
      return sendJson(normalizePagination(body));
    }

    return sendJson({ data: body ?? null });
  }) as Response["json"];

  next();
}
