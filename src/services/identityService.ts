import { supabase } from '../lib/supabaseClient';
import { LearnerProfile } from '../types';

/**
 * Identity Service Adapter
 * Real Supabase implementation behind the Name/Username form.
 * Uses Supabase Auth anonymous sign-ins (`signInAnonymously()`) to obtain an authenticated UUID,
 * and maintains the profile record in `public.users`.
 */

export interface IdentityService {
  setupProfile(name: string, username: string): Promise<LearnerProfile>;
  getExistingProfile(): Promise<LearnerProfile | null>;
  clearProfile(): Promise<void>;
  isLiveConnected(): boolean;
}

class SupabaseIdentityAdapter implements IdentityService {
  isLiveConnected(): boolean {
    return true;
  }

  /**
   * Retrieves existing profile if the visitor already has an active anonymous session.
   * Prevents creating duplicate accounts or users on refresh.
   */
  async getExistingProfile(): Promise<LearnerProfile | null> {
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        return null;
      }

      const { data, error } = await supabase
        .from('users')
        .select('user_id, name, username, created_at')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      return {
        name: data.name,
        username: data.username,
        createdAt: data.created_at,
        userId: data.user_id,
      };
    } catch {
      return null;
    }
  }

  /**
   * Sets up or updates the profile for the learner.
   * Authenticates anonymously if no session exists.
   * Rejects if username is already registered to a different account.
   */
  async setupProfile(name: string, username: string): Promise<LearnerProfile> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Name is required.');
    }

    const trimmedUsername = username.trim();
    if (/\s/.test(trimmedUsername) || !trimmedUsername) {
      throw new Error('Username must not contain spaces or whitespace.');
    }

    // 1. Check or establish anonymous session
    let {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.user) {
      const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
      if (authError) {
        if (authError.message.toLowerCase().includes('disabled')) {
          throw new Error(
            'Anonymous sign-ins are not enabled in Supabase yet. Please enable Anonymous provider in Supabase Dashboard -> Authentication -> Providers.'
          );
        }
        throw new Error(authError.message);
      }
      session = authData.session;
    }

    if (!session?.user) {
      throw new Error('Unable to establish an authenticated session.');
    }

    const currentUserId = session.user.id;

    // 2. Prevent accessing/hijacking an existing username belonging to another user
    const { data: existingUserWithUsername } = await supabase
      .from('users')
      .select('user_id, username')
      .ilike('username', trimmedUsername)
      .maybeSingle();

    if (existingUserWithUsername && existingUserWithUsername.user_id !== currentUserId) {
      throw new Error(
        `The username "${trimmedUsername}" is already taken by another learner. Please choose a different username.`
      );
    }

    // 3. Upsert profile into public.users
    const { data: savedProfile, error: saveError } = await supabase
      .from('users')
      .upsert(
        {
          user_id: currentUserId,
          name: trimmedName,
          username: trimmedUsername,
        },
        { onConflict: 'user_id' }
      )
      .select('user_id, name, username, created_at')
      .single();

    if (saveError) {
      if (saveError.code === '23505' || saveError.message?.toLowerCase().includes('unique')) {
        throw new Error(
          `The username "${trimmedUsername}" is already taken. Please choose another username.`
        );
      }
      throw new Error(`Failed to save profile: ${saveError.message}`);
    }

    return {
      name: savedProfile.name,
      username: savedProfile.username,
      createdAt: savedProfile.created_at,
      userId: savedProfile.user_id,
    };
  }

  async clearProfile(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
  }
}

export const identityService: IdentityService = new SupabaseIdentityAdapter();
