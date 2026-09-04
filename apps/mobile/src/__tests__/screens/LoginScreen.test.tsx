import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { LoginScreen } from '../../screens/auth/LoginScreen';

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ login: jest.fn(), error: null }),
}));

jest.mock('@react-navigation/native-stack', () => ({
  createNativeStackNavigator: jest.fn(),
}));

const mockNavigation: any = { navigate: jest.fn(), goBack: jest.fn() };

describe('LoginScreen', () => {
  it('renders email and password inputs', () => {
    render(<LoginScreen navigation={mockNavigation} route={{} as any} />);
    // Two empty TextInputs exist — use getAllByDisplayValue
    const inputs = screen.getAllByDisplayValue('');
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByPlaceholderText('you@example.com')).toBeTruthy();
    expect(screen.getByPlaceholderText('••••••••')).toBeTruthy();
  });

  it('renders sign in button', () => {
    render(<LoginScreen navigation={mockNavigation} route={{} as any} />);
    // "Sign in" appears as both heading and button text — getAllByText
    const matches = screen.getAllByText('Sign in');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('renders app title', () => {
    render(<LoginScreen navigation={mockNavigation} route={{} as any} />);
    expect(screen.getByText('Wealth Compass')).toBeTruthy();
  });

  it('renders link to create account', () => {
    render(<LoginScreen navigation={mockNavigation} route={{} as any} />);
    // RN splits inline Text nodes — match the "Create one" child span
    expect(screen.getByText('Create one')).toBeTruthy();
  });
});
