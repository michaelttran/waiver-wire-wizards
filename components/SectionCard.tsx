import { ReactNode } from "react";

export default function SectionCard({
  title,
  children,
}: {
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="wwz-card">
      <div className="wwz-section-header font-display text-sm sm:text-base flex items-center gap-2">
        <span>&#10022;</span> {title}
      </div>
      <div className="p-0">{children}</div>
    </div>
  );
}
