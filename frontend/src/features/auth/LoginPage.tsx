import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../../contexts/AuthContext';
import {
  XCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Shield,
  Fingerprint,
  Check,
} from 'lucide-react';

const PORTFOLIO_URL = 'https://iamgolden55.vercel.app/';
const BRAND_PRIMARY = '#cb2431';
const BRAND_PRIMARY_DARK = '#991b25';

const GoogleIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M12 5.04c1.74 0 3.31.6 4.55 1.78l3.4-3.4C17.95 1.5 15.24.5 12 .5 7.4.5 3.45 3.13 1.55 6.97l3.97 3.08C6.46 7.16 8.99 5.04 12 5.04z"
    />
    <path
      fill="#4285F4"
      d="M23.5 12.27c0-.85-.08-1.67-.22-2.47H12v4.68h6.46c-.28 1.5-1.13 2.78-2.4 3.62l3.86 3c2.26-2.09 3.58-5.18 3.58-8.83z"
    />
    <path
      fill="#FBBC05"
      d="M5.52 14.27a7.16 7.16 0 010-4.54L1.55 6.65A11.5 11.5 0 00.5 12c0 1.93.46 3.75 1.27 5.35l3.75-3.08z"
    />
    <path
      fill="#34A853"
      d="M12 23.5c3.24 0 5.96-1.07 7.94-2.9l-3.86-3c-1.07.72-2.45 1.16-4.08 1.16-3.01 0-5.54-2.12-6.46-4.99l-3.95 3.07C3.45 20.87 7.4 23.5 12 23.5z"
    />
  </svg>
);

const MicrosoftIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
    <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
    <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
    <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
  </svg>
);

const OktaIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="none" stroke="#007DC1" strokeWidth="4" />
  </svg>
);

interface SSOButtonProps {
  icon: React.ReactNode;
  label: string;
}

