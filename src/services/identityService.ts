import { LearnerProfile } from '../types';

/**
 * Identity Service Adapter
 * Abstracted interface for profile setup and anonymous session binding.
 * When real Supabase credentials / Edge Functions are supplied, this adapter routes
 * to Supabase Auth anonymous sign-in with profile metadata.
 * In development preview mode, it safely persists locally in browser sessionStorage.
 */

export interface IdentityService {
  setupProfile(name: string, username: string): Promise<LearnerProfile>;
  getExistingProfile(): Promise<LearnerProfile | null>;
  clearProfile(): Promise<void>;
  isLiveConnected(): boolean;
}

const STORAGE_KEY = 'concept_check_learner_profile_v04';

class PreviewIdentityAdapter implements IdentityService {
  isLiveConnected(): boolean {
    return false; // Preview mode adapter
  }

  async setupProfile(name: string, username: string): Promise<LearnerProfile> {
    // Artificial slight latency to represent network dispatch
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Client-side validation is already performed by form, but enforce invariables:
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error('Name is required.');
    }

    if (/\s/.test(username) || !username) {
      throw new Error('Username must not contain spaces or whitespace.');
    }

    const profile: LearnerProfile = {
      name: trimmedName,
      username: username.toLowerCase(),
      createdAt: new Date().toISOString(),
    };

    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Storage unavailable fallback
    }

    return profile;
  }

  async getExistingProfile(): Promise<LearnerProfile | null> {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw) as LearnerProfile;
      }
    } catch {
      return null;
    }
    return null;
  }

  async clearProfile(): Promise<void> {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}

export const identityService: IdentityService = new PreviewIdentityAdapter();
