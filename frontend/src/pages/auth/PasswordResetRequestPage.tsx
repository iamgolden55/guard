import React from 'react';
import { Link } from 'react-router-dom';
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
import axios from 'axios';

const PasswordResetRequestPage: React.FC = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSuccess, setIsSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Validation schema
  const validationSchema = Yup.object({
    email: Yup.string()
      .email('Please enter a valid email address')
      .required('Email is required')
  });

  // Form handling with Formik
  const formik = useFormik({
    initialValues: {
      email: ''
    },
    validationSchema,
    onSubmit: async (values) => {
      setIsLoading(true);
      setError(null);
      try {
        await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/v1/password-reset/request/`, {
          email: values.email
        });
        setIsSuccess(true);
      } catch (err) {
        console.error('Password reset request error:', err);
        // Always show the same message for security
        setIsSuccess(true);
      } finally {
        setIsLoading(false);
      }
    }
  });

  // If success, show success message
  if (isSuccess) {
    return (
      <AuthLayout
        title="Check Your Email"
        subtitle="Password reset instructions sent"
      >
        <Stack tokens={{ childrenGap: 16 }}>
          <MessageBar
            messageBarType={MessageBarType.success}
            isMultiline
          >
            If an account exists with the email address you provided, you will receive a password reset link shortly.
          </MessageBar>

          <div className="text-sm text-gray-600">
            <p>Please check your email inbox and spam folder for the password reset link.</p>
            <p className="mt-2">The link will expire in 24 hours.</p>
          </div>

          <div className="text-center mt-4">
            <Link to="/login" className="text-blue-600 hover:underline">
              Back to Login
            </Link>
          </div>
        </Stack>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your email address to receive reset instructions"
    >
      <form onSubmit={formik.handleSubmit}>
        <Stack tokens={{ childrenGap: 16 }}>
          {/* Error message */}
          {error && (
            <MessageBar
              messageBarType={MessageBarType.error}
              isMultiline={false}
              dismissButtonAriaLabel="Close"
            >
              {error}
            </MessageBar>
          )}

          {/* Instructions */}
          <div className="text-sm text-gray-600">
            <p>
              Enter the email address associated with your account and we'll send you a link to reset your password.
            </p>
          </div>

          {/* Email field */}
          <TextField
            label="Email Address"
            name="email"
            type="email"
            value={formik.values.email}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            errorMessage={
              formik.touched.email && formik.errors.email
                ? formik.errors.email
                : undefined
            }
            disabled={isLoading}
            autoComplete="email"
            required
          />

          {/* Submit button */}
          <PrimaryButton
            type="submit"
            text={isLoading ? undefined : "Send Reset Link"}
            disabled={isLoading}
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

export default PasswordResetRequestPage;
