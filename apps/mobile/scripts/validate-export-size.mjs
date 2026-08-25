import fs from "node:fs";
import path from "node:path";

const exportDir = path.resolve(process.env.MOBILE_EXPORT_DIR || "dist");
const maxBundleBytes = 12 * 1024 * 1024;
const maxAssetBytes = 2 * 1024 * 1024;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

if (!fs.existsSync(exportDir)) throw new Error(`Expo export bulunamadı: ${exportDir}`);

const files = walk(exportDir);
const bundles = files.filter((file) => /\.(hbc|js)$/.test(file));
const assets = files.filter((file) => file.includes(`${path.sep}assets${path.sep}`));
const bundleBytes = bundles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const assetBytes = assets.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const failures = [];

if (!bundles.length) failures.push("JavaScript/Hermes bundle bulunamadı");
if (bundleBytes > maxBundleBytes) failures.push(`bundle ${bundleBytes} byte > ${maxBundleBytes} byte`);
if (assetBytes > maxAssetBytes) failures.push(`asset toplamı ${assetBytes} byte > ${maxAssetBytes} byte`);
if (failures.length) throw new Error(`Expo export boyut bütçesi aşıldı:\n- ${failures.join("\n- ")}`);

console.log(JSON.stringify({ status: "passed", exportDir, bundleBytes, assetBytes, maxBundleBytes, maxAssetBytes }, null, 2));
