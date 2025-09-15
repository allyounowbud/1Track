import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import BatchSync from '../components/BatchSync';
import StreamingSync from '../components/StreamingSync';

// Admin function to check CSV status
async function checkCSVStatus(category) {
  console.log(`Checking CSV status for category: ${category}`);
  
  const response = await fetch('/.netlify/functions/csv-download-chunked', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, action: 'status' })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  const responseText = await response.text();
  if (!responseText) {
    throw new Error('Empty response from server');
  }
  
  return JSON.parse(responseText);
}

// Admin function to trigger CSV download
async function triggerCSVDownload(category) {
  console.log(`Triggering CSV download for category: ${category}`);
  
  const response = await fetch('/.netlify/functions/csv-download-chunked', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, action: 'download' })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  const responseText = await response.text();
  if (!responseText) {
    throw new Error('Empty response from server');
  }
  
  return JSON.parse(responseText);
}

// Admin function to trigger efficient CSV sync
async function triggerEfficientSync(category, clearExisting = false) {
  console.log(`Triggering efficient sync for category: ${category}`);
  
  const response = await fetch('/.netlify/functions/csv-sync-efficient', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, clearExisting })
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  const responseText = await response.text();
  console.log('Efficient sync response:', responseText);
  
  return JSON.parse(responseText);
}

// Get download logs
async function getDownloadLogs() {
  const { data, error } = await supabase
    .from('csv_download_logs')
    .select('*')
    .order('downloaded_at', { ascending: false })
    .limit(50);
  
  if (error) throw error;
  return data;
}

// Get product counts by category
async function getProductCounts() {
  const { data, error } = await supabase
    .from('price_charting_products')
    .select('category, downloaded_at')
    .order('downloaded_at', { ascending: false });
  
  if (error) throw error;
  
  // Count products by category
  const counts = {};
  data.forEach(product => {
    if (!counts[product.category]) {
      counts[product.category] = {
        count: 0,
        lastUpdated: product.downloaded_at
      };
    }
    counts[product.category].count++;
  });
  
  return counts;
}

