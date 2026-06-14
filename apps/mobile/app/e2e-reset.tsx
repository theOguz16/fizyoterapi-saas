import { useEffect } from "react";
import { Redirect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { setAuthToken } from "@/lib/http-client";
import { isE2EModeEnabled } from "@/lib/e2e-mode";
import { resetLocalPreferencesForE2E } from "@/lib/local-preferences";

const TOKEN_KEY = "fizyoflow.access_token";

export default function E2EResetScreen() {
  const e2eEnabled = isE2EModeEnabled();

  useEffect(() => {
    if (!e2eEnabled) return;

    void (async () => {
      setAuthToken(null);
      await Promise.all([SecureStore.deleteItemAsync(TOKEN_KEY), resetLocalPreferencesForE2E()]);
    })();
  }, [e2eEnabled]);

  return <Redirect href={e2eEnabled ? "/" : "/(auth)/welcome"} />;
}
