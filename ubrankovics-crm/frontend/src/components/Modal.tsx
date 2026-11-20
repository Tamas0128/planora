"use client";

import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  // Portaled to document.body: a modal that renders inline (e.g. nested inside
  // another <form>, like the Bankkivonat import button next to the
  // bankegyenleg form) would otherwise produce invalid nested <form> HTML and
  // unpredictable submit behaviour.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4 pt-16" onClick={onClose}>
      <div
        className={`w-full ${wide ? "max-w-3xl" : "max-w-md"} rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] p-4 shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]" aria-label="Bezárás">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
