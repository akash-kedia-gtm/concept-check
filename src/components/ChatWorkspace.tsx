import React, { useState, useEffect } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { LearnerProfile, RoundSession } from '../types';
import { assessmentService } from '../services/assessmentService';
import { QuestionSidebar } from './QuestionSidebar';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import { ContinueArea } from './ContinueArea';

interface ChatWorkspaceProps {
  profile: LearnerProfile;
  initialRound: RoundSession;
  onAssessmentCompleted: () => void;
  isSidebarOpenMobile: boolean;
  onCloseSidebarMobile: () => void;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  profile,
  initialRound,
  onAssessmentCompleted,
  isSidebarOpenMobile,
  onCloseSidebarMobile,
}) => {
  // Current progression index (highest question reached)
  const [currentProgressionNumber, setCurrentProgressionNumber] = useState<number>(
    initialRound.questionNumber
  );

  // Selected question in sidebar (can view earlier questions read-only)
  const [selectedQuestionNumber, setSelectedQuestionNumber] = useState<number>(
    initialRound.questionNumber
  );

  // Active round data for the currently selected question
  const [selectedRound, setSelectedRound] = useState<RoundSession>(initialRound);

  // Draft inputs mapped by questionNumber and type ('first' | 'retry')
  const [draftInputs, setDraftInputs] = useState<Record<string, string>>({});

  // Local UI status flags
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);

  // Load the round when selectedQuestionNumber changes
  useEffect(() => {
    let isMounted = true;
    const fetchRound = async () => {
      const round = await assessmentService.getRound(selectedQuestionNumber);
      if (isMounted && round) {
        setSelectedRound({ ...round });
      }
    };
    fetchRound();
    return () => {
      isMounted = false;
    };
  }, [selectedQuestionNumber]);

  // Read draft text for current round
  const currentDraftKey = `${selectedQuestionNumber}_${
    selectedRound.status === 'awaiting_retry' ? 'retry' : 'first'
  }`;
  const currentDraftValue = draftInputs[currentDraftKey] || '';

  const handleDraftChange = (text: string) => {
    setDraftInputs((prev) => ({
      ...prev,
      [currentDraftKey]: text,
    }));
    assessmentService.saveDraft(
      selectedQuestionNumber,
      selectedRound.status === 'awaiting_retry' ? 'retry' : 'first',
      text
    );
  };

  // Submission handler
  const handleSendMessage = async (text: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setOperationError(null);

    const questionNum = selectedQuestionNumber;
    const isRetry = selectedRound.status === 'awaiting_retry';

    try {
      if (!isRetry) {
        // Submit first attempt
        const updated = await assessmentService.submitFirstAnswer(
          questionNum,
          text,
          profile.name
        );

        // Update if user is still on this question
        if (selectedQuestionNumber === questionNum) {
          setSelectedRound({ ...updated });
        }

        // Clear draft for this attempt
        setDraftInputs((prev) => ({
          ...prev,
          [`${questionNum}_first`]: '',
        }));
      } else {
        // Submit retry
        const updated = await assessmentService.submitRetry(
          questionNum,
          text,
          profile.name
        );

        if (selectedQuestionNumber === questionNum) {
          setSelectedRound({ ...updated });
        }

        setDraftInputs((prev) => ({
          ...prev,
          [`${questionNum}_retry`]: '',
        }));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operation failed. Please try again.';
      setOperationError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Continue to next question or complete
  const handleContinue = async () => {
    setOperationError(null);
    try {
      const result = await assessmentService.advanceToNextQuestion(selectedQuestionNumber);

      if (result.isFinished || !result.nextRound) {
        onAssessmentCompleted();
      } else {
        const nextQNum = result.nextRound.questionNumber;
        setCurrentProgressionNumber(nextQNum);
        setSelectedQuestionNumber(nextQNum);
        setSelectedRound({ ...result.nextRound });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to advance. Please try again.';
      setOperationError(msg);
      throw err;
    }
  };

  const isCurrentProgress = selectedQuestionNumber === currentProgressionNumber;
  const isReadOnly = !isCurrentProgress || selectedRound.status === 'completed';

  const showComposer =
    isCurrentProgress &&
    (selectedRound.status === 'awaiting_first_answer' ||
      selectedRound.status === 'thinking_follow_up' ||
      selectedRound.status === 'awaiting_retry' ||
      selectedRound.status === 'saving_retry');

  const showContinue =
    isCurrentProgress && selectedRound.status === 'ready_to_continue';

  return (
    <div className="flex w-full min-h-[calc(100vh-4rem)]">
      {/* Left Sidebar: strictly shows question history (Question 1..maxReached) */}
      <QuestionSidebar
        maxStartedQuestion={currentProgressionNumber}
        selectedQuestionNumber={selectedQuestionNumber}
        onSelectQuestion={(qNum) => setSelectedQuestionNumber(qNum)}
        isOpenMobile={isSidebarOpenMobile}
        onCloseMobile={onCloseSidebarMobile}
      />

      {/* Main Chat Workspace Content Rail */}
      <div className="flex-1 md:pl-60 flex flex-col items-center">
        <div className="w-full max-w-[760px] px-4 sm:px-6 py-6 pb-20 flex flex-col gap-5">
          {/* Transition Notice from Frame 7 (Prior round verified) */}
          {selectedQuestionNumber > 1 && (
            <section className="w-full bg-[#f1f3ff] border border-[#dce2f7] rounded-xl p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-[#2563eb] text-white flex items-center justify-center shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  </div>
                  <span className="text-xs text-[#545f73] font-medium">
                    Question {selectedQuestionNumber - 1} verified. Advancing to technical conceptual verification.
                  </span>
                </div>
                <span className="font-mono text-[11px] text-[#9CA3AF] shrink-0 ml-2">
                  SESSION: 0{selectedQuestionNumber} // 10
                </span>
              </div>
            </section>
          )}

          {/* Assessment Active Track / Header Indicator */}
          <div className="flex items-baseline justify-between pt-1 pb-1 border-b border-[#F3F4F6]">
            <div>
              <span className="text-[10px] font-semibold text-[#6B7280] uppercase tracking-widest block mb-1">
                Concept Assessment
              </span>
              <h1 className="text-xl sm:text-2xl font-semibold text-[#111827] tracking-tight">
                Question {selectedQuestionNumber}
              </h1>
            </div>
            <div className="text-right">
              <span
                className={`text-[11px] font-semibold tracking-wider uppercase ${
                  isCurrentProgress ? 'text-[#004ac6]' : 'text-[#6B7280]'
                }`}
              >
                {isCurrentProgress ? 'Current Focus' : 'Archived (Read-Only)'}
              </span>
            </div>
          </div>

          {/* Primary Conversation Transcript Feed */}
          <MessageList
            messages={selectedRound.messages}
            topic={selectedRound.topic}
          />

          {/* Operation Error notice if any */}
          {operationError && (
            <div className="w-full p-3 rounded-xl bg-[#FEF2F2] border border-[#FCA5A5] text-xs text-[#DC2626] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{operationError}</span>
            </div>
          )}

          {/* Active Composer: Present during first attempt or retry of active round */}
          {showComposer && (
            <MessageComposer
              learnerName={profile.name}
              isRetry={selectedRound.status === 'awaiting_retry' || selectedRound.status === 'saving_retry'}
              value={currentDraftValue}
              onChange={handleDraftChange}
              onSubmit={handleSendMessage}
              disabled={isReadOnly}
              isSaving={selectedRound.status === 'saving_retry'}
              isThinking={selectedRound.status === 'thinking_follow_up'}
            />
          )}

          {/* Continue Area: Appears when retry is confirmed saved */}
          {showContinue && <ContinueArea onContinue={handleContinue} />}

          {/* Read-Only Notice when reviewing earlier rounds */}
          {isReadOnly && selectedRound.status === 'completed' && (
            <div className="w-full mt-3 p-3.5 rounded-xl bg-[#F9FAFB] border border-[#E5E7EB] text-center text-xs text-[#6B7280]">
              <span>Viewing Question {selectedQuestionNumber} in read-only mode. </span>
              <button
                type="button"
                onClick={() => setSelectedQuestionNumber(currentProgressionNumber)}
                className="text-[#004ac6] font-semibold hover:underline ml-1"
              >
                Return to active Question {currentProgressionNumber} →
              </button>
            </div>
          )}

          {/* Evaluation Criteria Supplementary Context Guide */}
          <aside className="bg-[#f1f3ff] border border-[#dce2f7] rounded-xl p-4 mt-2">
            <div className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-[#004ac6]/10 text-[#004ac6] flex items-center justify-center font-serif italic text-xs font-bold shrink-0 mt-0.5">
                i
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-[#111827]">
                  Evaluation Focus
                </span>
                <p className="text-xs text-[#545f73] leading-relaxed">
                  {selectedRound.evaluationCriteria}
                </p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
