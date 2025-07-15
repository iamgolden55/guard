import type React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  FontIcon
} from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { useAuth } from '../../contexts/AuthContext';

const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Stack
          horizontalAlign="center"
          tokens={{ childrenGap: 20 }}
          className="max-w-lg p-8 bg-white rounded-lg shadow-md"
        >
          <FontIcon
            iconName="SecurityError"
            className="text-red-500"
            style={{ fontSize: 64 }}
          />

          <Text variant="xxLarge" className="font-bold text-center">
            Access Denied
          </Text>

          <Text variant="medium" className="text-center mb-4">
            You don't have permission to access this page. Please contact your
            administrator if you believe you should have access.
          </Text>

          <Stack horizontal tokens={{ childrenGap: 10 }}>
            <PrimaryButton
              text="Go to Dashboard"
              onClick={() => navigate('/')}
            />
            <DefaultButton
              text="Logout"
              onClick={handleLogout}
            />
          </Stack>
        </Stack>
      </div>
    </MainLayout>
  );
};

export default UnauthorizedPage;
