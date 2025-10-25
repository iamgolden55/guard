/**
 * Button Component Tests
 * Tests for the Button UI component
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('should render with default props', () => {
    const { getByText } = render(<Button title="Click Me" onPress={jest.fn()} />);
    
    expect(getByText('Click Me')).toBeTruthy();
  });

  it('should call onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button title="Click Me" onPress={onPressMock} />
    );
    
    fireEvent.press(getByText('Click Me'));
    
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('should not call onPress when disabled', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button title="Click Me" onPress={onPressMock} disabled />
    );
    
    fireEvent.press(getByText('Click Me'));
    
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('should render with primary variant', () => {
    const { getByText } = render(
      <Button title="Primary Button" onPress={jest.fn()} variant="primary" />
    );
    
    expect(getByText('Primary Button')).toBeTruthy();
  });

  it('should render with secondary variant', () => {
    const { getByText } = render(
      <Button title="Secondary Button" onPress={jest.fn()} variant="secondary" />
    );
    
    expect(getByText('Secondary Button')).toBeTruthy();
  });

  it('should render with large size', () => {
    const { getByText } = render(
      <Button title="Large Button" onPress={jest.fn()} size="large" />
    );
    
    expect(getByText('Large Button')).toBeTruthy();
  });

  it('should render with icon', () => {
    const IconComponent = () => <></>;
    const { getByText } = render(
      <Button title="Button with Icon" onPress={jest.fn()} icon={<IconComponent />} />
    );
    
    expect(getByText('Button with Icon')).toBeTruthy();
  });

  it('should render as full width when fullWidth is true', () => {
    const { getByText } = render(
      <Button title="Full Width Button" onPress={jest.fn()} fullWidth />
    );
    
    const button = getByText('Full Width Button').parent;
    expect(button).toBeTruthy();
  });

  it('should apply custom styles', () => {
    const customStyle = { backgroundColor: 'red' };
    const { getByText } = render(
      <Button title="Styled Button" onPress={jest.fn()} style={customStyle} />
    );
    
    expect(getByText('Styled Button')).toBeTruthy();
  });

  it('should show loading state', () => {
    const { queryByText } = render(
      <Button title="Loading Button" onPress={jest.fn()} loading />
    );
    
    // When loading, the title should not be visible
    expect(queryByText('Loading Button')).toBeNull();
  });
});
