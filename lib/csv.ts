// Proper RFC4180 CSV parser — handles quoted fields with embedded commas,
// newlines, and doubled-up quotes, unlike a naive text.split(","). Shared by
// everything that parses a CSV from an external feed (nflverse's schedule
// and play-by-play exports, the Player Grades Google Sheet export) since a
// naive split silently corrupts rows the moment one of those feeds adds a
// field that needs quoting.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Parses a CSV with a header row into one object per row, keyed by header.
export function parseCsvRows(text: string): Record<string, string>[] {
  const table = parseCsv(text);
  const header = table[0] ?? [];
  return table.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h] = row[i] ?? ""));
    return obj;
  });
}
