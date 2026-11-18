import type { Metadata } from "next";
import { Archivo, Lora } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-lora",
});

export const metadata: Metadata = {
  title: "Ubrankovics CRM",
  description: "Ügyfél-, projekt- és tételkövetés",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className={`${archivo.variable} ${lora.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
