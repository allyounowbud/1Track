// src/routes/Profiles.jsx
import { useState } from "react";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { card } from "../utils/ui";

// Icons
const UserIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const AddIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
  </svg>
);

const ImportIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
  </svg>
);

const ExportIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
  </svg>
);

/* --------------------------------- page --------------------------------- */
export default function Profiles() {
  const [profiles] = useState([]); // Placeholder for future profiles data
  const connected = profiles.length > 0;

  return (
    <LayoutWithSidebar active="profiles" section="profiles">
      <PageHeader title="Profiles" />

      {/* Stats Cards */}
      {connected && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">{profiles.length}</div>
                <div className="text-sm text-slate-400">Total Profiles</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
                <UserIcon className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">{profiles.length}</div>
                <div className="text-sm text-slate-400">Active Profiles</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-fuchsia-600/20 flex items-center justify-center">
                <svg className="h-5 w-5 text-fuchsia-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-100">0</div>
                <div className="text-sm text-slate-400">Recent Activity</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Management */}
      <div className={`${card} mb-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <UserIcon className="h-5 w-5" />
              Profile Management
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Manage customer profiles and contact information for better order tracking and communication.
            </p>
          </div>
          {connected && (
            <div className="flex items-center gap-2 shrink-0">
              <button className="h-10 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-slate-100 font-medium transition-colors inline-flex items-center justify-center" title="Import Profiles">
                <ImportIcon className="h-4 w-4" />
              </button>
              <button className="h-10 px-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-slate-100 font-medium transition-colors inline-flex items-center justify-center" title="Export Profiles">
                <ExportIcon className="h-4 w-4" />
              </button>
              <button className="h-10 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors inline-flex items-center gap-2">
                <AddIcon className="h-4 w-4" />
                Add Profile
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Connected Profiles */}
      {connected ? (
        <div className={`${card} mb-6`}>
          {/* Profiles List */}
          {profiles.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              No profiles created yet.
            </div>
          ) : (
            <div className="space-y-2">
              {profiles.map((profile) => (
                <div
                  key={profile.id}
                  className="flex items-center gap-4 p-4 rounded-xl border border-slate-700 hover:border-slate-600 bg-slate-800/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0"></div>
                      <div className="text-slate-200 font-medium truncate">{profile.name}</div>
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {profile.email} • {profile.phone}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-purple-600/20 text-purple-400 px-2 py-1 rounded-lg">
                      Active
                    </span>
                    <button
                      className="h-8 w-8 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-slate-100 transition-colors flex items-center justify-center"
                      title="Edit Profile"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
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
              <UserIcon className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p className="text-xl font-medium">No Profiles Created</p>
              <p className="text-sm mt-2">Create your first customer profile to start tracking contact information and order history.</p>
            </div>
            <button className="mt-6 h-12 px-6 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors inline-flex items-center gap-2">
              <AddIcon className="h-5 w-5" />
              Create First Profile
            </button>
          </div>
        </div>
      )}

    </LayoutWithSidebar>
  );
}
