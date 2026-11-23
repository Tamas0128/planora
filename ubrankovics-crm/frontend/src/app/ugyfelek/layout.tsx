import type { Metadata } from "next";

export const metadata: Metadata = { title: "Ügyfelek" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
