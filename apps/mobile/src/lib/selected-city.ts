// Bu helper modulu mobil tarafta selected city ile ilgili veri donusumu, is kurali veya API erisimini toplar.
// Ekranlar ham ayrintilar yerine bu dosyadaki yardimcilari kullanarak daha yalniz kalir.
import * as SecureStore from "expo-secure-store";

const CITY_KEY = "clinerva.selected_city";

export async function getSelectedCity() {
  return (await SecureStore.getItemAsync(CITY_KEY)) || "";
}

export async function setSelectedCity(city: string) {
  await SecureStore.setItemAsync(CITY_KEY, city);
  return city;
}
