import React from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  PrimaryButton,
  TextField,
  Stack,
  MessageBar,
  MessageBarType,
  Spinner,
  SpinnerSize
} from '@fluentui/react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { AuthLayout } from '../../layouts';
import PasswordStrengthIndicator from '../../components/PasswordStrengthIndicator';
import axios from 'axios';

const PasswordResetConfirmPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = React.useState(false);
  const [isValidating, setIsValidating] = React.useState(true);
  const [isValidToken, setIsValidToken] = React.useState(false);
  const [email, setEmail] = React.useState<string>('');
  const [error, setError] = React.useState<string | null>(null);
  const [isSuccess, setIsSuccess] = React.useState(false);

  // Validate token on mount
  React.useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError('Invalid reset link');
        setIsValidating(false);
        return;
      }

      try {
        const response = await axios.get(
          `/api/v1/password-reset/validate/${token}/`
        );
        setIsValidToken(response.data.valid);
        setEmail(response.data.email || '');
      } catch (err: any) {
        console.error('Token validation error:', err);
        setError(err.response?.data?.message || 'Invalid or expired reset link');
        setIsValidToken(false);
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  // Validation schema
  const validationSchema = Yup.object({
    new_password: Yup.string()
      .min(8, 'Password must be at least 8 characters')
      .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
      .matches(/\d/, 'Password must contain at least one number')
      .matches(/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/, 'Password must contain at least one special character')
      .required('Password is required'),
    confirm_password: Yup.string()
      .oneOf([Yup.ref('new_password')], 'Passwords must match')
      .required('Please confirm your password')
  });

  // Form handling with Formik
  const formik = useFormik({
    initialValues: {
      new_password: '',
      confirm_password: ''
    },
    validationSchema,
    onSubmit: async (values) => {
      setIsLoading(true);
      setError(null);
      try {
        await axios.post(`/api/v1/password-reset/confirm/`, {
          token,
          new_password: values.new_password,
          confirm_password: values.confirm_password
        });
        setIsSuccess(true);
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } catch (err: any) {
        console.error('Password reset error:', err);
        if (err.response?.data?.error) {
          setError(err.response.data.error);
        } else if (err.response?.data?.new_password) {
          setError(err.response.data.new_password[0]);
        } else if (err.response?.data?.confirm_password) {
          setError(err.response.data.confirm_password[0]);
        } else {
          setError('Failed to reset password. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    }
  });

  // If token is being validated
  if (isValidating) {
    return (
      <AuthLayout
        title="Reset Password"
        subtitle="Validating your reset link"
      >
        <div className="text-center py-8">
          <Spinner size={SpinnerSize.large} label="Validating reset link..." />
        </div>
      </AuthLayout>
    );
  }

  // If token is invalid
  if (!isValidToken) {
    return (
      <AuthLayout
        title="Invalid Reset Link"
        subtitle="This password reset link is not valid"
      >
        <Stack tokens={{ childrenGap: 16 }}>
          <MessageBar
            messageBarType={MessageBarType.error}
            isMultiline
          >
            {error || 'The password reset link is invalid or has expired. Please request a new one.'}
          </MessageBar>

          <div className="text-center mt-4">
            <Link to="/reset-password" className="text-blue-600 hover:underline">
              Request a new reset link
            </Link>
          </div>

          <div className="text-center">
            <Link to="/login" className="text-blue-600 hover:underline">
              Back to Login
            </Link>
          </div>
        </Stack>
      </AuthLayout>
    );
  }

  // If password reset was successful
  if (isSuccess) {
    return (
      <AuthLayout
        title="Password Reset Successful"
        subtitle="Your password has been updated"
      >
        <Stack tokens={{ childrenGap: 16 }}>
          <MessageBar
            messageBarType={MessageBarType.success}
            isMultiline
          >
            Your password has been successfully reset. You can now log in with your new password.
          </MessageBar>

          <div className="text-sm text-gray-600 text-center">
            <p>Redirecting to login page in 3 seconds...</p>
          </div>

          <div className="text-center">
            <Link to="/login" className="text-blue-600 hover:underline">
              Go to Login Now
            </Link>
          </div>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set New Password"
      subtitle={email ? `for ${email}` : 'Create a strong password'}
    >
      <form onSubmit={formik.handleSubmit}>
        <Stack tokens={{ childrenGap: 16 }}>
          {/* Error message */}
          {error && (
            <MessageBar
              messageBarType={MessageBarType.error}
              isMultiline={false}
              dismissButtonAriaLabel="Close"
              onDismiss={() => setError(null)}
            >
              {error}
            </MessageBar>
          )}

          {/* Instructions */}
          <div className="text-sm text-gray-600">
            <p>
              Please enter your new password. Make sure it's strong and secure.
            </p>
          </div>

          {/* New Password field */}
          <div>
            <TextField
              label="New Password"
              name="new_password"
              type="password"
              value={formik.values.new_password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              errorMessage={
                formik.touched.new_password && formik.errors.new_password
                  ? formik.errors.new_password
                  : undefined
              }
              disabled={isLoading}
              autoComplete="new-password"
              canRevealPassword
              required
            />
            <PasswordStrengthIndicator password={formik.values.new_password} />
          </div>

          {/* Confirm Password field */}
          <TextField
            label="Confirm New Password"
            name="confirm_password"
            type="password"
            value={formik.values.confirm_password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            errorMessage={
              formik.touched.confirm_password && formik.errors.confirm_password
                ? formik.errors.confirm_password
                : undefined
            }
            disabled={isLoading}
            autoComplete="new-password"
            canRevealPassword
            required
          />

          {/* Submit button */}
          <PrimaryButton
            type="submit"
            text={isLoading ? undefined : "Reset Password"}
            disabled={isLoading || !formik.isValid}
          >
            {isLoading && <Spinner size={SpinnerSize.small} />}
          </PrimaryButton>

          {/* Back to login link */}
          <div className="text-center mt-4">
            <p className="text-gray-600">
              Remember your password?{' '}
              <Link to="/login" className="text-blue-600 hover:underline">
                Back to Login
              </Link>
            </p>
          </div>
        </Stack>
      </form>
    </AuthLayout>
  );
};

export default PasswordResetConfirmPage;
