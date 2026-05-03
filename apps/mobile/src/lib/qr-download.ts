import QRCode from "qrcode";
import { Share } from "react-native";
import { tokens } from "@/theme/tokens";

let FileSystemModule: any = null;
try {
  FileSystemModule = eval("require")("expo-file-system");
} catch {
  FileSystemModule = null;
}

export async function shareQrCodeImage(input: { value: string; fileName: string; message?: string }) {
  const normalized = String(input.value || "").trim();
  if (!normalized) {
    throw new Error("QR içeriği bulunamadı.");
  }

  if (!FileSystemModule) {
    throw new Error("QR görseli bu cihazda hazırlanamadı.");
  }

  const baseDir = FileSystemModule.cacheDirectory || FileSystemModule.documentDirectory;
  if (!baseDir) {
    throw new Error("Cihazda geçici dosya alanı bulunamadı.");
  }

  const dataUrl = await QRCode.toDataURL(normalized, {
    margin: 1,
    width: 768,
    color: {
      dark: tokens.colors.text,
      light: "#FFFFFF",
    },
  });

  const fileUri = `${baseDir}${input.fileName.replace(/[^a-z0-9-_]/gi, "_")}.png`;
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
  await FileSystemModule.writeAsStringAsync(fileUri, base64, {
    encoding: FileSystemModule.EncodingType.Base64,
  });

  await Share.share({
    url: fileUri,
    message: input.message || "QR görseli hazır.",
  });

  return fileUri;
}
