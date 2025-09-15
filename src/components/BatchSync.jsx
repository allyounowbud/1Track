import { useState } from 'react';

export default function BatchSync({ category, onComplete }) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, message: '' });
  const [error, setError] = useState('');

  const runBatchSync = async () => {
    setIsRunning(true);
    setError('');
    setProgress({ current: 0, total: 0, message: 'Starting batch sync...' });

    try {
      // Step 1: Start sync
      console.log('Starting batch sync for', category);
      const startResponse = await fetch('/.netlify/functions/csv-sync-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          category, 
          action: 'start',
          batchSize: 1000 
        })
      });

      const startData = await startResponse.json();
      if (!startResponse.ok) throw new Error(startData.error || 'Start failed');

      const { totalBatches, totalLines } = startData;
      setProgress({ current: 0, total: totalBatches, message: `Processing ${totalLines} products in ${totalBatches} batches...` });

      // Step 2: Process batches
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        console.log(`Processing batch ${batchIndex + 1}/${totalBatches}`);
        
        const batchResponse = await fetch('/.netlify/functions/csv-sync-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            category, 
            action: 'process',
            batchIndex,
            batchSize: 1000 
          })
        });

        const batchData = await batchResponse.json();
        if (!batchResponse.ok) throw new Error(batchData.error || `Batch ${batchIndex} failed`);

        setProgress({ 
          current: batchIndex + 1, 
          total: totalBatches, 
          message: `Processed batch ${batchIndex + 1}/${totalBatches}: ${batchData.processed} products` 
        });

        // Small delay between batches to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Step 3: Complete sync
      const completeResponse = await fetch('/.netlify/functions/csv-sync-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          category, 
          action: 'complete' 
        })
      });

      const completeData = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completeData.error || 'Complete failed');

      setProgress({ 
        current: totalBatches, 
        total: totalBatches, 
        message: `✅ Sync completed: ${completeData.productCount} products imported!` 
      });

      if (onComplete) {
        onComplete(completeData.productCount);
      }

    } catch (error) {
      console.error('Batch sync error:', error);
      setError(error.message);
      setProgress({ current: 0, total: 0, message: '❌ Sync failed' });
    } finally {
      setIsRunning(false);
    }
  };

  const progressPercentage = progress.total > 0 ? (progress.current / progress.total) * 100 : 0;

  return (
    <div className="space-y-3">
      <button
        onClick={runBatchSync}
        disabled={isRunning}
        className={`px-4 py-2 rounded-lg transition-colors ${
          isRunning
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        {isRunning ? 'Syncing...' : `Sync ${category.replace('_', ' ')}`}
      </button>

      {progress.total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{progress.message}</span>
            <span>{progress.current}/{progress.total} batches</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>
      )}

      {error && (
        <div className="text-red-400 text-sm">
          Error: {error}
        </div>
      )}
    </div>
  );
}
