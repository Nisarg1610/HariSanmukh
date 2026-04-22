import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

interface SabhaRideCardProps {
  householdId: string;
  memberId: string | null;
  isAdmin: boolean;
  isDark: boolean;
}

export function SabhaRideCard({ householdId, memberId, isAdmin, isDark }: SabhaRideCardProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasVoted, setHasVoted] = useState<string | null>(null);
  const [votes, setVotes] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifying, setNotifying] = useState(false);
  const [touchStartY, setTouchStartY] = useState(0);

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

      // If admin, fetch all votes and members
      if (isAdmin) {
        const [{ data: votesData }, { data: membersData }] = await Promise.all([
          supabase.from('sabha_ride_votes').select('*').eq('household_id', householdId),
          supabase.from('household_members').select('*').eq('household_id', householdId)
        ]);
        setVotes(votesData || []);
        setMembers(membersData || []);
      }
    } catch (err) {
      console.error('Failed to load Sabha ride state:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (choice: string) => {
    if (!memberId || !householdId) return;
    try {
      const { error } = await supabase
        .from('sabha_ride_votes')
        .upsert({
          household_id: householdId,
          member_id: memberId,
          vote: choice,
          updated_at: new Date().toISOString()
        }, { onConflict: 'household_id,member_id' });

      if (!error) {
        setHasVoted(choice);
        loadState();
        setTimeout(() => setIsOpen(false), 500); // Close after brief success indicator
      }
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  const toggleEnabled = async () => {
    const nextState = !isEnabled;
    try {
      if (nextState) {
        // Clearing votes when turning on
        await supabase.from('sabha_ride_votes').delete().eq('household_id', householdId);
        setVotes([]);
        setHasVoted(null);
      }

      await supabase
        .from('sabha_ride_status')
        .upsert({
          household_id: householdId,
          is_enabled: nextState,
          updated_at: new Date().toISOString()
        }, { onConflict: 'household_id' });

      setIsEnabled(nextState);
    } catch (err) {
      console.error('Error toggling feature:', err);
    }
  };

  const notifyAll = async () => {
    if (notifying) return;
    setNotifying(true);
    try {
      const res = await fetch('/api/push-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          householdId: householdId,
          title: 'Upcoming Sabha',
          body: 'Do you need ride for the upcoming Sabha??',
        })
      });
      if (res.ok) {
        alert('Notification sent!');
      } else {
        alert('Failed to send notification: ' + res.statusText);
      }
    } catch (err) {
      console.error('Failed to send notification:', err);
      alert('Error sending notification');
    } finally {
      setNotifying(false);
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
    <>
      <div
        onClick={() => setIsOpen(true)}
        className="mt-3 block rounded-3xl p-4 transition-transform active:scale-[0.97] relative overflow-hidden cursor-pointer shadow-sm glass-card"
      >
        <div style={{
          position: 'absolute', top: -18, right: -18,
          width: 80, height: 80, borderRadius: '50%',
          backgroundColor: 'var(--separator)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -24, left: -10,
          width: 60, height: 60, borderRadius: '50%',
          backgroundColor: 'var(--separator)', pointerEvents: 'none',
          opacity: 0.5,
        }} />

        <div className="flex justify-between items-center relative z-10">
          <div>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2"
              style={{
                backgroundColor: 'var(--separator)',
              }}>
              <span style={{ fontSize: 20 }}>🚗</span>
            </div>
            <p className="text-sm font-extrabold leading-tight" style={{ color: 'var(--text-1)' }}>
              Do you need ride for upcoming Sabha?
            </p>
          </div>

          <div className="ml-3 flex-shrink-0">
            {hasVoted ? (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full"
                style={{ 
                  backgroundColor: 'var(--accent-bg)', 
                  color: 'var(--accent)' 
                }}>
                {getVoteText(hasVoted)}
              </span>
            ) : isEnabled ? (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full shadow-sm"
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
          </div>
        </div>
      </div>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent 
          side="bottom" 
          className="rounded-t-[32px] px-6 pb-8 pt-6 h-auto"
          style={{ backgroundColor: 'var(--bg)', borderTop: '1px solid var(--border-color)' }}
          onTouchStart={(e) => setTouchStartY(e.touches[0].clientY)}
          onTouchEnd={(e) => {
            if (e.changedTouches[0].clientY - touchStartY > 60) setIsOpen(false);
          }}
          onMouseDown={(e) => setTouchStartY(e.clientY)}
          onMouseUp={(e) => {
            if (e.clientY - touchStartY > 60) setIsOpen(false);
          }}
        >
          <div className="w-12 h-1.5 rounded-full mx-auto mb-6" style={{ backgroundColor: 'var(--separator)' }} />
          <SheetHeader className="p-0 mb-6 text-left relative">
            <SheetTitle className="text-2xl font-bold flex items-center justify-between" style={{ color: 'var(--text-1)' }}>
              <span>Sabha Ride</span>
              {isAdmin && (
                <button
                  onClick={notifyAll}
                  disabled={notifying || !isEnabled}
                  className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}
                  aria-label="Send notification"
                >
                  <span style={{ fontSize: 20 }}>🔔</span>
                </button>
              )}
            </SheetTitle>
            <SheetDescription className="text-base" style={{ color: 'var(--text-3)' }}>
              Do you need ride for the upcoming Sabha??
            </SheetDescription>
          </SheetHeader>

          {isAdmin && (
            <div className="flex items-center justify-between mb-6 p-4 rounded-2xl"
              style={{ backgroundColor: 'var(--bg-card-2)' }}>
              <span className="font-semibold" style={{ color: 'var(--text-1)' }}>Enable Voting Session</span>
              <button
                onClick={toggleEnabled}
                className="w-12 h-6 rounded-full relative transition-colors duration-200"
                style={{ backgroundColor: isEnabled ? 'var(--green)' : 'var(--separator)' }}
              >
                <div
                  className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200"
                  style={{ transform: isEnabled ? 'translateX(24px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          )}

          {isEnabled ? (
            <div className="flex flex-col gap-3">
              {[
                { id: 'yes', label: 'Yes', icon: '👍' },
                { id: 'no', label: 'No', icon: '👎' },
                { id: 'coming_directly', label: 'Coming Directly', icon: '🚶' },
                { id: 'provide_ride', label: 'Can Provide Ride', icon: '🚗' }
              ].map((opt) => {
                const isSelected = hasVoted === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => handleVote(opt.id)}
                    className="w-full p-4 rounded-2xl flex items-center justify-between transition-all"
                    style={{
                      backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg-card)',
                      color: isSelected ? 'white' : 'var(--text-1)',
                      border: isSelected ? 'none' : '1px solid var(--border-color)'
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span style={{ fontSize: 20 }}>{opt.icon}</span>
                      <span className="font-bold">{opt.label}</span>
                    </div>
                    {isSelected && <span>✓</span>}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center rounded-2xl" style={{ backgroundColor: 'var(--bg-card)' }}>
              <span className="text-4xl block mb-2">😴</span>
              <p className="font-semibold" style={{ color: 'var(--text-1)' }}>Voting ends</p>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>Admin has disabled ride voting for now.</p>
            </div>
          )}

          {isAdmin && isEnabled && (
            <div className="mt-8">
              <h3 className="font-bold text-lg mb-4" style={{ color: 'var(--text-1)' }}>Live Status</h3>
              <div className="space-y-4">
                {[
                  { id: 'yes', label: 'Needs Ride', color: '#ef4444' }, // Red for needing ride (since it needs action usually) or maybe green? Let's use blue/green
                  { id: 'provide_ride', label: 'Can Provide Ride', color: '#3b82f6' },
                  { id: 'coming_directly', label: 'Coming Directly', color: '#10b981' },
                  { id: 'no', label: 'Not Coming', color: '#6b7280' },
                ].map((group) => {
                  const filtered = votes.filter(v => v.vote === group.id);
                  return (
                    <div key={group.id} className="p-4 rounded-2xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-sm" style={{ color: group.color }}>{group.label} ({filtered.length})</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        {filtered.length > 0 ? (
                          filtered.map(v => {
                            const member = members.find(m => m.id === v.member_id);
                            return (
                              <span key={v.id} className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>
                                • {member ? `${member.first_name} ${member.last_name}` : 'Unknown'}
                                {member?.phone ? ` (${member.phone})` : ''}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-4)' }}>No one yet</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
