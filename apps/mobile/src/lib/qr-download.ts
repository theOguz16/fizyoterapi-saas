export function buildQrFileName(input: { salonSlug?: string | null }) {
  const slug = String(input.salonSlug || "salon")
    .trim()
    .replace(/[^a-z0-9-_]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

  return `fizyoflow-salon-qr-${slug || "salon"}`;
}