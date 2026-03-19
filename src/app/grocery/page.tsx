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
  if (userRole === 'user') {
    return (
      <main
        className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-28"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Grocery</h1>

          <TabBar />

          {/* List */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
              <p className="font-semibold text-gray-900 dark:text-white capitalize text-sm">
                {activeTab} List
              </p>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
              >
                {copied
                  ? <><Check size={14} className="text-green-500" /> Copied!</>
                  : <><Copy size={14} /> Copy</>
                }
              </button>
            </div>
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-gray-400 dark:text-gray-600 text-sm">No items yet</p>
              </div>
            ) : (
              <ul>
                {items.map((item, i) => (
                  <li
                    key={i}
                    className={`flex items-center justify-between px-4 py-3 ${i !== items.length - 1 ? 'border-b border-gray-100 dark:border-slate-800' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      <span className="text-gray-900 dark:text-white text-sm">{item.name}</span>
                    </div>
                    {item.quantity && (
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {item.quantity}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Suggestion box */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-4">
            <p className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">
              Suggest something
            </p>
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder={`Suggest items for the ${activeTab} list...`}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex items-center justify-between mt-3">
              {suggestionSent && (
                <p className="text-green-600 dark:text-green-400 text-xs font-semibold">✓ Sent!</p>
              )}
              <button
                onClick={handleSubmitSuggestion}
                disabled={submittingSuggestion || !suggestionText.trim()}
                className="ml-auto bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl disabled:opacity-50 transition-all"
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
      className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-28"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Grocery</h1>
          <button
            onClick={handleShowSuggestions}
            className="relative p-2.5 text-gray-500 hover:text-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-all"
            title="Member suggestions"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <TabBar />

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Suggestions panel */}
        {showSuggestions && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-800">
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Member Suggestions</p>
              <button
                onClick={() => setShowSuggestions(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            </div>
            {suggestions.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">No suggestions yet.</p>
            ) : (
              <ul>
                {suggestions.map((s, idx) => (
                  <li
                    key={s.id}
                    className={`px-4 py-3 ${idx !== suggestions.length - 1 ? 'border-b border-gray-100 dark:border-slate-800' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                        {s.household_members?.first_name} Bhai
                      </span>
                      <span className="text-xs text-gray-400 capitalize bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {s.list_type}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">{s.suggestion}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Paste with AI */}
        {pasteMode ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Wand2 size={16} className="text-purple-500" />
              <p className="font-semibold text-gray-900 dark:text-white text-sm">
                Paste your list — AI will format it
              </p>
            </div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste any format — WhatsApp list, notes, random text..."
              rows={6}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <div className="flex gap-3 mt-3">
              <button
                onClick={handleAIPaste}
                disabled={aiProcessing || !pasteText.trim()}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2.5 rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-all text-sm"
              >
                <Wand2 size={15} />
                {aiProcessing ? 'Processing...' : 'Process with AI'}
              </button>
              <button
                onClick={() => { setPasteMode(false); setPasteText(''); }}
                className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-semibold py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all text-sm"
              >
                Cancel
              </button>
            </div>
          </div>

        ) : editMode ? (
          <div className="space-y-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                <p className="font-semibold text-gray-900 dark:text-white text-sm capitalize">
                  Editing {activeTab} List
                </p>
              </div>
              <div>
                {editItems.map((item, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 px-4 py-2.5 ${i !== editItems.length - 1 ? 'border-b border-gray-100 dark:border-slate-800' : ''}`}
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
                      className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-20 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleRemoveRow(i)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-gray-100 dark:border-slate-800">
                <button
                  onClick={handleAddRow}
                  className="flex items-center gap-1.5 text-sm text-blue-600 dark:text-blue-400 font-semibold hover:text-blue-700"
                >
                  <Plus size={15} /> Add item
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl disabled:opacity-50 transition-all text-sm"
              >
                {saving ? 'Saving...' : 'Save List'}
              </button>
              <button
                onClick={() => setEditMode(false)}
                className="flex-1 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-semibold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-all text-sm"
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
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold py-3 rounded-xl transition-all"
              >
                Edit List
              </button>
              <button
                onClick={() => setPasteMode(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold py-3 rounded-xl flex items-center justify-center gap-1 transition-all"
              >
                <Wand2 size={13} /> AI Paste
              </button>
              <button
                onClick={handleCopy}
                className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 text-xs font-semibold py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 flex items-center justify-center gap-1 transition-all"
              >
                {copied ? <><Check size={13} className="text-green-500" /> Copied</> : <><Copy size={13} /> Copy</>}
              </button>
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-800">
                <p className="font-semibold text-gray-900 dark:text-white text-sm capitalize">
                  {activeTab} List
                  {items.length > 0 && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">{items.length} items</span>
                  )}
                </p>
              </div>
              {items.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-gray-400 dark:text-gray-600 text-sm">No items yet</p>
                  <p className="text-gray-300 dark:text-gray-700 text-xs mt-1">Edit the list or paste with AI</p>
                </div>
              ) : (
                <ul>
                  {items.map((item, i) => (
                    <li
                      key={i}
                      className={`flex items-center justify-between px-4 py-3 ${i !== items.length - 1 ? 'border-b border-gray-100 dark:border-slate-800' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                        <span className="text-gray-900 dark:text-white text-sm">{item.name}</span>
                      </div>
                      {item.quantity && (
                        <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
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