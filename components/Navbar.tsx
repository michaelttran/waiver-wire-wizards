import Link from "next/link";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/rules", label: "Rules & Scoring" },
  { href: "/challenges", label: "Weekly Challenges" },
  { href: "/faab", label: "FAAB Tracker" },
  { href: "/draft", label: "Draft Order" },
];

export default function Navbar() {
  return (
    <header className="bg-purple text-cream border-b-4 border-gold">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <span aria-hidden className="text-gold text-xl leading-none">
            &#10022;
          </span>
          <span className="font-display font-700 tracking-wide text-lg sm:text-xl text-gold-light">
            WAIVER WIRE WIZARDS
          </span>
        </Link>
        <nav className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-cream/85 hover:text-gold-light transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
