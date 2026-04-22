import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@livekit/react-native', () => ({
  VideoTrack: () => null,
}));

jest.mock('livekit-client', () => ({
  Track: { Source: { Camera: 'camera' } },
}));

import { CallParticipantTile } from './src/components/Calls/CallParticipantTile';

const makeParticipant = (opts: {
  identity: string;
  hasVideo?: boolean;
}) => ({
  identity: opts.identity,
  getTrackPublication: jest.fn().mockReturnValue(
    opts.hasVideo
      ? {
          videoTrack: { sid: 'track-1' },
        }
      : undefined,
  ),
});

describe('CallParticipantTile', () => {
  it('matches snapshot without video track (placeholder)', () => {
    const p = makeParticipant({ identity: 'alice' });
    const { toJSON } = render(<CallParticipantTile participant={p as any} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('matches snapshot with video track', () => {
    const p = makeParticipant({ identity: 'bob', hasVideo: true });
    const { toJSON } = render(<CallParticipantTile participant={p as any} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('renders the participant identity when no video track is published', () => {
    const p = makeParticipant({ identity: 'alice' });
    const { getByText } = render(<CallParticipantTile participant={p as any} />);
    expect(getByText('alice')).toBeTruthy();
  });

  it('does not render the placeholder when a video track is present', () => {
    const p = makeParticipant({ identity: 'bob', hasVideo: true });
    const { queryByText } = render(<CallParticipantTile participant={p as any} />);
    expect(queryByText('bob')).toBeNull();
  });
});
