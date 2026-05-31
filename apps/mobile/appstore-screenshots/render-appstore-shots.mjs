import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "/Users/oguzhanuyar/Desktop/fitnes-saas/node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/index.mjs";

const outDir = "/Users/oguzhanuyar/Desktop/fitnes-saas/apps/mobile/appstore-screenshots/final";
const rawDir = "/Users/oguzhanuyar/Desktop/fitnes-saas/apps/mobile/appstore-screenshots/raw";

const shots = [
  { file: "admin-dashboard.png", out: "01-yonetim-merkezi.png", title: "Salon yönetimi tek merkezde", sub: "Üye, eğitmen, risk ve günlük operasyon özetleri." },
  { file: "admin-packages.png", out: "02-paket-yonetimi.png", title: "Paketleri dakikalar içinde yönet", sub: "Fiyat, kapasite, komisyon ve eğitmen eşleşmeleri." },
  { file: "admin-calendar-classes.png", out: "03-salon-takvimi.png", title: "Ders takvimi hep güncel", sub: "Grup dersleri, onaylar ve eğitmen programı aynı ekranda." },
  { file: "admin-members.png", out: "04-uye-listesi.png", title: "Üye ve eğitmen listesi hazır", sub: "Filtrele, riskli üyeyi gör, detaylara hızlı geç." },
  { file: "trainer-checkin.png", out: "05-qr-ders-girisi.png", title: "QR ile hızlı ders girişi", sub: "MEM kodu veya kamera ile doğru paketten hak düş." },
  { file: "member-package.png", out: "06-paket-takibi.png", title: "Üyeler paketlerini takip eder", sub: "Kalan hak, ödeme ve geçmiş bilgiler tek yerde." },
];

function escapeHtml(value) {
  return value.replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[char]);
}

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1242, height: 2688 }, deviceScaleFactor: 1 });

for (const shot of shots) {
  const imageBuffer = await fs.readFile(path.join(rawDir, shot.file));
  const imgUrl = `data:image/png;base64,${imageBuffer.toString("base64")}`;
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      width: 1242px;
      height: 2688px;
      overflow: hidden;
      background: #f6faf8;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", Arial, sans-serif;
      color: #1f2937;
    }
    .wrap {
      position: relative;
      width: 1242px;
      height: 2688px;
      background: linear-gradient(180deg, #f7fbf9 0%, #eef6f2 100%);
    }
    .mark {
      position: absolute;
      left: 72px;
      top: 64px;
      font-size: 34px;
      letter-spacing: 8px;
      font-weight: 800;
      color: #729579;
    }
    .title {
      position: absolute;
      left: 72px;
      right: 72px;
      top: 125px;
      font-size: 68px;
      line-height: 1.04;
      font-weight: 900;
      letter-spacing: 0;
      color: #1f2937;
    }
    .sub {
      position: absolute;
      left: 72px;
      right: 72px;
      top: 302px;
      font-size: 38px;
      line-height: 1.18;
      font-weight: 600;
      color: #6b7280;
    }
    .blob {
      position: absolute;
      right: -180px;
      top: 10px;
      width: 520px;
      height: 520px;
      border-radius: 48%;
      background: #dfece4;
      opacity: .9;
    }
    .blob2 {
      position: absolute;
      left: -190px;
      bottom: -160px;
      width: 520px;
      height: 520px;
      border-radius: 48%;
      background: #e9f1ff;
      opacity: .45;
    }
    .phone {
      position: absolute;
      left: 86px;
      top: 500px;
      width: 1070px;
      height: 2208px;
      border-radius: 74px;
      overflow: hidden;
      background: #fff;
      box-shadow: 0 30px 80px rgba(31, 41, 55, .16), 0 0 0 2px rgba(114, 149, 121, .18);
    }
    .phone img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      display: block;
    }
    .shine {
      position: absolute;
      left: 86px;
      top: 500px;
      width: 1070px;
      height: 2208px;
      border-radius: 74px;
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .7);
      pointer-events: none;
    }
  </style>
</head>
<body>
  <main class="wrap">
    <div class="blob"></div>
    <div class="blob2"></div>
    <div class="mark">FIZYOFLOW</div>
    <div class="title">${escapeHtml(shot.title)}</div>
    <div class="sub">${escapeHtml(shot.sub)}</div>
    <div class="phone"><img src="${imgUrl}" /></div>
    <div class="shine"></div>
  </main>
</body>
</html>`;

  await page.setContent(html, { waitUntil: "load" });
  await page.screenshot({ path: path.join(outDir, shot.out), type: "png" });
}

await browser.close();
console.log(shots.map((shot) => path.join(outDir, shot.out)).join("\n"));
