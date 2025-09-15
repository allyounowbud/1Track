import { useState } from 'react';

export default function StreamingSync({ category, onComplete }) {
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState({ processed: 0, total: 0, currentLine: 0 });
  const [clearExisting, setClearExisting] = useState(false);

  const startStreamingSync = async () => {
    setIsRunning(true);
    setStatus('Starting streaming sync...');
    setProgress({ processed: 0, total: 0, currentLine: 0 });

    let startLine = 1;
    let totalProcessed = 0;
    let totalLines = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        setStatus(`Processing lines ${startLine} to ${startLine + 199}...`);
        
        const response = await fetch('/.netlify/functions/csv-sync-streaming', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            category, 
            clearExisting: clearExisting && startLine === 1,
            startLine,
            maxLines: 200
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (!result.success) {
          throw new Error(result.error);
        }

        totalProcessed += result.processed;
        totalLines = result.totalLines;
        hasMore = result.hasMore;
        startLine = result.nextStartLine;

        setProgress({
          processed: totalProcessed,
          total: totalLines,
          currentLine: startLine
        });

        setStatus(`✅ Processed ${totalProcessed} products (${Math.round((totalProcessed / totalLines) * 100)}%)`);

        // Small delay between batches
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      setStatus(`🎉 Streaming sync completed! Processed ${totalProcessed} products total.`);
      onComplete && onComplete(totalProcessed);

    } catch (error) {
      setStatus(`❌ Streaming sync failed: ${error.message}`);
      console.error('Streaming sync error:', error);
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
          onClick={startStreamingSync}
          disabled={isRunning}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 disabled:opacity-50 rounded text-sm transition-colors"
        >
          {isRunning ? 'Streaming...' : `Start Streaming Sync ${category.replace('_', ' ')}`}
        </button>
      </div>

      {status && (
        <div className="text-sm text-slate-300">
          {status}
        </div>
      )}

      {progress.total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Progress: {progress.processed} / {progress.total}</span>
            <span>{Math.round((progress.processed / progress.total) * 100)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(progress.processed / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
