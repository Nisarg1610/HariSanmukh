'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function OAuthCallback() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only redirect on the actual OAuth callback, not every page load
        if (event === 'SIGNED_IN' && window.location.hash.includes('access_token')) {
          window.location.replace('/');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return null;
}