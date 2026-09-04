import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MetricCard } from '../../components/MetricCard';

describe('MetricCard', () => {
  it('renders label and value', () => {
    render(<MetricCard label="Total Value" value="₹1,00,000" />);
    expect(screen.getByText('Total Value')).toBeTruthy();
    expect(screen.getByText('₹1,00,000')).toBeTruthy();
  });

  it('renders skeleton when isLoading is true', () => {
    const { toJSON } = render(<MetricCard label="Total Value" value="₹1,00,000" isLoading />);
    // Skeleton renders placeholder Views; the value text should not be visible
    expect(screen.queryByText('₹1,00,000')).toBeNull();
  });

  it('renders positive delta', () => {
    render(<MetricCard label="P&L" value="₹500" delta={4.5} />);
    expect(screen.getByText('+4.50%')).toBeTruthy();
  });

  it('renders negative delta', () => {
    render(<MetricCard label="P&L" value="-₹200" delta={-2.1} />);
    expect(screen.getByText('-2.10%')).toBeTruthy();
  });

  it('renders no delta row when delta is undefined', () => {
    render(<MetricCard label="Risk Score" value="42/100" />);
    expect(screen.queryByText(/\%/)).toBeNull();
  });
});
