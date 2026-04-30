import React from 'react';
import { render } from '@testing-library/react-native';

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, canGoBack: mockCanGoBack }),
  // systemCallProvider.ts → navigationRef.ts evaluates this at import time.
  createNavigationContainerRef: () => ({
    current: null,
    isReady: () => false,
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
  }),
}));

const mockEnd = jest.fn().mockResolvedValue(undefined);
let mockActive: any = null;

jest.mock('../src/store/callsStore', () => {
  const fn: any = (selector: any) =>
    selector({ active: mockActive, end: mockEnd });
  fn.getState = () => ({ active: mockActive, end: mockEnd });
  return { useCallsStore: fn };
});

jest.mock('../src/services/calls/liveKitProvider', () => ({
  callsLiveKit: {
    enableMic: jest.fn().mockResolvedValue(undefined),
    enableCamera: jest.fn().mockResolvedValue(undefined),
    flipCamera: jest.fn(),
  },
}));

jest.mock('livekit-client', () => ({
  RoomEvent: {
    ParticipantConnected: 'participantConnected',
    ParticipantDisconnected: 'participantDisconnected',
    TrackSubscribed: 'trackSubscribed',
    TrackUnsubscribed: 'trackUnsubscribed',
    TrackMuted: 'trackMuted',
    TrackUnmuted: 'trackUnmuted',
    LocalTrackPublished: 'localTrackPublished',
  },
}));

jest.mock('../src/components/Calls/CallParticipantTile', () => ({
  CallParticipantTile: () => null,
}));

jest.mock('../src/components/Calls/CallControls', () => ({
  CallControls: () => null,
}));

import { InCallScreen } from '../src/screens/Calls/InCallScreen';

describe('InCallScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActive = null;
  });

  it('matches snapshot when no active call', () => {
    const { toJSON } = render(<InCallScreen />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders without crashing when there is an active room', () => {
    const room = {
      localParticipant: { identity: 'me' },
      remoteParticipants: new Map(),
      on: jest.fn(),
      off: jest.fn(),
    };
    mockActive = { callId: 'c1', status: 'connected', room };
    const { toJSON } = render(<InCallScreen />);
    expect(toJSON()).toBeTruthy();
    expect(room.on).toHaveBeenCalled();
  });

  it('subscribes to room events on mount and unsubscribes on unmount', () => {
    const room = {
      localParticipant: { identity: 'me' },
      remoteParticipants: new Map(),
      on: jest.fn(),
      off: jest.fn(),
    };
    mockActive = { callId: 'c1', status: 'connected', room };
    const { unmount } = render(<InCallScreen />);
    expect(room.on).toHaveBeenCalledTimes(7);
    unmount();
    expect(room.off).toHaveBeenCalledTimes(7);
  });

  it('ends the active call on unmount when user navigates away mid-call', () => {
    const room = {
      localParticipant: { identity: 'me' },
      remoteParticipants: new Map(),
      on: jest.fn(),
      off: jest.fn(),
    };
    mockActive = { callId: 'c1', status: 'connected', room };
    const { unmount } = render(<InCallScreen />);
    expect(mockEnd).not.toHaveBeenCalled();
    unmount();
    expect(mockEnd).toHaveBeenCalledTimes(1);
  });

  it('does not call end on unmount when no active call exists', () => {
    mockActive = null;
    const { unmount } = render(<InCallScreen />);
    unmount();
    expect(mockEnd).not.toHaveBeenCalled();
  });
});
