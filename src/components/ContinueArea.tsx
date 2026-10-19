import React, { useState } from 'react';
import { ArrowRight, Loader2 } from 'lucide-react';

interface ContinueAreaProps {
  onContinue: () => Promise<void>;
}

export const ContinueArea: React.FC<ContinueAreaProps> = ({ onContinue }) => {
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    setError(null);

    try {
      await onContinue();
    } catch (err: unknown) {
      setIsAdvancing(false);
      const msg = err instanceof Error ? err.message : 'Failed to advance to the next question. Please try again.';
      setError(msg);
    }
  };

  return (
    <section className="w-full mt-4 flex flex-col items-center text-center p-6 bg-white border border-[#E5E7EB] rounded-xl shadow-sm">
      {/* Exact transition sentence specified in Section 4E */}
      <p className="text-base font-normal text-[#111827] mb-4">
        You have now reached the next step.
      </p>

      {/* ONE button directly below it */}
      <button
        type="button"
        onClick={handleClick}
        disabled={isAdvancing}
        className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[#004ac6] text-white text-xs font-semibold hover:bg-[#003ea8] active:scale-[0.99] transition-all shadow-xs cursor-pointer disabled:opacity-70 disabled:cursor-wait"
      >
        {isAdvancing ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Advancing…</span>
          </>
        ) : (
          <>
            <span>Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </>
        )}
      </button>

      {error && (
        <div className="mt-3 text-xs text-[#DC2626] flex items-center gap-1.5">
          <span>{error}</span>
          <button
            onClick={handleClick}
            className="underline font-semibold hover:text-black ml-1"
          >
            Try again
          </button>
        </div>
      )}
    </section>
  );
};
