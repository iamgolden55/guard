import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { initializeIcons, ThemeProvider } from '@fluentui/react';
import { AuthProvider } from './contexts/AuthContext';
import Router from './Router';
import redTheme from './utils/theme';

// Initialize Fluent UI icons
initializeIcons();

function App() {
  return (
    <ThemeProvider theme={redTheme}>
      <BrowserRouter>
        <AuthProvider>
          <Router />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
