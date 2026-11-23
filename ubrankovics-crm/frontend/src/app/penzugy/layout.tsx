import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pénzügy" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
