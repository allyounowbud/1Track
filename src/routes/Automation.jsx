import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/* ---------- tokens ---------- */
const tabBase =
  "inline-flex items-center justify-center h-10 px-4 rounded-xl border border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900 transition";
const tabActive = "bg-indigo-600 text-white border-indigo-600 shadow hover:bg-indigo-600";
const card =
  "rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur p-4 sm:p-6 shadow-[0_10px_30px_rgba(0,0,0,.35)]";

/* ---------- tiny bits ---------- */
const Pill = ({ color = "slate", children }) => (
  <span
    className={`inline-flex items-center gap-1 px-2.5 h-7 rounded-full text-xs font-medium
      ${color === "green" ? "bg-emerald-600/20 text-emerald-300" :
        color === "amber" ? "bg-amber-600/20 text-amber-300" :
        "bg-slate-700/50 text-slate-300"}`}
  >
    {children}
  </span>
);

export default function Automation() {
  const [userInfo, setUserInfo] = useState({ avatar_url: "", username: "" });
  const [emailAcct, setEmailAcct] = useState(null); // { email_address, updated_at } | null
  const connected = !!emailAcct?.email_address;

  useEffect(() => {
    async function loadUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return setUserInfo({ avatar_url: "", username: "" });
      const m = user.user_metadata || {};
      const username =
        m.user_name || m.preferred_username || m.full_name || m.name || user.email || "Account";
      const avatar_url = m.avatar_url || m.picture || "";
      setUserInfo({ avatar_url, username });
    }
    async function loadEmailAcct() {
      const { data, error } = await supabase
        .from("email_accounts")
        .select("email_address, updated_at")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (!error && data?.length) setEmailAcct(data[0]);
      else setEmailAcct(null);
    }
    loadUser();
    loadEmailAcct();
  }, []);


  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link to="/" className="text-3xl font-bold hover:opacity-90">OneTrack</Link>
          <div className="flex items-center gap-3">
            {userInfo.avatar_url ? (
              <img src={userInfo.avatar_url} alt="" className="h-8 w-8 rounded-full border border-slate-800 object-cover"/>
            ) : (
              <div className="h-8 w-8 rounded-full bg-slate-800 grid place-items-center text-slate-300 text-xs">
                {(userInfo.username || "U").slice(0,1).toUpperCase()}
              </div>
            )}
            <div className="hidden sm:block text-sm text-slate-300 max-w-[160px] truncate">{userInfo.username}</div>
            <Link
              to="/"
              className="h-10 px-4 inline-flex items-center justify-center leading-none
                         rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900
                         text-slate-100 cursor-pointer"
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* Tabs for order-book area + link back to hub */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <Link to="/" className={tabBase}>← Hub</Link>
          <NavLink to="/add" className={({isActive}) => `${tabBase} ${isActive ? tabActive : ''}`}>Order Book</NavLink>
          <span className={`${tabBase} ${tabActive}`}>Automations</span>
        </div>

        {/* Emails automation card (email-themed hub style) */}
        <div className={`${card} overflow-hidden relative`}>
          {/* Accent gradient stripe */}
          <div className="absolute inset-x-0 -top-24 h-48 bg-gradient-to-r from-indigo-600/20 via-sky-500/15 to-emerald-500/10 blur-2xl pointer-events-none" />
          {/* Corner pattern */}
          <svg
            className="absolute -right-6 -bottom-6 h-40 w-40 text-slate-800"
            viewBox="0 0 100 100" fill="currentColor" opacity="0.55" aria-hidden
          >
            <circle cx="12" cy="12" r="2" />
            <circle cx="28" cy="12" r="2" />
            <circle cx="44" cy="12" r="2" />
            <circle cx="60" cy="12" r="2" />
            <circle cx="76" cy="12" r="2" />
            <circle cx="12" cy="28" r="2" />
            <circle cx="28" cy="28" r="2" />
            <circle cx="44" cy="28" r="2" />
            <circle cx="60" cy="28" r="2" />
            <circle cx="76" cy="28" r="2" />
            <circle cx="12" cy="44" r="2" />
            <circle cx="28" cy="44" r="2" />
            <circle cx="44" cy="44" r="2" />
            <circle cx="60" cy="44" r="2" />
            <circle cx="76" cy="44" r="2" />
          </svg>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 relative">
            {/* Icon + title */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-indigo-600/20 text-indigo-300 grid place-items-center border border-indigo-600/30">
                <MailSparkIcon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-lg font-semibold leading-tight">Emails</div>
                <div className="text-slate-400 text-xs mt-0.5">Auto-import orders & shipping updates</div>
              </div>
            </div>

            {/* Status pill */}
            <div className="sm:ml-auto">
              {connected ? (
                <Pill color="green">
                  <Dot className="h-3 w-3" /> Connected · {emailAcct.email_address}
                </Pill>
              ) : (
                <Pill>
                  <Dot className="h-3 w-3" /> Not connected
                </Pill>
              )}
            </div>
          </div>

          <p className="text-slate-300 text-sm mt-3 max-w-2xl">
            Link your mailbox and let OneTrack pull <span className="text-slate-100 font-medium">order confirmations</span>,
            <span className="text-slate-100 font-medium"> shipping</span>, and <span className="text-slate-100 font-medium">delivery</span> emails automatically.
            We normalize them into a single order timeline you can track.
          </p>

          {/* CTA row */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Link
              to="/emails"
              className="h-11 px-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
            >
              Open Emails
            </Link>
            <Link
              to="/emails"
              className="h-11 px-5 rounded-2xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100"
            >
              Configure
            </Link>
          </div>

          {/* Mini preview stripe */}
          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MailTiny className="h-4 w-4" />
              <span className="truncate">“Thanks for your order #114-8261726… — Amazon”</span>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div className="h-full w-2/3 bg-gradient-to-r from-indigo-600 via-sky-500 to-emerald-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------- icons ----------- */
function MailSparkIcon({ className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
      <path d="M12 3v2M7 3l1 2M17 3l-1 2" />
    </svg>
  );
}
function Dot({ className = "h-3 w-3" }) {
  return (
    <svg viewBox="0 0 10 10" className={className} fill="currentColor">
      <circle cx="5" cy="5" r="5" />
    </svg>
  );
}
function MailTiny({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  );
}
