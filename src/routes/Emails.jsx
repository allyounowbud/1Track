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


const SyncIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
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

async function getEmailStats() {
  const { data, error } = await supabase
    .from("emails")
    .select("id, processed_at, order_id")
    .not("processed_at", "is", null);
  if (error) throw error;
  return data || [];
}

/* --------------------------------- page --------------------------------- */
export default function Emails() {
  const { data: accounts = [], refetch: refetchAccounts } = useQuery({ 
    queryKey: ["email-accounts"], 
    queryFn: getEmailAccounts 
  });
  
  const { data: emailStats = [] } = useQuery({ 
    queryKey: ["email-stats"], 
    queryFn: getEmailStats 
  });

  const connected = !!accounts.length;
  const gmailAccounts = accounts.filter(acc => acc.provider.startsWith('gmail'));
  
  // Calculate stats
  const totalProcessed = emailStats.length;
  const todayProcessed = emailStats.filter(email => {
    const today = new Date().toDateString();
    return new Date(email.processed_at).toDateString() === today;
  }).length;

  /* ------------------ controls ------------------ */


  async function connectGmail() {
    try {
      // Get the current user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Please log in first");
        return;
      }
      
      // Pass the user ID to the OAuth flow
      window.location.href = `/.netlify/functions/gmail-auth-start?uid=${encodeURIComponent(user.id)}`;
    } catch (e) {
      alert(`Failed to start Gmail connection: ${e.message}`);
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
      } catch (e) {
        alert(`Failed to disconnect: ${e.message}`);
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
    } catch (e) {
        alert(`Failed to disconnect: ${e.message}`);
      }
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
              <MailIcon className="h-4 w-4" />
                Emails
              </div>
            </div>
        </div>

        {/* Stats Cards */}
        {connected && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                  <MailIcon className="h-5 w-5 text-slate-300" />
            </div>
                <div>
                  <div className="text-2xl font-bold text-slate-100">{connected ? gmailAccounts.length : 0}</div>
                  <div className="text-sm text-slate-400">Connected Accounts</div>
            </div>
          </div>
        </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                  <SyncIcon className="h-5 w-5 text-slate-300" />
                    </div>
                <div>
                  <div className="text-2xl font-bold text-slate-100">{totalProcessed}</div>
                  <div className="text-sm text-slate-400">Emails Processed</div>
                      </div>
                    </div>
                  </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-700/50 flex items-center justify-center">
                  <svg className="h-5 w-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                      </div>
                          <div>
                  <div className="text-2xl font-bold text-slate-100">{todayProcessed}</div>
                  <div className="text-sm text-slate-400">Today</div>
                            </div>
                          </div>
                        </div>
                      </div>
        )}

        {/* Email Management */}
        <div className={`${card} mb-6`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <MailIcon className="h-5 w-5" />
                Gmail Account Management
                        </div>
              <p className="text-slate-400 text-sm mt-1">
                Connect multiple Gmail accounts to automatically import order confirmations and shipping updates.
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
                {connected ? "Add Email" : "Connect Gmail"}
              </button>
                        </div>
                        </div>
                      </div>

        {/* Connected Accounts */}
        {connected ? (
          <div className={`${card} mb-6`}>
            {/* Accounts List */}
            {gmailAccounts.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No Gmail accounts connected.
              </div>
            ) : (
              <div className="space-y-2">
                {gmailAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/50 transition-colors"
                  >
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
                        onClick={() => disconnectGmail(account.id)}
                        className="h-8 w-8 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 transition-colors flex items-center justify-center"
                        title="Disconnect"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        ) : (
          <div className={`${card} mb-6`}>
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

    </div>
    </div>
  );
}