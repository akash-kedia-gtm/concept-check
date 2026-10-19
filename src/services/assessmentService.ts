import { MODULE_2_QUESTIONS } from '../data/questionBank';
import { ChatMessage, LearnerProfile, RoundSession } from '../types';

/**
 * Assessment Service Adapter
 * Handles lifecycle of sessions, rounds, first answers, follow-up probes, and retries.
 * Adheres strictly to:
 * - One database Session = ONE question round.
 * - Application-controlled ordering of Golden Pair IDs.
 * - Internal message roles (assistant/learner) kept separate from public display names.
 * - Plain-text follow-ups without highlighting, grading, diagnosis, or praise.
 * - Max 2 learner answers per round.
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

const RUN_STORAGE_KEY = 'concept_check_active_run_v04';

class PreviewAssessmentAdapter implements AssessmentService {
  private sessions: Map<number, RoundSession> = new Map();
  private maxStartedQuestion: number = 0;

  constructor() {
    this.hydrateFromStorage();
  }

  isLiveConnected(): boolean {
    return false; // Preview mode adapter
  }

  private persist() {
    try {
      const arr = Array.from(this.sessions.entries());
      sessionStorage.setItem(
        RUN_STORAGE_KEY,
        JSON.stringify({ sessions: arr, maxStartedQuestion: this.maxStartedQuestion })
      );
    } catch {
      // Storage unavailable fallback
    }
  }

  private hydrateFromStorage() {
    try {
      const raw = sessionStorage.getItem(RUN_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.sessions = new Map(parsed.sessions || []);
        this.maxStartedQuestion = parsed.maxStartedQuestion || 0;
      }
    } catch {
      this.sessions = new Map();
      this.maxStartedQuestion = 0;
    }
  }

  async startAssessment(profile: LearnerProfile): Promise<RoundSession> {
    // Artificial small delay to reflect network dispatch
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Clear old run state if starting fresh
    this.sessions.clear();
    this.maxStartedQuestion = 1;

    const round1 = this.createRound(1);
    this.sessions.set(1, round1);
    this.persist();

    return round1;
  }

  private createRound(questionNumber: number): RoundSession {
    const qData = MODULE_2_QUESTIONS.find((q) => q.questionNumber === questionNumber);
    if (!qData) {
      throw new Error(`Invalid question number: ${questionNumber}`);
    }

    const initialMessage: ChatMessage = {
      id: `msg_${qData.goldenPairId}_initial`,
      role: 'assistant',
      type: 'question',
      content: qData.questionText,
      timestamp: new Date().toISOString(),
      speakerName: 'Concept Check',
    };

    return {
      sessionId: `sess_mod2_q${questionNumber}_${Date.now()}`,
      questionNumber,
      goldenPairId: qData.goldenPairId,
      topic: qData.topic,
      questionText: qData.questionText,
      evaluationCriteria: qData.evaluationCriteria,
      messages: [initialMessage],
      status: 'awaiting_first_answer',
      draftFirstAnswer: '',
      draftRetryAnswer: '',
    };
  }

  async getRound(questionNumber: number): Promise<RoundSession | null> {
    return this.sessions.get(questionNumber) || null;
  }

  async getAllActiveRounds(): Promise<RoundSession[]> {
    const result: RoundSession[] = [];
    for (let i = 1; i <= this.maxStartedQuestion; i++) {
      const round = this.sessions.get(i);
      if (round) {
        result.push(round);
      }
    }
    return result;
  }

  async submitFirstAnswer(
    questionNumber: number,
    answerText: string,
    learnerName: string
  ): Promise<RoundSession> {
    const round = this.sessions.get(questionNumber);
    if (!round) {
      throw new Error(`Round ${questionNumber} not found.`);
    }

    const trimmed = answerText.trim();
    if (!trimmed) {
      throw new Error('Answer cannot be empty.');
    }

    // Set status to thinking_follow_up
    round.status = 'thinking_follow_up';
    round.firstAnswerSavedAt = new Date().toISOString();

    const learnerMsg: ChatMessage = {
      id: `msg_${round.goldenPairId}_ans1_${Date.now()}`,
      role: 'learner',
      type: 'first_attempt',
      content: trimmed,
      timestamp: round.firstAnswerSavedAt,
      speakerName: learnerName,
    };
    round.messages.push(learnerMsg);
    round.draftFirstAnswer = '';
    this.persist();

    // Socratic follow-up generation (Preview simulation with authentic reasoning)
    await new Promise((resolve) => setTimeout(resolve, 850));

    const followUpText = this.generateDirectFollowUp(round.questionNumber, trimmed);
    const followUpMsg: ChatMessage = {
      id: `msg_${round.goldenPairId}_followup_${Date.now()}`,
      role: 'assistant',
      type: 'follow_up',
      content: followUpText,
      timestamp: new Date().toISOString(),
      speakerName: 'Concept Check',
    };

    round.messages.push(followUpMsg);
    round.status = 'awaiting_retry';
    // Store internal gap metadata without exposing to learner UI
    round.gapMetadata = {
      identifiedGap: 'Mechanism elaboration needed for complete conceptual synthesis',
      supportingPhrase: trimmed.slice(0, 60),
    };

    this.persist();
    return round;
  }

  async submitRetry(
    questionNumber: number,
    retryText: string,
    learnerName: string
  ): Promise<RoundSession> {
    const round = this.sessions.get(questionNumber);
    if (!round) {
      throw new Error(`Round ${questionNumber} not found.`);
    }

    const trimmed = retryText.trim();
    if (!trimmed) {
      throw new Error('Retry response cannot be empty.');
    }

    round.status = 'saving_retry';
    this.persist();

    // Small network save simulation
    await new Promise((resolve) => setTimeout(resolve, 600));

    round.retrySavedAt = new Date().toISOString();
    const retryMsg: ChatMessage = {
      id: `msg_${round.goldenPairId}_ans2_${Date.now()}`,
      role: 'learner',
      type: 'retry',
      content: trimmed,
      timestamp: round.retrySavedAt,
      speakerName: learnerName,
    };

    round.messages.push(retryMsg);
    round.draftRetryAnswer = '';
    round.status = 'ready_to_continue';
    this.persist();

    return round;
  }

  async advanceToNextQuestion(currentQuestionNumber: number): Promise<{
    nextRound: RoundSession | null;
    isFinished: boolean;
  }> {
    const currentRound = this.sessions.get(currentQuestionNumber);
    if (currentRound) {
      currentRound.status = 'completed';
    }

    if (currentQuestionNumber >= 10) {
      this.persist();
      return { nextRound: null, isFinished: true };
    }

    const nextQNum = currentQuestionNumber + 1;
    let nextRound = this.sessions.get(nextQNum);
    if (!nextRound) {
      nextRound = this.createRound(nextQNum);
      this.sessions.set(nextQNum, nextRound);
      if (nextQNum > this.maxStartedQuestion) {
        this.maxStartedQuestion = nextQNum;
      }
    }

    this.persist();
    return { nextRound, isFinished: false };
  }

  saveDraft(questionNumber: number, type: 'first' | 'retry', text: string): void {
    const round = this.sessions.get(questionNumber);
    if (round) {
      if (type === 'first') {
        round.draftFirstAnswer = text;
      } else {
        round.draftRetryAnswer = text;
      }
      this.persist();
    }
  }

  getDraft(questionNumber: number, type: 'first' | 'retry'): string {
    const round = this.sessions.get(questionNumber);
    if (!round) return '';
    return type === 'first' ? round.draftFirstAnswer : round.draftRetryAnswer;
  }

  /**
   * Generates a plain-text follow-up without highlighting, praise, or diagnosis.
   * Probes the underlying mechanics in response to the learner's formulation.
   */
  private generateDirectFollowUp(qNum: number, answer: string): string {
    const lower = answer.toLowerCase();

    switch (qNum) {
      case 1:
        if (lower.includes('security') || lower.includes('safe') || lower.includes('hack')) {
          return 'What specifically allows a visitor or browser user to inspect bundled code or network traffic, and why cannot obfuscation solve this?';
        }
        return 'What could an attacker inspect after the website loads, and why does the client runtime lack boundary isolation for secrets?';

      case 2:
        if (lower.includes('refresh') || lower.includes('reload')) {
          return 'How does the browser handle the existing DOM tree and active memory during client-side transitions versus receiving a new HTML document?';
        }
        return 'What role does the browser History API play during client-side routing, and how is server round-trip overhead altered?';

      case 3:
        if (lower.includes('props') || lower.includes('prop drilling')) {
          return 'What performance or maintainability risks arise if components that do not need a piece of state are forced to re-render because it resides in a global store?';
        }
        return 'How do you determine whether a piece of state belongs to an isolated component subtree or requires application-level lifecycle synchronization?';

      case 4:
        if (lower.includes('domain') || lower.includes('origin')) {
          return 'What prevents a malicious third-party script from reading responses containing ambient cookies or session tokens if CORS headers are misconfigured?';
        }
        return 'What is the role of the preflight OPTIONS request in CORS, and which request characteristics trigger it?';

      case 5:
        if (lower.includes('build') || lower.includes('static')) {
          return 'How do personalized user data or frequent content updates impact the caching and invalidation strategy for SSG compared to SSR?';
        }
        return 'What are the infrastructure cost and server load implications when traffic spikes on an SSR endpoint compared to pre-rendered static assets on a CDN?';

      case 6:
        if (lower.includes('cache') || lower.includes('header')) {
          return 'What is the exact HTTP response code returned when an ETag matches the client conditional request, and what happens to the response body?';
        }
        return 'How does the client know whether to revalidate an asset with the origin server or serve it directly from local cache without a network round-trip?';

      case 7:
        if (lower.includes('acid') || lower.includes('transaction')) {
          return 'What specific data corruption or race condition could occur if two simultaneous balance transfers read and update an account without transaction isolation?';
        }
        return 'Under what conditions might an eventually consistent document database allow a balance violation or double-spend during concurrent requests?';

      case 8:
        if (lower.includes('token') || lower.includes('jwt')) {
          return 'If a user logs out or has their account compromised, why is it harder to revoke an active stateless JWT immediately compared to invalidating a server session row?';
        }
        return 'Where should a stateless authentication token be stored to mitigate both Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF)?';

      case 9:
        if (lower.includes('rollback') || lower.includes('undo') || lower.includes('fail')) {
          return 'How should the user interface communicate a synchronization failure to the user without causing jarring layout shifts or discarding subsequent edits?';
        }
        return 'What mechanism ensures the local cache returns to the verified server state without overwriting newer, unrelated mutations?';

      case 10:
        if (lower.includes('queue') || lower.includes('priority')) {
          return 'At what point in the event loop turn are all queued microtasks drained, and can a recurring microtask starve the rendering engine?';
        }
        return 'If a Promise resolves and a setTimeout callback is scheduled simultaneously, which handler executes first upon call stack exhaustion and why?';

      default:
        return 'What underlying mechanism or architectural constraint leads to this behavior in production environments?';
    }
  }
}

export const assessmentService: AssessmentService = new PreviewAssessmentAdapter();
