import { describe, it, expect } from 'vitest';
import { formatCurrency, formatPercent, formatDate, classifyDelta, cn } from '@/lib/utils';

describe('utils', () => {
  describe('formatCurrency', () => {
    it('formats INR values correctly', () => {
      const result = formatCurrency(1000, 'INR');
      expect(result).toContain('1,000');
    });

    it('returns — for NaN input', () => {
      expect(formatCurrency('invalid')).toBe('—');
    });

    it('uses compact notation when compact=true', () => {
      const result = formatCurrency(1_000_000, 'INR', true);
      // INR locale in compact notation uses "L" (lakh) or "Cr" (crore)
      expect(result.length).toBeLessThan(15); // compact is shorter than full
      expect(result).toContain('₹');
    });
  });

  describe('formatPercent', () => {
    it('adds + sign for positive values', () => {
      expect(formatPercent(4.5)).toBe('+4.50%');
    });

    it('no sign for negative values', () => {
      expect(formatPercent(-2.1)).toBe('-2.10%');
    });

    it('returns — for NaN', () => {
      expect(formatPercent('invalid' as any)).toBe('—');
    });
  });

  describe('classifyDelta', () => {
    it('returns positive for > 0', () => expect(classifyDelta(1)).toBe('positive'));
    it('returns negative for < 0', () => expect(classifyDelta(-1)).toBe('negative'));
    it('returns neutral for 0', () => expect(classifyDelta(0)).toBe('neutral'));
  });

  describe('cn', () => {
    it('merges class names', () => {
      expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold');
    });
    it('deduplicates tailwind classes', () => {
      expect(cn('p-4', 'p-6')).toBe('p-6');
    });
  });

  describe('formatDate', () => {
    it('formats ISO date string', () => {
      const result = formatDate('2026-09-04T00:00:00Z');
      expect(result).toMatch(/Sep/i);
      expect(result).toMatch(/2026/);
    });
  });
});
