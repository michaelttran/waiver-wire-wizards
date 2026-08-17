import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-12 border-t border-gold/50 bg-purple text-cream/70">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span>Waiver Wire Wizards &bull; League Rules</span>
        <Link href="/admin" className="hover:text-gold-light transition-colors">
          Commissioner Admin
        </Link>
      </div>
    </footer>
  );
}
