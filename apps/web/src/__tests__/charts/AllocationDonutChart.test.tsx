import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AllocationDonutChart } from '@/components/charts/AllocationDonutChart';

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

const sampleData = [
  { name: 'Equities', value: 420000 },
  { name: 'Crypto', value: 95000 },
  { name: 'Bonds', value: 55000 },
];

describe('AllocationDonutChart', () => {
  it('renders recharts responsive container wrapper with data', () => {
    const { container } = render(
      <AllocationDonutChart data={sampleData} height={240} />,
    );
    // ResponsiveContainer renders its wrapper div in jsdom
    const rechartWrapper = container.querySelector('.recharts-responsive-container');
    expect(rechartWrapper).toBeTruthy();
  });

  it('renders empty state when data is empty', () => {
    render(<AllocationDonutChart data={[]} height={240} />);
    expect(screen.getByText(/Add holdings/i)).toBeInTheDocument();
  });

  it('renders loading skeleton when isLoading=true', () => {
    const { container } = render(
      <AllocationDonutChart data={sampleData} height={240} isLoading />,
    );
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });
});
