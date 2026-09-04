import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '../../components/EmptyState';

describe('EmptyState', () => {
  it('renders title and description', () => {
    render(<EmptyState title="No portfolios" description="Create one to get started." />);
    expect(screen.getByText('No portfolios')).toBeTruthy();
    expect(screen.getByText('Create one to get started.')).toBeTruthy();
  });

  it('renders action button when actionLabel and onAction are provided', () => {
    const onAction = jest.fn();
    render(
      <EmptyState title="No data" description="Empty." actionLabel="Add Item" onAction={onAction} />,
    );
    expect(screen.getByText('Add Item')).toBeTruthy();
  });

  it('calls onAction when button is pressed', () => {
    const onAction = jest.fn();
    render(
      <EmptyState title="No data" description="Empty." actionLabel="Add Item" onAction={onAction} />,
    );
    fireEvent.press(screen.getByText('Add Item'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render button when no actionLabel', () => {
    render(<EmptyState title="Empty" description="Nothing here." />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
