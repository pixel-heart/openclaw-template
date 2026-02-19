import { h } from 'https://esm.sh/preact';
import { useState, useRef } from 'https://esm.sh/preact/hooks';
import htm from 'https://esm.sh/htm';
import { saveGoogleCredentials } from '../lib/api.js';
const html = htm.bind(h);

export function CredentialsModal({ visible, onClose, onSaved }) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [instrType, setInstrType] = useState('personal');
  const fileRef = useRef(null);

  if (!visible) return null;

  const redirectUri = `${window.location.origin}/auth/google/callback`;

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const creds = json.installed || json.web || json;
      if (creds.client_id) setClientId(creds.client_id);
      if (creds.client_secret) setClientSecret(creds.client_secret);
    } catch {
      setError('Invalid JSON file');
    }
  };

  const submit = async () => {
    setError('');
    if (!clientId || !clientSecret || !email) { setError('All fields required'); return; }
    setSaving(true);
    try {
      const data = await saveGoogleCredentials(clientId, clientSecret, email);
      if (data.ok) { onClose(); onSaved(); }
      else setError(data.error || 'Failed to save credentials');
    } catch { setError('Request failed'); }
    finally { setSaving(false); }
  };

  const btnCls = (type) => `px-2 py-1 rounded text-xs ${instrType === type ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`;

  return html`
    <div class="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onclick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="bg-surface border border-border rounded-xl p-6 max-w-md w-full space-y-4">
        <h2 class="text-lg font-semibold">Connect Google Workspace</h2>
        <div class="space-y-3">
          <div>
            <p class="text-gray-400 text-sm mb-3">
              You'll need a Google Cloud OAuth app.${' '}
              <a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="text-blue-400 hover:text-blue-300">Create one here →</a>
            </p>
            <details class="text-xs text-gray-500 mb-3">
              <summary class="cursor-pointer hover:text-gray-300">Step-by-step instructions</summary>
              <div class="mt-2 mb-2 flex gap-2">
                <button onclick=${() => setInstrType('workspace')} class=${btnCls('workspace')}>Google Workspace</button>
                <button onclick=${() => setInstrType('personal')} class=${btnCls('personal')}>Personal Gmail</button>
              </div>
              ${instrType === 'personal' ? html`
                <div>
                  <ol class="list-decimal list-inside space-y-1.5 ml-1">
                    <li><a href="https://console.cloud.google.com/projectcreate" target="_blank" class="text-blue-400 hover:text-blue-300">Create a Google Cloud project</a> (or use existing)</li>
                    <li>Go to <a href="https://console.cloud.google.com/auth/audience" target="_blank" class="text-blue-400 hover:text-blue-300">OAuth consent screen</a> → set to <strong>External</strong></li>
                    <li>Under <a href="https://console.cloud.google.com/auth/audience" target="_blank" class="text-blue-400 hover:text-blue-300">Test users</a>, <strong>add your own email</strong></li>
                    <li><a href="https://console.cloud.google.com/apis/library" target="_blank" class="text-blue-400 hover:text-blue-300">Enable APIs</a> for the services you selected below</li>
                    <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="text-blue-400 hover:text-blue-300">Credentials</a> → Create OAuth 2.0 Client ID (Web application)</li>
                    <li>Add redirect URI: <code class="bg-black/40 px-1 rounded text-gray-400">${redirectUri}</code></li>
                    <li>Copy Client ID + Secret (or download credentials JSON)</li>
                  </ol>
                  <p class="mt-2 text-yellow-500/80">⚠️ App will be in "Testing" mode. Only emails added as Test Users can sign in (up to 100).</p>
                </div>
              ` : html`
                <div>
                  <ol class="list-decimal list-inside space-y-1.5 ml-1">
                    <li><a href="https://console.cloud.google.com/projectcreate" target="_blank" class="text-blue-400 hover:text-blue-300">Create a Google Cloud project</a> (or use existing)</li>
                    <li>Go to <a href="https://console.cloud.google.com/auth/audience" target="_blank" class="text-blue-400 hover:text-blue-300">OAuth consent screen</a> → set to <strong>Internal</strong> (Workspace only)</li>
                    <li><a href="https://console.cloud.google.com/apis/library" target="_blank" class="text-blue-400 hover:text-blue-300">Enable APIs</a> for the services you selected below</li>
                    <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" class="text-blue-400 hover:text-blue-300">Credentials</a> → Create OAuth 2.0 Client ID (Web application)</li>
                    <li>Add redirect URI: <code class="bg-black/40 px-1 rounded text-gray-400">${redirectUri}</code></li>
                    <li>Copy Client ID + Secret (or download credentials JSON)</li>
                  </ol>
                  <p class="mt-2 text-green-500/80">✓ Internal apps skip test users and verification. Any user in your org can sign in.</p>
                </div>
              `}
            </details>
          </div>
          <div>
            <label class="text-sm text-gray-400 block mb-1">Upload credentials.json</label>
            <input type="file" ref=${fileRef} accept=".json" onchange=${handleFile}
              class="w-full text-sm text-gray-400 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700" />
          </div>
          <div class="text-gray-500 text-xs text-center">— or enter manually —</div>
          <div>
            <label class="text-sm text-gray-400 block mb-1">Client ID</label>
            <input type="text" value=${clientId} onInput=${(e) => setClientId(e.target.value)} placeholder="xxxx.apps.googleusercontent.com"
              class="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
          </div>
          <div>
            <label class="text-sm text-gray-400 block mb-1">Client Secret</label>
            <input type="password" value=${clientSecret} onInput=${(e) => setClientSecret(e.target.value)} placeholder="GOCSPX-..."
              class="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
          </div>
          <div>
            <label class="text-sm text-gray-400 block mb-1">Email (Google account to authorize)</label>
            <input type="email" value=${email} onInput=${(e) => setEmail(e.target.value)} placeholder="you@gmail.com"
              class="w-full bg-black/40 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-500" />
          </div>
        </div>
        <div class="flex gap-2 pt-2">
          <button onclick=${submit} disabled=${saving}
            class="flex-1 bg-green-500 text-black font-medium py-2 rounded-lg hover:opacity-85 transition-opacity text-sm">
            ${saving ? 'Saving...' : 'Connect Google'}
          </button>
          <button onclick=${onClose}
            class="px-4 bg-gray-800 text-gray-300 py-2 rounded-lg hover:bg-gray-700 transition-colors text-sm">
            Cancel
          </button>
        </div>
        ${error ? html`<div class="text-red-400 text-xs">${error}</div>` : null}
      </div>
    </div>`;
}
