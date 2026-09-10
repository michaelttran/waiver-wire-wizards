import SectionCard from "@/components/SectionCard";

export const metadata = {
  title: "Data — Waiver Wire Wizards",
};

export default function DataPage() {
  const sheetUrl = process.env.PLAYER_GRADES_SHEET_URL;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div>
        <h1 className="font-display font-700 text-2xl sm:text-3xl text-purple mb-2">
          Data
        </h1>
        <p className="text-ink/60 text-sm">
          Player grades on the Teams page are pulled from this workbook, maintained
          outside the site.
        </p>
      </div>

      <SectionCard title="Player Grades Workbook">
        <div className="p-4 space-y-3">
          {sheetUrl ? (
            <>
              <a
                href={sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded bg-purple text-cream text-sm font-600 px-4 py-2 hover:bg-purple-light transition-colors"
              >
                Open in Google Sheets &#8599;
              </a>
              <p className="text-xs text-ink/50">
                The &ldquo;Player Grades&rdquo; tab feeds the grades and stats shown on the{" "}
                <a href="/teams" className="underline hover:text-purple">
                  Teams
                </a>{" "}
                page (checked hourly).
              </p>
            </>
          ) : (
            <p className="text-sm text-ink/50">
              No spreadsheet linked yet — set <code>PLAYER_GRADES_SHEET_URL</code> to enable this.
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
