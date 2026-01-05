import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PrimaryButton,
  DefaultButton,
  Stack,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize,
  Text
} from '@fluentui/react';
import { AuthLayout } from '../../layouts';
import { useAuth } from '../../contexts/AuthContext';

const CompanySetupPage: React.FC = () => {
  const { authState, logout } = useAuth();
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Log the situation for debugging
  React.useEffect(() => {
    console.log('CompanySetupPage - User situation:', {
      userId: authState.user?.id,
      username: authState.user?.username,
      onboardingComplete: authState.onboarding.isCompleted,
      hasCompany: authState.onboarding.hasCompany,
      currentMembership: authState.currentMembership
    });
  }, [authState]);

  // Determine user's situation
  const getUserSituation = () => {
    if (!authState.onboarding.isCompleted) {
      return {
        title: 'Onboarding Incomplete',
        message: 'Your account setup is not complete. Please complete the onboarding process to access your dashboard.',
        action: 'complete-onboarding'
      };
    }

    if (authState.onboarding.isCompleted && !authState.currentMembership) {
      return {
        title: 'Company Membership Missing',
        message: 'Your account has completed onboarding, but we cannot find your company membership. This may be a temporary issue or a data synchronization problem.',
        action: 'refresh-or-contact'
      };
    }

    return {
      title: 'Unexpected Situation',
      message: 'We encountered an unexpected issue with your account. Please contact support for assistance.',
      action: 'contact-support'
    };
  };

  const situation = getUserSituation();

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setErrorMessage(null);

    try {
      // Reload the page to re-fetch all auth state
      window.location.reload();
    } catch (error) {
      console.error('Failed to refresh:', error);
      setErrorMessage('Failed to refresh your account status. Please try again or contact support.');
      setIsRefreshing(false);
    }
  };

  const handleCompleteOnboarding = () => {
    const currentStep = authState.onboarding.currentStep || 1;
    navigate(`/onboarding/step/${currentStep}`);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to logout:', error);
      setErrorMessage('Failed to log out. Please try again.');
    }
  };

  return (
    <AuthLayout>
      <div className="max-w-2xl mx-auto">
        <Stack tokens={{ childrenGap: 20 }}>
          {/* Header */}
          <div className="text-center">
            <Text variant="xxLarge" className="block mb-4 font-bold">
              {situation.title}
            </Text>
            <Text variant="large" className="block text-gray-600">
              {situation.message}
            </Text>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <MessageBar
              messageBarType={MessageBarType.error}
              isMultiline={true}
              onDismiss={() => setErrorMessage(null)}
            >
              {errorMessage}
            </MessageBar>
          )}

          {/* Action Buttons */}
          <Stack tokens={{ childrenGap: 15 }}>
            {situation.action === 'complete-onboarding' && (
              <>
                <PrimaryButton
                  text="Complete Onboarding"
                  onClick={handleCompleteOnboarding}
                  className="w-full"
                />
                <DefaultButton
                  text="Log Out"
                  onClick={handleLogout}
                  className="w-full"
                />
              </>
            )}

            {situation.action === 'refresh-or-contact' && (
              <>
                <MessageBar
                  messageBarType={MessageBarType.info}
                  isMultiline={true}
                >
                  <strong>What happened?</strong>
                  <br />
                  Your account completed the onboarding process, but your company membership record is missing from our database. This typically happens due to:
                  <ul className="mt-2 ml-4 list-disc">
                    <li>A temporary synchronization issue during onboarding</li>
                    <li>Your company membership being deactivated</li>
                    <li>A system update or migration issue</li>
                  </ul>
                  <br />
                  <strong>What to do:</strong>
                  <br />
                  1. Try refreshing your account status using the button below
                  <br />
                  2. If that doesn't work, log out and log back in
                  <br />
                  3. If the issue persists, contact your system administrator
                </MessageBar>

                <PrimaryButton
                  text={isRefreshing ? "Refreshing..." : "Refresh Account Status"}
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="w-full"
                >
                  {isRefreshing && <Spinner size={SpinnerSize.small} className="mr-2" />}
                </PrimaryButton>

                <DefaultButton
                  text="Log Out & Try Again"
                  onClick={handleLogout}
                  className="w-full"
                />
              </>
            )}

            {situation.action === 'contact-support' && (
              <>
                <MessageBar
                  messageBarType={MessageBarType.warning}
                  isMultiline={true}
                >
                  We're sorry, but we encountered an unexpected issue with your account. Please contact your system administrator for assistance.
                </MessageBar>

                <DefaultButton
                  text="Log Out"
                  onClick={handleLogout}
                  className="w-full"
                />
              </>
            )}
          </Stack>

          {/* Support Information */}
          <div className="mt-8 p-4 bg-gray-50 rounded-lg">
            <Text variant="medium" className="block font-semibold mb-2">
              Need Help?
            </Text>
            <Text variant="small" className="block text-gray-600">
              If you continue to experience issues, please contact your system administrator or support team with the following information:
            </Text>
            <div className="mt-3 p-3 bg-white rounded border border-gray-200">
              <Text variant="small" className="block font-mono text-xs text-gray-700">
                User ID: {authState.user?.id || 'N/A'}
                <br />
                Username: {authState.user?.username || 'N/A'}
                <br />
                Onboarding Status: {authState.onboarding.isCompleted ? 'Completed' : 'Incomplete'}
                <br />
                Company Membership: {authState.currentMembership ? 'Found' : 'Missing'}
                <br />
                Timestamp: {new Date().toISOString()}
              </Text>
            </div>
          </div>
        </Stack>
      </div>
    </AuthLayout>
  );
};

export default CompanySetupPage;
