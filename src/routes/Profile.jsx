// src/routes/Profile.jsx
import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../contexts/ThemeContext";
import LayoutWithSidebar from "../components/LayoutWithSidebar.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { pageCard, rowCard, inputSm, headerIconBtn, headerGhostBtn, iconSave, iconSaveBusy, iconDelete } from "../utils/ui.js";

export default function Profile() {
  const navigate = useNavigate();
  const userInfo = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  
  // Settings state
  const [discordWebhook, setDiscordWebhook] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Load saved settings from localStorage
  useState(() => {
    const savedWebhook = localStorage.getItem('discord-webhook');
    if (savedWebhook) {
      setDiscordWebhook(savedWebhook);
    }
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.removeItem('user-info');
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
      alert('Error signing out. Please try again.');
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      // Save Discord webhook to localStorage
      localStorage.setItem('discord-webhook', discordWebhook);
      
      // Here you could also save to a user settings table in Supabase
      // const { error } = await supabase
      //   .from('user_settings')
      //   .upsert({ 
      //     user_id: user.id, 
      //     discord_webhook: discordWebhook 
      //   });
      
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Export order book data
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('*');
      
      if (ordersError) throw ordersError;

      // Export items data
      const { data: items, error: itemsError } = await supabase
        .from('items')
        .select('*');
      
      if (itemsError) throw itemsError;

      // Export retailers data
      const { data: retailers, error: retailersError } = await supabase
        .from('retailers')
        .select('*');
      
      if (retailersError) throw retailersError;

      // Export marketplaces data
      const { data: marketplaces, error: marketplacesError } = await supabase
        .from('marketplaces')
        .select('*');
      
      if (marketplacesError) throw marketplacesError;

      // Create export data object
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        data: {
          orders: orders || [],
          items: items || [],
          retailers: retailers || [],
          marketplaces: marketplaces || []
        }
      };

      // Create and download file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `onetrack-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('Data exported successfully!');
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportData = async () => {
    if (!fileInputRef.current?.files[0]) {
      alert('Please select a file to import.');
      return;
    }

    setIsImporting(true);
    try {
      const file = fileInputRef.current.files[0];
      const text = await file.text();
      const importData = JSON.parse(text);

      // Validate import data structure
      if (!importData.data || !importData.version) {
        throw new Error('Invalid backup file format.');
      }

      // Confirm import
      if (!confirm('This will replace all your current data. Are you sure you want to continue?')) {
        return;
      }

      // Import data in order (dependencies first)
      if (importData.data.retailers?.length > 0) {
        const { error: retailersError } = await supabase
          .from('retailers')
          .upsert(importData.data.retailers);
        if (retailersError) throw retailersError;
      }

      if (importData.data.marketplaces?.length > 0) {
        const { error: marketplacesError } = await supabase
          .from('marketplaces')
          .upsert(importData.data.marketplaces);
        if (marketplacesError) throw marketplacesError;
      }

      if (importData.data.items?.length > 0) {
        const { error: itemsError } = await supabase
          .from('items')
          .upsert(importData.data.items);
        if (itemsError) throw itemsError;
      }

      if (importData.data.orders?.length > 0) {
        const { error: ordersError } = await supabase
          .from('orders')
          .upsert(importData.data.orders);
        if (ordersError) throw ordersError;
      }

      alert('Data imported successfully! Please refresh the page to see your data.');
      window.location.reload();
    } catch (error) {
      console.error('Error importing data:', error);
      alert(`Error importing data: ${error.message}`);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <LayoutWithSidebar active="profile" section="profile">
      {/* Mobile App Style Header */}
      <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700/50">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Profile & Settings</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Manage your account and application settings
        </p>
      </div>

      {/* iPhone-style Settings Content */}
      <div className="px-4 py-4 space-y-6">
        {/* Account Card */}
        <div className="bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
          <div className="p-6">
            <div className="flex items-center gap-4">
              {userInfo.avatar_url ? (
                <img
                  src={userInfo.avatar_url}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700/50 flex items-center justify-center text-gray-600 dark:text-slate-300 text-2xl font-semibold">
                  {(userInfo.username || "U").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {userInfo.username || "User"}
                </h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Beta User
                </p>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-200/50 dark:border-gray-700/50">
            <button
              onClick={handleSignOut}
              className="w-full px-6 py-4 text-left text-red-500 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Appearance Settings */}
        <div className="bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
          <div className="px-6 py-3">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Appearance</h3>
          </div>
          <div className="border-t border-gray-200/50 dark:border-gray-700/50">
            <button
              onClick={toggleTheme}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isDark ? (
                  <svg className="h-5 w-5 text-gray-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-gray-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
                <span className="text-gray-900 dark:text-white font-medium">
                  {isDark ? 'Dark Mode' : 'Light Mode'}
                </span>
              </div>
              <div className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isDark ? 'bg-blue-500' : 'bg-gray-300'
              }`}>
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  isDark ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </div>
            </button>
          </div>
        </div>

        {/* Notifications Settings */}
        <div className="bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
          <div className="px-6 py-3">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Notifications</h3>
          </div>
          <div className="border-t border-gray-200/50 dark:border-gray-700/50">
            <div className="px-6 py-4">
              <label htmlFor="discord-webhook" className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Discord Webhook
              </label>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                Get notified when orders are marked as sold
              </p>
              <input
                id="discord-webhook"
                type="url"
                value={discordWebhook}
                onChange={(e) => setDiscordWebhook(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                className="w-full px-3 py-2 text-sm border border-gray-300/50 dark:border-gray-600/50 rounded-lg bg-white/50 dark:bg-gray-700/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
              />
            </div>
            <div className="border-t border-gray-200/50 dark:border-gray-700/50">
              <button
                onClick={handleSaveSettings}
                disabled={isSaving}
                className="w-full px-6 py-4 text-left text-blue-500 hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save Settings
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white/80 dark:bg-gray-800/50 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
          <div className="px-6 py-3">
            <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Data</h3>
          </div>
          <div className="border-t border-gray-200/50 dark:border-gray-700/50">
            <button
              onClick={handleExportData}
              disabled={isExporting}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <svg className="h-5 w-5 text-gray-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-gray-900 dark:text-white font-medium">
                  {isExporting ? 'Exporting...' : 'Export Data'}
                </span>
              </div>
              {isExporting && (
                <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
            </button>
          </div>
          <div className="border-t border-gray-200/50 dark:border-gray-700/50">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportData}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 dark:hover:bg-gray-700/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-gray-600 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {isImporting ? 'Importing...' : 'Import Data'}
                  </span>
                </div>
                {isImporting && (
                  <svg className="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </LayoutWithSidebar>
  );
}
