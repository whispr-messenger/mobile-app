import React from 'react';
import { render } from '@testing-library/react-native';

const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(true);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, canGoBack: mockCanGoBack }),
}));

const mockEnd = jest.fn().mockResolvedValue(undefined);
let mockActive: any = null;

jest.mock('./src/store/callsStore', () => ({
  useCallsStore: (selector: any) => selector({ active: mockActive, end: mockEnd }),
}));

jest.mock('./src/services/calls/liveKitProvider', () => ({
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
  },
}));

jest.mock('./src/components/Calls/CallParticipantTile', () => ({
  CallParticipantTile: () => null,
}));

jest.mock('./src/components/Calls/CallControls', () => ({
  CallControls: () => null,
}));

import { InCallScreen } from './src/screens/Calls/InCallScreen';

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
    expect(room.on).toHaveBeenCalledTimes(4);
    unmount();
    expect(room.off).toHaveBeenCalledTimes(4);
  });
});
