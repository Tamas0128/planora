"use client";

import { useEffect } from "react";

const CONTROL = "input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea";

/**
 * Biztonsági háló az űrlapok hozzáférhetőségéhez: ahol egy <label> mellett (testvérként vagy
 * a testvér belsejében) ott a mező, de nincs `for`/`id` kapcsolat, azt létrehozza, és az
 * egyetlen címke nélküli mezőt (pl. csak placeholderes) a placeholder/title szövegével
 * nevezi el. Csak attribútumokat ír, a React saját állapotát nem érinti.
 */
export default function LabelAssociator() {
  useEffect(() => {
    let counter = 0;
    let frame = 0;

    function fix() {
      frame = 0;
      document.querySelectorAll<HTMLLabelElement>("label:not([for])").forEach((label) => {
        if (label.querySelector(CONTROL)) return; // a címke körbeveszi a mezőt
        const next = label.nextElementSibling;
        const ctrl = next ? (next.matches(CONTROL) ? next : next.querySelector(CONTROL)) : null;
        if (!ctrl) return;
        if (!ctrl.id) ctrl.id = `auto-mezo-${++counter}`;
        label.htmlFor = ctrl.id;
      });
      document.querySelectorAll<HTMLElement>(CONTROL).forEach((el) => {
        if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.closest("label")) return;
        if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return;
        const nev = el.getAttribute("placeholder") || el.getAttribute("title");
        if (nev) el.setAttribute("aria-label", nev);
      });
    }

    const schedule = () => {
      if (!frame) frame = window.setTimeout(fix, 50);
    };
    schedule();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) clearTimeout(frame);
    };
  }, []);

  return null;
}
