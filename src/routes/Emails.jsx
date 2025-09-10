// src/routes/Emails.jsx
import { useState } from "react";
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

        {/* Back to Hub */}
        <div className="mb-6">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Hub
          </Link>
        </div>

        {/* Connect / Sync */}
        <div className={`${card} mb-6`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <MailIcon className="h-5 w-5" />
                Emails
              </div>
              <p className="text-slate-400 text-sm mt-1">
                Connect multiple Gmail accounts to automatically import order confirmations and shipping updates from all connected accounts. We link shipping emails to their orders by order # and tracking number.
              </p>
              {connected && (
                <div className="mt-3 p-3 rounded-xl border border-slate-700 bg-slate-800/50">
                  <div className="text-slate-200 text-sm font-medium mb-2">📧 Connected Gmail Accounts</div>
                  {gmailAccounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between gap-3 py-2 px-2 rounded-lg bg-slate-700/50">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-green-500"></div>
                        <span className="text-slate-100 font-medium">{account.email_address}</span>
                      </div>
                      <button
                        onClick={() => disconnectGmail(account.id)}
                        className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={connectGmail} className="h-11 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium">
                {connected ? "Connect Another Gmail" : "Connect Gmail"}
              </button>
              {connected && (
                <>
                  <button onClick={() => syncNow()} disabled={syncing} className="h-11 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-medium">
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                  {gmailAccounts.length > 1 && (
                    <button onClick={() => disconnectGmail()} className="h-11 px-5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-medium">
                      Disconnect All
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {syncMsg && <div className="mt-3 text-sm text-slate-300">{syncMsg}</div>}
        </div>

        {/* Email Management Complete */}
        <div className={`${card}`}>
          <div className="text-center py-8">
            <div className="text-slate-400 mb-4">
              <MailIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-lg font-medium">Email Management</p>
              <p className="text-sm">Your Gmail accounts are connected and ready to sync.</p>
            </div>
            <p className="text-xs text-slate-500">
              View and manage your shipments on the <Link to="/shipments" className="text-indigo-400 hover:text-indigo-300">Shipments</Link> tab.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}