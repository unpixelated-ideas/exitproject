import type { Station } from '../../src/domain/types';

// Isolated fixture for future April Fools support; not in the ordinary ballot.
export const oneExitStation: Station = {
  id: 'fixture-single-exit',
  name: { en: 'Single Gate', ko: '싱글 게이트' },
  services: ['S'],
  exits: [{ id: 'single-gate', description: { en: 'Park gate', ko: '공원 입구' } }],
};
