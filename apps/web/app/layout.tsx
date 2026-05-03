import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clinerva Web",
  description: "Clinerva salon public sayfası",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
