import { h } from 'https://esm.sh/preact';
import htm from 'https://esm.sh/htm';
const html = htm.bind(h);

const ALL_CHANNELS = ['telegram', 'discord'];

export function Channels({ channels, onSwitchTab }) {
  return html`
    <div class="bg-surface border border-border rounded-xl p-4">
      <h2 class="font-semibold mb-3">Channels</h2>
      <div class="space-y-2">
        ${channels ? ALL_CHANNELS.map(ch => {
          const info = channels[ch];
          let badge;
          if (!info) {
            badge = html`<a
              href="#"
              onclick=${(e) => { e.preventDefault(); onSwitchTab?.('envars'); }}
              class="text-xs text-gray-500 hover:text-gray-300"
            >Add token</a>`;
          } else if (info.status === 'paired') {
            badge = html`<span class="text-xs px-2 py-0.5 rounded-full font-medium bg-green-500/10 text-green-500">Paired (${info.paired})</span>`;
          } else {
            badge = html`<span class="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-500/10 text-yellow-500">Awaiting pairing</span>`;
          }
          return html`<div class="flex justify-between items-center py-1.5">
            <span class="font-medium text-sm">${ch.charAt(0).toUpperCase() + ch.slice(1)}</span>
            ${badge}
          </div>`;
        }) : html`<div class="text-gray-500 text-sm text-center py-2">Loading...</div>`}
      </div>
    </div>`;
}

export { ALL_CHANNELS };
