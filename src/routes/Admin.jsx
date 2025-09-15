import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabaseClient';

// Admin function to trigger CSV sync
async function triggerCSVSync(category = 'all') {
  console.log(`Triggering CSV sync for category: ${category}`);
  
  const response = await fetch('/.netlify/functions/manual-csv-sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category })
  });
  
  console.log(`Response status: ${response.status}`);
  console.log(`Response headers:`, response.headers);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Response error:', errorText);
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }
  
  const responseText = await response.text();
  console.log('Response text:', responseText);
  
  if (!responseText) {
    throw new Error('Empty response from server');
  }
  
  try {
    const data = JSON.parse(responseText);
    return data;
  } catch (parseError) {
    console.error('JSON parse error:', parseError);
    console.error('Response text that failed to parse:', responseText);
    throw new Error(`Invalid JSON response: ${parseError.message}`);
  }
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

  const handleSync = async (category = 'all') => {
    setIsSyncing(true);
    setSyncStatus(`Syncing ${category}...`);
    
    try {
      const result = await triggerCSVSync(category);
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
          <h2 className="text-xl font-semibold mb-4">CSV Sync Controls</h2>
          
          <div className="flex flex-wrap gap-4 mb-4">
            <button
              onClick={() => handleSync('video_games')}
              disabled={isSyncing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 rounded-lg transition-colors"
            >
              Sync Video Games
            </button>
            
            <button
              onClick={() => handleSync('pokemon_cards')}
              disabled={isSyncing}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:opacity-50 rounded-lg transition-colors"
            >
              Sync Pokemon Cards
            </button>
            
            <button
              onClick={() => handleSync('magic_cards')}
              disabled={isSyncing}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:opacity-50 rounded-lg transition-colors"
            >
              Sync Magic Cards
            </button>
            
            <button
              onClick={() => handleSync('yugioh_cards')}
              disabled={isSyncing}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-800 disabled:opacity-50 rounded-lg transition-colors"
            >
              Sync YuGiOh Cards
            </button>
            
            <button
              onClick={handleFullSync}
              disabled={isSyncing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:opacity-50 rounded-lg transition-colors"
            >
              Full Sync (All Categories)
            </button>
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
