import { supabase } from '../lib/supabaseClient';
import { LearnerProfile, RoundSession } from '../types';

/**
 * Assessment Service Adapter
 * Real Supabase implementation routing all assessment state,
 * question progression, and answer persistence to the 'assessment' Edge Function.
 *
 * Adheres strictly to:
 * - One database Session = ONE question round.
 * - Strict application-controlled ordering of Golden Pair IDs.
 * - Authenticated JWT used for caller identity verification (never trusted client JSON).
 * - Socratic progression: original question -> first answer -> Groq follow-up -> retry -> continue.
 */

export interface AssessmentService {
  startAssessment(profile: LearnerProfile): Promise<RoundSession>;
  getRound(questionNumber: number): Promise<RoundSession | null>;
  getAllActiveRounds(): Promise<RoundSession[]>;
  submitFirstAnswer(
    questionNumber: number,
    answerText: string,
    learnerName: string
  ): Promise<RoundSession>;
  submitRetry(
    questionNumber: number,
    retryText: string,
    learnerName: string
  ): Promise<RoundSession>;
  advanceToNextQuestion(currentQuestionNumber: number): Promise<{
    nextRound: RoundSession | null;
    isFinished: boolean;
  }>;
  saveDraft(questionNumber: number, type: 'first' | 'retry', text: string): void;
  getDraft(questionNumber: number, type: 'first' | 'retry'): string;
  isLiveConnected(): boolean;
}

const DRAFT_STORAGE_KEY = 'concept_check_drafts_v1';

class SupabaseAssessmentAdapter implements AssessmentService {
  private cachedRounds: Map<number, RoundSession> = new Map();
  private maxStartedQuestion: number = 0;

  isLiveConnected(): boolean {
    return true;
  }

  /**
   * Action A: Start Assessment
   * Invokes Edge Function to create run_id, initialize Session 1 with Golden Pair 1,
   * and save the first assistant question.
   */
  async startAssessment(_profile: LearnerProfile): Promise<RoundSession> {
    const { data, error } = await supabase.functions.invoke('assessment', {
      body: { action: 'start_assessment' },
    });

    if (error) {
      throw new Error(`Failed to start assessment: ${error.message || 'Edge function error'}`);
    }

    if (!data?.round) {
      throw new Error('Edge function did not return a valid initial round.');
    }

    const round = data.round as RoundSession;
    this.cachedRounds.clear();
    this.cachedRounds.set(1, round);
    this.maxStartedQuestion = 1;

    return round;
  }

  /**
   * Action E: Load Assessment
   * Retrieves user's session history on page load / refresh.
   */
  async getAllActiveRounds(): Promise<RoundSession[]> {
    try {
      const { data, error } = await supabase.functions.invoke('assessment', {
        body: { action: 'load_assessment' },
      });

      if (error || !data) {
        return [];
      }

      if (!data.hasAssessment || !Array.isArray(data.rounds)) {
        return [];
      }

      const rounds = data.rounds as RoundSession[];
      this.cachedRounds.clear();
      for (const r of rounds) {
        this.cachedRounds.set(r.questionNumber, r);
        if (r.questionNumber > this.maxStartedQuestion) {
          this.maxStartedQuestion = r.questionNumber;
        }
      }

      return rounds;
    } catch {
      return [];
    }
  }

  async getRound(questionNumber: number): Promise<RoundSession | null> {
    return this.cachedRounds.get(questionNumber) || null;
  }

