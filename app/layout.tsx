import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EGB Digital - Sistema RED",
  description: "Plataforma digital de inspección de buses del Sistema RED",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
