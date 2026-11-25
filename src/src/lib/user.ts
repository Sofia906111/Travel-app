import type { UserProfile } from '@/types/user';

import { supabase } from './supabase';

export type { UserProfile } from '@/types/user';

export async function getUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  return data.user;
}

export async function getUserProfile(authUID: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('users')
    .select('authUID, name, surname')
    .eq('authUID', authUID)
    .maybeSingle();
  if (error) {
    console.log('get user profile error', error);
    throw error;
  }
  if (!data) return null;
  return {
    authUID: data.authUID,
    name: data.name ?? '',
    surname: data.surname ?? '',
  };
}

export async function updateUserProfile(
  authUID: string,
  patch: { name: string; surname: string },
): Promise<UserProfile> {
  const name = patch.name.trim();
  const surname = patch.surname.trim();
  const { data, error } = await supabase
    .from('users')
    .update({ name, surname })
    .eq('authUID', authUID)
    .select('authUID, name, surname')
    .single();
  if (error) {
    throw error;
  }
  return {
    authUID: data.authUID,
    name: data.name ?? '',
    surname: data.surname ?? '',
  };
}

export function profileDisplayName(profile: UserProfile | null | undefined): string {
  if (!profile) return '';
  return [profile.name.trim(), profile.surname.trim()].filter(Boolean).join(' ');
}

export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    console.log('sign in error', error);
    throw error;
  }
  if (data.user) {
    try {
      await ensureUserProfile(data.user.id, {
        name: data.user.user_metadata?.name ?? '',
        surname: data.user.user_metadata?.surname ?? '',
      });
    } catch (profileError) {
      console.log('profile sync failed', profileError);
    }
  }
  return data;
}

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

export async function register(email: string, password: string, name: string, surname: string) {
  const trimmedName = name.trim();
  const trimmedSurname = surname.trim();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: trimmedName,
        surname: trimmedSurname,
      },
    },
  });
  if (error) {
    console.log('register error', error);
    throw error;
  }

  if (data.user && data.session) {
    try {
      await ensureUserProfile(data.user.id, {
        name: trimmedName,
        surname: trimmedSurname,
      });
    } catch (profileError) {
      console.log('profile sync failed', profileError);
    }
  }

  return data;
}

export async function ensureUserProfile(
  userId: string,
  profile: { name: string; surname: string },
) {
  const { error } = await supabase.from('users').upsert(
    {
      authUID: userId,
      name: profile.name,
      surname: profile.surname,
    },
    { onConflict: 'authUID', ignoreDuplicates: true },
  );
  if (error) {
    if (error.code === '23505') return;
    throw error;
  }
}
