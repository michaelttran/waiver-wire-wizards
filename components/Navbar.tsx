"use client";

import Link from "next/link";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/rules", label: "Rules & Scoring" },
  { href: "/challenges", label: "Weekly Challenges" },
  { href: "/faab", label: "FAAB Tracker" },
  { href: "/draft", label: "Draft Order" },
  { href: "/punishments", label: "Punishments" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="bg-purple text-cream border-b-4 border-gold">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
        <button
          type="button"
          aria-label="Toggle navigation menu"
          aria-expanded={open}
          aria-controls="main-nav"
          onClick={() => setOpen((prev) => !prev)}
          className="shrink-0 flex flex-col justify-center gap-1.5 w-8 h-8"
        >
          <span
            className={`block h-0.5 w-6 bg-gold-light transition-transform ${
              open ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-6 bg-gold-light transition-opacity ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-6 bg-gold-light transition-transform ${
              open ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </button>

        <Link
          href="/"
          className="flex items-center gap-2 shrink-0"
          onClick={() => setOpen(false)}
        >
          <span aria-hidden className="text-gold text-xl leading-none">
            &#10022;
          </span>
          <span className="font-display font-700 tracking-wide text-lg sm:text-xl text-gold-light">
            WAIVER WIRE WIZARDS
          </span>
        </Link>
      </div>

      {open && (
        <nav id="main-nav" className="border-t border-gold/30 bg-purple-dark">
          <ul className="max-w-5xl mx-auto px-4 sm:px-6 py-2 flex flex-col text-sm">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block py-2 text-cream/85 hover:text-gold-light transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
