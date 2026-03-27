'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { Bell, Copy, Check, Plus, Trash2, Wand2, X, ShoppingCart, ChevronDown, ChevronUp, Edit2, Info } from 'lucide-react';
import {
  getGroceryItems,
  saveGroceryItems,
  getGrocerySuggestions,
  addGrocerySuggestion,
  markSuggestionsRead,
} from '@/utils/grocery';

interface GroceryItem {
  id?: string;
  name: string;
  quantity: string;
}

interface CategorizedItem {
  category: string;
  name: string;
  quantity: string;
  checked: boolean;
}

const CATEGORY_ORDER = [
  'Vegetables & Fruits',
  'Dairy',
  'Frozen',
  'Spices',
  'Other',
];

const CATEGORY_ICONS: Record<string, string> = {
  'Vegetables & Fruits': '🥦',
  'Dairy': '🥛',
  'Frozen': '🧊',
  'Spices': '🌶️',
  'Other': '🛒',
};

export default function GroceryPage() {
  const [loading, setLoading] = useState(true);
  const [householdId, setHouseholdId] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [memberId, setMemberId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly'>('weekly');
  const [items, setItems] = useState<GroceryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editItems, setEditItems] = useState<GroceryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [submittingSuggestion, setSubmittingSuggestion] = useState(false);
  const [suggestionSent, setSuggestionSent] = useState(false);

  // Grocery session
  const [grocerySession, setGrocerySession] = useState(false);
  const [categorizedItems, setCategorizedItems] = useState<CategorizedItem[]>([]);
  const [categorizingItems, setCategorizingItems] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [showEndModal, setShowEndModal] = useState(false);
  const [endNote, setEndNote] = useState('');
  const [endingGrocery, setEndingGrocery] = useState(false);

  const fetchItems = async (hId: string, tab: 'weekly' | 'monthly') => {
    const data = await getGroceryItems(hId, tab);
    setItems(data);
  };

  const fetchSuggestions = async (hId: string) => {
    const data = await getGrocerySuggestions(hId);
    setSuggestions(data);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { window.location.href = '/'; return; }
        const { data: dbUser } = await supabase
          .from('users').select('*').eq('id', session.user.id).maybeSingle();
        if (!dbUser) { window.location.href = '/'; return; }
        setHouseholdId(dbUser.household_id);
        setUserRole(dbUser.role);
        const { data: member } = await supabase
          .from('household_members').select('id')
          .eq('email', session.user.email!).maybeSingle();
        if (member) setMemberId(member.id);
        await fetchItems(dbUser.household_id, 'weekly');
        if (dbUser.role === 'admin') await fetchSuggestions(dbUser.household_id);
      } catch (err) {
        console.error(err);
        window.location.href = '/';
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (householdId) fetchItems(householdId, activeTab);
  }, [activeTab, householdId]);

  const handleCopy = () => {
    const text = items
      .map((item) => `${item.name}${item.quantity ? ` - ${item.quantity}` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestionText.trim() || !memberId) return;
    try {
      setSubmittingSuggestion(true);
      const ok = await addGrocerySuggestion(householdId, memberId, activeTab, suggestionText.trim());
      if (ok) {
        setSuggestionText('');
        setSuggestionSent(true);
        setTimeout(() => setSuggestionSent(false), 3000);
      }
    } finally {
      setSubmittingSuggestion(false);
    }
  };

  const handleStartEdit = () => {
    setEditItems(items.map((i) => ({ name: i.name, quantity: i.quantity || '' })));
    setEditMode(true);
  };

  const handleSaveEdit = async () => {
    const filtered = editItems.filter((i) => i.name.trim());
    try {
      setSaving(true);
      const ok = await saveGroceryItems(householdId, activeTab, filtered);
      if (ok) {
        await fetchItems(householdId, activeTab);
        setEditMode(false);
      } else {
        setError('Failed to save');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAddRow = () => setEditItems([...editItems, { name: '', quantity: '' }]);
  const handleRemoveRow = (index: number) => setEditItems(editItems.filter((_, i) => i !== index));

  const handleClearList = async () => {
    if (window.confirm('Are you sure you want to clear the entire list?')) {
      try {
        setSaving(true);
        // Optimistic update so it clears instantly for the user 
        setItems([]);
        const ok = await saveGroceryItems(householdId, activeTab, []);
        if (!ok) {
          setError('Failed to clear list');
          // Revert on fail
          await fetchItems(householdId, activeTab);
        }
      } finally {
        setSaving(false);
      }
    }
  };

  const handleAIPaste = async () => {
    if (!pasteText.trim()) return;
    try {
      setAiProcessing(true);
      setError(null);
      const response = await fetch('/api/grocery-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: pasteText }),
      });
      const data = await response.json();
      const text = data.content ?? '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) { setError('AI could not parse the list. Try again.'); return; }
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setEditItems([...items, ...parsed]);
        setEditMode(true);
        setPasteMode(false);
        setPasteText('');
      } else {
        setError('AI returned empty list. Try again.');
      }
    } catch {
      setError('AI processing failed.');
    } finally {
      setAiProcessing(false);
    }
  };

  const handleShowSuggestions = async () => {
    setShowSuggestions(true);
    await markSuggestionsRead(householdId);
    setSuggestions((prev) => prev.map((s) => ({ ...s, is_read: true })));
  };

  // ── Grocery Session ────────────────────────────────────────
  const handleStartGrocery = async () => {
    if (items.length === 0) return;
    try {
      setCategorizingItems(true);
      setError(null);
      const response = await fetch('/api/grocery-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      });
      const data = await response.json();
      if (data.items && data.items.length > 0) {
        setCategorizedItems(data.items.map((item: any) => ({
          ...item,
          checked: false,
          category: CATEGORY_ORDER.includes(item.category) ? item.category : 'Other',
        })));
        setGrocerySession(true);
      } else {
        setError('Could not categorize items. Try again.');
      }
    } catch {
      setError('Failed to start grocery session.');
    } finally {
      setCategorizingItems(false);
    }
  };

  const handleToggleItem = (idx: number) => {
    setCategorizedItems(prev =>
      prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item)
    );
  };

  const handleToggleCategory = (category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const handleEndGrocery = async () => {
    try {
      setEndingGrocery(true);
      // Remove checked items from list
      const uncheckedNames = categorizedItems
        .filter(i => !i.checked)
        .map(i => i.name.toLowerCase());

      const remaining = items.filter(item =>
        uncheckedNames.includes(item.name.toLowerCase())
      );

      await saveGroceryItems(householdId, activeTab, remaining);

      // Save note if provided
      if (endNote.trim()) {
        await addGrocerySuggestion(
          householdId,
          memberId,
          activeTab,
          `[Grocery Note] ${endNote.trim()}`
        );
      }

      await fetchItems(householdId, activeTab);
      setGrocerySession(false);
      setCategorizedItems([]);
      setShowEndModal(false);
      setEndNote('');
    } finally {
      setEndingGrocery(false);
    }
  };

  const checkedCount = categorizedItems.filter(i => i.checked).length;
  const totalCount = categorizedItems.length;
  const unreadCount = suggestions.filter((s) => !s.is_read).length;

  if (loading) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ backgroundColor: 'var(--bg)' }}>
        <div className="w-16 h-16 rounded-3xl overflow-hidden animate-pulse shadow-lg">
          <img src="/icon-256.png" alt="HariSanmukh" className="w-full h-full object-cover" />
        </div>
        <p className="text-[15px] font-medium animate-pulse" style={{ color: 'var(--text-3)' }}>Loading your list...</p>
      </main>
    );
  }

  const TabBar = () => (
    <div className="relative flex p-1 mb-8 rounded-2xl" style={{ backgroundColor: 'var(--bg-card-2)' }}>
      {(['weekly', 'monthly'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => { setActiveTab(tab); setEditMode(false); setPasteMode(false); }}
          className="relative z-10 flex-1 py-3 rounded-xl text-[14px] font-bold transition-all duration-300 capitalize"
          style={{ color: activeTab === tab ? 'var(--text-1)' : 'var(--text-3)' }}
        >
          {tab}
        </button>
      ))}
      {/* Active pill indicator */}
      <div 
        className="absolute top-1 bottom-1 rounded-xl transition-all duration-300 ease-out shadow-sm"
        style={{ width: 'calc(50% - 4px)', left: activeTab === 'weekly' ? '4px' : 'calc(50%)', backgroundColor: 'var(--bg-card)', zIndex: 0 }}
      />
    </div>
  );

  // ── GROCERY SESSION VIEW ──────────────────────────────────
  if (grocerySession) {
    const grouped = CATEGORY_ORDER.reduce((acc, cat) => {
      const catItems = categorizedItems.filter(i => i.category === cat);
      if (catItems.length > 0) acc[cat] = catItems;
      return acc;
    }, {} as Record<string, CategorizedItem[]>);

    return (
      <main className="min-h-screen pb-28" style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}>
        {showEndModal && (
          <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
            <div className="w-full max-w-lg rounded-t-[32px] p-6 pb-12 shadow-2xl" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-1)' }}>Finish Run</h3>
              <p className="text-[14px] mb-6" style={{ color: 'var(--text-3)' }}>
                {checkedCount} of {totalCount} items checked off. Unchecked items will stay on the list for next time.
              </p>
              <textarea
                value={endNote}
                onChange={e => setEndNote(e.target.value)}
                placeholder="Add a note (e.g. out of stock items...)"
                rows={3}
                className="input text-[14px] resize-none mb-6 rounded-xl"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleEndGrocery}
                  disabled={endingGrocery}
                  className="flex-1 text-white font-bold py-3.5 rounded-xl disabled:opacity-50 transition-all text-[15px] shadow-sm flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, var(--green), #248256)' }}
                >
                  {endingGrocery ? 'Finishing...' : 'End Grocery ✓'}
                </button>
                <button
                  onClick={() => setShowEndModal(false)}
                  className="btn-secondary flex-1 py-3.5 text-[15px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-extrabold" style={{ color: 'var(--text-1)' }}>Grocery Run</h1>
              <p className="text-[14px] mt-1 font-medium" style={{ color: 'var(--text-3)' }}>
                {checkedCount} / {totalCount} items checked
              </p>
            </div>
            <button
              onClick={() => setShowEndModal(true)}
              className="text-[13px] font-bold px-4 py-2.5 rounded-xl text-white transition-all shadow-sm"
              style={{ backgroundColor: 'var(--green)' }}
            >
              Finish
            </button>
          </div>

          {/* Thick Progress bar */}
          <div className="rounded-full overflow-hidden shadow-inner" style={{ backgroundColor: 'var(--bg-card-2)', height: 10 }}>
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{ backgroundColor: 'var(--green)', width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%` }}
            />
          </div>

          <div className="space-y-4">
            {Object.entries(grouped).map(([category, catItems]) => {
              const isCollapsed = collapsedCategories.has(category);
              const doneCount = catItems.filter(i => i.checked).length;
              const allDone = doneCount === catItems.length;

              return (
                <div key={category} className="list-group shadow-sm">
                  <button
                    onClick={() => handleToggleCategory(category)}
                    className="w-full flex items-center justify-between px-5 py-4 transition-all"
                    style={{
                      borderBottom: isCollapsed ? 'none' : '0.5px solid var(--separator)',
                      background: allDone ? 'var(--green-bg)' : 'var(--bg-card-2)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[20px] bg-white dark:bg-black/20 rounded-lg p-1.5 shadow-sm">{CATEGORY_ICONS[category]}</span>
                      <span className="font-bold text-[15px]" style={{ color: allDone ? 'var(--green)' : 'var(--text-1)' }}>
                        {category}
                      </span>
                      <span className="text-[12px] px-2 py-0.5 rounded-full font-bold ml-1" style={{ backgroundColor: allDone ? 'rgba(77,184,150,0.15)' : 'var(--accent-bg)', color: allDone ? 'var(--green)' : 'var(--accent)' }}>
                        {doneCount}/{catItems.length}
                      </span>
                    </div>
                    {isCollapsed
                      ? <ChevronDown size={18} style={{ color: 'var(--text-3)' }} />
                      : <ChevronUp size={18} style={{ color: 'var(--text-3)' }} />
                    }
                  </button>

                  {!isCollapsed && (
                    <div className="divide-y" style={{ borderColor: 'var(--separator)' }}>
                      {catItems.map((item, itemIdx) => {
                        const globalIdx = categorizedItems.findIndex(ci => ci.name === item.name && ci.category === item.category);
                        return (
                          <button
                            key={itemIdx}
                            onClick={() => handleToggleItem(globalIdx)}
                            className="w-full flex items-center gap-4 px-5 py-4 transition-colors text-left"
                            style={{ backgroundColor: item.checked ? 'var(--green-bg)' : 'var(--bg-card)' }}
                          >
                            <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-300" style={{ backgroundColor: item.checked ? 'var(--green)' : 'transparent', border: item.checked ? '2px solid var(--green)' : '2px solid var(--border-strong)' }}>
                              {item.checked && (
                                <svg width="12" height="10" viewBox="0 0 10 8" fill="none">
                                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <span className="flex-1 text-[16px] font-semibold transition-all duration-300" style={{ color: item.checked ? 'var(--text-3)' : 'var(--text-1)', textDecoration: item.checked ? 'line-through' : 'none' }}>
                              {item.name}
                            </span>
                            {item.quantity && (
                              <span className="text-[13px] px-2.5 py-1 rounded-full flex-shrink-0 font-semibold shadow-sm" style={{ backgroundColor: item.checked ? 'rgba(255,255,255,0.5)' : 'var(--bg-card-2)', color: item.checked ? 'var(--text-3)' : 'var(--text-2)', border: '0.5px solid var(--separator)' }}>
                                {item.quantity}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {checkedCount === totalCount && totalCount > 0 && (
            <div className="rounded-3xl p-8 text-center animate-in zoom-in duration-300" style={{ backgroundColor: 'var(--green-bg)', border: '1px solid var(--green)' }}>
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-xl font-extrabold" style={{ color: 'var(--green)' }}>All done!</p>
              <p className="text-[14px] mt-2 font-medium" style={{ color: 'var(--text-3)' }}>Tap Finish to complete your grocery run.</p>
            </div>
          )}
        </div>
        <BottomNav isAdmin={userRole === 'admin'} />
      </main>
    );
  }

  // ── USER VIEW ──────────────────────────────────────────────
  if (userRole === 'user') {
    return (
      <main className="min-h-screen pb-28" style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text-1)' }}>Grocery</h1>
          <TabBar />

          <div className="card shadow-sm">
            <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: 'var(--bg-card-2)', borderBottom: '0.5px solid var(--separator)' }}>
              <p className="font-bold capitalize text-[15px]" style={{ color: 'var(--text-1)' }}>{activeTab} List</p>
              <button 
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg transition-colors bg-white dark:bg-black/20 shadow-sm"
                style={{ color: copied ? 'var(--green)' : 'var(--text-2)' }}
              >
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>
            
            {items.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center bg-[var(--bg-card-2)]">
                  <ShoppingCart size={24} style={{ color: 'var(--text-4)' }} />
                </div>
                <p className="text-[15px] font-semibold" style={{ color: 'var(--text-2)' }}>No items yet</p>
                <p className="text-[13px] mt-1" style={{ color: 'var(--text-3)' }}>The admins haven't added anything to this list.</p>
              </div>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--separator)' }}>
                {items.map((item, i) => (
                  <li key={i} className="flex items-center justify-between px-5 py-3.5 bg-[var(--bg-card)]">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                      <span className="text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>{item.name}</span>
                    </div>
                    {item.quantity && (
                      <span className="text-[13px] font-bold px-2.5 py-1 rounded-full border border-[var(--separator)]" style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-2)' }}>
                        {item.quantity}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {items.length > 0 && (
            <button
              onClick={handleStartGrocery}
              disabled={categorizingItems}
              className="group relative w-full overflow-hidden flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[15px] text-white transition-all disabled:opacity-70 shadow-lg"
              style={{ background: 'linear-gradient(135deg, var(--green), #248256)' }}
            >
              <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
              <ShoppingCart size={18} />
              {categorizingItems ? 'Organizing your cart...' : 'Start Grocery Run'}
            </button>
          )}

          <div className="card shadow-sm overflow-hidden border-[var(--separator)] mt-8">
            <div className="bg-[var(--bg-card-2)] p-4 border-b border-[var(--separator)] flex items-center gap-2">
              <Info size={16} className="text-[var(--accent)]" />
              <p className="font-bold text-[14px]" style={{ color: 'var(--text-1)' }}>Suggest Items</p>
            </div>
            <div className="p-4 bg-[var(--bg-card)]">
              <textarea
                value={suggestionText}
                onChange={(e) => setSuggestionText(e.target.value)}
                placeholder={`What's missing from the ${activeTab} list?`}
                rows={3}
                className="w-full text-[14px] resize-none outline-none bg-transparent"
                style={{ color: 'var(--text-1)' }}
              />
              <div className="flex items-center justify-between mt-3">
                {suggestionSent ? (
                  <p className="text-[13px] font-bold text-[var(--green)]">✓ Sent to admins!</p>
                ) : <div />}
                <button
                  onClick={handleSubmitSuggestion}
                  disabled={submittingSuggestion || !suggestionText.trim()}
                  className="px-5 py-2.5 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-50"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {submittingSuggestion ? 'Sending...' : 'Send Suggestion'}
                </button>
              </div>
            </div>
          </div>
        </div>
        <BottomNav isAdmin={false} />
      </main>
    );
  }

  // ── ADMIN VIEW ─────────────────────────────────────────────
  return (
    <main className="min-h-screen pb-28" style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="max-w-xl mx-auto px-4 py-8 space-y-6">

        <div className="flex items-center justify-between mb-2">
          <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: 'var(--text-1)' }}>List Hub</h1>
          <button
            onClick={handleShowSuggestions}
            className="relative p-2.5 rounded-xl transition-all shadow-sm"
            style={{ backgroundColor: 'var(--bg-card)', border: '0.5px solid var(--border-color)' }}
          >
            <Bell size={20} style={{ color: 'var(--text-2)' }} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-md" style={{ backgroundColor: 'var(--red)' }}>
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <TabBar />

        {error && (
          <div className="p-4 rounded-xl flex items-center gap-2 text-[14px] font-medium" style={{ backgroundColor: 'var(--red-bg)', border: '0.5px solid var(--red)', color: 'var(--red)' }}>
            <Info size={16} />{error}
          </div>
        )}

        {showSuggestions && (
          <div className="card shadow-lg mb-6 transform transition-all duration-300">
            <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: 'var(--yellow-bg)', borderBottom: '0.5px solid rgba(232,184,75,0.2)' }}>
              <p className="font-bold text-[15px]" style={{ color: 'var(--yellow)' }}>Member Suggestions</p>
              <button onClick={() => setShowSuggestions(false)} className="p-1 rounded-lg hover:bg-black/5" style={{ color: 'var(--yellow)' }}>
                <X size={18} />
              </button>
            </div>
            {suggestions.length === 0 ? (
              <p className="text-center py-10 text-[14px] font-medium text-[var(--text-4)]">All caught up! No active suggestions.</p>
            ) : (
              <ul className="divide-y" style={{ borderColor: 'var(--separator)' }}>
                {suggestions.map((s) => (
                  <li key={s.id} className="px-5 py-4 bg-[var(--bg-card)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[13px] font-bold px-2 py-0.5 rounded border border-[var(--separator)]" style={{ backgroundColor: 'var(--bg-card-2)' }}>{s.household_members?.first_name}</span>
                      <span className="text-[11px] font-bold capitalize px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}>{s.list_type} list</span>
                    </div>
                    <p className="text-[15px] font-medium text-[var(--text-1)]">{s.suggestion}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {pasteMode ? (
          <div className="card overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[var(--separator)]" style={{ background: 'linear-gradient(to right, rgba(167, 139, 250, 0.1), rgba(125, 211, 252, 0.05))' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <Wand2 size={18} className="text-indigo-500 font-bold" />
                <p className="font-extrabold text-[16px]" style={{ color: 'var(--text-1)' }}>Magic Paste</p>
              </div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--text-3)' }}>Paste text from a recipe, WhatsApp chat, or any list. AI will automatically format it into items and quantities.</p>
            </div>
            
            <div className="p-5" style={{ backgroundColor: 'var(--bg-card)' }}>
              <textarea 
                value={pasteText} 
                onChange={(e) => setPasteText(e.target.value)} 
                placeholder="E.g. We need 2 liters of milk, a loaf of bread, and a dozen eggs..." 
                rows={5} 
                className="w-full text-[15px] resize-none outline-none bg-transparent font-medium" 
                style={{ color: 'var(--text-1)' }}
              />
            </div>
            
            <div className="flex border-t border-[var(--separator)]">
              <button 
                onClick={() => { setPasteMode(false); setPasteText(''); }} 
                className="flex-1 py-4 text-[14px] font-bold border-r border-[var(--separator)] transition-colors hover:bg-black/5"
                style={{ color: 'var(--text-3)', backgroundColor: 'var(--bg-card)' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleAIPaste} 
                disabled={aiProcessing || !pasteText.trim()} 
                className="flex-1 flex items-center justify-center gap-2 py-4 text-[15px] font-bold transition-all disabled:opacity-75" 
                style={{ color: 'white', background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}
              >
                {aiProcessing ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : <Wand2 size={16} />}
                {aiProcessing ? 'Processing AI...' : 'Extract Items'}
              </button>
            </div>
          </div>

        ) : editMode ? (
          <div className="card shadow-sm overflow-hidden mb-6">
            <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--bg-card-2)', borderBottom: '0.5px solid var(--separator)' }}>
              <p className="font-bold text-[15px] capitalize" style={{ color: 'var(--text-1)' }}>Editing {activeTab}</p>
              <span className="text-[12px] font-bold px-2 py-1 rounded-full border border-[var(--separator)]" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-2)' }}>{editItems.length} items</span>
            </div>
            
            <div className="divide-y" style={{ borderColor: 'var(--separator)' }}>
              {editItems.map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 bg-[var(--bg-card)]">
                  <input type="text" value={item.name} onChange={(e) => { const u = [...editItems]; u[i] = { ...u[i], name: e.target.value }; setEditItems(u); }} placeholder="Item name" className="flex-1 bg-transparent text-[15px] font-bold outline-none" style={{ color: 'var(--text-1)' }} />
                  <div className="w-[1px] h-6" style={{ backgroundColor: 'var(--separator)' }} />
                  <input type="text" value={item.quantity} onChange={(e) => { const u = [...editItems]; u[i] = { ...u[i], quantity: e.target.value }; setEditItems(u); }} placeholder="Qty" className="w-[70px] bg-transparent text-[14px] font-medium outline-none text-right" style={{ color: 'var(--text-2)' }} />
                  <button onClick={() => handleRemoveRow(i)} className="p-2 -mr-2 rounded-xl transition-colors hover:bg-red-50" style={{ color: 'var(--red)' }}>
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
            
            <button 
              onClick={handleAddRow} 
              className="w-full flex items-center justify-center gap-2 py-4 text-[14px] font-bold transition-colors hover:bg-black/5" 
              style={{ color: 'var(--accent)', borderTop: '0.5px solid var(--separator)', backgroundColor: 'var(--bg-card-2)' }}
            >
              <Plus size={16} /> Add Blank Item
            </button>

            <div className="flex p-3 gap-3" style={{ borderTop: '0.5px solid var(--separator)', backgroundColor: 'var(--bg-card)' }}>
              <button 
                onClick={() => setEditMode(false)} 
                className="flex-1 py-3.5 rounded-xl text-[14px] font-bold transition-colors shadow-sm" 
                style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-2)', border: '1px solid var(--separator)' }}
              >
                Discard
              </button>
              <button 
                onClick={handleSaveEdit} 
                disabled={saving} 
                className="flex-[2] py-3.5 rounded-xl text-[14px] font-bold text-white shadow-md transition-all disabled:opacity-75" 
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {saving ? 'Saving changes...' : 'Save List'}
              </button>
            </div>
          </div>

        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-3">
              <button 
                onClick={handleStartEdit} 
                className="flex flex-col items-center justify-center gap-2 py-3.5 rounded-2xl transition-all shadow-sm active:scale-95"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--separator)' }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-bg)', color: 'var(--accent)' }}>
                  <Edit2 size={16} />
                </div>
                <span className="text-[12px] font-bold" style={{ color: 'var(--text-2)' }}>Edit List</span>
              </button>

              <button 
                onClick={() => setPasteMode(true)} 
                className="flex flex-col items-center justify-center gap-2 py-3.5 rounded-2xl transition-all shadow-sm active:scale-95"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--separator)' }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white" style={{ background: 'linear-gradient(135deg, #8B5CF6, #3B82F6)' }}>
                  <Wand2 size={16} />
                </div>
                <span className="text-[12px] font-bold" style={{ color: 'var(--text-2)' }}>AI Paste</span>
              </button>

              <button 
                onClick={handleCopy} 
                className="flex flex-col items-center justify-center gap-2 py-3.5 rounded-2xl transition-all shadow-sm active:scale-95"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--separator)' }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: copied ? 'var(--green-bg)' : 'var(--bg-card-2)', color: copied ? 'var(--green)' : 'var(--text-2)' }}>
                  {copied ? <Check size={16} /> : <Copy size={16} />}
                </div>
                <span className="text-[12px] font-bold" style={{ color: 'var(--text-2)' }}>{copied ? 'Copied' : 'Copy Items'}</span>
              </button>

              <button 
                onClick={handleClearList} 
                className="flex flex-col items-center justify-center gap-2 py-3.5 rounded-2xl transition-all shadow-sm active:scale-95"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--separator)' }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--red-bg)', color: 'var(--red)' }}>
                  <Trash2 size={16} />
                </div>
                <span className="text-[12px] font-bold" style={{ color: 'var(--text-2)' }}>Clear All</span>
              </button>
            </div>

            <div className="card shadow-sm border border-[var(--separator)]">
              <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: 'var(--bg-card-2)', borderBottom: '1px solid var(--separator)' }}>
                <p className="font-extrabold text-[15px] capitalize tracking-wide" style={{ color: 'var(--text-1)' }}>
                  {activeTab} List
                </p>
                {items.length > 0 && (
                  <span className="text-[12px] font-bold px-2.5 py-1 rounded-full border border-[var(--separator)] bg-[var(--bg-card)] text-[var(--text-2)]">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>
              
              {items.length === 0 ? (
                <div className="py-16 text-center px-4 bg-[var(--bg-card)]">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center bg-[var(--bg-card-2)] border border-[var(--separator)]">
                    <ShoppingCart size={28} style={{ color: 'var(--text-4)' }} />
                  </div>
                  <p className="text-[16px] font-bold mb-1" style={{ color: 'var(--text-1)' }}>Your list is empty</p>
                  <p className="text-[14px] font-medium" style={{ color: 'var(--text-3)' }}>Tap "Edit List" to add items or<br/>use "AI Paste" to magically drop them in.</p>
                </div>
              ) : (
                <ul className="divide-y" style={{ borderColor: 'var(--separator)', backgroundColor: 'var(--bg-card)' }}>
                  {items.map((item, i) => (
                    <li key={i} className="flex items-center justify-between px-5 py-4 hover:bg-black/5 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                        <span className="text-[16px] font-semibold" style={{ color: 'var(--text-1)' }}>{item.name}</span>
                      </div>
                      {item.quantity && (
                        <span className="text-[13px] font-bold px-3 py-1 rounded-full border border-[var(--separator)]" style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-2)' }}>
                          {item.quantity}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 && (
              <button
                onClick={handleStartGrocery}
                disabled={categorizingItems}
                className="group relative w-full overflow-hidden flex items-center justify-center gap-2 py-4 rounded-2xl font-extrabold text-[16px] text-white transition-all disabled:opacity-75 shadow-lg"
                style={{ background: 'linear-gradient(135deg, var(--green), #248256)' }}
              >
                <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none" />
                <ShoppingCart size={18} />
                {categorizingItems ? 'Organizing your list...' : 'Start Grocery Run'}
              </button>
            )}
          </div>
        )}
      </div>
      <BottomNav isAdmin={true} />
    </main>
  );
}