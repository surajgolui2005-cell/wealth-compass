import { describe, it, expect } from 'vitest';
import {
  formatAxisCurrency,
  formatTooltipCurrency,
  formatAxisPercent,
  formatAxisDate,
  formatTooltipDate,
  correlationToColor,
} from '@/components/charts/chart-theme';

describe('chart-theme formatters', () => {
  describe('formatAxisCurrency', () => {
    it('formats small values with ₹ and no suffix', () => {
      expect(formatAxisCurrency(500)).toBe('₹500');
    });

    it('formats thousands as K', () => {
      expect(formatAxisCurrency(5000)).toBe('₹5K');
    });

    it('formats lakhs as L', () => {
      expect(formatAxisCurrency(150000)).toBe('₹1.5L');
    });

    it('formats crores as Cr', () => {
      expect(formatAxisCurrency(10000000)).toBe('₹1.0Cr');
    });

    it('handles negative values', () => {
      expect(formatAxisCurrency(-50000)).toBe('-₹50K');
    });

    it('returns — for NaN', () => {
      expect(formatAxisCurrency(NaN)).toBe('—');
    });
  });

  describe('formatTooltipCurrency', () => {
    it('formats full precision INR', () => {
      const result = formatTooltipCurrency(123456.78);
      expect(result).toContain('₹');
      expect(result).toContain('1,23,456');
    });

    it('returns — for NaN', () => {
      expect(formatTooltipCurrency(NaN)).toBe('—');
    });
  });

  describe('formatAxisPercent', () => {
    it('adds + for positive values', () => {
      expect(formatAxisPercent(4.5)).toBe('+4.5%');
    });

    it('no extra sign for negative values', () => {
      expect(formatAxisPercent(-2.1)).toBe('-2.1%');
    });

    it('handles zero (no + prefix)', () => {
      // 0 is not > 0, so no sign prefix
      expect(formatAxisPercent(0)).toBe('0.0%');
    });

    it('respects decimal param', () => {
      expect(formatAxisPercent(3.14159, 2)).toBe('+3.14%');
    });

    it('returns — for NaN', () => {
      expect(formatAxisPercent(NaN)).toBe('—');
    });
  });

  describe('formatAxisDate', () => {
    it('formats ISO date to short form', () => {
      const result = formatAxisDate('2026-09-04T00:00:00Z');
      expect(result).toMatch(/\d{1,2}\s+\w+/);
    });

    it('returns original string for invalid date', () => {
      const result = formatAxisDate('not-a-date');
      expect(typeof result).toBe('string');
    });
  });

  describe('correlationToColor', () => {
    it('returns white-ish for correlation 0', () => {
      const color = correlationToColor(0);
      expect(color).toBe('rgb(255,255,255)');
    });

    it('returns red-ish for correlation -1', () => {
      const color = correlationToColor(-1);
      expect(color).toMatch(/rgb\(255,0,0\)/);
    });

    it('returns blue-ish for correlation +1', () => {
      const color = correlationToColor(1);
      expect(color).toMatch(/rgb\(0,0,255\)/);
    });

    it('clamps values outside [-1, 1]', () => {
      const overOne = correlationToColor(2);
      const atOne = correlationToColor(1);
      expect(overOne).toBe(atOne);
    });
  });
});
