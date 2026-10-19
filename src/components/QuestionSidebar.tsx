import React from 'react';
import { X } from 'lucide-react';

interface QuestionSidebarProps {
  maxStartedQuestion: number; // e.g. 1, 2, ..., up to 10
  selectedQuestionNumber: number;
  onSelectQuestion: (questionNumber: number) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const QuestionSidebar: React.FC<QuestionSidebarProps> = ({
  maxStartedQuestion,
  selectedQuestionNumber,
  onSelectQuestion,
  isOpenMobile,
  onCloseMobile,
}) => {
  // Generate entries ONLY for questions that have actually started
  const questionEntries = Array.from(
    { length: maxStartedQuestion },
    (_, idx) => idx + 1
  );

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Mobile Drawer Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
          Assessment Rail
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          className="p-1 rounded text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6]"
          aria-label="Close drawer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block px-5 py-4">
        <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider block">
          Assessment Rail
        </span>
      </div>

      {/* Navigation Entries */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto" aria-label="Question history">
        {questionEntries.map((qNum) => {
          const isSelected = qNum === selectedQuestionNumber;
          return (
            <button
              key={qNum}
              type="button"
              onClick={() => {
                onSelectQuestion(qNum);
                onCloseMobile();
              }}
              className={`w-full flex items-center px-4 py-2.5 rounded-lg text-xs font-medium transition-colors text-left ${
                isSelected
                  ? 'bg-[#e9edff] text-[#004ac6] font-semibold'
                  : 'text-[#545f73] hover:bg-[#F9FAFB] hover:text-[#111827]'
              }`}
            >
              Question {qNum}
            </button>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Fixed Left Rail */}
      <aside className="hidden md:block fixed left-0 top-0 h-full w-60 bg-white border-r border-[#E5E7EB] pt-16 z-30">
        {navContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isOpenMobile && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-xs z-50 transition-opacity"
          onClick={onCloseMobile}
        >
          <div
            className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl z-50 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
