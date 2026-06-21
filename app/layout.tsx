import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EGB Digital MVP",
  description: "Base local del MVP EGB Digital",
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
