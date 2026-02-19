import { h } from 'https://esm.sh/preact';
import { useState } from 'https://esm.sh/preact/hooks';
import htm from 'https://esm.sh/htm';
import { restartGateway } from '../lib/api.js';
import { showToast } from './toast.js';
const html = htm.bind(h);

export function Gateway({ status }) {
  const [restarting, setRestarting] = useState(false);
  const isRunning = status === 'running' && !restarting;
  const dotClass = isRunning
    ? 'w-2 h-2 rounded-full bg-green-500'
    : 'w-2 h-2 rounded-full bg-yellow-500 animate-pulse';

  const handleRestart = async () => {
    if (restarting) return;
    setRestarting(true);
    try {
      await restartGateway();
      showToast('Gateway restarted', 'success');
    } catch (err) {
      showToast('Restart failed: ' + err.message, 'error');
    }
    setRestarting(false);
  };

  return html`
    <div class="bg-surface border border-border rounded-xl p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <span class=${dotClass}></span>
          <span class="font-semibold">Gateway:</span>
          <span class="text-gray-400">${restarting ? 'restarting...' : (status || 'checking...')}</span>
        </div>
        <button
          onclick=${handleRestart}
          disabled=${restarting || !status}
          class="text-xs px-2.5 py-1 rounded-lg border border-border text-gray-500 hover:text-gray-300 hover:border-gray-500 transition-colors ${restarting || !status ? 'opacity-50 cursor-not-allowed' : ''}"
        >
          Restart
        </button>
      </div>
    </div>`;
}
