import { describe, it, expect } from '@jest/globals';
import { formatCurrency, formatPercent, formatDate, classifyDelta } from '../../lib/utils';

describe('utils', () => {
  describe('formatCurrency', () => {
    it('formats standard INR value', () => {
      const result = formatCurrency(100000);
      expect(result).toContain('₹');
    });

    it('returns — for NaN', () => {
      expect(formatCurrency('invalid')).toBe('—');
    });

    it('formats compact thousands as K', () => {
      expect(formatCurrency(5000, 'INR', true)).toBe('₹5K');
    });

    it('formats compact lakhs as L', () => {
      expect(formatCurrency(250000, 'INR', true)).toBe('₹2.5L');
    });

    it('formats compact crores as Cr', () => {
      expect(formatCurrency(20000000, 'INR', true)).toBe('₹2.0Cr');
    });

    it('handles negative compact values', () => {
      expect(formatCurrency(-50000, 'INR', true)).toBe('-₹50K');
    });
  });

  describe('formatPercent', () => {
    it('adds + for positive', () => {
      expect(formatPercent(4.5)).toBe('+4.50%');
    });

    it('no extra sign for negative', () => {
      expect(formatPercent(-2.1)).toBe('-2.10%');
    });

    it('returns — for NaN', () => {
      expect(formatPercent(NaN)).toBe('—');
    });
  });

  describe('classifyDelta', () => {
    it('returns positive for > 0', () => expect(classifyDelta(1)).toBe('positive'));
    it('returns negative for < 0', () => expect(classifyDelta(-1)).toBe('negative'));
    it('returns neutral for 0', () => expect(classifyDelta(0)).toBe('neutral'));
  });

  describe('formatDate', () => {
    it('formats ISO date string', () => {
      const result = formatDate('2026-09-05T00:00:00Z');
      expect(result).toMatch(/Sep/i);
      expect(result).toMatch(/2026/);
    });
  });
});
