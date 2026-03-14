'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function OAuthCallback() {
  useEffect(() => {
    // Handle OAuth callback from URL
    const handleCallback = async () => {
      const hash = window.location.hash;
      if (hash) {
        // Let Supabase handle the OAuth callback
        const { data, error } = await supabase.auth.getSession();
        if (data.session) {
          // Session established, refresh page to show dashboard
          window.location.href = '/';
        }
      }
    };

    handleCallback();
  }, []);

  return null;
}