import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { AuthLayout } from '../../layouts';
import { useAuth } from '../../contexts/AuthContext';
import { XCircle, User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';

const LoginPage: React.FC = () => {
  const { login, authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const sessionExpired = searchParams.get('expired') === 'true';
  const from = location.state?.from?.pathname || '/';
  const hasRedirectedRef = React.useRef(false);

  React.useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (authState.isAuthenticated && !authState.isLoading && !authState.onboardingLoading) {
      hasRedirectedRef.current = true;
      if (!authState.onboarding.isCompleted) {
        const currentStep = authState.onboarding.currentStep || 1;
        navigate(`/onboarding/step/${currentStep}`);
      } else {
        navigate(from === '/' ? '/dashboard' : from);
      }
    }
  }, [authState.isAuthenticated, authState.isLoading, authState.onboardingLoading, authState.onboarding.isCompleted, authState.onboarding.currentStep, navigate, from]);

  React.useEffect(() => {
    if (sessionExpired) setLoginError('Your session has expired. Please log in again.');
  }, [sessionExpired]);

  const formik = useFormik({
    initialValues: { username: '', password: '' },
    validationSchema: Yup.object({
      username: Yup.string().required('Email or username is required'),
      password: Yup.string().required('Password is required'),
    }),
    onSubmit: async (values) => {
      setLoginError(null);
      try {
        await login(values.username, values.password);
      } catch (error) {
        setLoginError('Login failed. Please check your credentials and try again.');
      }
    },
  });

  const errorMessage = authState.error || loginError;

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to your Mead Security account"
      illustration="https://cdn.undraw.co/illustration/security-on_3ykb.svg"
    >
      <form onSubmit={formik.handleSubmit} className="space-y-5">

        {/* Error banner */}
        {errorMessage && (
          <div className="flex items-center gap-3 p-4 bg-[#FEF2F2] border border-[#FECACA] rounded-xl">
            <div className="w-8 h-8 rounded-lg bg-[#DC2626]/10 flex items-center justify-center flex-shrink-0">
              <XCircle size={14} className="text-[#DC2626]" />
            </div>
            <p className="text-[13px] text-[#991B1B]">{errorMessage}</p>
          </div>
        )}

        {/* Email / Username */}
        <div>
          <label htmlFor="username" className="block text-[13px] font-medium text-[#374151] mb-1.5">
            Email or Username
          </label>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
              <User size={16} className="text-[#9CA3AF]" />
            </div>
            <input
              id="username"
              name="username"
              type="text"
              placeholder="Enter your email or username"
              autoComplete="username email"
              value={formik.values.username}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={authState.isLoading}
              className={`w-full h-11 pl-10 pr-4 text-[14px] bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] placeholder-[#9CA3AF] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                formik.touched.username && formik.errors.username
                  ? 'border-[#DC2626] bg-[#FEF2F2]/30'
                  : 'border-[#E5E7EB]'
              }`}
            />
          </div>
          {formik.touched.username && formik.errors.username && (
            <p className="mt-1.5 text-[12px] text-[#DC2626]">{formik.errors.username}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label htmlFor="password" className="text-[13px] font-medium text-[#374151]">
              Password
            </label>
            <Link
              to="/reset-password"
              className="text-[12px] font-medium text-[#DC2626] hover:text-[#B91C1C] no-underline transition-colors"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
              <Lock size={16} className="text-[#9CA3AF]" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={formik.values.password}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              disabled={authState.isLoading}
              className={`w-full h-11 pl-10 pr-11 text-[14px] bg-white border rounded-xl focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] placeholder-[#9CA3AF] transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                formik.touched.password && formik.errors.password
                  ? 'border-[#DC2626] bg-[#FEF2F2]/30'
                  : 'border-[#E5E7EB]'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#6B7280] transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {formik.touched.password && formik.errors.password && (
            <p className="mt-1.5 text-[12px] text-[#DC2626]">{formik.errors.password}</p>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={authState.isLoading}
          className="w-full h-11 flex items-center justify-center gap-2 text-[14px] font-semibold text-white bg-[#1A1A2E] rounded-xl hover:bg-[#374151] focus:outline-none focus:ring-2 focus:ring-[#1A1A2E]/30 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {authState.isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Sign in
              <ArrowRight size={13} />
            </>
          )}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 py-1">
          <div className="flex-1 h-px bg-[#E5E7EB]" />
          <span className="text-[11px] text-[#9CA3AF] font-medium uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-[#E5E7EB]" />
        </div>

        {/* Register link */}
        <p className="text-center text-[13px] text-[#6B7280]">
          Don't have an account?{' '}
          <Link
            to="/register"
            className="font-semibold text-[#DC2626] hover:text-[#B91C1C] no-underline transition-colors"
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
};

export default LoginPage;
