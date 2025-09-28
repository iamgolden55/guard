import React from 'react';
import { Stack, Text } from '@fluentui/react';
import { MainLayout } from '../../layouts';
import { EmploymentTypesManagement as EmploymentTypesManagementComponent } from '../../components';

const EmploymentTypesManagement: React.FC = () => {
  return (
    <MainLayout>
      <Stack tokens={{ childrenGap: 24 }}>
        <Stack horizontal horizontalAlign="space-between" verticalAlign="center">
          <Text variant="xxLarge">Employment Types Management</Text>
        </Stack>

        <Stack tokens={{ childrenGap: 16 }}>
          <Text variant="large">
            Manage the employment types available for your company's recruitment process.
            Each employment type represents a job category that candidates can apply for.
          </Text>

          <EmploymentTypesManagementComponent />
        </Stack>
      </Stack>
    </MainLayout>
  );
};

export default EmploymentTypesManagement;