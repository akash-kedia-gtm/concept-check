import { PreparedQuestion } from '../types';

/**
 * Prepared Question Bank for Module 2
 * Display positions (Question 1..10) map to explicit Golden Pair IDs.
 * These are prepared data, not runtime hallucinations.
 */
export const MODULE_2_QUESTIONS: PreparedQuestion[] = [
  {
    goldenPairId: 'gp_mod2_sec_001',
    questionNumber: 1,
    topic: 'Web Security & Client Environments',
    questionText: "Why shouldn't a secret API key be included in JavaScript sent to a browser?",
    evaluationCriteria:
      'Distinguish client-accessible bundles from secure server execution environments. Focus on inspector access and network extraction.',
  },
  {
    goldenPairId: 'gp_mod2_arch_002',
    questionNumber: 2,
    topic: 'Single Page Applications & Web Architecture',
    questionText:
      'What is the primary difference between client-side routing and server-side page navigation?',
    evaluationCriteria:
      'Distinguish lifecycle execution, document retrieval, and DOM updates. Focus on mechanics rather than opinionated framework preferences.',
  },
  {
    goldenPairId: 'gp_mod2_state_003',
    questionNumber: 3,
    topic: 'State Architecture & Data Flow',
    questionText:
      'When should application state be managed locally within a component versus elevated to a shared global store?',
    evaluationCriteria:
      'Evaluate component reusability, prop drilling friction, local lifecycle ownership, and cache invalidation.',
  },
  {
    goldenPairId: 'gp_mod2_cors_004',
    questionNumber: 4,
    topic: 'Browser Security Model & Cross-Origin Rules',
    questionText:
      "How does the browser's Same-Origin Policy protect users, and what role does CORS play in relaxing it safely?",
    evaluationCriteria:
      'Identify ambient session credentials, server-controlled response headers, and preflight handshake verification.',
  },
  {
    goldenPairId: 'gp_mod2_render_005',
    questionNumber: 5,
    topic: 'Rendering Patterns & Performance Tradeoffs',
    questionText:
      'What are the core technical tradeoffs between Server-Side Rendering (SSR) and Static Site Generation (SSG) in production?',
    evaluationCriteria:
      'Balance TTFB (time-to-first-byte), CDN edge caching, server compute overhead per request, and dynamic data freshness.',
  },
  {
    goldenPairId: 'gp_mod2_cache_006',
    questionNumber: 6,
    topic: 'HTTP Protocol & Caching Strategies',
    questionText:
      'How do HTTP ETag and Cache-Control headers collaborate to prevent unnecessary payload downloads over the network?',
    evaluationCriteria:
      'Differentiate between client-side freshness expiration and 304 Not Modified cryptographic revalidation.',
  },
  {
    goldenPairId: 'gp_mod2_db_007',
    questionNumber: 7,
    topic: 'Database Consistency & Transaction Guarantees',
    questionText:
      'Why might a financial ledger prefer an ACID-compliant relational database over an eventually consistent document store?',
    evaluationCriteria:
      'Explain atomicity, strict isolation levels, transactional invariants, and anomalies created by concurrent balance writes.',
  },
  {
    goldenPairId: 'gp_mod2_auth_008',
    questionNumber: 8,
    topic: 'Authentication & Session Management',
    questionText:
      'What architectural tradeoffs exist between stateless JWT authentication and stateful server-side sessions?',
    evaluationCriteria:
      'Assess immediate revocation latency, token theft storage vulnerabilities (cookie vs localStorage), and database lookup costs.',
  },
  {
    goldenPairId: 'gp_mod2_optui_009',
    questionNumber: 9,
    topic: 'Distributed UI State & Resilience',
    questionText:
      'How should a frontend application handle state rollbacks and reconciliation when an optimistic UI update fails on the server?',
    evaluationCriteria:
      'Address snapshot rollbacks, user disruption minimization, concurrent dirty states, and idempotent recovery.',
  },
  {
    goldenPairId: 'gp_mod2_evloop_010',
    questionNumber: 10,
    topic: 'Asynchronous Runtime & Concurrency',
    questionText:
      'In the JavaScript event loop, what is the precise difference in execution priority between microtasks and macrotasks?',
    evaluationCriteria:
      'Clarify microtask queue draining before macrotask ticks, Promise job execution, and browser repaint interleaving.',
  },
];
