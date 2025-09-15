import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import BatchSync from '../components/BatchSync';
import StreamingSync from '../components/StreamingSync';
import ChunkedPokemonSync from '../components/ChunkedPokemonSync';

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
  // Get counts for each category using proper COUNT queries
  const categories = ['pokemon_cards', 'video_games', 'magic_cards', 'yugioh_cards'];
  const counts = {};
  
  for (const category of categories) {
    try {
      // Get count for this category
      const { count, error: countError } = await supabase
        .from('price_charting_products')
        .select('*', { count: 'exact', head: true })
        .eq('category', category);
      
      if (countError) {
        console.error(`Error getting count for ${category}:`, countError);
        counts[category] = { count: 0, lastUpdated: null };
        continue;
      }
      
      // Get the most recent download time for this category
      const { data: recentData, error: recentError } = await supabase
        .from('price_charting_products')
        .select('downloaded_at')
        .eq('category', category)
        .order('downloaded_at', { ascending: false })
        .limit(1);
      
      if (recentError) {
        console.error(`Error getting recent data for ${category}:`, recentError);
      }
      
      counts[category] = {
        count: count || 0,
        lastUpdated: recentData && recentData.length > 0 ? recentData[0].downloaded_at : null
      };
      
    } catch (error) {
      console.error(`Error processing ${category}:`, error);
      counts[category] = { count: 0, lastUpdated: null };
    }
  }
  
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
          
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-white">Product Counts</h3>
            <button
              onClick={() => refetchCounts()}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
            >
              Refresh
            </button>
          </div>
          
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Chunked Pokemon Sync - Recommended */}
              <div className="bg-slate-800/30 rounded-lg border border-slate-700 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <h3 className="font-semibold text-white">Chunked Pokemon Sync</h3>
                  <span className="bg-blue-500/20 text-blue-400 text-xs px-2 py-1 rounded-full">
                    Recommended
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  Processes all 71,349 Pokemon cards in small chunks (500 at a time) to avoid timeouts. 
                  Shows real-time progress and handles the complete dataset reliably.
                </p>
                <ChunkedPokemonSync 
                  onComplete={(count) => {
                    setSyncStatus(`✅ Chunked sync completed: ${count.toLocaleString()} Pokemon cards processed`);
                    refetchCounts();
                    refetchLogs();
                  }}
                />
              </div>

              {/* Streaming Sync - Alternative */}
              <div className="bg-slate-800/30 rounded-lg border border-slate-700 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                  <h3 className="font-semibold text-white">Streaming Sync</h3>
                  <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2 py-1 rounded-full">
                    Alternative
                  </span>
                </div>
                <p className="text-sm text-slate-400 mb-4">
                  Processes CSV in small batches (200 lines at a time) to avoid timeouts. 
                  Alternative method if the full sync has issues.
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
            <button
              onClick={async () => {
                setIsSyncing(true);
                setSyncStatus('Debugging chunk 28 errors...');
                try {
                  const response = await fetch('/.netlify/functions/debug-chunk-errors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ chunkIndex: 28 })
                  });
                  const result = await response.json();
                  if (result.success) {
                    let errorMsg = `Chunk ${result.chunkIndex}: ${result.validProducts} valid products`;
                    if (result.insertError) {
                      errorMsg += `. Insert error: ${result.insertError.message}`;
                      if (result.insertError.details) {
                        errorMsg += ` (${result.insertError.details})`;
                      }
                    }
                    if (result.parseErrors.length > 0) {
                      errorMsg += `. Parse errors: ${result.parseErrors.slice(0, 3).join(', ')}`;
                    }
                    setSyncStatus(`✅ Debug results: ${errorMsg}`);
                  } else {
                    setSyncStatus(`❌ Debug failed: ${result.error}`);
                  }
                } catch (error) {
                  setSyncStatus(`❌ Debug failed: ${error.message}`);
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 rounded text-sm transition-colors"
            >
              Debug Chunk 28
            </button>
            <button
              onClick={async () => {
                setIsSyncing(true);
                setSyncStatus('Checking database schema...');
                try {
                  const response = await fetch('/.netlify/functions/check-schema', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                  });
                  const result = await response.json();
                  if (result.success) {
                    const constraintInfo = result.uniqueConstraints.length > 0 
                      ? `Found ${result.uniqueConstraints.length} unique constraints` 
                      : 'No unique constraints found';
                    setSyncStatus(`✅ Schema check: Table exists: ${result.tableExists}, ${constraintInfo}`);
                  } else {
                    setSyncStatus(`❌ Schema check failed: ${result.error}`);
                  }
                } catch (error) {
                  setSyncStatus(`❌ Schema check failed: ${error.message}`);
                } finally {
                  setIsSyncing(false);
                }
              }}
              disabled={isSyncing}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:opacity-50 rounded text-sm transition-colors"
            >
              Check Schema
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