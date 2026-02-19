const authFetch = async (url, opts = {}) => {
  const res = await fetch(url, opts);
  if (res.status === 401) {
    window.location.href = '/setup';
    throw new Error('Unauthorized');
  }
  return res;
};

export async function fetchStatus() {
  const res = await authFetch('/api/status');
  return res.json();
}

export async function fetchPairings() {
  const res = await authFetch('/api/pairings');
  return res.json();
}

export async function approvePairing(id, channel) {
  const res = await authFetch(`/api/pairings/${id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel }),
  });
  return res.json();
}

export async function rejectPairing(id, channel) {
  const res = await authFetch(`/api/pairings/${id}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel }),
  });
  return res.json();
}

export async function fetchGoogleStatus() {
  const res = await authFetch('/api/google/status');
  return res.json();
}

export async function checkGoogleApis() {
  const res = await authFetch('/api/google/check');
  return res.json();
}

export async function saveGoogleCredentials(clientId, clientSecret, email) {
  const res = await authFetch('/api/google/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret, email }),
  });
  return res.json();
}

export async function disconnectGoogle() {
  const res = await authFetch('/api/google/disconnect', { method: 'POST' });
  return res.json();
}

export async function restartGateway() {
  const res = await authFetch('/api/gateway/restart', { method: 'POST' });
  return res.json();
}

export async function fetchOnboardStatus() {
  const res = await authFetch('/api/onboard/status');
  return res.json();
}

export async function runOnboard(vars) {
  const res = await authFetch('/api/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vars }),
  });
  return res.json();
}

export async function fetchEnvVars() {
  const res = await authFetch('/api/env');
  return res.json();
}

export async function saveEnvVars(vars) {
  const res = await authFetch('/api/env', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vars }),
  });
  return res.json();
}
