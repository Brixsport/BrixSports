import { describe, expect, it } from 'vitest';
import { editionLabel, seriesBaseName } from '@/lib/competition-series';

describe('seriesBaseName', () => {
  it('strips a trailing gender edition, case-insensitively', () => {
    expect(seriesBaseName('BUSA LEAGUE BASKETBALL (MALE)')).toBe('BUSA LEAGUE BASKETBALL');
    expect(seriesBaseName('BUSA League Basketball (Female) ')).toBe('BUSA League Basketball');
    expect(seriesBaseName("NPUGA (Women's)")).toBe('NPUGA');
  });
  it('leaves other names and other parentheses alone', () => {
    expect(seriesBaseName('BUSA LEAGUE BASKETBALL')).toBe('BUSA LEAGUE BASKETBALL');
    expect(seriesBaseName('NPUGA (FOOTBALL)')).toBe('NPUGA (FOOTBALL)');
    expect(seriesBaseName('GENTLEMEN FC LEAGUE (AUGUST)')).toBe('GENTLEMEN FC LEAGUE (AUGUST)');
  });
});

describe('editionLabel', () => {
  it('names the edition or returns null', () => {
    expect(editionLabel('X (MALE)')).toBe('Male');
    expect(editionLabel('X (female)')).toBe('Female');
    expect(editionLabel('X')).toBeNull();
  });
});
