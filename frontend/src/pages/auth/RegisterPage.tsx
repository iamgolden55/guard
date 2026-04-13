import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { useAuth } from '../../contexts/AuthContext';

const RegisterPage: React.FC = () => {
  const { register, authState } = useAuth();
  const navigate = useNavigate();

  // Redirect based on authentication and onboarding status
  React.useEffect(() => {
    if (authState.isAuthenticated) {
      // If onboarding is not completed, redirect to onboarding
      if (authState.onboarding.isCompleted === false) {
        const currentStep = authState.onboarding.currentStep || 1;
        navigate(`/onboarding/step/${currentStep}`);
      } else {
        // If onboarding is completed, redirect to dashboard
        navigate('/dashboard');
      }
    }
  }, [authState.isAuthenticated, authState.onboarding, navigate]);

  // Registration form validation schema
  const validationSchema = Yup.object({
    username: Yup.string()
      .required('Username is required')
      .min(3, 'Username must be at least 3 characters'),
    email: Yup.string()
      .email('Invalid email address')
      .required('Email is required'),
    firstName: Yup.string()
      .required('First name is required'),
    lastName: Yup.string()
      .required('Last name is required'),
    password: Yup.string()
      .required('Password is required')
      .min(8, 'Password must be at least 8 characters')
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      ),
    confirmPassword: Yup.string()
      .oneOf([Yup.ref('password')], 'Passwords must match')
      .required('Please confirm your password')
  });

  // Form handling with Formik
  const formik = useFormik({
    initialValues: {
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: ''
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        // The confirmPassword field is only used for validation
        const { confirmPassword, ...registrationData } = values;
        await register(registrationData);
        // Navigation will happen in the useEffect above when isAuthenticated changes
      } catch (error) {
        // Error is handled by the auth context and shown in the form
      }
    }
  });

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Sign up to get started"
    >
      <form onSubmit={formik.handleSubmit}>
        <Stack tokens={{ childrenGap: 16 }}>
          {/* Error message */}
          {authState.error && (
            <MessageBar
              messageBarType={MessageBarType.error}
              isMultiline={false}
              dismissButtonAriaLabel="Close"
            >
              {authState.error}
            </MessageBar>
          )}

          {/* Username field */}
          <TextField
            label="Username"
            name="username"
            value={formik.values.username}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            errorMessage={
              formik.touched.username && formik.errors.username
                ? formik.errors.username
                : undefined
            }
            disabled={authState.isLoading}
            autoComplete="username"
            required
          />

          {/* Email field */}
          <TextField
            label="Email"
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
            disabled={authState.isLoading}
            autoComplete="email"
            required
          />

          {/* First Name field */}
          <TextField
            label="First Name"
            name="firstName"
            value={formik.values.firstName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            errorMessage={
              formik.touched.firstName && formik.errors.firstName
                ? formik.errors.firstName
                : undefined
            }
            disabled={authState.isLoading}
            autoComplete="given-name"
            required
          />

          {/* Last Name field */}
          <TextField
            label="Last Name"
            name="lastName"
            value={formik.values.lastName}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            errorMessage={
              formik.touched.lastName && formik.errors.lastName
                ? formik.errors.lastName
                : undefined
            }
            disabled={authState.isLoading}
            autoComplete="family-name"
            required
          />

          {/* Password field */}
          <TextField
            label="Password"
            name="password"
            type="password"
            value={formik.values.password}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            errorMessage={
              formik.touched.password && formik.errors.password
                ? formik.errors.password
                : undefined
            }
            disabled={authState.isLoading}
            autoComplete="new-password"
            canRevealPassword
            required
          />

          {/* Confirm Password field */}
          <TextField
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={formik.values.confirmPassword}
            onChange={formik.handleChange}
            onBlur={formik.handleBlur}
            errorMessage={
              formik.touched.confirmPassword && formik.errors.confirmPassword
                ? formik.errors.confirmPassword
                : undefined
            }
            disabled={authState.isLoading}
            autoComplete="new-password"
            canRevealPassword
            required
          />

          {/* Submit button */}
          <PrimaryButton
            type="submit"
            text={authState.isLoading ? undefined : "Create Account"}
            disabled={authState.isLoading}
          >
            {authState.isLoading && <Spinner size={SpinnerSize.small} />}
          </PrimaryButton>

          {/* Login link */}
          <div className="text-center mt-4">
            <p className="text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </Stack>
      </form>
    </AuthLayout>
  );
};

export default RegisterPage;
