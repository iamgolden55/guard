/**
 * Error Boundary
 * Catches JavaScript errors in child components and displays a fallback UI
 * instead of crashing the entire app.
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

interface Props {
  children: React.ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.subtitle}>{this.props.fallbackLabel || 'An unexpected error occurred'}</Text>
          <Text style={styles.errorLabel}>Error:</Text>
          <Text style={styles.errorText}>{this.state.error?.message || 'Unknown error'}</Text>
          {this.state.error?.stack && (
            <>
              <Text style={styles.errorLabel}>Stack:</Text>
              <Text style={styles.stackText}>{this.state.error.stack}</Text>
            </>
          )}
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 80,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 24,
  },
  errorLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    marginTop: 16,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    fontFamily: 'Courier',
  },
  stackText: {
    fontSize: 11,
    color: '#666666',
    fontFamily: 'Courier',
  },
});
