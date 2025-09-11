// src/routes/Emails.jsx
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import HeaderWithTabs from "../components/HeaderWithTabs";
import { card } from "../utils/ui";

// Icons
const MailIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);

// Helper functions
async function getEmailAccounts() {
  const { data, error } = await supabase
    .from("email_accounts")
    .select("id, email_address, provider, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

/* --------------------------------- page --------------------------------- */
export default function Emails() {
  const { data: accounts = [], refetch: refetchAccounts } = useQuery({ queryKey: ["email-accounts"], queryFn: getEmailAccounts });

  const connected = !!accounts.length;
  const gmailAccounts = accounts.filter(acc => acc.provider.startsWith('gmail'));

  /* ------------------ controls ------------------ */
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");
  const [selectedAccounts, setSelectedAccounts] = useState(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Filter accounts based on search
  const filteredAccounts = useMemo(() => {
    if (!searchQuery.trim()) return gmailAccounts;
    return gmailAccounts.filter(account => 
      account.email_address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [gmailAccounts, searchQuery]);

  // Handle account selection
  const toggleAccountSelection = (accountId) => {
    const newSelected = new Set(selectedAccounts);
    if (newSelected.has(accountId)) {
      newSelected.delete(accountId);
    } else {
      newSelected.add(accountId);
    }
    setSelectedAccounts(newSelected);
  };

  const selectAllAccounts = () => {
    if (selectedAccounts.size === filteredAccounts.length) {
      setSelectedAccounts(new Set());
    } else {
      setSelectedAccounts(new Set(filteredAccounts.map(acc => acc.id)));
    }
  };

  const bulkDisconnect = () => {
    if (selectedAccounts.size === 0) return;
    
    const accountNames = filteredAccounts
      .filter(acc => selectedAccounts.has(acc.id))
      .map(acc => acc.email_address)
      .join(', ');
    
    if (!confirm(`Are you sure you want to disconnect ${selectedAccounts.size} account(s): ${accountNames}?`)) {
      return;
    }
    
    // Disconnect selected accounts
    selectedAccounts.forEach(async (accountId) => {
      try {
        const { error } = await supabase
          .from("email_accounts")
          .delete()
          .eq("id", accountId);
        
        if (error) throw error;
      } catch (e) {
        setSyncMsg(`Failed to disconnect account: ${e.message}`);
      }
    });
    
    setSelectedAccounts(new Set());
    refetchAccounts();
    setSyncMsg(`${selectedAccounts.size} account(s) disconnected successfully`);
  };

  async function connectGmail() {
    try {
      // Get the current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setSyncMsg("Please log in first");
        return;
      }
      
      // Pass the user ID to the OAuth flow
      window.location.href = `/.netlify/functions/gmail-auth-start?uid=${encodeURIComponent(user.id)}`;
    } catch (e) {
      setSyncMsg(`Failed to start Gmail connection: ${e.message}`);
    }
  }

  async function disconnectGmail(accountId = null) {
    if (accountId) {
      // Disconnect specific account
      const account = gmailAccounts.find(acc => acc.id === accountId);
      if (!account) return;
      
      if (!confirm(`Are you sure you want to disconnect ${account.email_address}?`)) {
        return;
      }
      
      try {
        const { error } = await supabase
          .from("email_accounts")
          .delete()
          .eq("id", accountId);
        
        if (error) throw error;
        
        await refetchAccounts();
        setSyncMsg(`Gmail account ${account.email_address} disconnected successfully`);
      } catch (e) {
        setSyncMsg(`Failed to disconnect: ${e.message}`);
      }
    } else {
      // Disconnect all Gmail accounts
      if (!confirm("Are you sure you want to disconnect all Gmail accounts? This will stop automatic email syncing.")) {
        return;
      }
      
      try {
        const { error } = await supabase
          .from("email_accounts")
          .delete()
          .like("provider", "gmail%");
        
        if (error) throw error;
        
        await refetchAccounts();
        setSyncMsg("All Gmail accounts disconnected successfully");
    } catch (e) {
        setSyncMsg(`Failed to disconnect: ${e.message}`);
      }
    }
  }

  async function syncNow({ silent = false, label } = {}) {
    if (syncing) return;
    
    setSyncing(true);
    if (!silent) setSyncMsg("Syncing emails...");
    
    try {
      const response = await fetch(`/.netlify/functions/gmail-sync?mode=${label || 'sync'}`);
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      if (!silent) {
        setSyncMsg(`Sync complete: ${result.imported || 0} imported, ${result.updated || 0} updated`);
        setTimeout(() => setSyncMsg(""), 3000);
      }
    } catch (e) {
      setSyncMsg(`Sync failed: ${e.message}`);
      setTimeout(() => setSyncMsg(""), 5000);
    } finally {
      setSyncing(false);
    }
  }

  /* ------------------------------- render ------------------------------- */
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-[95vw] mx-auto p-4 sm:p-6">
        <HeaderWithTabs active="emails" showTabs={false} section="automations" />

        {/* Navigation Tabs */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Link 
              to="/" 
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Hub
            </Link>
            <Link 
              to="/shipments" 
              className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-600 bg-slate-800/60 text-slate-200 hover:bg-slate-700 hover:border-slate-500 transition"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Shipments
            </Link>
            <div className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-500 bg-slate-700/60 text-slate-100">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Emails
            </div>
          </div>
        </div>

        {/* Email Management */}
        <div className={`${card} mb-6`}>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <MailIcon className="h-5 w-5" />
                Email Management
              </div>
              <p className="text-slate-400 text-sm mt-1">
                Connect multiple Gmail accounts to automatically import order confirmations and shipping updates from all connected accounts.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button 
                onClick={connectGmail} 
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors inline-flex items-center gap-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                {connected ? "Connect Another" : "Connect Gmail"}
                </button>
              {connected && (
                <button 
                  onClick={() => syncNow()} 
                  disabled={syncing} 
                  className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium transition-colors inline-flex items-center gap-2"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {syncing ? "Syncing…" : "Sync Now"}
                  </button>
              )}
            </div>
          </div>
          {syncMsg && <div className="mb-4 p-3 rounded-xl bg-slate-800/50 border border-slate-700 text-sm text-slate-300">{syncMsg}</div>}
        </div>

        {/* Connected Accounts */}
        {connected ? (
          <div className={`${card}`}>
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative">
                <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              <input
                  type="text"
                  placeholder="Search email accounts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                {searchQuery && (
                          <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-300"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                          </button>
                )}
                    </div>
                  </div>

            {/* Header with Bulk Actions */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={filteredAccounts.length > 0 && selectedAccounts.size === filteredAccounts.length}
                    onChange={selectAllAccounts}
                    className="h-4 w-4 text-indigo-600 bg-slate-800 border-slate-600 rounded focus:ring-indigo-500 focus:ring-2"
                  />
                  <span className="text-sm text-slate-400">
                    {selectedAccounts.size > 0 ? `${selectedAccounts.size}/${filteredAccounts.length} selected` : `${filteredAccounts.length} accounts`}
                  </span>
                        </div>
                      </div>

              {selectedAccounts.size > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={bulkDisconnect}
                    className="h-8 px-3 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium transition-colors inline-flex items-center gap-1"
                  >
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Disconnect
                  </button>
                </div>
                          )}
                        </div>

            {/* Accounts List */}
            {filteredAccounts.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                {searchQuery ? 'No accounts match your search.' : 'No Gmail accounts connected.'}
                      </div>
            ) : (
              <div className="space-y-2">
                {filteredAccounts.map((account) => {
                  const isSelected = selectedAccounts.has(account.id);
                  return (
                    <div
                      key={account.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border transition-colors cursor-pointer ${
                        isSelected 
                          ? 'border-indigo-500 bg-indigo-500/10' 
                          : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'
                      }`}
                      onClick={() => toggleAccountSelection(account.id)}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAccountSelection(account.id)}
                        className="h-4 w-4 text-indigo-600 bg-slate-800 border-slate-600 rounded focus:ring-indigo-500 focus:ring-2"
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></div>
                          <div className="text-slate-200 font-medium truncate">{account.email_address}</div>
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          Connected {new Date(account.updated_at).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded-lg">
                          Active
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            disconnectGmail(account.id);
                          }}
                          className="h-8 px-3 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 text-sm font-medium transition-colors inline-flex items-center gap-1"
                        >
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Disconnect
                        </button>
                  </div>
                </div>
              );
            })}
          </div>
            )}
        </div>
        ) : (
          <div className={`${card}`}>
            <div className="text-center py-12">
              <div className="text-slate-400 mb-4">
                <MailIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-xl font-medium">No Gmail Accounts Connected</p>
                <p className="text-sm mt-2">Connect your Gmail accounts to start automatically importing order confirmations and shipping updates.</p>
            </div>
              <button
                onClick={connectGmail} 
                className="mt-6 h-12 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors inline-flex items-center gap-2"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Connect Your First Gmail Account
              </button>
            </div>
          </div>
        )}

        {/* Link to Shipments */}
        {connected && (
          <div className={`${card} mt-6`}>
            <div className="text-center py-6">
              <p className="text-sm text-slate-400">
                View and manage your shipments on the <Link to="/shipments" className="text-indigo-400 hover:text-indigo-300 font-medium">Shipments</Link> tab.
              </p>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}