  /**
   * Action B: Submit First Answer
   * Saves the learner's initial explanation to public.messages and
   * receives the Groq-generated Socratic follow-up question.
   */
  async submitFirstAnswer(
    questionNumber: number,
    answerText: string,
    learnerName: string
  ): Promise<RoundSession> {
    const currentRound = this.cachedRounds.get(questionNumber);
    if (!currentRound) {
      throw new Error(`Round ${questionNumber} not loaded.`);
    }

    const trimmed = answerText.trim();
    if (!trimmed) {
      throw new Error('Answer cannot be empty.');
    }

    const { data, error } = await supabase.functions.invoke('assessment', {
      body: {
        action: 'submit_first_answer',
        sessionId: currentRound.sessionId,
        answerText: trimmed,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to submit first answer.');
    }

    // Attach saved learner first attempt message
    if (data?.savedFirstAttempt) {
      const exists = currentRound.messages.some((m) => m.id === data.savedFirstAttempt.id);
      if (!exists) {
        currentRound.messages.push({
          id: data.savedFirstAttempt.id,
          role: data.savedFirstAttempt.role,
          type: data.savedFirstAttempt.type,
          content: data.savedFirstAttempt.content,
          timestamp: data.savedFirstAttempt.timestamp,
          speakerName: learnerName,
        });
      }
    }

    // Attach Groq follow-up question message
    if (data?.followUpMessage) {
      const exists = currentRound.messages.some((m) => m.id === data.followUpMessage.id);
      if (!exists) {
        currentRound.messages.push({
          id: data.followUpMessage.id,
          role: data.followUpMessage.role,
          type: data.followUpMessage.type,
          content: data.followUpMessage.content,
          timestamp: data.followUpMessage.timestamp,
          speakerName: 'Concept Check',
        });
      }
      currentRound.status = 'awaiting_retry';
    } else {
      currentRound.status = 'thinking_follow_up';
    }

    currentRound.draftFirstAnswer = '';
    this.cachedRounds.set(questionNumber, currentRound);

    return currentRound;
  }

  /**
   * Action C: Submit Retry
   * Saves the learner's retry explanation linked to the session's gap without re-invoking Groq.
   */
  async submitRetry(
    questionNumber: number,
    retryText: string,
    learnerName: string
  ): Promise<RoundSession> {
    const currentRound = this.cachedRounds.get(questionNumber);
    if (!currentRound) {
      throw new Error(`Round ${questionNumber} not loaded.`);
    }

    const trimmed = retryText.trim();
    if (!trimmed) {
      throw new Error('Retry explanation cannot be empty.');
    }

    const { data, error } = await supabase.functions.invoke('assessment', {
      body: {
        action: 'submit_retry',
        sessionId: currentRound.sessionId,
        retryText: trimmed,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to submit retry.');
    }

    if (data?.savedMessage) {
      const exists = currentRound.messages.some((m) => m.id === data.savedMessage.id);
      if (!exists) {
        currentRound.messages.push({
          id: data.savedMessage.id,
          role: data.savedMessage.role,
          type: data.savedMessage.type,
          content: data.savedMessage.content,
          timestamp: data.savedMessage.timestamp,
          speakerName: learnerName,
        });
      }
    }

    currentRound.draftRetryAnswer = '';
    currentRound.status = 'ready_to_continue';
    this.cachedRounds.set(questionNumber, currentRound);

    return currentRound;
  }

  /**
   * Action D: Continue Assessment
   * Advances from current completed question to the next question (up to Question 10).
   */
  async advanceToNextQuestion(currentQuestionNumber: number): Promise<{
    nextRound: RoundSession | null;
    isFinished: boolean;
  }> {
    const currentRound = this.cachedRounds.get(currentQuestionNumber);
    if (!currentRound) {
      throw new Error(`Round ${currentQuestionNumber} not loaded.`);
    }

    const { data, error } = await supabase.functions.invoke('assessment', {
      body: {
        action: 'continue_assessment',
        sessionId: currentRound.sessionId,
      },
    });

    if (error) {
      throw new Error(error.message || 'Failed to advance to next question.');
    }

    currentRound.status = 'completed';

    if (data?.isFinished || !data?.nextRound) {
      return { nextRound: null, isFinished: true };
    }

    const nextRound = data.nextRound as RoundSession;
    this.cachedRounds.set(nextRound.questionNumber, nextRound);
    if (nextRound.questionNumber > this.maxStartedQuestion) {
      this.maxStartedQuestion = nextRound.questionNumber;
    }

    return { nextRound, isFinished: false };
  }

  saveDraft(questionNumber: number, type: 'first' | 'retry', text: string): void {
    const round = this.cachedRounds.get(questionNumber);
    if (round) {
      if (type === 'first') {
        round.draftFirstAnswer = text;
      } else {
        round.draftRetryAnswer = text;
      }
    }
    try {
      const key = `${DRAFT_STORAGE_KEY}_${questionNumber}_${type}`;
      sessionStorage.setItem(key, text);
    } catch {
      // Storage unavailable fallback
    }
  }

  getDraft(questionNumber: number, type: 'first' | 'retry'): string {
    const round = this.cachedRounds.get(questionNumber);
    if (round) {
      return type === 'first' ? round.draftFirstAnswer : round.draftRetryAnswer;
    }
    try {
      const key = `${DRAFT_STORAGE_KEY}_${questionNumber}_${type}`;
      return sessionStorage.getItem(key) || '';
    } catch {
      return '';
    }
  }
}

export const assessmentService: AssessmentService = new SupabaseAssessmentAdapter();
