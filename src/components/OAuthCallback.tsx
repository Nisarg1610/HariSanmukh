'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function OAuthCallback() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          // Force a hard reload so page.tsx re-runs with the new session
          window.location.href = '/';
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return null;
}