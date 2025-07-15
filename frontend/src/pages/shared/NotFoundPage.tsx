import type React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Stack,
  Text,
  PrimaryButton,
  FontIcon
} from '@fluentui/react';
import { MainLayout } from '../../layouts';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <MainLayout>
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Stack
          horizontalAlign="center"
          tokens={{ childrenGap: 20 }}
          className="max-w-lg p-8 bg-white rounded-lg shadow-md"
        >
          <FontIcon
            iconName="SearchIssue"
            className="text-blue-500"
            style={{ fontSize: 64 }}
          />

          <Text variant="superLarge" className="font-bold text-center">
            404
          </Text>

          <Text variant="xxLarge" className="font-bold text-center">
            Page Not Found
          </Text>

          <Text variant="medium" className="text-center mb-4">
            The page you are looking for doesn't exist or has been moved.
          </Text>

          <PrimaryButton
            text="Go to Dashboard"
            onClick={() => navigate('/')}
          />
        </Stack>
      </div>
    </MainLayout>
  );
};

export default NotFoundPage;
