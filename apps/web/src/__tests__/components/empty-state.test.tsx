import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '@/components/common/empty-state';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No portfolios" description="Create one to get started." />);
    expect(screen.getByText('No portfolios')).toBeInTheDocument();
    expect(screen.getByText('Create one to get started.')).toBeInTheDocument();
  });

  it('renders action button when actionLabel and onAction are provided', () => {
    const mockAction = vi.fn();
    render(
      <EmptyState
        title="No data"
        description="Nothing here."
        actionLabel="Create"
        onAction={mockAction}
      />,
    );
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();
  });

  it('calls onAction when button clicked', async () => {
    const mockAction = vi.fn();
    render(
      <EmptyState title="No data" description="Empty." actionLabel="Add Item" onAction={mockAction} />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    expect(mockAction).toHaveBeenCalledTimes(1);
  });

  it('does not render button when no actionLabel', () => {
    render(<EmptyState title="No data" description="Empty." />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
