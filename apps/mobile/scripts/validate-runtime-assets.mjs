import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const limits = {
  "assets/brand/fizyoflow-mark.png": 160 * 1024,
  "assets/icon.png": 1_500 * 1024,
  "assets/splash-logo.png": 1_500 * 1024,
};

const failures = [];
const assets = Object.entries(limits).map(([relativePath, maxBytes]) => {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath}: dosya bulunamadı`);
    return { path: relativePath, bytes: 0, maxBytes };
  }
  const bytes = fs.statSync(absolutePath).size;
  if (bytes > maxBytes) failures.push(`${relativePath}: ${bytes} byte > ${maxBytes} byte`);
  return { path: relativePath, bytes, maxBytes };
});

if (failures.length) {
  throw new Error(`Runtime asset bütçesi aşıldı:\n- ${failures.join("\n- ")}`);
}

console.log(JSON.stringify({ status: "passed", assets }, null, 2));
