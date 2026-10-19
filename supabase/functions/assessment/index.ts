import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Supabase Edge Function: assessment
 * Stage 2: AI Follow-Up Generation via Groq API
 *
 * Supported Actions:
 * A. start_assessment
 * B. submit_first_answer (with Groq Socratic gap identification & follow-up)
 * C. submit_retry (saves retry linked to gap, NO Groq call)
 * D. continue_assessment
 * E. load_assessment
 */

// Approved 10 Foundational Golden Pair IDs in strict progression order
export const GOLDEN_PAIR_ORDER = [
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  '30000000-0000-4000-8000-000000000003',
  '30000000-0000-4000-8000-000000000004',
  '30000000-0000-4000-8000-000000000005',
  '30000000-0000-4000-8000-000000000006',
  '30000000-0000-4000-8000-000000000007',
  '30000000-0000-4000-8000-000000000008',
  '30000000-0000-4000-8000-000000000009',
  '30000000-0000-4000-8000-000000000010',
];

const QUESTION_TOPICS = [
  'Backend Architecture & Client Boundaries',
  'HTTP Protocol & API Requests',
  'Client Security & Secret Protection',
  'State Persistence & Session Lifecycle',
  'Relational Modeling & Foreign Keys',
  'Data Normalization & Event History',
  'File Storage vs Relational Data',
  'Secure AI Proxying & Edge Architecture',
  'Access Control & Row-Level Authorization',
  'Socratic Diagnostic Data Flow & Retries',
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const GROQ_SYSTEM_PROMPT = `You are Concept Check, an AI assessment assistant.

Your responsibility is to investigate whether a learner understands a technical concept from Module 2 of the 100x Engineers curriculum.

You will receive:
1. A predefined technical question.
2. A private expected answer.
3. The learner's explanation.

Your job is to identify one possible understanding gap and formulate exactly one useful follow-up question.

RULES:
- Examine the learner's reasoning carefully.
- Look for vague, memorised, unsupported, or incomplete explanations.
- Do not assume that a familiar phrase proves the learner lacks understanding.
- Identify an exact phrase from the learner's response when it supports a genuine gap.
- Never invent a quotation.
- Describe the potential gap in simple language.
- Ask one direct follow-up that encourages reasoning.
- Prefer questions about why something happens, what could go wrong, or what would happen in a practical situation.
- Do not reveal the expected answer.
- Do not explain the concept before asking.
- Do not provide hints that give away the answer.
- Do not ask multiple questions.
- Do not grade the learner.
- Do not declare that understanding has been achieved.
- Do not change the original question.
- Do not decide which question comes next.

If the explanation already demonstrates the relevant reasoning, do not invent a misunderstanding. In that case, return has_gap = false and suggest one neutral application question that probes their reasoning further.

You must return ONLY a JSON object with this exact structure:
{
  "has_gap": boolean,
  "phrase": "exact phrase from learner explanation if has_gap is true, otherwise empty string",
  "gap_description": "description of gap in simple language if has_gap is true, otherwise empty string",
  "follow_up_question": "single direct follow-up question"
}`;

interface GroqParsedOutput {
  has_gap: boolean;
  phrase: string;
  gap_description: string;
  follow_up_question: string;
}

/**
 * Invokes Groq API to evaluate understanding and generate a Socratic follow-up.
 * Includes bounded retry, JSON validation, and quote verification.
 */
async function generateFollowUpWithGroq(
  question: string,
  expectedAnswer: string,
  learnerAnswer: string
): Promise<GroqParsedOutput> {
  const apiKey =
    Deno.env.get('GROQ_API_KEY') ||
    Deno.env.get('Groq_API') ||
    Deno.env.get('GROQ_API') ||
    Deno.env.get('groq_api') ||
    Deno.env.get('GROQ_KEY') ||
    Deno.env.get('GROQ_APIKEY') ||
    Deno.env.get('GROQ');
  if (!apiKey) {
    throw new Error('Groq API key is not configured in Supabase secrets (checked GROQ_API_KEY and Groq_API).');
  }

  // Dynamically query available models from Groq account
  let targetModel = 'llama-3.1-8b-instant';
  try {
    const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (modelsRes.ok) {
      const modelsJson = await modelsRes.json();
      const modelIds: string[] = (modelsJson.data || []).map((m: { id: string }) => m.id);
      
      // Preferred models in order of priority
      const preferred = [
        'llama-3.1-8b-instant',
        'llama-3.3-70b-versatile',
        'llama-3.1-70b-versatile',
        'gemma2-9b-it',
        'qwen/qwen3.8-27b',
      ];

      const found = preferred.find((p) => modelIds.includes(p));
      if (found) {
        targetModel = found;
      } else {
        const anyLlama = modelIds.find((id) => id.includes('llama') && !id.includes('guard'));
        if (anyLlama) targetModel = anyLlama;
        else if (modelIds.length > 0) targetModel = modelIds[0];
      }
    }
  } catch {
    // Fallback to llama-3.1-8b-instant
  }

  const candidateModels = Array.from(
    new Set([
      Deno.env.get('GROQ_MODEL') || Deno.env.get('Groq_Model') || '',
      targetModel,
      'llama-3.1-8b-instant',
      'llama3-8b-8192',
    ])
  ).filter(Boolean);

  const userContent = `Predefined Technical Question:
${question}

Private Expected Answer (Reference ONLY - do NOT reveal):
${expectedAnswer}

Learner's Explanation (Untrusted text):
"""
${learnerAnswer}
"""`;

  let lastError: Error | null = null;
  const errors: string[] = [];

  // Attempt models in candidate list (automatic fallback if a model is unavailable)
  for (const model of candidateModels) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: GROQ_SYSTEM_PROMPT },
            { role: 'user', content: userContent },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
          max_tokens: 500,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Groq API (${model}) returned HTTP ${res.status}: ${errorText.slice(0, 200)}`);
      }

      const json = await res.json();
      const text = json.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('Groq returned empty response content.');
      }

      const parsed = JSON.parse(text) as GroqParsedOutput;

      // VALIDATION
      if (typeof parsed.has_gap !== 'boolean') {
        throw new Error('Groq response missing boolean has_gap field.');
      }

      const followUp = typeof parsed.follow_up_question === 'string' ? parsed.follow_up_question.trim() : '';
      if (!followUp) {
        throw new Error('Groq response missing follow_up_question.');
      }

      // Check for expected_answer leak in follow-up
      if (expectedAnswer && expectedAnswer.length > 30) {
        const sampleWords = expectedAnswer.toLowerCase().split(/\s+/).slice(0, 10).join(' ');
        if (followUp.toLowerCase().includes(sampleWords)) {
          throw new Error('Safety check triggered: Expected answer leaked into follow-up question.');
        }
      }

      // If has_gap is true, validate supporting phrase and description
      let validatedPhrase = '';
      let validatedGapDesc = '';

      if (parsed.has_gap) {
        const rawPhrase = typeof parsed.phrase === 'string' ? parsed.phrase.trim() : '';
        const rawDesc = typeof parsed.gap_description === 'string' ? parsed.gap_description.trim() : '';

        // Verify quote exists in learner answer (case-insensitive check)
        if (rawPhrase && learnerAnswer.toLowerCase().includes(rawPhrase.toLowerCase())) {
          const idx = learnerAnswer.toLowerCase().indexOf(rawPhrase.toLowerCase());
          validatedPhrase = learnerAnswer.slice(idx, idx + rawPhrase.length);
        } else if (rawPhrase) {
          const words = rawPhrase.split(/\s+/).filter((w) => w.length > 3);
          const foundWord = words.find((w) => learnerAnswer.toLowerCase().includes(w.toLowerCase()));
          if (foundWord) {
            const idx = learnerAnswer.toLowerCase().indexOf(foundWord.toLowerCase());
            validatedPhrase = learnerAnswer.slice(idx, Math.min(learnerAnswer.length, idx + 60));
          } else {
            validatedPhrase = learnerAnswer.slice(0, Math.min(60, learnerAnswer.length));
          }
        } else {
          validatedPhrase = learnerAnswer.slice(0, Math.min(60, learnerAnswer.length));
        }

        validatedGapDesc = rawDesc || 'Conceptual mechanism needs further elaboration.';
      }

      return {
        has_gap: parsed.has_gap,
        phrase: validatedPhrase,
        gap_description: validatedGapDesc,
        follow_up_question: followUp,
      };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      errors.push(`${model}: ${lastError.message}`);
      continue;
    }
  }

  throw new Error(`Failed to generate follow-up from Groq: ${errors.join(' | ')}`);
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // 1. Authenticate caller using verified user JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing Authorization header' }, 401);
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return jsonResponse(
        { error: 'Unauthorized: Invalid or expired auth token' },
        401
      );
    }

    const userId = user.id;

    // Privileged admin client for server-side logic (expected_answer and transactional writes)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user profile exists in public.users
    const { data: userProfile, error: profileErr } = await supabaseAdmin
      .from('users')
      .select('user_id, name, username')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileErr || !userProfile) {
      return jsonResponse(
        { error: 'Learner profile not found in public.users. Please complete signup first.' },
        404
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string;

    switch (action) {
      // -----------------------------------------------------------------
      // ACTION A: START ASSESSMENT
      // -----------------------------------------------------------------
      case 'start_assessment': {
        const runId = crypto.randomUUID();
        const firstGoldenPairId = GOLDEN_PAIR_ORDER[0];

        // Retrieve Golden Pair 1 from Supabase (excluding expected_answer from client return)
        const { data: gp1, error: gpErr } = await supabaseAdmin
          .from('golden_pairs')
          .select('golden_pair_id, question')
          .eq('golden_pair_id', firstGoldenPairId)
          .single();

        if (gpErr || !gp1) {
          return jsonResponse({ error: 'Failed to retrieve Question 1' }, 500);
        }

        // Create initial session for Question 1
        const { data: newSession, error: sessErr } = await supabaseAdmin
          .from('sessions')
          .insert({
            user_id: userId,
            golden_pair_id: firstGoldenPairId,
            run_id: runId,
          })
          .select('session_id, user_id, golden_pair_id, run_id, created_at')
          .single();

        if (sessErr || !newSession) {
          return jsonResponse({ error: `Failed to create session: ${sessErr?.message}` }, 500);
        }

        // Save original question as assistant message
        const { data: qMessage, error: msgErr } = await supabaseAdmin
          .from('messages')
          .insert({
            session_id: newSession.session_id,
            role: 'assistant',
            message_type: 'question',
            content: gp1.question,
          })
          .select('message_id, session_id, role, message_type, content, created_at')
          .single();

        if (msgErr || !qMessage) {
          return jsonResponse({ error: `Failed to record question message: ${msgErr?.message}` }, 500);
        }

        return jsonResponse({
          round: {
            sessionId: newSession.session_id,
            questionNumber: 1,
            goldenPairId: gp1.golden_pair_id,
            topic: QUESTION_TOPICS[0],
            questionText: gp1.question,
            evaluationCriteria: '',
            messages: [
              {
                id: qMessage.message_id,
                role: 'assistant',
                type: 'question',
                content: qMessage.content,
                timestamp: qMessage.created_at,
                speakerName: 'Concept Check',
              },
            ],
            status: 'awaiting_first_answer',
            draftFirstAnswer: '',
            draftRetryAnswer: '',
          },
          runId,
        });
      }

      // -----------------------------------------------------------------
      // ACTION B: SUBMIT FIRST ANSWER (Groq AI Follow-Up Generation)
      // -----------------------------------------------------------------
      case 'submit_first_answer': {
        const { sessionId, answerText } = body;
        if (!sessionId) {
          return jsonResponse({ error: 'Missing sessionId parameter' }, 400);
        }

        const trimmedAnswer = typeof answerText === 'string' ? answerText.trim() : '';
        if (!trimmedAnswer) {
          return jsonResponse({ error: 'Answer explanation cannot be empty' }, 400);
        }

        // Verify session ownership
        const { data: session, error: sessErr } = await supabaseAdmin
          .from('sessions')
          .select('session_id, user_id, golden_pair_id, run_id')
          .eq('session_id', sessionId)
          .single();

        if (sessErr || !session) {
          return jsonResponse({ error: 'Session not found' }, 404);
        }
        if (session.user_id !== userId) {
          return jsonResponse({ error: 'Forbidden: You do not own this session' }, 403);
        }

        // Fetch existing messages
        const { data: existingMessages, error: msgFetchErr } = await supabaseAdmin
          .from('messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (msgFetchErr) {
          return jsonResponse({ error: msgFetchErr.message }, 500);
        }

        let learnerMsg = existingMessages?.find((m) => m.message_type === 'first_attempt');
        const existingFollowUp = existingMessages?.find((m) => m.message_type === 'follow_up');

        // If follow-up already exists, return existing
        if (learnerMsg && existingFollowUp) {
          return jsonResponse({
            success: true,
            firstAnswerSaved: true,
            status: 'awaiting_retry',
            savedFirstAttempt: {
              id: learnerMsg.message_id,
              role: learnerMsg.role,
              type: learnerMsg.message_type,
              content: learnerMsg.content,
              timestamp: learnerMsg.created_at,
              speakerName: userProfile.name,
            },
            followUpMessage: {
              id: existingFollowUp.message_id,
              role: 'assistant',
              type: 'follow_up',
              content: existingFollowUp.content,
              timestamp: existingFollowUp.created_at,
              speakerName: 'Concept Check',
            },
          });
        }

        // Save learner first attempt message if not already saved
        if (!learnerMsg) {
          const { data: insertedMsg, error: insertErr } = await supabaseAdmin
            .from('messages')
            .insert({
              session_id: sessionId,
              role: 'learner',
              message_type: 'first_attempt',
              content: trimmedAnswer,
            })
            .select('message_id, session_id, role, message_type, content, created_at')
            .single();

          if (insertErr || !insertedMsg) {
            return jsonResponse({ error: `Failed to save first answer: ${insertErr?.message}` }, 500);
          }
          learnerMsg = insertedMsg;
        }

        // Retrieve question and expected answer privately on backend
        const { data: gp, error: gpErr } = await supabaseAdmin
          .from('golden_pairs')
          .select('question, expected_answer')
          .eq('golden_pair_id', session.golden_pair_id)
          .single();

        if (gpErr || !gp) {
          return jsonResponse({ error: 'Failed to retrieve Golden Pair reference.' }, 500);
        }

        // Generate Socratic follow-up via Groq
        let groqResult: GroqParsedOutput;
        try {
          groqResult = await generateFollowUpWithGroq(
            gp.question,
            gp.expected_answer,
            learnerMsg.content
          );
        } catch (groqErr: unknown) {
          const msg = groqErr instanceof Error ? groqErr.message : 'AI Follow-up generation failed';
          // Return recoverable notice preserving the saved first answer
          return jsonResponse(
            {
              success: false,
              firstAnswerSaved: true,
              error: `Your explanation is saved. AI follow-up could not be generated: ${msg}. Please try again.`,
              savedFirstAttempt: {
                id: learnerMsg.message_id,
                role: 'learner',
                type: 'first_attempt',
                content: learnerMsg.content,
                timestamp: learnerMsg.created_at,
                speakerName: userProfile.name,
              },
            },
            502
          );
        }

        // IF has_gap = true, record gap in public.gaps
        if (groqResult.has_gap) {
          const { error: gapInsertErr } = await supabaseAdmin
            .from('gaps')
            .upsert(
              {
                message_id: learnerMsg.message_id,
                phrase: groqResult.phrase,
                gap_description: groqResult.gap_description,
              },
              { onConflict: 'message_id' }
            );

          if (gapInsertErr) {
            console.error('Failed to insert gap:', gapInsertErr.message);
          }
        }

        // Save follow-up in messages as assistant follow_up
        const { data: followUpMsg, error: fMsgErr } = await supabaseAdmin
          .from('messages')
          .insert({
            session_id: sessionId,
            role: 'assistant',
            message_type: 'follow_up',
            content: groqResult.follow_up_question,
          })
          .select('message_id, session_id, role, message_type, content, created_at')
          .single();

        if (fMsgErr || !followUpMsg) {
          return jsonResponse({ error: `Failed to save follow-up message: ${fMsgErr?.message}` }, 500);
        }

        // Return follow-up to frontend (gap_description and phrase are kept server-side)
        return jsonResponse({
          success: true,
          firstAnswerSaved: true,
          status: 'awaiting_retry',
          savedFirstAttempt: {
            id: learnerMsg.message_id,
            role: 'learner',
            type: 'first_attempt',
            content: learnerMsg.content,
            timestamp: learnerMsg.created_at,
            speakerName: userProfile.name,
          },
          followUpMessage: {
            id: followUpMsg.message_id,
            role: 'assistant',
            type: 'follow_up',
            content: followUpMsg.content,
            timestamp: followUpMsg.created_at,
            speakerName: 'Concept Check',
          },
        });
      }

      // -----------------------------------------------------------------
      // ACTION C: SUBMIT RETRY (No Groq Call)
      // -----------------------------------------------------------------
      case 'submit_retry': {
        const { sessionId, retryText } = body;
        if (!sessionId) {
          return jsonResponse({ error: 'Missing sessionId parameter' }, 400);
        }

        const trimmedRetry = typeof retryText === 'string' ? retryText.trim() : '';
        if (!trimmedRetry) {
          return jsonResponse({ error: 'Retry explanation cannot be empty' }, 400);
        }

        // Verify session ownership
        const { data: session, error: sessErr } = await supabaseAdmin
          .from('sessions')
          .select('session_id, user_id, golden_pair_id, run_id')
          .eq('session_id', sessionId)
          .single();

        if (sessErr || !session) {
          return jsonResponse({ error: 'Session not found' }, 404);
        }
        if (session.user_id !== userId) {
          return jsonResponse({ error: 'Forbidden: You do not own this session' }, 403);
        }

        // Check messages in session
        const { data: existingMessages } = await supabaseAdmin
          .from('messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        const followUpMsg = existingMessages?.find((m) => m.message_type === 'follow_up');
        if (!followUpMsg) {
          return jsonResponse(
            { error: 'Cannot submit retry: No assistant follow-up exists for this session yet.' },
            400
          );
        }

        const existingRetry = existingMessages?.find((m) => m.message_type === 'retry');
        if (existingRetry) {
          return jsonResponse({
            success: true,
            retrySaved: true,
            status: 'ready_to_continue',
            systemMessage: 'You have now reached the next step.',
            savedMessage: {
              id: existingRetry.message_id,
              role: 'learner',
              type: 'retry',
              content: existingRetry.content,
              timestamp: existingRetry.created_at,
              speakerName: userProfile.name,
              gapId: existingRetry.gap_id,
            },
          });
        }

        // Identify gap if created for this session
        const firstAttemptMsg = existingMessages?.find((m) => m.message_type === 'first_attempt');
        let linkedGapId: string | null = null;
        if (firstAttemptMsg) {
          const { data: gap } = await supabaseAdmin
            .from('gaps')
            .select('gap_id')
            .eq('message_id', firstAttemptMsg.message_id)
            .maybeSingle();
          if (gap) {
            linkedGapId = gap.gap_id;
          }
        }

        // Save retry message (NO Groq call)
        const { data: retryMsg, error: retryErr } = await supabaseAdmin
          .from('messages')
          .insert({
            session_id: sessionId,
            role: 'learner',
            message_type: 'retry',
            content: trimmedRetry,
            gap_id: linkedGapId,
          })
          .select('message_id, session_id, role, message_type, content, gap_id, created_at')
          .single();

        if (retryErr || !retryMsg) {
          return jsonResponse({ error: `Failed to save retry: ${retryErr?.message}` }, 500);
        }

        return jsonResponse({
          success: true,
          retrySaved: true,
          status: 'ready_to_continue',
          systemMessage: 'You have now reached the next step.',
          savedMessage: {
            id: retryMsg.message_id,
            role: 'learner',
            type: 'retry',
            content: retryMsg.content,
            timestamp: retryMsg.created_at,
            speakerName: userProfile.name,
            gapId: retryMsg.gap_id,
          },
        });
      }

      // -----------------------------------------------------------------
      // ACTION D: CONTINUE ASSESSMENT
      // -----------------------------------------------------------------
      case 'continue_assessment': {
        const { sessionId } = body;
        if (!sessionId) {
          return jsonResponse({ error: 'Missing sessionId parameter' }, 400);
        }

        // Verify session ownership
        const { data: session, error: sessErr } = await supabaseAdmin
          .from('sessions')
          .select('session_id, user_id, golden_pair_id, run_id')
          .eq('session_id', sessionId)
          .single();

        if (sessErr || !session) {
          return jsonResponse({ error: 'Session not found' }, 404);
        }
        if (session.user_id !== userId) {
          return jsonResponse({ error: 'Forbidden: You do not own this session' }, 403);
        }

        // Verify retry has been saved
        const { data: retryMsg } = await supabaseAdmin
          .from('messages')
          .select('message_id')
          .eq('session_id', sessionId)
          .eq('message_type', 'retry')
          .maybeSingle();

        if (!retryMsg) {
          return jsonResponse(
            { error: 'Cannot advance: retry explanation has not been submitted for this round.' },
            400
          );
        }

        // Determine next question index
        const currentIndex = GOLDEN_PAIR_ORDER.indexOf(session.golden_pair_id);
        if (currentIndex === -1) {
          return jsonResponse({ error: 'Invalid golden pair identifier' }, 500);
        }

        // If completed Question 10, finish assessment — do NOT create Question 11
        if (currentIndex === 9) {
          return jsonResponse({
            isFinished: true,
            nextRound: null,
            message: 'Thanks for completing all 10 questions.',
          });
        }

        const nextIndex = currentIndex + 1;
        const nextGoldenPairId = GOLDEN_PAIR_ORDER[nextIndex];
        const nextQNum = nextIndex + 1;

        // Retrieve or create next session in the same run
        let { data: nextSession } = await supabaseAdmin
          .from('sessions')
          .select('*')
          .eq('user_id', userId)
          .eq('run_id', session.run_id)
          .eq('golden_pair_id', nextGoldenPairId)
          .maybeSingle();

        if (!nextSession) {
          const { data: createdSess, error: createErr } = await supabaseAdmin
            .from('sessions')
            .insert({
              user_id: userId,
              golden_pair_id: nextGoldenPairId,
              run_id: session.run_id,
            })
            .select()
            .single();

          if (createErr || !createdSess) {
            return jsonResponse({ error: `Failed to create next session: ${createErr?.message}` }, 500);
          }
          nextSession = createdSess;
        }

        // Retrieve Question text
        const { data: nextGp } = await supabaseAdmin
          .from('golden_pairs')
          .select('golden_pair_id, question')
          .eq('golden_pair_id', nextGoldenPairId)
          .single();

        if (!nextGp) {
          return jsonResponse({ error: 'Failed to retrieve next question from database' }, 500);
        }

        // Check or insert assistant question message
        let { data: existingQMsg } = await supabaseAdmin
          .from('messages')
          .select('*')
          .eq('session_id', nextSession.session_id)
          .eq('message_type', 'question')
          .maybeSingle();

        if (!existingQMsg) {
          const { data: createdQMsg, error: qErr } = await supabaseAdmin
            .from('messages')
            .insert({
              session_id: nextSession.session_id,
              role: 'assistant',
              message_type: 'question',
              content: nextGp.question,
            })
            .select()
            .single();

          if (qErr || !createdQMsg) {
            return jsonResponse({ error: `Failed to record next question message: ${qErr?.message}` }, 500);
          }
          existingQMsg = createdQMsg;
        }

        return jsonResponse({
          isFinished: false,
          nextRound: {
            sessionId: nextSession.session_id,
            questionNumber: nextQNum,
            goldenPairId: nextGoldenPairId,
            topic: QUESTION_TOPICS[nextIndex],
            questionText: nextGp.question,
            evaluationCriteria: '',
            messages: [
              {
                id: existingQMsg.message_id,
                role: 'assistant',
                type: 'question',
                content: existingQMsg.content,
                timestamp: existingQMsg.created_at,
                speakerName: 'Concept Check',
              },
            ],
            status: 'awaiting_first_answer',
            draftFirstAnswer: '',
            draftRetryAnswer: '',
          },
        });
      }

      // -----------------------------------------------------------------
      // ACTION E: LOAD ASSESSMENT (Refresh & Sidebar History)
      // -----------------------------------------------------------------
      case 'load_assessment': {
        // Query user's sessions
        const { data: allSessions, error: sessListErr } = await supabaseAdmin
          .from('sessions')
          .select('session_id, user_id, golden_pair_id, run_id, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: true });

        if (sessListErr) {
          return jsonResponse({ error: sessListErr.message }, 500);
        }

        if (!allSessions || allSessions.length === 0) {
          return jsonResponse({ hasAssessment: false, rounds: [] });
        }

        // Find the latest active run_id
        const latestSession = allSessions[allSessions.length - 1];
        const latestRunId = latestSession.run_id;
        const runSessions = allSessions.filter((s) => s.run_id === latestRunId);

        // Fetch questions map
        const { data: gpList } = await supabaseAdmin
          .from('golden_pairs')
          .select('golden_pair_id, question');

        const gpMap = new Map((gpList || []).map((gp) => [gp.golden_pair_id, gp.question]));

        // Fetch messages for each session in this run
        const rounds = [];
        for (const s of runSessions) {
          const index = GOLDEN_PAIR_ORDER.indexOf(s.golden_pair_id);
          const qNum = index >= 0 ? index + 1 : 1;

          const { data: msgs } = await supabaseAdmin
            .from('messages')
            .select('message_id, role, message_type, content, gap_id, created_at')
            .eq('session_id', s.session_id)
            .order('created_at', { ascending: true });

          const chatMessages = (msgs || []).map((m) => ({
            id: m.message_id,
            role: m.role as 'assistant' | 'learner',
            type: m.message_type as 'question' | 'first_attempt' | 'follow_up' | 'retry',
            content: m.content,
            timestamp: m.created_at,
            speakerName: m.role === 'assistant' ? 'Concept Check' : userProfile.name,
          }));

          const hasRetry = chatMessages.some((m) => m.type === 'retry');
          const hasFollowUp = chatMessages.some((m) => m.type === 'follow_up');
          const hasFirst = chatMessages.some((m) => m.type === 'first_attempt');

          let status:
            | 'awaiting_first_answer'
            | 'thinking_follow_up'
            | 'awaiting_retry'
            | 'ready_to_continue'
            | 'completed' = 'awaiting_first_answer';

          if (hasRetry) {
            status = 'ready_to_continue';
          } else if (hasFollowUp) {
            status = 'awaiting_retry';
          } else if (hasFirst) {
            status = 'thinking_follow_up';
          }

          rounds.push({
            sessionId: s.session_id,
            questionNumber: qNum,
            goldenPairId: s.golden_pair_id,
            topic: QUESTION_TOPICS[qNum - 1] ?? 'Concept Check',
            questionText: gpMap.get(s.golden_pair_id) ?? '',
            evaluationCriteria: '',
            messages: chatMessages,
            status,
            draftFirstAnswer: '',
            draftRetryAnswer: '',
          });
        }

        // Sort by question number strictly
        rounds.sort((a, b) => a.questionNumber - b.questionNumber);

        // Mark rounds preceding the active round as completed if retry exists
        for (let i = 0; i < rounds.length - 1; i++) {
          if (rounds[i].status === 'ready_to_continue') {
            rounds[i].status = 'completed';
          }
        }

        return jsonResponse({
          hasAssessment: true,
          runId: latestRunId,
          rounds,
        });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Internal Server Error';
    return jsonResponse({ error: errorMsg }, 500);
  }
});
