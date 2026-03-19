'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { Bell, Copy, Check, Plus, Trash2, Wand2, X } from 'lucide-react';
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

  const handleAddRow = () => {
    setEditItems([...editItems, { name: '', quantity: '' }]);
  };

  const handleRemoveRow = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
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
        setEditItems(parsed);
        setEditMode(true);
        setPasteMode(false);
        setPasteText('');
      } else {
        setError('AI returned empty list. Try again.');
      }
    } catch {
      setError('AI processing failed. Check your connection.');
    } finally {
      setAiProcessing(false);
    }
  };

  const handleShowSuggestions = async () => {
    setShowSuggestions(true);
    await markSuggestionsRead(householdId);
    setSuggestions((prev) => prev.map((s) => ({ ...s, is_read: true })));
  };

  const unreadCount = suggestions.filter((s) => !s.is_read).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center animate-pulse">
          <span className="text-white text-xl">🛒</span>
        </div>
        <p className="text-gray-400 dark:text-gray-500 text-sm">Loading...</p>
      </main>
    );
  }

  const TabBar = () => (
    <div className="flex gap-2 mb-6 p-1 bg-gray-100 dark:bg-slate-800 rounded-2xl">
      {(['weekly', 'monthly'] as const).map((tab) => (
        <button
          key={tab}
          onClick={() => { setActiveTab(tab); setEditMode(false); setPasteMode(false); }}
          className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all capitalize ${
            activeTab === tab
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400'
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );

  // ── USER VIEW ──────────────────────────────────────────────
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
              {copied
                ? <><Check size={14} /> Copied!</>
                : <><Copy size={14} /> Copy</>
              }
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
                  style={{
                    borderBottom: i !== items.length - 1
                      ? '0.5px solid var(--separator)'
                      : 'none',
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: 'var(--accent)' }}
                    />
                    <span className="text-sm" style={{ color: 'var(--text-1)' }}>{item.name}</span>
                  </div>
                  {item.quantity && (
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: 'var(--bg-card-2)',
                        color: 'var(--text-3)',
                      }}
                    >
                      {item.quantity}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

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

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-1)' }}>Grocery</h1>
        <button
          onClick={handleShowSuggestions}
          className="relative p-2.5 rounded-xl transition-all"
          style={{ color: 'var(--text-3)' }}
          title="Member suggestions"
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
        <div
          className="p-4 rounded-xl"
          style={{ backgroundColor: 'var(--red-bg)', border: '0.5px solid var(--red)' }}
        >
          <p className="text-sm" style={{ color: 'var(--red)' }}>{error}</p>
        </div>
      )}

      {/* Suggestions panel */}
      {showSuggestions && (
        <div className="list-group">
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: '0.5px solid var(--separator)' }}
          >
            <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
              Member Suggestions
            </p>
            <button
              onClick={() => setShowSuggestions(false)}
              className="p-1 rounded-lg transition-all"
              style={{ color: 'var(--text-3)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-card-2)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={16} />
            </button>
          </div>
          {suggestions.length === 0 ? (
            <p className="text-center py-8 text-sm" style={{ color: 'var(--text-4)' }}>
              No suggestions yet.
            </p>
          ) : (
            <ul>
              {suggestions.map((s, idx) => (
                <li
                  key={s.id}
                  className="px-4 py-3"
                  style={{
                    borderBottom: idx !== suggestions.length - 1
                      ? '0.5px solid var(--separator)'
                      : 'none',
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                      {s.household_members?.first_name} Bhai
                    </span>
                    <span
                      className="text-xs capitalize px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--bg-card-2)', color: 'var(--text-3)' }}
                    >
                      {s.list_type}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-2)' }}>{s.suggestion}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Paste with AI */}
      {pasteMode ? (
        <div className="list-group p-5">
          <div className="flex items-center gap-2 mb-3">
            <Wand2 size={16} style={{ color: 'var(--accent-2)' }} />
            <p className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>
              Paste your list — AI will format it
            </p>
          </div>
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder="Paste any format — WhatsApp list, notes, random text..."
            rows={6}
            className="input text-sm resize-none"
          />
          <div className="flex gap-3 mt-3">
            <button
              onClick={handleAIPaste}
              disabled={aiProcessing || !pasteText.trim()}
              className="flex-1 text-white font-semibold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all text-sm"
              style={{ backgroundColor: 'var(--accent-2)' }}
            >
              <Wand2 size={15} />
              {aiProcessing ? 'Processing...' : 'Process with AI'}
            </button>
            <button
              onClick={() => { setPasteMode(false); setPasteText(''); }}
              className="btn-secondary flex-1 py-2.5 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>

      ) : editMode ? (
        <div className="space-y-3">
          <div className="list-group">
            <div
              className="px-4 py-3"
              style={{
                borderBottom: '0.5px solid var(--separator)',
                backgroundColor: 'var(--bg-card-2)',
              }}
            >
              <p className="font-semibold text-sm capitalize" style={{ color: 'var(--text-1)' }}>
                Editing {activeTab} List
              </p>
            </div>
            <div>
              {editItems.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-4 py-2.5"
                  style={{
                    borderBottom: i !== editItems.length - 1
                      ? '0.5px solid var(--separator)'
                      : 'none',
                  }}
                >
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => {
                      const updated = [...editItems];
                      updated[i] = { ...updated[i], name: e.target.value };
                      setEditItems(updated);
                    }}
                    placeholder="Item name"
                    className="input text-sm py-1.5"
                    style={{ flex: 1 }}
                  />
                  <input
                    type="text"
                    value={item.quantity}
                    onChange={(e) => {
                      const updated = [...editItems];
                      updated[i] = { ...updated[i], quantity: e.target.value };
                      setEditItems(updated);
                    }}
                    placeholder="Qty"
                    className="input text-sm py-1.5"
                    style={{ width: 80 }}
                  />
                  <button
                    onClick={() => handleRemoveRow(i)}
                    className="p-1.5 rounded-lg transition-all"
                    style={{ color: 'var(--red)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--red-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div
              className="px-4 py-3"
              style={{ borderTop: '0.5px solid var(--separator)' }}
            >
              <button
                onClick={handleAddRow}
                className="flex items-center gap-1.5 text-sm font-semibold"
                style={{ color: 'var(--accent)' }}
              >
                <Plus size={15} /> Add item
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleSaveEdit}
              disabled={saving}
              className="btn-primary flex-1 py-3 text-sm disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save List'}
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="btn-secondary flex-1 py-3 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>

      ) : (
        <div className="space-y-3">
          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleStartEdit}
              className="text-xs font-semibold py-3 rounded-xl transition-all text-white"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              Edit List
            </button>
            <button
              onClick={() => setPasteMode(true)}
              className="text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-1 transition-all text-white"
              style={{ backgroundColor: 'var(--accent-2)' }}
            >
              <Wand2 size={13} /> AI Paste
            </button>
            <button
              onClick={handleCopy}
              className="btn-secondary text-xs py-3 flex items-center justify-center gap-1"
            >
              {copied
                ? <><Check size={13} style={{ color: 'var(--green)' }} /> Copied</>
                : <><Copy size={13} /> Copy</>
              }
            </button>
          </div>

          {/* List */}
          <div className="list-group">
            <div
              className="px-4 py-3"
              style={{ borderBottom: '0.5px solid var(--separator)' }}
            >
              <p className="font-semibold text-sm capitalize" style={{ color: 'var(--text-1)' }}>
                {activeTab} List
                {items.length > 0 && (
                  <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-4)' }}>
                    {items.length} items
                  </span>
                )}
              </p>
            </div>
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: 'var(--text-4)' }}>No items yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-4)', opacity: 0.6 }}>
                  Edit the list or paste with AI
                </p>
              </div>
            ) : (
              <ul>
                {items.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between px-4 py-3"
                    style={{
                      borderBottom: i !== items.length - 1
                        ? '0.5px solid var(--separator)'
                        : 'none',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: 'var(--accent)' }}
                      />
                      <span className="text-sm" style={{ color: 'var(--text-1)' }}>
                        {item.name}
                      </span>
                    </div>
                    {item.quantity && (
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: 'var(--bg-card-2)',
                          color: 'var(--text-3)',
                        }}
                      >
                        {item.quantity}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
    <BottomNav isAdmin={true} />
  </main>
);
}