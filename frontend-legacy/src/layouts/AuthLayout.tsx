import type React from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  illustration?: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
  illustration = 'https://cdn.undraw.co/illustration/security-on_3ykb.svg',
}) => {
  return (
    <div className="min-h-screen flex bg-[#F7F7FA]">

      {/* ── LEFT PANEL: Branding + Illustration (hidden on mobile) ── */}
      <div className="hidden lg:flex lg:w-[48%] xl:w-[45%] relative overflow-hidden bg-gradient-to-br from-[#1A1A2E] via-[#1A1A2E] to-[#2D2B55] flex-col justify-between p-10 xl:p-14">

        {/* Background decorative elements */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {/* Grid pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }} />
          {/* Gradient orbs */}
          <div className="absolute -top-20 -right-20 w-[300px] h-[300px] rounded-full bg-[#DC2626]/10 blur-[80px]" />
          <div className="absolute -bottom-32 -left-20 w-[250px] h-[250px] rounded-full bg-[#6366F1]/10 blur-[80px]" />
        </div>

        {/* Top: Logo */}
        <div className="relative z-10">
          <Link to="/" className="flex items-center gap-3 no-underline">
            <div className="w-10 h-10 rounded-xl bg-[#DC2626] flex items-center justify-center">
              <span className="text-white font-bold text-sm tracking-wide">MS</span>
            </div>
            <div>
              <span className="text-white font-bold text-[16px] font-['Plus_Jakarta_Sans'] block leading-tight">Mead Security</span>
              <span className="text-white/40 text-[11px] block">Workforce platform</span>
            </div>
          </Link>
        </div>

        {/* Center: Illustration */}
        <div className="relative z-10 flex-1 flex items-center justify-center py-10">
          <img
            src={illustration}
            alt="Security illustration"
            className="w-full max-w-[380px] xl:max-w-[420px] drop-shadow-2xl"
            style={{ filter: 'hue-rotate(-10deg) saturate(0.85)' }}
          />
        </div>

        {/* Bottom: Testimonial / trust signal */}
        <div className="relative z-10">
          <div className="bg-white/[0.06] backdrop-blur-sm rounded-2xl border border-white/[0.08] p-6">
            <p className="text-white/70 text-[13px] leading-relaxed italic">
              "Mead Security has transformed how we manage our workforce. Scheduling, compliance, and invoicing — all in one place."
            </p>
            <div className="flex items-center gap-3 mt-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#DC2626] to-[#EF4444] flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">RM</span>
              </div>
              <div>
                <p className="text-white/90 text-[12px] font-semibold">Robert Mitchell</p>
                <p className="text-white/40 text-[11px]">Operations Director</p>
              </div>
            </div>
          </div>

          <p className="text-white/25 text-[11px] mt-6">
            &copy; {new Date().getFullYear()} Mead Security Ltd. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL: Form ── */}
      <div className="flex-1 flex flex-col min-h-screen">

        {/* Mobile header (visible on small screens only) */}
        <div className="lg:hidden flex items-center justify-between p-5 bg-white border-b border-[#E5E7EB]">
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-[8px] bg-[#DC2626] flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">MS</span>
            </div>
            <span className="text-[#1A1A2E] font-bold text-[14px] font-['Plus_Jakarta_Sans']">Mead Security</span>
          </Link>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="w-full max-w-[420px]">

            {/* Title */}
            <div className="mb-8">
              <h1 className="text-[28px] sm:text-[32px] font-extrabold text-[#1A1A2E] tracking-[-0.02em] font-['Plus_Jakarta_Sans'] leading-tight">
                {title}
              </h1>
              {subtitle && (
                <p className="text-[15px] text-[#6B7280] mt-2">{subtitle}</p>
              )}
            </div>

            {/* Form content */}
            {children}
          </div>
        </div>

        {/* Mobile footer */}
        <div className="lg:hidden p-5 text-center">
          <p className="text-[#9CA3AF] text-[11px]">
            &copy; {new Date().getFullYear()} Mead Security Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
