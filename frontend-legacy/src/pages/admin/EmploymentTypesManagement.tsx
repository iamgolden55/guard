import React from 'react';
import { EmploymentTypesManagement as EmploymentTypesManagementComponent } from '../../components';
import { Header, SpaceBetween } from '../../components/cloudscape';

const EmploymentTypesManagement: React.FC = () => {
  return (
    <SpaceBetween size="m">
      <Header
        variant="h1"
        description="Manage the employment types available for your company's recruitment process. Each employment type represents a job category that candidates can apply for."
      >
        Employment types
      </Header>

      <EmploymentTypesManagementComponent />
    </SpaceBetween>
  );
};

export default EmploymentTypesManagement;
