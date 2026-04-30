import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CallControls } from '../src/components/Calls/CallControls';

describe('CallControls', () => {
  const makeProps = () => ({
    muted: false,
    cameraOff: false,
    onToggleMute: jest.fn(),
    onToggleCamera: jest.fn(),
    onFlip: jest.fn(),
    onEnd: jest.fn(),
  });

  // The redesigned bar always renders four buttons (mic, camera, flip, end).
  // We assert the count rather than snapshotting the whole tree because the
  // styling is heavy and snapshots break on every visual tweak.
  it('renders four control buttons', () => {
    const { getAllByRole } = render(<CallControls {...makeProps()} />);
    expect(getAllByRole('button')).toHaveLength(4);
  });

  // Mic button keeps a stable accessibilityLabel ("Micro") and surfaces the
  // muted/active state via a helper line ("Coupé" / "Activé").
  it('shows the French mic helper text depending on muted state', () => {
    const props = makeProps();
    const { getByText, rerender } = render(<CallControls {...props} />);
    expect(getByText('Coupé')).toBeTruthy();
    rerender(<CallControls {...props} muted />);
    expect(getByText('Activé')).toBeTruthy();
  });

  // Same pattern for the camera button: label stays "Caméra", helper toggles
  // "Active" ↔ "Coupée".
  it('shows the French camera helper text depending on cameraOff state', () => {
    const props = makeProps();
    const { getByText, rerender } = render(<CallControls {...props} />);
    expect(getByText('Active')).toBeTruthy();
    rerender(<CallControls {...props} cameraOff />);
    expect(getByText('Coupée')).toBeTruthy();
  });

  it('fires onToggleMute when mic button is pressed', () => {
    const props = makeProps();
    const { getByLabelText } = render(<CallControls {...props} />);
    fireEvent.press(getByLabelText('Couper micro'));
    expect(props.onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('fires onToggleCamera when camera button is pressed', () => {
    const props = makeProps();
    const { getByLabelText } = render(<CallControls {...props} />);
    fireEvent.press(getByLabelText('Couper caméra'));
    expect(props.onToggleCamera).toHaveBeenCalledTimes(1);
  });

  it('fires onFlip when flip button is pressed', () => {
    const props = makeProps();
    const { getByLabelText } = render(<CallControls {...props} />);
    fireEvent.press(getByLabelText('Pivoter'));
    expect(props.onFlip).toHaveBeenCalledTimes(1);
  });

  // The end button has an empty accessibilityLabel by design (red icon-only
  // call button) — we press it via its helper text "Fin", which @testing-
  // library/react-native bubbles up to the parent TouchableOpacity.
  it('fires onEnd when end button is pressed', () => {
    const props = makeProps();
    const { getByText } = render(<CallControls {...props} />);
    fireEvent.press(getByText('Fin'));
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });
});
