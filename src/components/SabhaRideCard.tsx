'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Car, ChevronRight } from 'lucide-react';

interface SabhaRideCardProps {
  householdId: string;
  memberId: string | null;
  isAdmin: boolean;
  isDark: boolean;
}

export function SabhaRideCard({ householdId, memberId, isAdmin, isDark }: SabhaRideCardProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [hasVoted, setHasVoted] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (householdId) {
      loadState();
    }
  }, [householdId, memberId]);

  const loadState = async () => {
    try {
      setLoading(true);

      // Check if feature is enabled
      const { data: statusData } = await supabase
        .from('sabha_ride_status')
        .select('*')
        .eq('household_id', householdId)
        .maybeSingle();

      setIsEnabled(statusData?.is_enabled ?? false);

      // Fetch user's vote
      if (memberId) {
        const { data: myVote } = await supabase
          .from('sabha_ride_votes')
          .select('vote')
          .eq('household_id', householdId)
          .eq('member_id', memberId)
          .maybeSingle();

        if (myVote) {
          setHasVoted(myVote.vote);
        } else {
          setHasVoted(null);
        }
      }
    } catch (err) {
      console.error('Failed to load Sabha ride state:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isAdmin && !isEnabled) {
    return null;
  }

  const getVoteText = (vote: string) => {
    if (vote === 'yes') return 'Needs Ride';
    if (vote === 'no') return 'Not Coming';
    if (vote === 'coming_directly') return 'Coming Directly';
    if (vote === 'provide_ride') return 'Can Provide Ride';
    return 'Pending';
  };

  return (
    <Link
      href="/sabha-ride"
      className="mt-3 block rounded-3xl p-5 transition-all active:scale-[0.98] relative overflow-hidden cursor-pointer shadow-sm glass-card group"
    >
      <div style={{
        position: 'absolute', top: -18, right: -18,
        width: 100, height: 100, borderRadius: '50%',
        backgroundColor: 'var(--separator)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: -24, left: -10,
        width: 70, height: 70, borderRadius: '50%',
        backgroundColor: 'var(--separator)', pointerEvents: 'none',
        opacity: 0.5,
      }} />

      <div className="flex justify-between items-center relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
            style={{
              backgroundColor: 'var(--accent-bg)',
              color: 'var(--accent)'
            }}>
            <Car size={24} />
          </div>
          <div>
            <p className="text-base font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>
              Sabha Ride
            </p>
            <p className="text-[13px] font-medium opacity-60 mt-0.5" style={{ color: 'var(--text-1)' }}>
              {isEnabled ? 'Voting session active' : 'Session closed'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasVoted ? (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ 
                backgroundColor: 'var(--accent-bg)', 
                color: 'var(--accent)' 
              }}>
              {getVoteText(hasVoted)}
            </span>
          ) : isEnabled ? (
            <span className="text-xs font-bold px-4 py-2 rounded-full shadow-sm"
              style={{ 
                backgroundColor: 'var(--accent)', 
                color: '#fff' 
              }}>
              Vote
            </span>
          ) : (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full"
              style={{ 
                backgroundColor: 'var(--separator)', 
                color: 'var(--text-3)' 
              }}>
              OFF
            </span>
          )}
          <ChevronRight size={20} className="text-[var(--text-4)] group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
