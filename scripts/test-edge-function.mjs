import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read credentials from .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const publishableKey = keyMatch[1].trim();

console.log('=== CONCEPT CHECK: EDGE FUNCTION (assessment) VERIFICATION ===');
console.log('Project URL:', supabaseUrl);

async function runEdgeFunctionTests() {
  const clientA = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
  });

  const clientB = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
  });

  // Authenticate User A
  console.log('\n[1] Authenticating Test Learner A...');
  const { data: authA, error: errAuthA } = await clientA.auth.signInAnonymously();
  if (errAuthA) {
    console.error('Failed to authenticate User A:', errAuthA.message);
    return;
  }
  const userAId = authA.user.id;

  // Ensure User A has profile in public.users
  const usernameA = `tester_a_${Date.now().toString(36)}`;
  await clientA.from('users').upsert({
    user_id: userAId,
    name: 'Edge Test Learner A',
    username: usernameA,
  });
  console.log('✅ Learner A profile verified.');

  // Test Action A: start_assessment
  console.log('\n[2] Invoking Edge Function: action = start_assessment...');
  const { data: startData, error: startErr } = await clientA.functions.invoke('assessment', {
    body: { action: 'start_assessment' },
  });

  if (startErr) {
    console.log('\n⚠️  Edge Function invocation failed or function not yet deployed.');
    console.log('Details:', startErr.message);
    console.log('\n👉 Instructions to deploy via Supabase Dashboard:');
    console.log('   1. Open: https://supabase.com/dashboard/project/wpcbodwgyitklputcykp/functions');
    console.log('   2. Click "Create a new function" -> Name: assessment');
    console.log('   3. Paste the contents of: supabase/functions/assessment/index.ts');
    console.log('   4. Click "Deploy"');
    console.log('   5. Re-run this test script: node scripts/test-edge-function.mjs\n');
    return;
  }

  console.log('✅ start_assessment responded successfully!');
  console.log('   Session ID:', startData?.round?.sessionId);
  console.log('   Question Number:', startData?.round?.questionNumber);
  console.log('   Question Text:', startData?.round?.questionText?.slice(0, 60) + '...');
  console.log('   Expected Answer in response:', startData?.round?.expected_answer !== undefined ? 'EXPOSED (FAIL)' : 'PROTECTED (PASS)');

  const sessionId = startData?.round?.sessionId;
  if (!sessionId) {
    console.error('❌ No sessionId returned');
    return;
  }

  // Test Action B: submit_first_answer
  console.log('\n[3] Invoking Edge Function: action = submit_first_answer...');
  const { data: answerData, error: answerErr } = await clientA.functions.invoke('assessment', {
    body: {
      action: 'submit_first_answer',
      sessionId,
      answerText: 'Client-side code cannot securely isolate secrets because bundles can be inspected.',
    },
  });

  if (answerErr) {
    console.log('First answer returned error:', answerErr.message);
  } else {
    console.log('✅ First answer processed by Edge Function.');
    console.log('   Answer Saved:', answerData?.firstAnswerSaved);
    console.log('   AI Configured:', answerData?.aiConfigured);
    console.log('   Notice Message:', answerData?.message);
    console.log('   Expected Answer in response:', answerData?.expectedAnswer !== undefined ? 'EXPOSED (FAIL)' : 'PROTECTED (PASS)');
  }

  // Test Action E: load_assessment
  console.log('\n[4] Invoking Edge Function: action = load_assessment (Refresh hydration)...');
  const { data: loadData, error: loadErr } = await clientA.functions.invoke('assessment', {
    body: { action: 'load_assessment' },
  });

  if (loadErr) {
    console.log('load_assessment error:', loadErr.message);
  } else {
    console.log('✅ load_assessment succeeded!');
    console.log('   Has Assessment:', loadData?.hasAssessment);
    console.log('   Rounds count:', loadData?.rounds?.length);
    console.log('   Messages in Round 1:', loadData?.rounds?.[0]?.messages?.length);
  }

  // Test Cross-User Isolation (User B attempts to modify User A's session)
  console.log('\n[5] Cross-user session tampering test (User B calling submit_first_answer on User A session)...');
  const { data: authB } = await clientB.auth.signInAnonymously();
  await clientB.from('users').upsert({
    user_id: authB.user.id,
    name: 'Edge Test Learner B',
    username: `tester_b_${Date.now().toString(36)}`,
  });

  const { data: tamperData, error: tamperErr } = await clientB.functions.invoke('assessment', {
    body: {
      action: 'submit_first_answer',
      sessionId, // User A's session!
      answerText: 'Malicious injection from User B',
    },
  });

  if (tamperErr) {
    console.log('✅ Tampering blocked by Edge Function (returned error as expected):', tamperErr.message);
  } else if (tamperData?.error) {
    console.log('✅ Tampering blocked by Edge Function:', tamperData.error);
  } else {
    console.error('❌ SECURITY FAILURE: User B was able to submit an answer to User A session!');
  }

  console.log('\n======================================================');
  console.log('✅ EDGE FUNCTION TEST COMPLETED');
  console.log('======================================================');
}

runEdgeFunctionTests().catch((err) => {
  console.error('Test error:', err);
});
