import { describe, expect, it } from 'vitest';
import { confidenceLevel, confidenceText, LOW_CONFIDENCE } from '@/lib/tickets/confidence';

describe('confidence', () => {
  it('is low below 0.6 and high from 0.6 up, the same threshold as Ask client', () => {
    expect(LOW_CONFIDENCE).toBe(0.6);
    expect(confidenceLevel(0.59)).toBe('low');
    expect(confidenceLevel(0.6)).toBe('high');
    expect(confidenceLevel(0.8)).toBe('high');
  });

  it('gives two decimals and the level word', () => {
    expect(confidenceText(0.8, { low: 'low', high: 'high' })).toEqual({ number: '0.80', level: 'high', word: 'high' });
    expect(confidenceText(0.41, { low: 'low', high: 'high' })).toEqual({ number: '0.41', level: 'low', word: 'low' });
  });
});
