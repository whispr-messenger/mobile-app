import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@livekit/react-native', () => ({
  VideoTrack: () => null,
}));

jest.mock('livekit-client', () => ({
  Track: { Source: { Camera: 'camera' } },
}));

import { CallParticipantTile } from '../src/components/Calls/CallParticipantTile';

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
    const { getAllByText } = render(<CallParticipantTile participant={p as any} />);
    // The new design renders the identity twice in the placeholder branch:
    // once as the main label and once in the bottom name badge that overlays
    // every tile. We just need to assert it appears at least once.
    expect(getAllByText('alice').length).toBeGreaterThanOrEqual(1);
  });

  it('does not render the placeholder when a video track is present', () => {
    const p = makeParticipant({ identity: 'bob', hasVideo: true });
    const { queryByText } = render(<CallParticipantTile participant={p as any} />);
    // The "Participant" sub-label is only emitted inside the placeholder
    // branch, so its absence proves we rendered the video tile path. The
    // identity itself is now also shown on the always-visible name badge.
    expect(queryByText('Participant')).toBeNull();
  });
});
