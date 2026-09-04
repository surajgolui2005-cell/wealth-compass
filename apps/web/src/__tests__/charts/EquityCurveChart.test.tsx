import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EquityCurveChart } from '@/components/charts/EquityCurveChart';

// Recharts ResponsiveContainer requires real layout — mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const sampleData = [
  { date: '2026-01-01', value: 500000 },
  { date: '2026-02-01', value: 540000 },
  { date: '2026-03-01', value: 520000 },
];

describe('EquityCurveChart', () => {
  it('renders a recharts responsive container wrapper with data', () => {
    const { container } = render(
      <EquityCurveChart data={sampleData} height={200} />,
    );
    // ResponsiveContainer renders a div wrapper even in jsdom (no SVG without layout engine)
    const rechartWrapper = container.querySelector('.recharts-responsive-container');
    expect(rechartWrapper).toBeTruthy();
  });

  it('renders empty state message when data is empty', () => {
    render(<EquityCurveChart data={[]} height={200} />);
    expect(screen.getByText(/Record transactions/i)).toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading=true', () => {
    const { container } = render(
      <EquityCurveChart data={sampleData} height={200} isLoading />,
    );
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
