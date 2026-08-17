import { ReactNode } from "react";

export default function SectionCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="wwz-card">
      <div className="wwz-section-header font-display text-sm sm:text-base">
        &#10022; {title}
      </div>
      <div className="p-0">{children}</div>
    </div>
  );
}
