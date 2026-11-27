// A recurring competition keeps one series across seasons even when a later season
// splits into a men's and a women's edition ("BUSA LEAGUE BASKETBALL" 2025/26, then
// "BUSA LEAGUE BASKETBALL (MALE)" and "(FEMALE)" 2026/27). The gender suffix is
// stripped for grouping and for the series display name; each edition keeps its own
// row, id, fixtures and standings.

const GENDER_SUFFIX = /\s*\((?:male|female|men'?s|women'?s)\)\s*$/i;

export function seriesBaseName(name: string): string {
  return name.replace(GENDER_SUFFIX, '').trim();
}

/** "Male" / "Female" when the name carries an edition suffix, otherwise null. */
export function editionLabel(name: string): string | null {
  const m = name.match(/\((male|female|men'?s|women'?s)\)\s*$/i);
  if (!m) return null;
  return /^(female|women)/i.test(m[1]) ? 'Female' : 'Male';
}