export default function Admin() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  // Queries
  const { data: logs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['downloadLogs'],
    queryFn: getDownloadLogs,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const { data: counts = {}, refetch: refetchCounts } = useQuery({
    queryKey: ['productCounts'],
    queryFn: getProductCounts,
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'success':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'error':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Product Database Admin</h1>
          <p className="text-slate-400">Manage CSV sync operations and monitor database status</p>
        </div>

        {/* Database Status Overview */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            Database Status
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(counts).map(([category, data]) => (
              <div key={category} className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
                <div className="text-sm text-slate-400 mb-1">
                  {category.replace('_', ' ').toUpperCase()}
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {data.count.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500">
                  Last updated: {formatDate(data.lastUpdated)}
                </div>
              </div>
            ))}
            
            {Object.keys(counts).length === 0 && (
              <div className="col-span-full text-center text-slate-500 py-8">
                No products found in database
              </div>
            )}
          </div>
        </div>

        {/* Sync Operations */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            Sync Operations
          </h2>
          
          <div className="space-y-6">
            {/* Current Status */}
            {syncStatus && (
              <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4">
                <div className="text-sm font-medium text-slate-300 mb-1">Current Operation</div>
                <div className="text-slate-100">{syncStatus}</div>
              </div>
            )}

            {/* Sync Methods */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Streaming Sync - Recommended */}
              <div className="bg-slate-800/30 rounded-lg border border-slate-700 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <h3 className="font-semibold text-white">Streaming Sync</h3>
                  <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-1 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  Processes CSV in small batches (200 lines at a time) to avoid timeouts. 
                  Best for large datasets like Pokemon cards (71,349 products).
                </p>
                <StreamingSync 
                  category="pokemon_cards" 
                  onComplete={(count) => {
                    setSyncStatus(`✅ Streaming sync completed: ${count.toLocaleString()} products processed`);
                    refetchCounts();
                    refetchLogs();
                  }}
                />
              </div>

              {/* Batch Sync */}
              <div className="bg-slate-800/30 rounded-lg border border-slate-700 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <h3 className="font-semibold text-white">Batch Sync</h3>
                  <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full">
                    Legacy
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  Original batch processing method. May timeout on large datasets 
                  but useful for smaller categories.
                </p>
                <BatchSync 
                  category="pokemon_cards" 
                  onComplete={(count) => {
                    setSyncStatus(`✅ Batch sync completed: ${count.toLocaleString()} products processed`);
                    refetchCounts();
                    refetchLogs();
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Debug Tools */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            Debug Tools
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button
              onClick={async () => {
                setIsSyncing(true);
                setSyncStatus('Running basic connectivity test...');
                try {
                  const response = await fetch('/.netlify/functions/test-basic', {
                    method: 'GET'
                  });
                  const result = await response.json();
                  if (result.success) {
                    setSyncStatus(`✅ Basic test successful: ${result.message}`);
                  } else {
                    setSyncStatus(`❌ Basic test failed: ${result.error}`);
                  }
                } catch (error) {
                  setSyncStatus(`❌ Basic test failed: ${error.message}`);
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 rounded text-sm transition-colors"
            >
              Basic Test
            </button>

            <button
              onClick={async () => {
                setIsSyncing(true);
                setSyncStatus('Testing CSV URL accessibility...');
                try {
                  const response = await fetch('/.netlify/functions/test-csv-head', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                  });
                  const result = await response.json();
                  if (result.success) {
                    setSyncStatus(`✅ CSV accessible: ${result.message}`);
                  } else {
                    setSyncStatus(`❌ CSV test failed: ${result.error}`);
                  }
                } catch (error) {
                  setSyncStatus(`❌ CSV test failed: ${error.message}`);
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 rounded text-sm transition-colors"
            >
              Test CSV URL
            </button>

            <button
              onClick={async () => {
                setIsSyncing(true);
                setSyncStatus('Running minimal CSV test (10 products)...');
                try {
                  const response = await fetch('/.netlify/functions/test-csv-minimal', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                  });
                  const result = await response.json();
                  if (result.success) {
                    setSyncStatus(`✅ Minimal test successful: ${result.message}`);
                    refetchCounts();
                  } else {
                    setSyncStatus(`❌ Minimal test failed: ${result.error}`);
                  }
                } catch (error) {
                  setSyncStatus(`❌ Minimal test failed: ${error.message}`);
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 rounded text-sm transition-colors"
            >
              Minimal Test
            </button>

            <button
              onClick={async () => {
                setIsSyncing(true);
                setSyncStatus('Analyzing database contents...');
                try {
                  const response = await fetch('/.netlify/functions/database-analysis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                  });
                  const result = await response.json();
                  if (result.success) {
                    const categoryBreakdown = Object.entries(result.uniqueCategories || result.categoryAnalysis)
                      .map(([cat, count]) => `${cat}: ${count.toLocaleString()}`)
                      .join(', ');
                    setSyncStatus(`✅ Database Analysis: ${result.totalCount.toLocaleString()} total products. Detailed breakdown: ${categoryBreakdown}`);
                    refetchCounts();
                  } else {
                    setSyncStatus(`❌ Analysis failed: ${result.error}`);
                  }
                } catch (error) {
                  setSyncStatus(`❌ Analysis failed: ${error.message}`);
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 rounded text-sm transition-colors"
            >
              Analyze DB
            </button>
          </div>
        </div>

        {/* Activity Logs */}
        <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
            Recent Activity
          </h2>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                No activity logs found
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} className="bg-slate-800/30 rounded-lg border border-slate-700 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(log.success ? 'success' : 'error')}`}>
                        {log.success ? 'Success' : 'Error'}
                      </span>
                      <span className="text-sm font-medium text-white">
                        {log.category.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="text-sm text-slate-400">
                        {log.product_count.toLocaleString()} products
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatDate(log.downloaded_at)}
                    </span>
                  </div>
                  {log.error_message && (
                    <div className="text-sm text-slate-300 bg-slate-700/30 rounded p-2 mt-2">
                      {log.error_message}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}