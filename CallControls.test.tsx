import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CallControls } from './src/components/Calls/CallControls';

describe('CallControls', () => {
  const makeProps = () => ({
    muted: false,
    cameraOff: false,
    onToggleMute: jest.fn(),
    onToggleCamera: jest.fn(),
    onFlip: jest.fn(),
    onEnd: jest.fn(),
  });

  it('matches snapshot (default state)', () => {
    const { toJSON } = render(<CallControls {...makeProps()} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it('shows "Mute" label when unmuted and "Unmute" when muted', () => {
    const props = makeProps();
    const { getByText, rerender } = render(<CallControls {...props} />);
    expect(getByText('Mute')).toBeTruthy();
    rerender(<CallControls {...props} muted />);
    expect(getByText('Unmute')).toBeTruthy();
  });

  it('shows "Cam off" label when camera on and "Cam on" when camera off', () => {
    const props = makeProps();
    const { getByText, rerender } = render(<CallControls {...props} />);
    expect(getByText('Cam off')).toBeTruthy();
    rerender(<CallControls {...props} cameraOff />);
    expect(getByText('Cam on')).toBeTruthy();
  });

  it('fires onToggleMute when Mute button is pressed', () => {
    const props = makeProps();
    const { getByLabelText } = render(<CallControls {...props} />);
    fireEvent.press(getByLabelText('Mute'));
    expect(props.onToggleMute).toHaveBeenCalledTimes(1);
  });

  it('fires onToggleCamera when Cam button is pressed', () => {
    const props = makeProps();
    const { getByLabelText } = render(<CallControls {...props} />);
    fireEvent.press(getByLabelText('Cam off'));
    expect(props.onToggleCamera).toHaveBeenCalledTimes(1);
  });

  it('fires onFlip when Flip button is pressed', () => {
    const props = makeProps();
    const { getByLabelText } = render(<CallControls {...props} />);
    fireEvent.press(getByLabelText('Flip'));
    expect(props.onFlip).toHaveBeenCalledTimes(1);
  });

  it('fires onEnd when End button is pressed', () => {
    const props = makeProps();
    const { getByLabelText } = render(<CallControls {...props} />);
    fireEvent.press(getByLabelText('End'));
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });
});
