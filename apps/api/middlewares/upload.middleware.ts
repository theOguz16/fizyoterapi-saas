// Bu middleware request zincirinde upload.middleware ile ilgili ortak kontrolu uygular.
// Yetki, hata, tenant veya upload gibi cros-cutting davranislar controller oncesi burada ele alinir.
import multer from "multer";
import path from "path";
import fs from "fs";

function ensureDir(dirPath: string) {
  fs.mkdirSync(dirPath, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tenantId = (req as any).tenantId; // tenantMiddleware set ediyor
    if (!tenantId) return cb(new Error("NO_TENANT"), "");

    // kind seçimi (hero/gallery)
    const kind = String((req.body?.kind ?? "hero")).toLowerCase(); // default hero
    const safeKind = kind === "gallery" ? "gallery" : "hero";

    const uploadRoot = path.join(process.cwd(), "uploads", "tenants", tenantId, safeKind);
    ensureDir(uploadRoot);

    cb(null, uploadRoot);
  },

  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = [".png", ".jpg", ".jpeg", ".webp"].includes(ext) ? ext : ".jpg";
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`;
    cb(null, unique);
  },
});

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  // MIME kontrolü (en pratik MVP)
  if (!file.mimetype.startsWith("image/")) {
    return cb(new Error("ONLY_IMAGES_ALLOWED"));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});