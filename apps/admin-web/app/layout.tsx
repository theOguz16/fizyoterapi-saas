import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/toaster";
import { RootLayoutShell } from "@/components/layout/root-layout-shell";
import { AuthSessionProvider } from "@/lib/auth-session";
import { getServerAuthSnapshot } from "@/lib/server-auth";
import "./globals.css";

const poppins = localFont({
  src: [
    { path: "./fonts/Poppins-Light.ttf", weight: "300", style: "normal" },
    { path: "./fonts/Poppins-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/Poppins-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/Poppins-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "./fonts/Poppins-Bold.ttf", weight: "700", style: "normal" },
  ],
  display: "swap",
  variable: "--font-poppins",
});

export const metadata: Metadata = {
  title: "Clinerva",
  description: "Clinerva fizyoterapi klinik yönetim platformu",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialSnapshot = await getServerAuthSnapshot();

  return (
    <html lang="tr">
      <body className={poppins.variable}>
        <AuthSessionProvider initialSnapshot={initialSnapshot}>
          <RootLayoutShell>{children}</RootLayoutShell>
        </AuthSessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
