/**
 * Types for Concept Check - Version 0.4
 * Implements strict separation between internal database roles and public display names.
 */

export interface LearnerProfile {
  name: string;      // The learner's display name (spaces permitted)
  username: string;  // Unique identifier chosen by learner (no whitespace)
  createdAt: string;
}

export type MessageRole = 'assistant' | 'learner';

export type MessageType = 'question' | 'first_attempt' | 'follow_up' | 'retry';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  timestamp: string;
  speakerName: string; // "Concept Check" or learner's display name (e.g. "Akash Kedia")
}

export type RoundStatus =
  | 'unstarted'
  | 'awaiting_first_answer'
  | 'thinking_follow_up'
  | 'awaiting_retry'
  | 'saving_retry'
  | 'ready_to_continue'
  | 'completed';

export interface PreparedQuestion {
  goldenPairId: string;
  questionNumber: number; // 1 to 10
  topic: string;
  questionText: string;
  evaluationCriteria: string;
  suggestedGapProbes?: Record<string, string>;
}

export interface RoundSession {
  sessionId: string;
  questionNumber: number; // 1 to 10
  goldenPairId: string;
  topic: string;
  questionText: string;
  evaluationCriteria: string;
  messages: ChatMessage[];
  status: RoundStatus;
  draftFirstAnswer: string;
  draftRetryAnswer: string;
  firstAnswerSavedAt?: string;
  retrySavedAt?: string;
  // Internal gap reference preserved without polluting learner interface
  gapMetadata?: {
    identifiedGap?: string;
    supportingPhrase?: string;
  };
}

export type ScreenState = 'signup' | 'start' | 'chat_workspace' | 'thank_you';
