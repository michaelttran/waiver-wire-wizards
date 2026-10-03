"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// Sends one beacon per page view (including client-side navigations) to
// /api/track, which records the visitor's IP for the admin Visitors log.
export default function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    navigator.sendBeacon?.("/api/track", pathname);
  }, [pathname]);

  return null;
}
