import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
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

const LoginPage: React.FC = () => {
  const { login, authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginError, setLoginError] = React.useState<string | null>(null);

  // Check for expired session parameter
  const searchParams = new URLSearchParams(window.location.search);
  const sessionExpired = searchParams.get('expired') === 'true';

  // Get the previous location the user was trying to access
  const from = location.state?.from?.pathname || '/';

  // Redirect if already authenticated
  React.useEffect(() => {
    if (authState.isAuthenticated && !authState.isLoading) {
      navigate(from);
    }
  }, [authState, navigate, from]);

  // If session expired, show that message instead of any previous errors
  React.useEffect(() => {
    if (sessionExpired) {
      setLoginError('Your session has expired. Please log in again.');
    }
  }, [sessionExpired]);

  // Login form validation schema
  const validationSchema = Yup.object({
    username: Yup.string()
      .required('Username is required'),
    password: Yup.string()
      .required('Password is required')
  });

  // Form handling with Formik
  const formik = useFormik({
    initialValues: {
      username: '',
      password: ''
    },
    validationSchema,
    onSubmit: async (values) => {
      setLoginError(null);
      try {
        await login(values.username, values.password);
        // Navigation will happen in the useEffect above when isAuthenticated changes
      } catch (error) {
        console.error('Login error caught in form submit:', error);
        setLoginError('Login failed. Please check your credentials and try again.');
      }
    }
  });

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in to access your account"
    >
      <div className="mb-4">
        <div className="bg-blue-100 border border-blue-300 text-blue-800 px-4 py-2 rounded">
          <p className="font-semibold">Demo Login Credentials:</p>
          <ul className="list-disc list-inside">
            <li>Username: <span className="font-mono">admin</span>, Password: <span className="font-mono">any</span> (Admin Role)</li>
            <li>Username: <span className="font-mono">manager</span>, Password: <span className="font-mono">any</span> (Manager Role)</li>
            <li>Username: <span className="font-mono">staff</span>, Password: <span className="font-mono">any</span> (Staff Role)</li>
          </ul>
        </div>
      </div>

      <form onSubmit={formik.handleSubmit}>
        <Stack tokens={{ childrenGap: 16 }}>
          {/* Error message */}
          {(authState.error || loginError) && (
            <MessageBar
              messageBarType={MessageBarType.error}
              isMultiline={false}
              dismissButtonAriaLabel="Close"
            >
              {authState.error || loginError}
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
            autoComplete="current-password"
            canRevealPassword
            required
          />

          {/* Submit button */}
          <PrimaryButton
            type="submit"
            text={authState.isLoading ? undefined : "Sign In"}
            disabled={authState.isLoading}
          >
            {authState.isLoading && <Spinner size={SpinnerSize.small} />}
          </PrimaryButton>

          {/* Register link */}
          <div className="text-center mt-4">
            <p className="text-gray-600">
              Don't have an account?{' '}
              <Link to="/register" className="text-blue-600 hover:underline">
                Sign up here
              </Link>
            </p>
          </div>
        </Stack>
      </form>
    </AuthLayout>
  );
};

export default LoginPage;
