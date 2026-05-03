// Bu layout owner-setup akisindaki ekranlarin ortak navigation ve kabuk davranisini tanimlar.
// Grup icindeki sayfalar ayni stack, tab veya ust seviye yonlendirme kurallarini bu dosyadan alir.
import { Stack } from "expo-router";

export default function OwnerSetupLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
