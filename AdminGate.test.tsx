/**
 * Tests for AdminGate component
 * Verifies role-based gating: admin/moderator see children, user sees access denied
 */

import React from 'react';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

// Mock the store before importing the component
const mockStoreState = {
  isAdmin: false,
  isModerator: false,
};

jest.mock('./src/store/moderationStore', () => ({
  useModerationStore: (selector?: any) => {
    if (typeof selector === 'function') {
      return selector(mockStoreState);
    }
    return mockStoreState;
  },
  // WHISPR-1075: AdminGate now reads through the shared selector hook
  useIsStaff: () => mockStoreState.isAdmin || mockStoreState.isModerator,
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

import { AdminGate } from './src/components/Moderation/AdminGate';

// ─── Helpers ─────────────────────────────────────────────────────

const ProtectedContent = () => <Text>Protected Content</Text>;

beforeEach(() => {
  mockStoreState.isAdmin = false;
  mockStoreState.isModerator = false;
});

// ─── Tests ───────────────────────────────────────────────────────

describe('AdminGate', () => {
  it('shows access denied for regular user', () => {
    const { queryByText } = render(
      <AdminGate>
        <ProtectedContent />
      </AdminGate>,
    );

    expect(queryByText('Protected Content')).toBeNull();
    expect(queryByText(/refus/i)).toBeTruthy();
  });

  it('renders children for admin', () => {
    mockStoreState.isAdmin = true;
    mockStoreState.isModerator = true;

    const { getByText } = render(
      <AdminGate>
        <ProtectedContent />
      </AdminGate>,
    );

    expect(getByText('Protected Content')).toBeTruthy();
  });

  it('renders children for moderator', () => {
    mockStoreState.isAdmin = false;
    mockStoreState.isModerator = true;

    const { getByText } = render(
      <AdminGate>
        <ProtectedContent />
      </AdminGate>,
    );

    expect(getByText('Protected Content')).toBeTruthy();
  });

  it('shows access denied message with correct text', () => {
    const { getByText } = render(
      <AdminGate>
        <ProtectedContent />
      </AdminGate>,
    );

    expect(
      getByText(/administrateur ou mod/i),
    ).toBeTruthy();
  });

  it('switches from denied to allowed when role changes', () => {
    const { queryByText, rerender } = render(
      <AdminGate>
        <ProtectedContent />
      </AdminGate>,
    );

    expect(queryByText('Protected Content')).toBeNull();

    // Promote to moderator
    mockStoreState.isModerator = true;

    rerender(
      <AdminGate>
        <ProtectedContent />
      </AdminGate>,
    );

    expect(queryByText('Protected Content')).toBeTruthy();
  });

  it('renders multiple children correctly when authorized', () => {
    mockStoreState.isAdmin = true;
    mockStoreState.isModerator = true;

    const { getByText } = render(
      <AdminGate>
        <Text>Child 1</Text>
        <Text>Child 2</Text>
      </AdminGate>,
    );

    expect(getByText('Child 1')).toBeTruthy();
    expect(getByText('Child 2')).toBeTruthy();
  });
});
