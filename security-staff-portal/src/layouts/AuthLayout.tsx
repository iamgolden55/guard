import type React from 'react';
import { Link } from 'react-router-dom';
import { Stack, Text, useTheme } from '@fluentui/react';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  const theme = useTheme();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header
        className="p-4 flex justify-center shadow-md"
        style={{ backgroundColor: theme.palette.themePrimary }}
      >
        <Link to="/" className="text-white text-2xl font-bold">
          Security Staff Portal
        </Link>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full">
          <Stack tokens={{ childrenGap: 16 }}>
            <Stack.Item align="center">
              <Text variant="xxLarge" className="font-bold">{title}</Text>
              {subtitle && (
                <Text variant="medium" className="text-gray-500 mt-2 text-center">
                  {subtitle}
                </Text>
              )}
            </Stack.Item>

            <Stack.Item>
              {children}
            </Stack.Item>
          </Stack>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-gray-500 text-sm">
        <p>&copy; {new Date().getFullYear()} Security Staff Portal. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default AuthLayout;
