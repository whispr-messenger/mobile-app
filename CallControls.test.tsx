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

  it('shows French mic label depending on muted state', () => {
    const props = makeProps();
    const { getByText, rerender } = render(<CallControls {...props} />);
    expect(getByText('Couper micro')).toBeTruthy();
    rerender(<CallControls {...props} muted />);
    expect(getByText('Activer micro')).toBeTruthy();
  });

  it('shows French camera label depending on cameraOff state', () => {
    const props = makeProps();
    const { getByText, rerender } = render(<CallControls {...props} />);
    expect(getByText('Couper caméra')).toBeTruthy();
    rerender(<CallControls {...props} cameraOff />);
    expect(getByText('Activer caméra')).toBeTruthy();
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

  it('fires onEnd when end button is pressed', () => {
    const props = makeProps();
    const { getByLabelText } = render(<CallControls {...props} />);
    fireEvent.press(getByLabelText('Fin'));
    expect(props.onEnd).toHaveBeenCalledTimes(1);
  });
});
