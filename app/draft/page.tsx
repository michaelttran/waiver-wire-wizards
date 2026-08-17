import { prisma } from "@/lib/prisma";
import SectionCard from "@/components/SectionCard";

export const metadata = {
  title: "Draft Order — Waiver Wire Wizards",
};

export const revalidate = 0;

export default async function DraftPage() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div>
        <h1 className="font-display font-700 text-2xl sm:text-3xl text-purple mb-2">
          Draft Order
        </h1>
        <p className="text-ink/60 text-sm">
          Set by the commissioner ahead of the draft.
        </p>
      </div>

      <SectionCard title="Draft Order">
        <div className="p-8 text-center text-ink/60 text-sm">
          {settings?.draftOrderNote ??
            "Draft order will be posted here once it's set."}
        </div>
      </SectionCard>
    </div>
  );
}