const SSOButton: React.FC<SSOButtonProps> = ({ icon, label }) => (
  <button
    type="button"
    disabled
    title="Coming soon"
    className="relative inline-flex items-center justify-center gap-2 bg-white border border-[#edebe9] rounded-[10px] px-3 py-2.5 text-[13px] font-semibold text-[#605e5c] font-['Plus_Jakarta_Sans'] cursor-not-allowed opacity-80 hover:opacity-100 transition-opacity"
  >
    {icon}
    <span>{label}</span>
    <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase bg-[#faf9f8] border border-[#edebe9] rounded-full text-[#a19f9d] leading-none">
      Soon
    </span>
  </button>
);

const LogoMark: React.FC<{ light?: boolean }> = ({ light }) => (
  <Link to="/" className="inline-flex items-center gap-3 no-underline">
    <img
      src="/logos/LOGOM.svg"
      alt="Mead Security"
      className="w-9 h-9 rounded-[9px]"
      style={{
        boxShadow: `0 6px 16px -6px ${BRAND_PRIMARY}80`,
      }}
    />
    <div className="flex flex-col leading-none">
      <span
        className={`font-['Plus_Jakarta_Sans'] font-extrabold text-[16.5px] tracking-[-0.02em] ${
          light ? 'text-white' : 'text-[#201f1e]'
        }`}
      >
        Mead Security
      </span>
      <span
        className={`mt-1 text-[10.5px] font-semibold tracking-[0.14em] uppercase ${
          light ? 'text-white/55' : 'text-[#a19f9d]'
        }`}
      >
        Operations Console
      </span>
    </div>
  </Link>
);

const LoginPage: React.FC = () => {
  const { login, authState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [remember, setRemember] = React.useState(true);

  const from = location.state?.from?.pathname || '/';
  const hasRedirectedRef = React.useRef(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      setLoginError('Your session has expired. Please log in again.');
      params.delete('expired');
      const cleanUrl = params.toString()
        ? `${window.location.pathname}?${params.toString()}`
        : window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }, []);

  React.useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (authState.isAuthenticated && !authState.isLoading && !authState.onboardingLoading) {
      hasRedirectedRef.current = true;
      if (authState.onboarding.isCompleted === false) {
        const currentStep = authState.onboarding.currentStep || 1;
        navigate(`/onboarding/step/${currentStep}`);
      } else {
        navigate(from === '/' ? '/dashboard' : from);
      }
    }
  }, [
    authState.isAuthenticated,
    authState.isLoading,
    authState.onboardingLoading,
    authState.onboarding.isCompleted,
    authState.onboarding.currentStep,
    navigate,
    from,
  ]);

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
      } catch {
        setLoginError('Login failed. Please check your credentials and try again.');
      }
    },
  });

  const errorMessage = authState.error || loginError;
  const isLoading = authState.isLoading;

  return (
    <div className="min-h-screen flex flex-col bg-[#faf9f8] font-['Inter']">
      <style>{`
        @keyframes ms-spin { to { transform: rotate(360deg); } }
        @keyframes ms-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(16,185,129,0.55); }
          70%  { box-shadow: 0 0 0 8px rgba(16,185,129,0); }
          100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); }
        }
      `}</style>

      {/* Header */}
      <header className="flex items-center justify-between px-6 sm:px-8 py-5">
        <LogoMark />
        <nav className="flex items-center gap-4 sm:gap-5">
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline text-[13px] text-[#605e5c] hover:text-[#201f1e] no-underline transition-colors"
          >
            Status
          </a>
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline text-[13px] text-[#605e5c] hover:text-[#201f1e] no-underline transition-colors"
          >
            Help
          </a>
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white border border-[#edebe9] text-[13px] font-semibold text-[#323130] no-underline hover:border-[#a19f9d] transition-colors"
          >
            Contact sales
          </a>
        </nav>
      </header>

      {/* Split */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 sm:px-6 lg:px-8 pb-8">
        {/* LEFT — form card */}
        <section className="bg-white rounded-[20px] border border-[#edebe9] shadow-[0_2px_6px_-2px_rgba(32,31,30,0.08),0_1px_2px_rgba(32,31,30,0.04)] flex items-center justify-center p-8 sm:p-12 lg:p-14 min-h-[640px] lg:min-h-[720px]">
          <form onSubmit={formik.handleSubmit} className="w-full max-w-[420px] flex flex-col gap-5">
            {/* Heading */}
            <div>
              <h1 className="font-['Plus_Jakarta_Sans'] font-extrabold text-[30px] tracking-[-0.025em] text-[#201f1e] leading-[1.1]">
                Sign in to your console
              </h1>
              <p className="mt-2 text-[14px] text-[#605e5c] leading-[1.5]">
                Welcome back. Use your work email or single sign‑on to continue.
              </p>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="flex items-center gap-3 p-3.5 bg-[#fde7e9] border border-[#cb2431]/30 rounded-xl">
                <div className="w-7 h-7 rounded-lg bg-[#cb2431]/15 flex items-center justify-center flex-shrink-0">
                  <XCircle size={14} className="text-[#cb2431]" />
                </div>
                <p className="text-[13px] text-[#5b0a10]">{errorMessage}</p>
              </div>
            )}

            {/* SSO row */}
            <div className="grid grid-cols-3 gap-2">
              <SSOButton icon={<GoogleIcon />} label="Google" />
              <SSOButton icon={<MicrosoftIcon />} label="Microsoft" />
              <SSOButton icon={<OktaIcon />} label="Okta SSO" />
            </div>

            <div className="flex items-center gap-2.5 text-[#a19f9d] text-[11.5px] font-semibold uppercase tracking-[0.08em]">
              <span className="flex-1 h-px bg-[#edebe9]" />
              <span>or sign in with email</span>
              <span className="flex-1 h-px bg-[#edebe9]" />
            </div>

            {/* Fields */}
            <div className="flex flex-col gap-3">
              {/* Email / Username */}
              <label className="block">
                <div className="text-[12px] font-semibold text-[#3b3a39] mb-1.5">Work email</div>
                <div
                  className={`flex items-center gap-2.5 bg-white border rounded-[10px] px-3.5 py-2.5 transition-all ${
                    formik.touched.username && formik.errors.username
                      ? 'border-[#cb2431] bg-[#fde7e9]/30'
                      : 'border-[#edebe9] focus-within:border-[#cb2431] focus-within:ring-4 focus-within:ring-[#cb2431]/15'
                  }`}
                >
                  <Mail size={16} className="text-[#605e5c] flex-shrink-0" />
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoFocus
                    autoComplete="username email"
                    placeholder="you@meadsecurity.co.uk"
                    value={formik.values.username}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    disabled={isLoading}
                    className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[14px] text-[#201f1e] placeholder-[#a19f9d] disabled:opacity-50"
                  />
                </div>
                {formik.touched.username && formik.errors.username && (
                  <p className="mt-1.5 text-[12px] text-[#cb2431]">{formik.errors.username}</p>
                )}
              </label>

              {/* Password */}
              <label className="block">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-semibold text-[#3b3a39]">Password</span>
                  <Link
                    to="/reset-password"
                    className="text-[12px] font-semibold no-underline transition-colors hover:opacity-80"
                    style={{ color: BRAND_PRIMARY }}
                  >
                    Forgot password?
                  </Link>
                </div>
                <div
                  className={`flex items-center gap-2.5 bg-white border rounded-[10px] px-3.5 py-2.5 transition-all ${
                    formik.touched.password && formik.errors.password
                      ? 'border-[#cb2431] bg-[#fde7e9]/30'
                      : 'border-[#edebe9] focus-within:border-[#cb2431] focus-within:ring-4 focus-within:ring-[#cb2431]/15'
                  }`}
                >
                  <Lock size={16} className="text-[#605e5c] flex-shrink-0" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={formik.values.password}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    disabled={isLoading}
                    className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[14px] text-[#201f1e] placeholder-[#a19f9d] disabled:opacity-50 tracking-[0.05em]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="grid place-items-center text-[#605e5c] hover:text-[#201f1e] transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {formik.touched.password && formik.errors.password && (
                  <p className="mt-1.5 text-[12px] text-[#cb2431]">{formik.errors.password}</p>
                )}
              </label>
            </div>

            {/* Remember + biometric hint */}
            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                <span
                  onClick={() => setRemember((r) => !r)}
                  className="grid place-items-center w-[18px] h-[18px] rounded-[5px] transition-all text-white"
                  style={{
                    background: remember ? BRAND_PRIMARY : 'white',
                    border: `1px solid ${remember ? BRAND_PRIMARY : '#c8c6c4'}`,
                  }}
                >
                  {remember && <Check size={12} strokeWidth={3} />}
                </span>
                <span className="text-[13px] text-[#323130]">Keep me signed in on this device</span>
              </label>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-[#a19f9d]">
                <Fingerprint size={14} /> Biometrics ready
              </span>
            </div>

            {/* Primary action */}
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center gap-2.5 px-[18px] py-3.5 rounded-[10px] text-white font-['Plus_Jakarta_Sans'] font-bold text-[14.5px] tracking-[-0.005em] transition-transform active:translate-y-px disabled:cursor-wait"
              style={{
                background: `linear-gradient(180deg, ${BRAND_PRIMARY}, ${BRAND_PRIMARY_DARK})`,
                boxShadow: `0 8px 22px -10px ${BRAND_PRIMARY}cc, inset 0 -1px 0 rgba(0,0,0,0.22)`,
              }}
            >
              {isLoading ? (
                <>
                  <span
                    className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white"
                    style={{ animation: 'ms-spin 0.8s linear infinite' }}
                  />
                  Signing in…
                </>
              ) : (
                <>
                  Continue <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Footer */}
            <div className="text-[12.5px] text-[#605e5c]">
              New to Mead Security?{' '}
              <Link
                to="/register"
                className="font-semibold no-underline hover:opacity-80"
                style={{ color: BRAND_PRIMARY }}
              >
                Request a workspace
              </Link>
              <span className="mx-2 text-[#c8c6c4]">·</span>
              <a href="#" className="text-[#3b3a39] no-underline hover:underline">
                Officer app instead →
              </a>
            </div>
          </form>
        </section>

        {/* RIGHT — minimal panel */}
        <section
          className="hidden lg:flex relative overflow-hidden rounded-[20px] border border-[#1f1c1b] text-white p-10 xl:p-12 flex-col justify-between min-h-[720px]"
          style={{
            background: `radial-gradient(120% 80% at 100% 0%, ${BRAND_PRIMARY}40 0%, transparent 55%), radial-gradient(80% 60% at 0% 100%, ${BRAND_PRIMARY_DARK}55 0%, transparent 55%), linear-gradient(160deg, #0e0d0c 0%, #1a1716 100%)`,
          }}
        >
          {/* scanline overlay */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-40"
            style={{
              backgroundImage:
                'repeating-linear-gradient(180deg, rgba(255,255,255,0.02) 0 1px, transparent 1px 3px)',
            }}
          />

          {/* Status pill */}
          <div className="relative">
            <div className="inline-flex items-center gap-2.5 pl-2 pr-3 py-1.5 bg-white/[0.06] border border-white/10 rounded-full">
              <span
                className="w-2 h-2 rounded-full bg-emerald-500"
                style={{ animation: 'ms-pulse 1.6s infinite' }}
              />
              <span className="text-[11.5px] font-bold tracking-[0.12em] uppercase text-white/85">
                All systems normal
              </span>
            </div>
          </div>

          {/* Headline */}
          <div className="relative">
            <h2
              className="font-['Plus_Jakarta_Sans'] font-extrabold text-[44px] xl:text-[56px] tracking-[-0.035em] leading-[0.98] text-white"
              style={{ textWrap: 'balance' } as React.CSSProperties}
            >
              Operations control for venue security teams.
            </h2>
            <p className="mt-5 text-[15px] text-white/60 max-w-[460px] leading-[1.55]">
              Schedule officers, run weekly payroll, monitor incidents and prove compliance — from
              one console.
            </p>
          </div>

          {/* Trust + footer */}
          <div className="relative space-y-5">
            <div className="inline-flex items-center gap-2 text-[12px] text-white/70">
              <Shield size={14} className="text-white/60" />
              <span>SIA compliant · ISO 27001 · GDPR</span>
            </div>
            <div className="font-mono text-[11.5px] text-white/40 tracking-[0.06em]">
              © {new Date().getFullYear()} MEAD SECURITY LTD · LONDON · COMPANY NO. 09827341
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-between px-6 sm:px-8 pb-7 text-[#a19f9d] text-[12px]">
        <span>© {new Date().getFullYear()} Mead Security Ltd · UK & Ireland</span>
        <span className="inline-flex gap-4">
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-inherit no-underline hover:text-[#605e5c]"
          >
            Privacy
          </a>
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-inherit no-underline hover:text-[#605e5c]"
          >
            Terms
          </a>
          <a
            href={PORTFOLIO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-inherit no-underline hover:text-[#605e5c]"
          >
            Security
          </a>
        </span>
      </footer>
    </div>
  );
};

export default LoginPage;
