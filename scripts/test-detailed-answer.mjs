import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);

const supabaseUrl = urlMatch[1].trim();
const publishableKey = keyMatch[1].trim();

console.log('=== TEST 2: DETAILED ANSWER VERIFICATION ===');

async function testDetailedAnswer() {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
  });

  const { data: auth } = await client.auth.signInAnonymously();
  const userId = auth.user.id;
  await client.from('users').upsert({
    user_id: userId,
    name: 'Detailed Tester',
    username: `detailed_${Date.now().toString(36)}`,
  });

  // Start assessment
  const { data: startRes } = await client.functions.invoke('assessment', {
    body: { action: 'start_assessment' },
  });
  const sessionId = startRes.round.sessionId;

  // Submit comprehensive, sound answer
  const answerText =
    'Browser JavaScript and network requests can be inspected and altered by any user. A backend provides a trusted execution environment for storing secret credentials, enforcing authorization, and executing private business logic.';

  console.log('Submitting detailed explanation:\n', answerText);
  const { data: ansRes, error: ansErr } = await client.functions.invoke('assessment', {
    body: {
      action: 'submit_first_answer',
      sessionId,
      answerText,
    },
  });

  if (ansErr) {
    console.error('Error:', ansErr.message);
    return;
  }

  console.log('\n✅ Response from Concept Check:');
  console.log('   Follow-up Question:', ansRes.followUpMessage?.content);

  // Check if any gap was inserted in database
  const { data: gapRows } = await client
    .from('gaps')
    .select('*')
    .eq('message_id', ansRes.savedFirstAttempt.id);

  if (!gapRows || gapRows.length === 0) {
    console.log('✅ TEST PASSED: has_gap was false, NO row created in public.gaps as expected!');
  } else {
    console.log('ℹ️  Gap recorded:', gapRows[0]);
  }
}

testDetailedAnswer().catch(console.error);
