'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { Bell, Copy, Check, Plus, Trash2, Wand2, X, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react';
import {
  getGroceryItems,
  saveGroceryItems,
  getGrocerySuggestions,
  addGrocerySuggestion,
  markSuggestionsRead,
} from '@/utils/grocery';
import { AppHeader } from '@/components/AppHeader';

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
        setEditItems(parsed);
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
    <main
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: 'var(--bg)' }}
    >
      <div className="w-12 h-12 rounded-2xl overflow-hidden animate-pulse">
        <img src="/icon-256.png" alt="HariSanmukh" className="w-full h-full object-cover" />
      </div>
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading...</p>
    </main>
  );
}

  const TabBar = () => (
    <div
      className="flex gap-2 mb-6 p-1 rounded-2xl"
      style={{ backgroundColor: 'var(--bg-card-2)' }}
    >
      {(['weekly', 'monthly'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => { setActiveTab(tab); setEditMode(false); setPasteMode(false); }}
          className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all capitalize"
          style={{
            backgroundColor: activeTab === tab ? 'var(--bg-card)' : 'transparent',
            color: activeTab === tab ? 'var(--text-1)' : 'var(--text-3)',
            boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          {tab}
        </button>
      ))}
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
      <main
        className="min-h-screen pb-28"
        style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}
      >
        {/* End grocery modal */}
        {showEndModal && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          >
            <div
              className="w-full max-w-lg rounded-t-3xl p-6"
              style={{ backgroundColor: 'var(--bg-card)' }}
            >
              <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--text-1)' }}>
                End Grocery
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--text-3)' }}>
                {checkedCount} of {totalCount} items checked off. Unchecked items will stay on the list.
              </p>
              <textarea
                value={endNote}
                onChange={e => setEndNote(e.target.value)}
                placeholder="Add a note (optional) — e.g. milk was out of stock..."
                rows={3}
                className="input text-sm resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={handleEndGrocery}
                  disabled={endingGrocery}
                  className="flex-1 text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-all text-sm"
                  style={{ backgroundColor: 'var(--green)' }}
                >
                  {endingGrocery ? 'Finishing...' : 'End Grocery ✓'}
                </button>
                <button
                  onClick={() => setShowEndModal(false)}
                  className="btn-secondary flex-1 py-3 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-1)' }}>
                Grocery 🛒
              </h1>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                {checkedCount} of {totalCount} items in cart
              </p>
            </div>
            <button
              onClick={() => setShowEndModal(true)}
              className="text-sm font-semibold px-4 py-2 rounded-xl text-white transition-all"
              style={{ backgroundColor: 'var(--green)' }}
            >
              End Grocery
            </button>
          </div>

          {/* Progress bar */}
          <div
            className="rounded-full overflow-hidden"
            style={{ backgroundColor: 'var(--bg-card-2)', height: 6 }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                backgroundColor: 'var(--green)',
                width: `${totalCount > 0 ? (checkedCount / totalCount) * 100 : 0}%`,
              }}
            />
          </div>

          {/* Categories */}
          {Object.entries(grouped).map(([category, catItems]) => {
            const isCollapsed = collapsedCategories.has(category);
            const doneCount = catItems.filter(i => i.checked).length;
            const allDone = doneCount === catItems.length;

            return (
              <div key={category} className="list-group">
                {/* Category header */}
                <button
                  onClick={() => handleToggleCategory(category)}
                  className="w-full flex items-center justify-between px-4 py-3 transition-all"
                  style={{
                    borderBottom: isCollapsed ? 'none' : '0.5px solid var(--separator)',
                    backgroundColor: allDone ? 'var(--green-bg)' : 'var(--bg-card-2)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: 16 }}>{CATEGORY_ICONS[category]}</span>
                    <span
                      className="font-semibold text-sm"
                      style={{ color: allDone ? 'var(--green)' : 'var(--text-1)' }}
                    >
                      {category}
                    </span>
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{
                        backgroundColor: allDone ? 'var(--green-bg)' : 'var(--accent-bg)',
                        color: allDone ? 'var(--green)' : 'var(--accent-text)',
                      }}
                    >
                      {doneCount}/{catItems.length}
                    </span>
                  </div>
                  {isCollapsed
                    ? <ChevronDown size={16} style={{ color: 'var(--text-3)' }} />
                    : <ChevronUp size={16} style={{ color: 'var(--text-3)' }} />
                  }
                </button>

                {/* Items */}
                {!isCollapsed && catItems.map((item, itemIdx) => {
                  const globalIdx = categorizedItems.findIndex(
                    ci => ci.name === item.name && ci.category === item.category
                  );
                  return (
                    <button
                      key={itemIdx}
                      onClick={() => handleToggleItem(globalIdx)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 transition-all text-left"
                      style={{
                        borderBottom: itemIdx !== catItems.length - 1
                          ? '0.5px solid var(--separator)'
                          : 'none',
                        backgroundColor: item.checked ? 'var(--green-bg)' : 'transparent',
                      }}
                    >
                      {/* Checkbox */}
                      <div
                        className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center transition-all"
                        style={{
                          backgroundColor: item.checked ? 'var(--green)' : 'transparent',
                          border: item.checked
                            ? '2px solid var(--green)'
                            : '2px solid var(--border-strong)',
                        }}
                      >
                        {item.checked && (
                          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>

                      {/* Item name */}
                      <span
                        className="flex-1 text-sm font-medium"
                        style={{
                          color: item.checked ? 'var(--text-3)' : 'var(--text-1)',
                          textDecoration: item.checked ? 'line-through' : 'none',
                        }}
                      >
                        {item.name}
                      </span>

                      {/* Quantity */}
                      {item.quantity && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor: 'var(--bg-card-2)',
                            color: 'var(--text-3)',
                          }}
                        >
                          {item.quantity}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {/* All done state */}
          {checkedCount === totalCount && totalCount > 0 && (
            <div
              className="rounded-2xl p-6 text-center"
              style={{ backgroundColor: 'var(--green-bg)', border: '0.5px solid var(--green)' }}
            >
              <p className="text-2xl mb-1">🎉</p>
              <p className="font-bold" style={{ color: 'var(--green)' }}>All items in cart!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-3)' }}>
                Tap End Grocery to finish
              </p>
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
      <main
        className="min-h-screen pb-28"
        style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}
      >
       
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>Grocery</h1>
          <TabBar />

          {/* List */}
          <div className="list-group">
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '0.5px solid var(--separator)' }}
            >
              <p className="font-semibold capitalize text-sm" style={{ color: 'var(--text-1)' }}>
                {activeTab} List
              </p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all"
                style={{ color: copied ? 'var(--green)' : 'var(--text-3)' }}
              >
                {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: 'var(--text-4)' }}>No items yet</p>
              </div>
            ) : (
              <ul>
                {items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: i !== items.length - 1 ? '0.5px solid var(--separator)' : 'none' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                      <span className="text-sm" style={{ color: 'var(--text-1)' }}>{item.name}</span>
                    </div>
                    {item.quantity && (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-3)' }}>
                        {item.quantity}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Start Grocery Button */}
          {items.length > 0 && (
            <button
              onClick={handleStartGrocery}
              disabled={categorizingItems}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm text-white transition-all disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <ShoppingCart size={18} />
              {categorizingItems ? 'Organizing your list...' : 'Start Grocery'}
            </button>
          )}

          {/* Suggestion box */}
          <div className="list-group p-4">
            <p className="font-semibold text-sm mb-3" style={{ color: 'var(--text-1)' }}>
              Suggest something
            </p>
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder={`Suggest items for the ${activeTab} list...`}
              rows={3}
              className="input text-sm resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              {suggestionSent && (
                <p className="text-xs font-semibold" style={{ color: 'var(--green)' }}>✓ Sent!</p>
              )}
              <button
                onClick={handleSubmitSuggestion}
                disabled={submittingSuggestion || !suggestionText.trim()}
                className="ml-auto text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-all text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {submittingSuggestion ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
        <BottomNav isAdmin={false} />
      </main>
    );
  }

  // ── ADMIN VIEW ─────────────────────────────────────────────
  return (
    <main
      className="min-h-screen pb-28"
      style={{ backgroundColor: 'var(--bg)', paddingTop: 'env(safe-area-inset-top)' }}
    >
    
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>Grocery</h1>
          <button
            onClick={handleShowSuggestions}
            className="relative p-2.5 rounded-xl transition-all"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--yellow-bg)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold"
                style={{ backgroundColor: 'var(--red)' }}
              >
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <TabBar />

        {error && (
          <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--red-bg)', border: '0.5px solid var(--red)' }}>
            <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
          </div>
        )}

        {showSuggestions && (
          <div className="list-group">
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '0.5px solid var(--separator)' }}>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Member Suggestions</p>
              <button onClick={() => setShowSuggestions(false)} className="p-1 rounded-lg" style={{ color: 'var(--text-3)' }}>
                <X size={16} />
              </button>
            </div>
            {suggestions.length === 0 ? (
              <p className="text-center py-8 text-sm" style={{ color: 'var(--text-4)' }}>No suggestions yet.</p>
            ) : (
              <ul>
                {suggestions.map((s, idx) => (
                  <li key={s.id} className="px-4 py-3" style={{ borderBottom: idx !== suggestions.length - 1 ? '0.5px solid var(--separator)' : 'none' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{s.household_members?.first_name} Bhai</span>
                      <span className="text-xs capitalize px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-3)' }}>{s.list_type}</span>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-2)' }}>{s.suggestion}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {pasteMode ? (
          <div className="list-group p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 size={16} style={{ color: 'var(--accent-2)' }} />
              <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>Paste your list — AI will format it</p>
            </div>
            <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Paste any format..." rows={6} className="input text-sm resize-none" />
            <div className="flex gap-3 mt-3">
              <button onClick={handleAIPaste} disabled={aiProcessing || !pasteText.trim()} className="flex-1 text-white font-semibold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 text-sm" style={{ backgroundColor: 'var(--accent-2)' }}>
                <Wand2 size={15} />{aiProcessing ? 'Processing...' : 'Process with AI'}
              </button>
              <button onClick={() => { setPasteMode(false); setPasteText(''); }} className="btn-secondary flex-1 py-2.5 text-sm">Cancel</button>
            </div>
          </div>

        ) : editMode ? (
          <div className="space-y-3">
            <div className="list-group">
              <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--separator)', backgroundColor: 'var(--bg-card-2)' }}>
                <p className="font-semibold text-sm capitalize" style={{ color: 'var(--text-1)' }}>Editing {activeTab} List</p>
              </div>
              {editItems.map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: i !== editItems.length - 1 ? '0.5px solid var(--separator)' : 'none' }}>
                  <input type="text" value={item.name} onChange={(e) => { const u = [...editItems]; u[i] = { ...u[i], name: e.target.value }; setEditItems(u); }} placeholder="Item name" className="input text-sm py-1.5" style={{ flex: 1 }} />
                  <input type="text" value={item.quantity} onChange={(e) => { const u = [...editItems]; u[i] = { ...u[i], quantity: e.target.value }; setEditItems(u); }} placeholder="Qty" className="input text-sm py-1.5" style={{ width: 80 }} />
                  <button onClick={() => handleRemoveRow(i)} className="p-1.5 rounded-lg" style={{ color: 'var(--red)' }} onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--red-bg)')} onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}><Trash2 size={14} /></button>
                </div>
              ))}
              <div className="px-4 py-3" style={{ borderTop: '0.5px solid var(--separator)' }}>
                <button onClick={handleAddRow} className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--accent)' }}><Plus size={15} /> Add item</button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={handleSaveEdit} disabled={saving} className="btn-primary flex-1 py-3 text-sm disabled:opacity-50">{saving ? 'Saving...' : 'Save List'}</button>
              <button onClick={() => setEditMode(false)} className="btn-secondary flex-1 py-3 text-sm">Cancel</button>
            </div>
          </div>

        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <button onClick={handleStartEdit} className="text-xs font-semibold py-3 rounded-xl text-white" style={{ backgroundColor: 'var(--accent)' }}>Edit List</button>
              <button onClick={() => setPasteMode(true)} className="text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-1 text-white" style={{ backgroundColor: 'var(--accent-2)' }}><Wand2 size={13} /> AI Paste</button>
              <button onClick={handleCopy} className="btn-secondary text-xs py-3 flex items-center justify-center gap-1">
                {copied ? <><Check size={13} style={{ color: 'var(--green)' }} /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
            </div>

            <div className="list-group">
              <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--separator)' }}>
                <p className="font-semibold text-sm capitalize" style={{ color: 'var(--text-1)' }}>
                  {activeTab} List
                  {items.length > 0 && <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-4)' }}>{items.length} items</span>}
                </p>
              </div>
              {items.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-4)' }}>No items yet</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-4)', opacity: 0.6 }}>Edit the list or paste with AI</p>
                </div>
              ) : (
                <ul>
                  {items.map((item, i) => (
                    <li key={i} className="flex items-center justify-between px-4 py-3" style={{ borderBottom: i !== items.length - 1 ? '0.5px solid var(--separator)' : 'none' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
                        <span className="text-sm" style={{ color: 'var(--text-1)' }}>{item.name}</span>
                      </div>
                      {item.quantity && <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-3)' }}>{item.quantity}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Start Grocery Button */}
            {items.length > 0 && (
              <button
                onClick={handleStartGrocery}
                disabled={categorizingItems}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-semibold text-sm text-white transition-all disabled:opacity-60"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                <ShoppingCart size={18} />
                {categorizingItems ? 'Organizing your list...' : 'Start Grocery'}
              </button>
            )}
          </div>
        )}
      </div>
      <BottomNav isAdmin={true} />
    </main>
  );
}