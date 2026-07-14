import { chromium } from "@playwright/test";

function numberFromEnv(name, fallback) {
  const value = Number(process.env[name] || fallback);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} pozitif bir sayı olmalıdır.`);
  }
  return value;
}

const targetUrl = process.env.WEB_PERF_URL;
if (!targetUrl) {
  throw new Error("WEB_PERF_URL ile staging veya production URL'sini belirtin.");
}

const budgets = {
  firstContentfulPaintMs: numberFromEnv("WEB_PERF_FCP_MS", 1800),
  largestContentfulPaintMs: numberFromEnv("WEB_PERF_LCP_MS", 2500),
  cumulativeLayoutShift: numberFromEnv("WEB_PERF_CLS", 0.1),
  interactionDelayMs: numberFromEnv("WEB_PERF_INTERACTION_MS", 200),
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.addInitScript(() => {
    window.__fizyoflowPerformance = {
      firstContentfulPaintMs: null,
      largestContentfulPaintMs: null,
      cumulativeLayoutShift: 0,
      interactionDelayMs: null,
    };

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          window.__fizyoflowPerformance.firstContentfulPaintMs = entry.startTime;
        }
      }
    }).observe({ type: "paint", buffered: true });

    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const latest = entries[entries.length - 1];
      if (latest) window.__fizyoflowPerformance.largestContentfulPaintMs = latest.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          window.__fizyoflowPerformance.cumulativeLayoutShift += entry.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });

    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const delay = entry.processingStart - entry.startTime;
        const current = window.__fizyoflowPerformance.interactionDelayMs || 0;
        window.__fizyoflowPerformance.interactionDelayMs = Math.max(current, delay);
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 16 });
  });

  const response = await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 45000 });
  if (!response || !response.ok()) {
    throw new Error(`Web performans hedefi yanıt vermedi: ${response?.status() || "yanıt yok"}`);
  }

  const interactionSelector = process.env.WEB_PERF_INTERACTION_SELECTOR;
  if (interactionSelector) {
    await page.locator(interactionSelector).first().click({ timeout: 10000 });
  } else {
    await page.mouse.click(4, 4);
  }
  await page.waitForTimeout(2500);

  const metrics = await page.evaluate(() => window.__fizyoflowPerformance);
  const failures = [];
  for (const [metric, limit] of Object.entries(budgets)) {
    const value = metrics[metric];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      failures.push(`${metric}: ölçülemedi`);
    } else if (value > limit) {
      failures.push(`${metric}: ${value.toFixed(1)} > ${limit}`);
    }
  }

  console.log(JSON.stringify({ targetUrl, budgets, metrics }, null, 2));
  if (failures.length > 0) {
    throw new Error(`Web performans bütçesi geçmedi:\n- ${failures.join("\n- ")}`);
  }
} finally {
  await browser.close();
}
