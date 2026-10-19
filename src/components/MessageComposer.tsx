import React, { useEffect, useRef } from 'react';
import { ArrowUp, Lock, Loader2 } from 'lucide-react';

interface MessageComposerProps {
  learnerName: string;
  isRetry: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (text: string) => void;
  disabled: boolean;
  isSaving: boolean;
  isThinking: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  learnerName,
  isRetry,
  value,
  onChange,
  onSubmit,
  disabled,
  isSaving,
  isThinking,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const trimmedLength = value.trim().length;
  const canSend = trimmedLength > 0 && !disabled && !isSaving && !isThinking;

  const label = isRetry ? 'Your reply' : 'Your explanation';
  const placeholder = isRetry ? 'Write your reply…' : 'Explain in your own words…';

  // Auto focus textarea when enabled
  useEffect(() => {
    if (!disabled && !isThinking && !isSaving && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [disabled, isThinking, isSaving, isRetry]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      if (canSend) {
        e.preventDefault();
        onSubmit(value);
      }
    }
    // Plain Enter inserts normal newline, as specified in Section 9: "Enter inserts a newline; Send submits."
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (canSend) {
      onSubmit(value);
    }
  };

  return (
    <section className="flex flex-col gap-1.5 w-full mt-2">
      {/* Speaker and draft header */}
      <div className="flex items-center justify-between text-xs px-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold uppercase tracking-wider text-[#6B7280]">
            {learnerName}
          </span>
          <span className="w-1 h-1 rounded-full bg-[#D1D5DB]" />
          <span className="text-[#9CA3AF]">
            {isThinking
              ? 'Waiting for follow-up…'
              : isSaving
              ? 'Saving response…'
              : 'Drafting response'}
          </span>
        </div>
        <span className="text-[11px] text-[#9CA3AF] hidden sm:inline-block">
          Press Cmd + Enter to submit
        </span>
      </div>

      {/* Composer Card */}
      <form
        onSubmit={handleFormSubmit}
        className="bg-white border border-[#E5E7EB] rounded-xl p-4 sm:p-5 shadow-sm transition-shadow focus-within:shadow-md focus-within:border-[#004ac6]/50"
      >
        <label
          htmlFor="learner-input"
          className="block text-xs font-semibold text-[#6B7280] mb-2"
        >
          {label}
        </label>

        <textarea
          ref={textareaRef}
          id="learner-input"
          rows={4}
          disabled={disabled || isSaving || isThinking}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-[#F9FAFB] text-[#111827] text-base rounded-lg p-3 sm:p-4 outline-none border border-[#E5E7EB] placeholder:text-[#9CA3AF] focus:bg-white focus:border-[#004ac6] transition-colors resize-y min-h-[110px] disabled:opacity-60 disabled:cursor-not-allowed"
        />

        <div className="mt-3 pt-1 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
            {value.trim().length > 0 ? (
              <>
                <span className="font-mono text-xs">{value.length} characters</span>
                <span>•</span>
                <span>Plain text response</span>
              </>
            ) : (
              <div className="flex items-center gap-1.5 text-[#9CA3AF] text-xs">
                <Lock className="w-3.5 h-3.5" />
                <span>Draft securely saved</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#004ac6] text-white text-xs font-semibold shadow-xs hover:bg-[#003ea8] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving…</span>
              </>
            ) : isThinking ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Thinking…</span>
              </>
            ) : (
              <>
                <span>Send</span>
                <ArrowUp className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
};
