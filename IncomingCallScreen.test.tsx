import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

const mockReset = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    reset: mockReset,
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
  }),
}));

const mockAcceptIncoming = jest.fn().mockResolvedValue(undefined);
const mockDeclineIncoming = jest.fn().mockResolvedValue(undefined);

let mockIncoming: any = {
  callId: 'c1',
  initiatorId: 'user-alice',
  conversationId: 'conv1',
  type: 'audio',
};

jest.mock('./src/store/callsStore', () => ({
  useCallsStore: (selector: any) =>
    selector({
      incoming: mockIncoming,
      acceptIncoming: mockAcceptIncoming,
      declineIncoming: mockDeclineIncoming,
    }),
}));

import { IncomingCallScreen } from './src/screens/Calls/IncomingCallScreen';

describe('IncomingCallScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIncoming = {
      callId: 'c1',
      initiatorId: 'user-alice',
      conversationId: 'conv1',
      type: 'audio',
    };
  });

  it('matches snapshot', () => {
    const { toJSON } = render(<IncomingCallScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders caller id and accept/decline buttons', () => {
    const { getByLabelText, getByText } = render(<IncomingCallScreen />);
    expect(getByText('user-alice')).toBeTruthy();
    expect(getByLabelText("Accepter l'appel")).toBeTruthy();
    expect(getByLabelText("Refuser l'appel")).toBeTruthy();
  });

  it('renders nothing when there is no incoming call', () => {
    mockIncoming = null;
    const { toJSON } = render(<IncomingCallScreen />);
    expect(toJSON()).toBeNull();
  });

  it('calls acceptIncoming and navigates to InCall when Accept is pressed', async () => {
    const { getByLabelText } = render(<IncomingCallScreen />);
    fireEvent.press(getByLabelText("Accepter l'appel"));
    await Promise.resolve();
    await Promise.resolve();
    expect(mockAcceptIncoming).toHaveBeenCalledTimes(1);
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'InCall' }],
    });
  });

  it('calls declineIncoming and goes back when Decline is pressed', async () => {
    const { getByLabelText } = render(<IncomingCallScreen />);
    fireEvent.press(getByLabelText("Refuser l'appel"));
    await Promise.resolve();
    await Promise.resolve();
    expect(mockDeclineIncoming).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalled();
  });
});
