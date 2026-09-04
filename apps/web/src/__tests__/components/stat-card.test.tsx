import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '@/components/common/stat-card';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total Value" value="₹1,00,000" />);
    expect(screen.getByText('Total Value')).toBeInTheDocument();
    expect(screen.getByText('₹1,00,000')).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading=true', () => {
    const { container } = render(<StatCard label="Total Value" value="₹1,00,000" isLoading />);
    // Skeleton renders divs with animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows positive delta with TrendingUp icon class', () => {
    const { container } = render(<StatCard label="P&L" value="₹500" delta={4.5} />);
    expect(screen.getByText('+4.50%')).toBeInTheDocument();
    // Positive delta gets text-success class
    const deltaEl = container.querySelector('.text-success');
    expect(deltaEl).toBeTruthy();
  });

  it('shows negative delta with destructive color', () => {
    const { container } = render(<StatCard label="P&L" value="-₹200" delta={-2.1} />);
    expect(screen.getByText('-2.10%')).toBeInTheDocument();
    const deltaEl = container.querySelector('.text-destructive');
    expect(deltaEl).toBeTruthy();
  });

  it('shows deltaLabel when provided', () => {
    render(<StatCard label="P&L" value="₹500" delta={1.2} deltaLabel="today" />);
    expect(screen.getByText('today')).toBeInTheDocument();
  });
});
