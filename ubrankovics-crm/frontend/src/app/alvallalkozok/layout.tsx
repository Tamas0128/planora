import type { Metadata } from "next";

export const metadata: Metadata = { title: "Alvállalkozók" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
