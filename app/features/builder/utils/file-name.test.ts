import { describe, expect, it } from 'vitest';

import { fileName } from '~/features/builder/utils/file-name';

describe('fileName', () => {
  it('makes a short, safe file name from the drill name', () => {
    expect(fileName('Third ball attack!', 'json')).toBe('third-ball-attack.json');
    expect(fileName('  Ünterschnitt / FH ', 'txt')).toBe('ünterschnitt-fh.txt');
    expect(fileName('???', 'txt')).toBe('drill.txt');
  });
});
