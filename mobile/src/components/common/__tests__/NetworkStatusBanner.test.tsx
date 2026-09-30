/**
 * The "not sent · tap to review" banner has to be tappable.
 *
 * It was drawn from the top edge of the screen, so its text sat in the iOS
 * status bar, which doesn't deliver taps: the only way to review or discard a
 * failed item couldn't be reached.
 */
import React from 'react';
import { Alert, StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { NetworkStatusBanner } from '../NetworkStatusBanner';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('../../../hooks/useNetworkStatus', () => ({
  useNetworkStatus: () => ({ isOnline: true, isSyncing: false, queueCount: 0, failedCount: 1 }),
}));
jest.mock('../../../services/syncService', () => ({
  syncService: {
    getFailedItems: jest.fn(async () => [
      { type: 'create_incident', error: 'HTTP 400: actions_taken: This field may not be blank.' },
    ]),
    retryFailedItems: jest.fn(),
    clearFailedItems: jest.fn(),
  },
}));

it('starts its content below the status bar', () => {
  const { getByText } = render(<NetworkStatusBanner />);
  let node: any = getByText('1 item not sent · tap to review');
  let paddingTop: number | undefined;
  while (node && paddingTop === undefined) {
    paddingTop = StyleSheet.flatten(node.props.style)?.paddingTop;
    node = node.parent;
  }
  expect(paddingTop).toBe(47 + 12);
});

it('opens the review when tapped', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { getByText } = render(<NetworkStatusBanner />);

  fireEvent.press(getByText('1 item not sent · tap to review'));

  await waitFor(() => expect(alert).toHaveBeenCalled());
  const [title, message, buttons] = alert.mock.calls[0];
  expect(title).toBe('1 item was not sent');
  expect(message).toContain('Incident report: actions_taken: This field may not be blank.');
  expect(buttons?.map((b) => b.text)).toEqual(['Close', 'Discard', 'Try again']);
  alert.mockRestore();
});
