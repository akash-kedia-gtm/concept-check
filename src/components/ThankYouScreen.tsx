import React, { useState } from 'react';
import { RotateCcw, Check, Info } from 'lucide-react';

interface ThankYouScreenProps {
  onRestartPendingAction?: () => void;
}

export const ThankYouScreen: React.FC<ThankYouScreenProps> = () => {
  const [showRetryNotice, setShowRetryNotice] = useState(false);

  // Per Section 6: Isolated handler for the unconfirmed Retry action.
  // The final Retry action is not confirmed in the redesigned brief.
  // We document it explicitly as a disabled control with an accessible notice.
  const handleRetryClick = () => {
    setShowRetryNotice(true);
  };

  return (
    <div className="w-full max-w-[640px] mx-auto py-8 sm:py-12 flex flex-col items-center">
      {/* Completion Progress Indicator Strip */}
      <div className="w-full mb-8 bg-[#f1f3ff] border border-[#dce2f7] rounded-xl p-4 shadow-xs">
        <div className="flex items-center justify-between text-xs text-[#545f73] mb-2 font-medium">
          <span className="tracking-widest uppercase font-semibold text-[11px]">
            Evaluation Status
          </span>
          <span className="font-mono text-xs text-[#004ac6] font-semibold">
            10 / 10 Completed
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#e1e8fd] rounded-full overflow-hidden flex">
          <div className="h-full bg-[#004ac6] rounded-full transition-all duration-700 w-full" />
        </div>
      </div>

      {/* Main Summary Card */}
      <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl shadow-md p-6 sm:p-10 flex flex-col items-center text-center relative overflow-hidden">
        {/* Subtle Decorative Atmospheric Glow */}
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#004ac6]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-[#2563eb]/5 rounded-full blur-3xl pointer-events-none" />

        {/* Checkmark Monogram */}
        <div className="w-16 h-16 rounded-2xl bg-[#f1f3ff] flex items-center justify-center text-[#004ac6] mb-6 shadow-xs">
          <Check className="w-8 h-8 stroke-[2.5]" />
        </div>

        {/* Overline Metadata */}
        <div className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wider mb-2">
          Concept Check • Round Summary
        </div>

        {/* Exact Required Headline from Section 6 */}
        <h1 className="text-2xl sm:text-3xl font-semibold text-[#111827] tracking-tight max-w-[480px] mb-4">
          Thanks for completing all 10 questions.
        </h1>

        {/* Summary Breakdown Grid */}
        <div className="w-full max-w-[440px] my-4 py-3.5 px-4 sm:px-6 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl flex items-center justify-around text-left">
          <div className="flex flex-col">
            <span className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold">
              Session
            </span>
            <span className="font-mono text-xs text-[#111827] mt-1 font-semibold">
              10 Inquiries
            </span>
          </div>
          <div className="w-px h-8 bg-[#E5E7EB]" />
          <div className="flex flex-col">
            <span className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold">
              Retention
            </span>
            <span className="font-mono text-xs text-[#111827] mt-1 font-semibold">
              Saved Locally
            </span>
          </div>
          <div className="w-px h-8 bg-[#E5E7EB]" />
          <div className="flex flex-col">
            <span className="text-[10px] text-[#6B7280] uppercase tracking-wider font-semibold">
              Format
            </span>
            <span className="font-mono text-xs text-[#111827] mt-1 font-semibold">
              Free Response
            </span>
          </div>
        </div>

        {/* Action Area: Explicitly Documented Unresolved Retry Button */}
        <div className="flex flex-col items-center w-full max-w-[420px] mt-4">
          <div className="relative group">
            <button
              type="button"
              disabled
              onClick={handleRetryClick}
              aria-describedby="retry-unresolved-desc"
              className="w-full sm:w-auto min-w-[220px] h-11 px-8 rounded-lg bg-[#004ac6]/50 text-white/80 font-medium text-xs tracking-normal flex items-center justify-center gap-2 cursor-not-allowed transition-all shadow-xs"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>

          {/* Accessible Notice explaining the temporary disabled status per Section 6 */}
          <div
            id="retry-unresolved-desc"
            className="mt-3 p-3 bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg text-left text-xs text-[#6B7280] flex items-start gap-2.5 max-w-[420px]"
          >
            <Info className="w-4 h-4 text-[#004ac6] shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              <span className="font-semibold text-[#111827] block mb-0.5">
                Specification Dependency Note
              </span>
              The post-diagnostic Retry behavior is pending confirmation from the course administrator. This control is intentionally kept isolated to avoid overwriting or invalidating confirmed submissions.
            </div>
          </div>

          {/* Exact Subtext from Section 6 */}
          <p className="text-xs text-[#6B7280] mt-4 text-center leading-relaxed max-w-[360px]">
            Retry starts again from Question 1. Your earlier responses will be kept.
          </p>
        </div>
      </div>

      {/* Auxiliary Metadata Panel */}
      <div className="w-full mt-6 flex flex-col sm:flex-row items-center justify-between text-[#9CA3AF] text-xs px-2">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#004ac6]/70" />
          <span>Diagnostic complete</span>
        </div>
        <div className="font-mono text-[11px] mt-2 sm:mt-0">
          REF: CC-REV-0.4-Q10
        </div>
      </div>
    </div>
  );
};
