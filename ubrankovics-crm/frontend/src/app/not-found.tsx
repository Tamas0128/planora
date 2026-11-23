import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">Az oldal nem található</h1>
        <p className="text-[var(--muted)]">
          A keresett cím nem létezik, vagy az oldalt áthelyezték. Ellenőrizd a címet, vagy térj vissza a kezdőlapra.
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-[var(--radius)] bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)]"
        >
          Vissza a kezdőlapra
        </Link>
      </div>
    </main>
  );
}
