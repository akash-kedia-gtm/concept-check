import React, { useState } from 'react';
import { ArrowRight, Brain, Clock, MessageSquare, AlertCircle } from 'lucide-react';
import { LearnerProfile, RoundSession } from '../types';
import { assessmentService } from '../services/assessmentService';

interface StartScreenProps {
  profile: LearnerProfile;
  onAssessmentStarted: (firstRound: RoundSession) => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({ profile, onAssessmentStarted }) => {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    if (isStarting) return;
    setIsStarting(true);
    setError(null);

    try {
      const firstRound = await assessmentService.startAssessment(profile);
      onAssessmentStarted(firstRound);
    } catch (err: unknown) {
      setIsStarting(false);
      const msg = err instanceof Error ? err.message : 'Failed to initialize Question 1. Please try again.';
      setError(msg);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-[560px] mx-auto py-8 sm:py-14 items-center text-center">
      {/* Subtle Glow Backdrop */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-72 h-72 bg-gradient-to-b from-[#004ac6]/10 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Module 2 Monogram & Badge */}
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-2xl bg-[#e1e8fd] shadow-sm flex items-center justify-center text-[#004ac6]">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 32 32">
            <circle
              cx="16"
              cy="16"
              r="13"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray="2 3"
            />
            <path
              d="M11 16.5L14.5 19.5L21 13"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="absolute -bottom-1 -right-2 px-2 py-0.5 rounded bg-[#004ac6] text-white font-mono text-[10px] tracking-wider uppercase font-semibold shadow-sm">
          M-02
        </div>
      </div>

      {/* Evaluation Tag */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e1e8fd] text-[#434655] text-xs font-medium mb-4">
        <span className="w-1.5 h-1.5 rounded-full bg-[#004ac6] animate-pulse" />
        <span>Concept Evaluation</span>
      </div>

      {/* Exact Required Title */}
      <h1 className="text-2xl sm:text-3xl font-semibold text-[#111827] tracking-tight mb-2 max-w-[460px]">
        Let's test your concepts for Module 2
      </h1>
      <p className="text-base text-[#6B7280] max-w-[380px] mb-8">
        10 questions. One at a time.
      </p>

      {/* Format Parameters Card */}
      <div className="w-full max-w-[420px] bg-white border border-[#E5E7EB] p-5 rounded-xl shadow-sm mb-8 text-left">
        <div className="flex items-center justify-between text-xs text-[#6B7280] mb-3.5">
          <span className="flex items-center gap-1.5 font-medium">
            <Brain className="w-4 h-4 text-[#004ac6]" />
            Format
          </span>
          <span className="font-mono text-xs text-[#111827] font-semibold">Short Form Synthesis</span>
        </div>
        <div className="flex items-center justify-between text-xs text-[#6B7280] mb-3.5">
          <span className="flex items-center gap-1.5 font-medium">
            <Clock className="w-4 h-4 text-[#004ac6]" />
            Pacing
          </span>
          <span className="text-[#111827] font-medium">Untimed • Thoughtful</span>
        </div>
        <div className="flex items-center justify-between text-xs text-[#6B7280]">
          <span className="flex items-center gap-1.5 font-medium">
            <MessageSquare className="w-4 h-4 text-[#004ac6]" />
            Structure
          </span>
          <span className="text-[#111827] font-medium">Adaptive Probing</span>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="w-full max-w-[320px] flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={handleStart}
          disabled={isStarting}
          className="w-full py-3 px-6 rounded-lg bg-[#004ac6] text-white font-semibold text-sm hover:bg-[#003ea8] active:scale-[0.99] transition-all duration-150 shadow-sm flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-75 disabled:cursor-wait"
        >
          <span>{isStarting ? 'Starting…' : 'Start'}</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </button>

        {error && (
          <div className="w-full p-2.5 rounded-lg bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#DC2626] flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <div className="flex-1">{error}</div>
            <button
              onClick={handleStart}
              className="underline font-semibold hover:text-black shrink-0"
            >
              Try again
            </button>
          </div>
        )}

        <p className="text-[11px] text-[#9CA3AF] leading-relaxed text-center px-2">
          Your responses will be saved for this assessment. Please avoid personal information.
        </p>
      </div>
    </div>
  );
};
