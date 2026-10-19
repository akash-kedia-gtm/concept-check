import { PreparedQuestion } from '../types';

/**
 * Prepared Question Bank for Module 2
 * Display positions (Question 1..10) map strictly to Golden Pair UUIDs in Supabase.
 * Predefined follow-ups are omitted; follow-ups are generated dynamically by the LLM.
 * Expected answers are kept strictly in Supabase (server-side) and never shipped in frontend code.
 */
export const MODULE_2_QUESTIONS: PreparedQuestion[] = [
  {
    goldenPairId: '30000000-0000-4000-8000-000000000001',
    questionNumber: 1,
    topic: 'Backend Architecture & Client Boundaries',
    questionText:
      'Why does an application need a backend instead of handling every operation in the browser?',
    evaluationCriteria:
      'A backend handles operations that require trusted execution, authorization, protected secrets, and/or business logic. Distinguish client interface from server-side trusted execution.',
  },
  {
    goldenPairId: '30000000-0000-4000-8000-000000000002',
    questionNumber: 2,
    topic: 'HTTP Protocol & API Requests',
    questionText:
      'What information travels in a typical HTTP API request from a frontend to a server?',
    evaluationCriteria:
      'Request includes HTTP method, URL/path, headers (content type, auth token), and optional body (JSON). Distinguish request contents from server response contents.',
  },
  {
    goldenPairId: '30000000-0000-4000-8000-000000000003',
    questionNumber: 3,
    topic: 'Client Security & Secret Protection',
    questionText:
      'Why is hiding a secret API key from the visible webpage not enough to protect it?',
    evaluationCriteria:
      'Browser bundles and network traffic are inspectable. Secrets shipped to the client can be extracted. Credentials must stay in trusted server environments.',
  },
  {
    goldenPairId: '30000000-0000-4000-8000-000000000004',
    questionNumber: 4,
    topic: 'State Persistence & Session Lifecycle',
    questionText:
      'A learner sends a chat message and sees it on screen, then refreshes. Why might the message disappear?',
    evaluationCriteria:
      'Temporary client state resets on reload. Durable database persistence and retrieval on hydration are required for permanence.',
  },
  {
    goldenPairId: '30000000-0000-4000-8000-000000000005',
    questionNumber: 5,
    topic: 'Relational Modeling & Foreign Keys',
    questionText:
      'One user can have many chats, but each chat belongs to one user. Where should user_id be stored, and why?',
    evaluationCriteria:
      'user_id goes as a foreign key on the many side (chats table). Supports multiple chats per user cleanly without array/list columns in users.',
  },
  {
    goldenPairId: '30000000-0000-4000-8000-000000000006',
    questionNumber: 6,
    topic: 'Data Normalization & Event History',
    questionText:
      'One conversation has many messages. Why should its messages generally be separate database rows instead of one growing text cell?',
    evaluationCriteria:
      'Each message is a discrete event with role, content, timestamp, and ID. Separate rows facilitate ordering, indexing, and partial updates.',
  },
  {
    goldenPairId: '30000000-0000-4000-8000-000000000007',
    topic: 'File Storage vs Relational Data',
    questionNumber: 7,
    questionText:
      'A user uploads a large PDF to an application. What should be stored in file storage, and what should be stored in the database?',
    evaluationCriteria:
      'File bytes reside in blob/object storage; relational database holds paths/identifiers, metadata, and ownership links.',
  },
  {
    goldenPairId: '30000000-0000-4000-8000-000000000008',
    questionNumber: 8,
    topic: 'Secure AI Proxying & Edge Architecture',
    questionText:
      'A React frontend needs an AI reply using a secret provider API key. Describe the safe path from the browser to the model and back.',
    evaluationCriteria:
      'Browser sends request to backend proxy/Edge Function. Server reads secret, dispatches call to model API, validates response, returns sanitized payload.',
  },
  {
    goldenPairId: '30000000-0000-4000-8000-000000000009',
    questionNumber: 9,
    topic: 'Access Control & Row-Level Authorization',
    questionText:
      'Two signed-in users have saved different chat histories. How should the application stop one user from reading the other\'s messages?',
    evaluationCriteria:
      'Authenticate caller via verified token/JWT; enforce authorization with RLS policies and backend ownership checks. Never trust client-supplied ID parameters.',
  },
  {
    goldenPairId: '30000000-0000-4000-8000-000000000010',
    questionNumber: 10,
    topic: 'Socratic Diagnostic Data Flow & Retries',
    questionText:
      'A learner answers a question, receives a follow-up, and answers again. How would you save both answers so you can later identify which gap the second answer addressed?',
    evaluationCriteria:
      'Store initial attempt and retry as distinct rows. Identified gap links to initial attempt. Retry links back to that gap via foreign key.',
  },
];
