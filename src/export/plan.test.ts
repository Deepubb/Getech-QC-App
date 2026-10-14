import { describe, expect, it } from 'vitest';
import { partFileName, planParts } from './plan';

describe('planParts', () => {
  it('keeps everything in one part under the limit', () => {
    expect(planParts([10, 10, 10], 100)).toEqual([[0, 1, 2]]);
  });
  it('starts a new part before going over the limit', () => {
    expect(planParts([40, 40, 40, 10], 100)).toEqual([[0, 1], [2, 3]]);
  });
  it('reserves room in part 1 for the manifest', () => {
    expect(planParts([40, 40], 100, 30)).toEqual([[0], [1]]);
  });
  it('gives an oversized photo a part of its own', () => {
    expect(planParts([150, 10], 100)).toEqual([[0], [1]]);
  });
  it('handles no photos', () => {
    expect(planParts([], 100)).toEqual([[]]);
  });
});

describe('partFileName', () => {
  it('only adds part numbers when split', () => {
    expect(partFileName('X', 0, 1)).toBe('X.zip');
    expect(partFileName('X', 1, 3)).toBe('X_part2of3.zip');
  });
});
