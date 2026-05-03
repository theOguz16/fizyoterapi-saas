import { useEffect } from "react";
import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { setAuthToken } from "@/lib/http-client";
import { resetLocalPreferencesForE2E } from "@/lib/local-preferences";

const TOKEN_KEY = "clinerva.access_token";

export default function E2EResetScreen() {
  useEffect(() => {
    void (async () => {
      setAuthToken(null);
      await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), resetLocalPreferencesForE2E()]);
    })();
  }, []);

  return <Redirect href="/" />;
}
