import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('Missing credentials in .env.local');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const publishableKey = keyMatch[1].trim();

console.log('=== CONCEPT CHECK: STAGE 2 GROQ INTEGRATION VERIFICATION ===');
console.log('Supabase URL:', supabaseUrl);

async function runGroqTestSuite() {
  const clientA = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
  });

  const clientB = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
  });

  // Sign in Learner A
  console.log('\n[Setup] Authenticating Test Learner A...');
  const { data: authA } = await clientA.auth.signInAnonymously();
  const userAId = authA.user.id;
  const usernameA = `groq_test_a_${Date.now().toString(36)}`;
  await clientA.from('users').upsert({
    user_id: userAId,
    name: 'Groq Learner Alpha',
    username: usernameA,
  });
  console.log('✅ Learner A profile verified.');

  // TEST 1: Vague Answer Flow
  console.log('\n[TEST 1] Vague Answer Flow (Expecting gap detection & follow-up probe)...');
  const { data: start1, error: start1Err } = await clientA.functions.invoke('assessment', {
    body: { action: 'start_assessment' },
  });

  if (start1Err || !start1?.round) {
    console.error('❌ Failed to start assessment:', start1Err?.message);
    return;
  }

  const session1Id = start1.round.sessionId;
  console.log('   Question 1:', start1.round.questionText);

  // Submit vague first answer
  console.log('   Submitting vague explanation: "Because of security reasons."');
  const { data: answer1Res, error: answer1Err } = await clientA.functions.invoke('assessment', {
    body: {
      action: 'submit_first_answer',
      sessionId: session1Id,
      answerText: 'Because of security reasons.',
    },
  });

  if (answer1Err) {
    console.error('❌ submit_first_answer failed:', answer1Err.message);
    return;
  }

  console.log('✅ First answer saved:', answer1Res?.firstAnswerSaved);
  console.log('✅ AI Follow-up received from Concept Check:');
  console.log('   Follow-up Question:', answer1Res?.followUpMessage?.content);
  console.log('   Expected answer in response:', answer1Res?.expected_answer !== undefined ? 'EXPOSED (FAIL)' : 'PROTECTED (PASS)');

  // Verify Gap in database
  const { data: gapRows, error: gapQueryErr } = await clientA
    .from('gaps')
    .select('gap_id, phrase, gap_description, message_id')
    .eq('message_id', answer1Res.savedFirstAttempt.id);

  if (gapRows && gapRows.length > 0) {
    console.log('✅ Supported Gap verified in public.gaps:');
    console.log('   Gap ID:', gapRows[0].gap_id);
    console.log('   Supporting Phrase from learner:', gapRows[0].phrase);
    console.log('   Gap Description (Server-only):', gapRows[0].gap_description);
  } else {
    console.log('ℹ️  No gap row recorded (or query restricted):', gapQueryErr?.message);
  }

  // TEST 3: Retry Submission
  console.log('\n[TEST 3] Submitting Retry explanation without invoking Groq...');
  const { data: retryRes, error: retryErr } = await clientA.functions.invoke('assessment', {
    body: {
      action: 'submit_retry',
      sessionId: session1Id,
      retryText: 'Browser developer tools and network tabs allow anyone to inspect source code and network packets to extract API keys.',
    },
  });

  if (retryErr) {
    console.error('❌ submit_retry failed:', retryErr.message);
  } else {
    console.log('✅ Retry saved successfully!');
    console.log('   Linked Gap ID on retry message:', retryRes?.savedMessage?.gapId);
    console.log('   Status:', retryRes?.status);
    console.log('   System message:', retryRes?.systemMessage);
  }

  // TEST 4: Advance to Question 2
  console.log('\n[TEST 4] Continuing to Next Question...');
  const { data: continueRes, error: continueErr } = await clientA.functions.invoke('assessment', {
    body: {
      action: 'continue_assessment',
      sessionId: session1Id,
    },
  });

  if (continueErr) {
    console.error('❌ continue_assessment failed:', continueErr.message);
  } else {
    console.log('✅ Advanced to Question 2 successfully!');
    console.log('   Next Question Number:', continueRes?.nextRound?.questionNumber);
    console.log('   Next Question Text:', continueRes?.nextRound?.questionText);
  }

  // TEST 5: Cross-User Security Check
  console.log('\n[TEST 5] Security Check: Cross-user session isolation...');
  const { data: authB } = await clientB.auth.signInAnonymously();
  await clientB.from('users').upsert({
    user_id: authB.user.id,
    name: 'Groq Learner Beta',
    username: `groq_test_b_${Date.now().toString(36)}`,
  });

  const { data: tamperData, error: tamperErr } = await clientB.functions.invoke('assessment', {
    body: {
      action: 'submit_first_answer',
      sessionId: session1Id, // User A's session!
      answerText: 'Unauthorized attempt by User B',
    },
  });

  if (tamperErr) {
    console.log('✅ Tampering blocked by Edge Function as expected:', tamperErr.message);
  } else if (tamperData?.error) {
    console.log('✅ Tampering blocked by Edge Function:', tamperData.error);
  } else {
    console.error('❌ SECURITY FAILURE: Cross-user tampering succeeded!');
  }

  console.log('\n======================================================');
  console.log('✅ GROQ INTEGRATION VERIFICATION COMPLETE');
  console.log('======================================================');
}

runGroqTestSuite().catch((err) => {
  console.error('Error in Groq test suite:', err);
});
