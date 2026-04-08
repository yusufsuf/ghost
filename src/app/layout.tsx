import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ghost — Görünmez Manken Efekti",
  description: "Elbise fotoğraflarınızı yükleyin, ghost mannequin efektiyle profesyonel e-ticaret görsellerine dönüştürün.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
