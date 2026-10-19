import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, AlertCircle, Minus, ShieldCheck } from 'lucide-react';
import { LearnerProfile } from '../types';
import { identityService } from '../services/identityService';

interface SignupScreenProps {
  onProfileCreated: (profile: LearnerProfile) => void;
}

export const SignupScreen: React.FC<SignupScreenProps> = ({ onProfileCreated }) => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Real-time username validation rules strictly per Section 2
  const hasWhitespace = /\s/.test(username);
  const isUsernameEmpty = username.trim().length === 0;
  const isNameEmpty = name.trim().length === 0;
  const isUsernameValid = !isUsernameEmpty && !hasWhitespace;
  const canSubmit = !isNameEmpty && isUsernameValid && !isSubmitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const profile = await identityService.setupProfile(name, username);
      onProfileCreated(profile);
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Failed to initialize profile. Please try again.';
      setSubmitError(msg);
    }
  };

  return (
    <div className="flex flex-col w-full items-center justify-center py-8 sm:py-12">
      <div className="relative w-full max-w-[460px] px-2 sm:px-0">
        {/* Soft Ambient Background Glow */}
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-[#004ac6]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-64 h-64 bg-[#2563eb]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Main Card */}
        <div className="relative w-full bg-white rounded-2xl shadow-xl shadow-[#d3daef]/30 border border-[#E5E7EB] p-6 sm:p-8 transition-all duration-300">
          {/* Top Branding Section */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-[#004ac6] text-white font-semibold text-xl mb-3 shadow-md shadow-[#004ac6]/20">
              C
            </div>
            <div className="flex items-center gap-1.5 text-[#9CA3AF] text-xs uppercase tracking-wider font-semibold mb-1">
              <span>Initial Verification</span>
              <span>•</span>
              <span>Cohort 04</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold text-[#111827] tracking-tight">
              Profile Setup
            </h1>
            <p className="text-sm text-[#6B7280] mt-1.5 max-w-[340px]">
              Configure your learner credentials before commencing the conceptual diagnostic.
            </p>
          </div>

          {/* Form */}
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {/* Field 1: Name */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#111827]" htmlFor="learner-name">
                  Name
                </label>
                <span className="text-[11px] font-medium text-[#9CA3AF]">Required</span>
              </div>
              <input
                id="learner-name"
                name="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSubmitError(null);
                }}
                placeholder="e.g. Akash Kedia"
                className="w-full h-11 px-3.5 rounded-lg bg-[#F9FAFB] text-[#111827] text-sm outline-none border border-[#E5E7EB] transition-all duration-200 focus:bg-white focus:border-[#004ac6] focus:ring-2 focus:ring-[#004ac6]/15"
                required
              />
              <p className="text-[11px] text-[#6B7280] leading-relaxed">
                The learner's display name. Spaces in a person's name are allowed.
              </p>
            </div>

            {/* Field 2: Username */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#111827]" htmlFor="learner-username">
                  Username
                </label>
                <span className="font-mono text-[11px] text-[#9CA3AF]">
                  {username.length} chars
                </span>
              </div>
              <div className="relative">
                <input
                  id="learner-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setSubmitError(null);
                  }}
                  placeholder="e.g. akashkedia"
                  className={`w-full h-11 px-3.5 pr-10 rounded-lg font-mono text-sm outline-none border transition-all duration-200 ${
                    hasWhitespace
                      ? 'bg-[#FEF2F2] border-[#FCA5A5] text-[#DC2626] focus:ring-2 focus:ring-[#DC2626]/15'
                      : 'bg-[#F9FAFB] border-[#E5E7EB] text-[#111827] focus:bg-white focus:border-[#004ac6] focus:ring-2 focus:ring-[#004ac6]/15'
                  }`}
                  required
                />
                <div className="absolute right-3 top-3 flex items-center justify-center">
                  {isUsernameEmpty ? (
                    <Minus className="w-4 h-4 text-[#9CA3AF]" />
                  ) : hasWhitespace ? (
                    <AlertCircle className="w-4 h-4 text-[#DC2626]" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#004ac6]" />
                  )}
                </div>
              </div>

              {/* Status and feedback */}
              <div className="flex flex-col gap-1">
                <p className="text-[11px] text-[#6B7280] leading-relaxed">
                  The identifier you choose. No spaces or whitespace.
                </p>
                <div
                  className={`flex items-center gap-1.5 py-1 px-2.5 rounded text-[11px] w-fit transition-all duration-200 ${
                    hasWhitespace
                      ? 'bg-[#FEF2F2] text-[#DC2626] font-medium border border-[#FCA5A5]'
                      : isUsernameEmpty
                      ? 'bg-[#F3F4F6] text-[#6B7280]'
                      : 'bg-[#EFF6FF] text-[#1E40AF] border border-[#93C5FD]/50'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      hasWhitespace
                        ? 'bg-[#DC2626]'
                        : isUsernameEmpty
                        ? 'bg-[#9CA3AF]'
                        : 'bg-[#004ac6]'
                    }`}
                  />
                  <span>
                    {hasWhitespace
                      ? 'Spaces or whitespace are not permitted'
                      : isUsernameEmpty
                      ? 'Whitespace free identifier required'
                      : 'Valid identifier format'}
                  </span>
                </div>
              </div>
            </div>

            {/* Zero Credential Friction Callout */}
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] p-3 rounded-lg flex items-start gap-2.5 mt-1">
              <ShieldCheck className="w-4 h-4 text-[#004ac6] shrink-0 mt-0.5" />
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-[#111827]">
                  Zero Credential Friction
                </span>
                <span className="text-[11px] text-[#6B7280] leading-normal">
                  Direct session binding. No authentication tokens or external accounts required.
                </span>
              </div>
            </div>

            {submitError && (
              <div className="p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#DC2626] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full h-11 mt-1 bg-[#111827] hover:bg-black disabled:bg-[#111827]/40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.99] cursor-pointer"
            >
              <span>{isSubmitting ? 'Initializing assessment...' : 'Sign Up'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Protocol Metadata Footer */}
          <div className="mt-6 pt-3 border-t border-[#E5E7EB] flex items-center justify-between text-[#9CA3AF] text-[11px]">
            <span className="font-mono">PROT-0x4A</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#004ac6]/80 animate-pulse" />
              Ready to initialize
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
