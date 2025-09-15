import { useState } from 'react';

export default function ChunkedPokemonSync({ onComplete }) {
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState({ 
    currentChunk: 0, 
    totalChunks: 0, 
    processed: 0, 
    totalProducts: 0 
  });
  const [clearExisting, setClearExisting] = useState(true);

  const startChunkedSync = async () => {
    setIsRunning(true);
    setStatus('Initializing chunked sync...');
    setProgress({ currentChunk: 0, totalChunks: 0, processed: 0, totalProducts: 0 });

    try {
      // Start the sync process
      const startResponse = await fetch('/.netlify/functions/sync-pokemon-chunked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'start',
          chunkSize: 500,
          clearExisting
        })
      });

      if (!startResponse.ok) {
        throw new Error(`HTTP ${startResponse.status}: ${startResponse.statusText}`);
      }

      const startResult = await startResponse.json();
      
      if (!startResult.success) {
        throw new Error(startResult.error);
      }

      setStatus(`Starting sync of ${startResult.totalProducts.toLocaleString()} products in ${startResult.totalChunks} chunks...`);
      setProgress({
        currentChunk: 0,
        totalChunks: startResult.totalChunks,
        processed: 0,
        totalProducts: startResult.totalProducts
      });

      // Process each chunk
      for (let chunkIndex = 0; chunkIndex < startResult.totalChunks; chunkIndex++) {
        setStatus(`Processing chunk ${chunkIndex + 1} of ${startResult.totalChunks}...`);
        
        const chunkResponse = await fetch('/.netlify/functions/sync-pokemon-chunked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'process',
            chunkIndex,
            chunkSize: 500
          })
        });

        if (!chunkResponse.ok) {
          throw new Error(`HTTP ${chunkResponse.status}: ${chunkResponse.statusText}`);
        }

        const chunkResult = await chunkResponse.json();
        
        if (!chunkResult.success) {
          throw new Error(chunkResult.error);
        }

        setProgress({
          currentChunk: chunkIndex + 1,
          totalChunks: startResult.totalChunks,
          processed: (chunkIndex + 1) * 500, // Approximate
          totalProducts: startResult.totalProducts
        });

        setStatus(`✅ Chunk ${chunkIndex + 1}/${startResult.totalChunks} completed: ${chunkResult.processed} products processed`);

        // Small delay between chunks
        if (chunkIndex < startResult.totalChunks - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setStatus(`🎉 Chunked sync completed! All ${startResult.totalProducts.toLocaleString()} products processed.`);
      onComplete && onComplete(startResult.totalProducts);

    } catch (error) {
      setStatus(`❌ Chunked sync failed: ${error.message}`);
      console.error('Chunked sync error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={clearExisting}
            onChange={(e) => setClearExisting(e.target.checked)}
            className="rounded"
          />
          Clear existing data
        </label>
        
        <button
          onClick={startChunkedSync}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:opacity-50 rounded text-sm transition-colors"
        >
          {isRunning ? 'Syncing...' : 'Start Chunked Sync'}
        </button>
      </div>

      {status && (
        <div className="text-sm text-slate-300">
          {status}
        </div>
      )}

      {progress.totalChunks > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Chunk {progress.currentChunk} of {progress.totalChunks}</span>
            <span>{Math.round((progress.currentChunk / progress.totalChunks) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.currentChunk / progress.totalChunks) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
