import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';
import BatchSync from '../components/BatchSync';

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
  const [syncStatus, setSyncStatus] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [csvStatus, setCsvStatus] = useState({});

  // Get download logs
  const { data: logs, refetch: refetchLogs } = useQuery({
    queryKey: ['download-logs'],
    queryFn: getDownloadLogs,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Get product counts
  const { data: productCounts, refetch: refetchCounts } = useQuery({
    queryKey: ['product-counts'],
    queryFn: getProductCounts,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const handleCheckStatus = async (category) => {
    setIsSyncing(true);
    setSyncStatus(`Checking ${category} CSV status...`);
    
    try {
      const result = await checkCSVStatus(category);
      setCsvStatus(prev => ({
        ...prev,
        [category]: result.result
      }));
      setSyncStatus(`✅ ${category}: ${result.result.productCount} products available (${Math.round(result.result.csvSize / 1024)}KB)`);
    } catch (error) {
      setSyncStatus(`❌ Status check failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSync = async (category) => {
    setIsSyncing(true);
    setSyncStatus(`Downloading ${category}...`);
    
    try {
      const result = await triggerCSVDownload(category);
      setSyncStatus(`✅ Successfully synced ${result.result.productCount} products for ${category}`);
      
      // Refresh the data
      refetchLogs();
      refetchCounts();
      
    } catch (error) {
      setSyncStatus(`❌ Sync failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDebugCSV = async () => {
    setIsSyncing(true);
    setSyncStatus(`Debugging CSV structure...`);
    
    try {
      const response = await fetch('/.netlify/functions/debug-csv-structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      setSyncStatus(`✅ CSV Debug: ${result.message}`);
      console.log('CSV Structure:', result);
      
    } catch (error) {
      setSyncStatus(`❌ Debug failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFullSync = async () => {
    setIsSyncing(true);
    setSyncStatus('Starting full sync of all categories...');
    
    const categories = ['video_games', 'pokemon_cards', 'magic_cards', 'yugioh_cards'];
    let totalProducts = 0;
    
    try {
      for (const category of categories) {
        setSyncStatus(`Syncing ${category}...`);
        const result = await triggerCSVSync(category);
        totalProducts += result.result.productCount;
      }
      
      setSyncStatus(`✅ Full sync completed: ${totalProducts} total products synced`);
      
      // Refresh the data
      refetchLogs();
      refetchCounts();
      
    } catch (error) {
      setSyncStatus(`❌ Full sync failed: ${error.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Price Charting Admin</h1>
        
        {/* Sync Controls */}
        <div className="bg-slate-800 rounded-xl p-6 mb-8">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">CSV Sync Controls</h2>
            <div className="flex gap-2">
              <button
                onClick={handleDebugCSV}
                disabled={isSyncing}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:opacity-50 rounded text-sm transition-colors"
              >
                Debug CSV Structure
              </button>
              <button
                onClick={async () => {
                  setIsSyncing(true);
                  setSyncStatus('Testing simple CSV debug...');
                  try {
                    const response = await fetch('/.netlify/functions/simple-csv-debug');
                    const result = await response.json();
                    setSyncStatus(`✅ CSV Debug: ${result.message}`);
                    console.log('Simple CSV Debug:', result);
                    console.log('CSV Headers:', result.headers);
                    console.log('Sample Data:', result.sampleData);
                  } catch (error) {
                    setSyncStatus(`❌ Debug failed: ${error.message}`);
                  } finally {
                    setIsSyncing(false);
                  }
                }}
                disabled={isSyncing}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-50 rounded text-sm transition-colors"
              >
                Simple CSV Debug
              </button>
            </div>
          </div>
          
          <div className="space-y-4 mb-4">
            {/* Video Games */}
            <div className="flex items-center gap-4">
              <div className="w-32">
                <button
                  onClick={() => handleCheckStatus('video_games')}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800 disabled:opacity-50 rounded text-sm transition-colors"
                >
                  Check Status
                </button>
              </div>
              <div className="flex-1">
                <button
                  onClick={() => handleSync('video_games')}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors"
                >
                  Sync Video Games
                </button>
              </div>
              {csvStatus.video_games && (
                <div className="text-sm text-slate-400">
                  {csvStatus.video_games.productCount} products ({Math.round(csvStatus.video_games.csvSize / 1024)}KB)
                </div>
              )}
            </div>

            {/* Pokemon Cards */}
            <div className="flex items-center gap-4">
              <div className="w-32">
                <button
                  onClick={() => handleCheckStatus('pokemon_cards')}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-green-500 hover:bg-green-600 disabled:bg-green-800 disabled:opacity-50 rounded text-sm transition-colors"
                >
                  Check Status
                </button>
              </div>
              <div className="flex-1 flex gap-2">
                <BatchSync 
                  category="pokemon_cards" 
                  onComplete={() => {
                    refetchLogs();
                    refetchCounts();
                  }}
                />
                <button
                  onClick={async () => {
                    setIsSyncing(true);
                    setSyncStatus('Checking current progress...');
                    try {
                      const response = await fetch('/.netlify/functions/resume-sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ category: 'pokemon_cards' })
                      });
                      const result = await response.json();
                      setSyncStatus(`✅ Current progress: ${result.currentCount} products imported`);
                      refetchCounts();
                    } catch (error) {
                      setSyncStatus(`❌ Check failed: ${error.message}`);
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-800 disabled:opacity-50 rounded text-sm transition-colors"
                >
                  Check Progress
                </button>
                <button
                  onClick={async () => {
                    setIsSyncing(true);
                    setSyncStatus('Running simple test...');
                    try {
                      const response = await fetch('/.netlify/functions/test-simple', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({})
                      });
                      const result = await response.json();
                      if (result.success) {
                        setSyncStatus(`✅ Simple test successful: ${result.message}`);
                      } else {
                        setSyncStatus(`❌ Simple test failed: ${result.error}`);
                      }
                    } catch (error) {
                      setSyncStatus(`❌ Simple test failed: ${error.message}`);
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-yellow-800 disabled:opacity-50 rounded text-sm transition-colors"
                >
                  Simple Test
                </button>
                <button
                  onClick={async () => {
                    const clearExisting = confirm('Clear existing Pokemon cards data and sync fresh?');
                    setIsSyncing(true);
                    setSyncStatus('Starting efficient sync...');
                    try {
                      const result = await triggerEfficientSync('pokemon_cards', clearExisting);
                      setSyncStatus(`✅ Efficient sync completed: ${result.processed} products processed`);
                      refetchCounts();
                      refetchLogs();
                    } catch (error) {
                      setSyncStatus(`❌ Efficient sync failed: ${error.message}`);
                    } finally {
                      setIsSyncing(false);
                    }
                  }}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:opacity-50 rounded text-sm transition-colors"
                >
                  Efficient Sync
                </button>
              </div>
              {csvStatus.pokemon_cards && (
                <div className="text-sm text-slate-400">
                  {csvStatus.pokemon_cards.productCount} products ({Math.round(csvStatus.pokemon_cards.csvSize / 1024)}KB)
                </div>
              )}
            </div>

            {/* Magic Cards */}
            <div className="flex items-center gap-4">
              <div className="w-32">
                <button
                  onClick={() => handleCheckStatus('magic_cards')}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-800 disabled:opacity-50 rounded text-sm transition-colors"
                >
                  Check Status
                </button>
              </div>
              <div className="flex-1">
                <button
                  onClick={() => handleSync('magic_cards')}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 rounded-lg transition-colors"
                >
                  Sync Magic Cards
                </button>
              </div>
              {csvStatus.magic_cards && (
                <div className="text-sm text-slate-400">
                  {csvStatus.magic_cards.productCount} products ({Math.round(csvStatus.magic_cards.csvSize / 1024)}KB)
                </div>
              )}
            </div>

            {/* YuGiOh Cards */}
            <div className="flex items-center gap-4">
              <div className="w-32">
                <button
                  onClick={() => handleCheckStatus('yugioh_cards')}
                  disabled={isSyncing}
                  className="px-3 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-800 disabled:opacity-50 rounded text-sm transition-colors"
                >
                  Check Status
                </button>
              </div>
              <div className="flex-1">
                <button
                  onClick={() => handleSync('yugioh_cards')}
                  disabled={isSyncing}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 disabled:opacity-50 rounded-lg transition-colors"
                >
                  Sync YuGiOh Cards
                </button>
              </div>
              {csvStatus.yugioh_cards && (
                <div className="text-sm text-slate-400">
                  {csvStatus.yugioh_cards.productCount} products ({Math.round(csvStatus.yugioh_cards.csvSize / 1024)}KB)
                </div>
              )}
            </div>
          </div>
          
          {syncStatus && (
            <div className="mt-4 p-3 bg-slate-700 rounded-lg">
              <p className="text-sm">{syncStatus}</p>
            </div>
          )}
        </div>

        {/* Product Counts */}
        <div className="bg-slate-800 rounded-xl p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Product Database Status</h2>
          
          {productCounts && Object.keys(productCounts).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(productCounts).map(([category, data]) => (
                <div key={category} className="bg-slate-700 rounded-lg p-4">
                  <h3 className="font-medium capitalize">{category.replace('_', ' ')}</h3>
                  <p className="text-2xl font-bold text-indigo-400">{data.count.toLocaleString()}</p>
                  <p className="text-xs text-slate-400">
                    Last updated: {new Date(data.lastUpdated).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400">No data available. Run a sync to populate the database.</p>
          )}
        </div>

        {/* Download Logs */}
        <div className="bg-slate-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Download Activity</h2>
          
          {logs && logs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2">Category</th>
                    <th className="text-left py-2">Products</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">Time</th>
                    <th className="text-left py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-700/50">
                      <td className="py-2 capitalize">{log.category.replace('_', ' ')}</td>
                      <td className="py-2">{log.product_count.toLocaleString()}</td>
                      <td className="py-2">
                        <span className={`px-2 py-1 rounded text-xs ${
                          log.success ? 'bg-green-600 text-green-100' : 'bg-red-600 text-red-100'
                        }`}>
                          {log.success ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="py-2 text-slate-400">
                        {new Date(log.downloaded_at).toLocaleString()}
                      </td>
                      <td className="py-2 text-red-400">
                        {log.error_message ? log.error_message.substring(0, 50) + '...' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-slate-400">No download logs available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
