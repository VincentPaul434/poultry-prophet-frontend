"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function BackToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setIsVisible(window.scrollY > 500);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  if (!isVisible) return null;

  const scrollToTop = () => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({
      top: 0,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Bumalik sa itaas"
      title="Bumalik sa itaas"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-40 inline-flex h-12 w-12 animate-[landing-rise_280ms_ease-out] items-center justify-center gap-2 rounded-full bg-[#173d2a] px-0 text-white shadow-[0_12px_28px_rgb(23_61_42_/_0.24)] transition-[background-color,transform,box-shadow] hover:-translate-y-1 hover:bg-[#cc7d2e] hover:shadow-[0_16px_32px_rgb(23_61_42_/_0.28)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#f4bf55]/70 sm:bottom-6 sm:right-6 sm:w-auto sm:px-4 motion-reduce:animate-none motion-reduce:transition-none"
    >
      <ArrowUp className="size-5" aria-hidden="true" />
      <span className="hidden text-sm font-bold sm:inline">To the top</span>
    </button>
  );
}
