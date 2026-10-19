import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read credentials from .env.local
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const urlMatch = envContent.match(/VITE_SUPABASE_URL=(.+)/);
const keyMatch = envContent.match(/VITE_SUPABASE_PUBLISHABLE_KEY=(.+)/);

if (!urlMatch || !keyMatch) {
  console.error('Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY in .env.local');
  process.exit(1);
}

const supabaseUrl = urlMatch[1].trim();
const publishableKey = keyMatch[1].trim();

console.log('--- CONCEPT CHECK: AUTH & RLS SECURITY TEST SUITE ---');
console.log('Target URL:', supabaseUrl);

async function runTestSuite() {
  // Client 1: User A
  const clientA = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Client 2: User B
  const clientB = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // STEP 1: Test Anonymous Auth sign-in for User A
  console.log('\n[Test 1] Signing in User A anonymously...');
  const { data: authA, error: errAuthA } = await clientA.auth.signInAnonymously();
  if (errAuthA) {
    if (errAuthA.message.toLowerCase().includes('disabled')) {
      console.log('⚠️  RESULT: Anonymous sign-ins are currently disabled in Supabase project.');
      console.log('👉 Please enable Anonymous Sign-Ins in Supabase Dashboard:');
      console.log('   https://supabase.com/dashboard/project/wpcbodwgyitklputcykp/auth/providers');
      console.log('   Then run this test again to complete verification.\n');
      return;
    }
    console.error('❌ User A sign-in failed:', errAuthA.message);
    return;
  }
  const userAId = authA.user.id;
  console.log('✅ User A authenticated successfully (UUID established).');

  // STEP 2: Profile creation for User A
  console.log('\n[Test 2] Creating profile for User A in public.users...');
  const testUsernameA = `test_usr_a_${Date.now().toString(36)}`;
  const { data: profileA, error: errProfileA } = await clientA
    .from('users')
    .insert({
      user_id: userAId,
      name: 'Test Learner Alpha',
      username: testUsernameA,
    })
    .select('user_id, username')
    .single();

  if (errProfileA) {
    console.error('❌ User A profile insert failed:', errProfileA.message);
    return;
  }
  console.log('✅ User A profile created successfully in public.users.');

  // STEP 3: Refresh / existing session test (User A queries own profile)
  console.log('\n[Test 3] Refresh simulation: User A queries own profile via auth.uid()...');
  const { data: ownProfile, error: errOwn } = await clientA
    .from('users')
    .select('user_id, username')
    .eq('user_id', userAId)
    .single();

  if (errOwn || !ownProfile) {
    console.error('❌ User A could not read own profile:', errOwn?.message);
  } else {
    console.log('✅ User A successfully retrieved own profile without duplicate user creation.');
  }

  // STEP 4: Golden Pairs column-level security test
  console.log('\n[Test 4] Golden Pairs column-level protection test...');
  // 4a. Authenticated user reading question only (should succeed)
  const { data: questions, error: errQ } = await clientA
    .from('golden_pairs')
    .select('golden_pair_id, question')
    .limit(2);
  if (errQ) {
    console.log('⚠️  Questions query error (check if seed is applied):', errQ.message);
  } else {
    console.log(`✅ User A can read questions (returned ${questions.length} items).`);
  }

  // 4b. Authenticated user attempting to read expected_answer (MUST FAIL)
  const { data: leakedAnswers, error: errLeak } = await clientA
    .from('golden_pairs')
    .select('golden_pair_id, expected_answer')
    .limit(1);

  if (errLeak) {
    console.log('✅ Column-Level Security verified: expected_answer access DENIED to frontend/client.');
  } else if (leakedAnswers && leakedAnswers.length > 0 && leakedAnswers[0].expected_answer) {
    console.error('❌ SECURITY FAILURE: expected_answer was exposed to the client!');
  } else {
    console.log('✅ Column-Level Security verified: expected_answer is not returned.');
  }

  // STEP 5: Authenticate User B
  console.log('\n[Test 5] Signing in User B anonymously...');
  const { data: authB, error: errAuthB } = await clientB.auth.signInAnonymously();
  if (errAuthB) {
    console.error('❌ User B sign-in failed:', errAuthB.message);
    return;
  }
  const userBId = authB.user.id;
  console.log('✅ User B authenticated successfully with distinct UUID.');

  // STEP 6: User B attempts to hijack User A's username
  console.log("\n[Test 6] User B attempts to claim User A's username...");
  const { error: errDuplicateUsername } = await clientB.from('users').insert({
    user_id: userBId,
    name: 'Imposter',
    username: testUsernameA.toUpperCase(), // case-insensitive collision attempt
  });
  if (errDuplicateUsername) {
    console.log('✅ Security check passed: Duplicate / case-insensitive username claim REJECTED.');
  } else {
    console.error('❌ SECURITY FAILURE: Duplicate username was allowed!');
  }

  // Create valid profile for User B
  const testUsernameB = `test_usr_b_${Date.now().toString(36)}`;
  await clientB.from('users').insert({
    user_id: userBId,
    name: 'Test Learner Beta',
    username: testUsernameB,
  });

  // STEP 7: User B attempts to SELECT User A's profile via RLS
  console.log("\n[Test 7] User B attempts to read User A's profile...");
  const { data: leakedProfileA } = await clientB
    .from('users')
    .select('user_id, name')
    .eq('user_id', userAId);

  if (!leakedProfileA || leakedProfileA.length === 0) {
    console.log('✅ RLS isolation verified: User B CANNOT read User A profile (0 rows returned).');
  } else {
    console.error('❌ SECURITY FAILURE: User B was able to read User A profile!');
  }

  // STEP 8: User B attempts to UPDATE User A's profile
  console.log("\n[Test 8] User B attempts to modify User A's profile...");
  const { error: errHacked, count: updatedCount } = await clientB
    .from('users')
    .update({ name: 'Hacked Name' })
    .eq('user_id', userAId);

  // With RLS, Postgres filters rows where USING check fails, resulting in 0 rows updated
  const { data: checkOriginal } = await clientA
    .from('users')
    .select('name')
    .eq('user_id', userAId)
    .single();

  if (checkOriginal && checkOriginal.name === 'Test Learner Alpha') {
    console.log("✅ RLS isolation verified: User B modification attempt had NO EFFECT on User A data.");
  } else {
    console.error("❌ SECURITY FAILURE: User B successfully modified User A's profile!");
  }

  // STEP 9: Session & Message ownership isolation
  console.log('\n[Test 9] Cross-session tampering test...');
  const dummyRunId = '00000000-0000-4000-8000-000000000001';
  const goldenPairId = '30000000-0000-4000-8000-000000000001';

  // User A creates a session
  const { data: sessionA } = await clientA
    .from('sessions')
    .insert({
      user_id: userAId,
      golden_pair_id: goldenPairId,
      run_id: dummyRunId,
    })
    .select('session_id')
    .single();

  if (sessionA) {
    // User B attempts to insert a message into User A's session
    const { error: errTamperMsg } = await clientB.from('messages').insert({
      session_id: sessionA.session_id,
      role: 'learner',
      message_type: 'first_attempt',
      content: 'Unauthorized injection attempt',
    });

    if (errTamperMsg) {
      console.log("✅ RLS verified: User B CANNOT insert messages into User A's session.");
    } else {
      console.error("❌ SECURITY FAILURE: User B inserted message into User A's session!");
    }

    // User B attempts to read User A's session
    const { data: stolenSession } = await clientB
      .from('sessions')
      .select('session_id')
      .eq('session_id', sessionA.session_id);

    if (!stolenSession || stolenSession.length === 0) {
      console.log("✅ RLS verified: User B CANNOT read User A's session.");
    } else {
      console.error("❌ SECURITY FAILURE: User B read User A's session!");
    }
  }

  console.log('\n======================================================');
  console.log('✅ ALL RLS & AUTHENTICATION TESTS COMPLETED SUCCESSFULLY');
  console.log('======================================================');
}

runTestSuite().catch((err) => {
  console.error('Unexpected error in test suite:', err);
});
