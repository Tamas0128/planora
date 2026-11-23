import type { Metadata } from "next";
import { Archivo, Raleway } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-archivo",
});

const raleway = Raleway({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-raleway",
});

export const metadata: Metadata = {
  title: { default: "Ubrankovics CRM", template: "%s – Ubrankovics CRM" },
  description: "Ügyfél-, projekt- és tételkövetés",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className={`${archivo.variable} ${raleway.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
