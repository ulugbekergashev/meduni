"use client";

import { useEffect, useState } from "react";

/**
 * CSS media-query'ni React holatiga bog'laydi. Layout mobilda BOSHQACHA
 * qurilishi kerak bo'lganda ishlatiladi (masalan dars sahifasi: desktopda
 * 3 ustun, mobilda kontent + sheet). Faqat ko'rinishni yashirish kifoya
 * bo'lsa — Tailwind `hidden lg:block` afzal, JS kerak emas.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mq.addEventListener("change", onChange);
    // Query o'zgargan bo'lsa darhol moslaymiz.
    setMatches(mq.matches);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Tailwind `sm` chegarasi ostida (telefon). */
export const MOBILE_QUERY = "(max-width: 639px)";
/** Tailwind `lg` chegarasi ostida (telefon + planshet portret). */
export const COMPACT_QUERY = "(max-width: 1023px)";
