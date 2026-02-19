import { h } from "https://esm.sh/preact";
import { useState, useEffect, useCallback } from "https://esm.sh/preact/hooks";
import htm from "https://esm.sh/htm";
import { fetchEnvVars, saveEnvVars } from "../lib/api.js";
import { showToast } from "./toast.js";
const html = htm.bind(h);

const kGroupLabels = {
  ai: "AI Provider",
  github: "GitHub",
  channels: "Channels",
  tools: "Tools",
  custom: "Custom",
};

const kGroupOrder = ["ai", "github", "channels", "tools", "custom"];

const EnvRow = ({ envVar, onChange, onDelete, disabled }) => {
  const [visible, setVisible] = useState(false);
  const isSecret = !!envVar.value;

  return html`
    <div class="flex items-center gap-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span
            class="inline-block w-2 h-2 rounded-full ${envVar.value
              ? "bg-green-500"
              : "bg-gray-600"}"
          />
          <label class="text-xs font-medium text-gray-400">
            ${envVar.label || envVar.key}
          </label>
          ${envVar.hint
            ? html`<span class="text-xs text-gray-600"
                >· ${envVar.hint}</span
              >`
            : null}
        </div>
        <div class="flex items-center gap-1">
          <input
            type=${isSecret && !visible ? "password" : "text"}
            value=${envVar.value}
            placeholder=${envVar.value ? "" : "not set"}
            onInput=${(e) => onChange(envVar.key, e.target.value)}
            class="w-full bg-black/30 border border-border rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-gray-500 font-mono"
            disabled=${disabled}
          />
          ${isSecret
            ? html`<button
                onclick=${() => setVisible(!visible)}
                class="text-gray-500 hover:text-gray-300 px-1 text-xs shrink-0"
                title=${visible ? "Hide" : "Show"}
              >
                ${visible ? "Hide" : "Show"}
              </button>`
            : null}
          ${envVar.group === "custom"
            ? html`<button
                onclick=${() => onDelete(envVar.key)}
                class="text-gray-600 hover:text-red-400 px-1 text-xs shrink-0"
                title="Delete"
              >
                ✕
              </button>`
            : null}
        </div>
      </div>
    </div>
  `;
};

export const Envars = () => {
  const [vars, setVars] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await fetchEnvVars();
      setVars(data.vars || []);
      setDirty(false);
    } catch (err) {
      console.error("Failed to load env vars:", err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = (key, value) => {
    setVars((prev) => prev.map((v) => (v.key === key ? { ...v, value } : v)));
    setDirty(true);
  };

  const handleDelete = (key) => {
    setVars((prev) => prev.filter((v) => v.key !== key));
    setDirty(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const toSave = vars.filter((v) => v.editable).map((v) => ({ key: v.key, value: v.value }));
      await saveEnvVars(toSave);
      showToast("Environment variables saved", "success");
      setDirty(false);
    } catch (err) {
      showToast("Failed to save: " + err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const [newVal, setNewVal] = useState("");

  const parsePaste = (input) => {
    const lines = input.split("\n").map((l) => l.trim()).filter(Boolean).filter((l) => !l.startsWith("#"));
    const pairs = [];
    for (const line of lines) {
      const eqIdx = line.indexOf("=");
      if (eqIdx > 0) pairs.push({ key: line.slice(0, eqIdx).trim(), value: line.slice(eqIdx + 1).trim() });
    }
    return pairs;
  };

  const addVars = (pairs) => {
    let added = 0;
    setVars((prev) => {
      const next = [...prev];
      for (const { key: rawKey, value } of pairs) {
        const key = rawKey.toUpperCase().replace(/[^A-Z0-9_]/g, "_");
        if (!key) continue;
        const existing = next.find((v) => v.key === key);
        if (existing) {
          existing.value = value;
        } else {
          next.push({ key, value, label: key, group: "custom", hint: "", source: "env_file", editable: true });
        }
        added++;
      }
      return next;
    });
    if (added) setDirty(true);
    return added;
  };

  const handlePaste = (e, fallbackField) => {
    const text = (e.clipboardData || window.clipboardData).getData("text");
    const pairs = parsePaste(text);
    if (pairs.length > 1) {
      e.preventDefault();
      const added = addVars(pairs);
      setNewKey("");
      setNewVal("");
      showToast(`Added ${added} variable${added !== 1 ? "s" : ""}`, "success");
      return;
    }
    if (pairs.length === 1) {
      e.preventDefault();
      setNewKey(pairs[0].key);
      setNewVal(pairs[0].value);
      return;
    }
  };

  const handleKeyInput = (raw) => {
    const pairs = parsePaste(raw);
    if (pairs.length === 1) {
      setNewKey(pairs[0].key);
      setNewVal(pairs[0].value);
      return;
    }
    setNewKey(raw);
  };

  const handleValInput = (raw) => {
    const pairs = parsePaste(raw);
    if (pairs.length === 1) {
      setNewKey(pairs[0].key);
      setNewVal(pairs[0].value);
      return;
    }
    setNewVal(raw);
  };

  const handleAddVar = () => {
    const key = newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!key) return;
    addVars([{ key, value: newVal }]);
    setNewKey("");
    setNewVal("");
  };

  // Group vars
  const grouped = {};
  for (const v of vars) {
    const g = v.group || "custom";
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(v);
  }

  return html`
    <div class="space-y-4">
      ${kGroupOrder
        .filter((g) => grouped[g]?.length)
        .map(
          (g) => html`
            <div
              class="bg-surface border border-border rounded-xl p-4 space-y-3"
            >
              <h3 class="text-sm font-medium text-gray-400">
                ${kGroupLabels[g] || g}
              </h3>
              ${grouped[g].map(
                (v) =>
                  html`<${EnvRow}
                    envVar=${v}
                    onChange=${handleChange}
                    onDelete=${handleDelete}
                    disabled=${saving}
                  />`
              )}
            </div>
          `
        )}

      <div class="bg-surface border border-border rounded-xl p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-medium text-gray-400">Add Variable</h3>
          <span class="text-xs text-gray-600">Paste KEY=VALUE or multiple lines</span>
        </div>
        <input
          type="text"
          value=${newKey}
          placeholder="VARIABLE_NAME"
          onInput=${(e) => handleKeyInput(e.target.value)}
          onPaste=${(e) => handlePaste(e, "key")}
          onKeyDown=${(e) => e.key === "Enter" && handleAddVar()}
          class="w-full bg-black/30 border border-border rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-gray-500 font-mono uppercase"
        />
        <div class="flex gap-2">
          <input
            type="text"
            value=${newVal}
            placeholder="value"
            onInput=${(e) => handleValInput(e.target.value)}
            onPaste=${(e) => handlePaste(e, "val")}
            onKeyDown=${(e) => e.key === "Enter" && handleAddVar()}
            class="flex-1 bg-black/30 border border-border rounded-lg px-3 py-1.5 text-sm text-gray-200 outline-none focus:border-gray-500 font-mono"
          />
          <button
            onclick=${handleAddVar}
            class="text-sm px-3 py-1.5 rounded-lg border border-border text-gray-400 hover:text-gray-200 hover:border-gray-500 shrink-0"
          >
            + Add
          </button>
        </div>
      </div>

      <button
        onclick=${handleSave}
        disabled=${!dirty || saving}
        class="w-full text-sm font-medium px-4 py-2.5 rounded-xl transition-all ${dirty &&
        !saving
          ? "bg-white text-black hover:opacity-85"
          : "bg-gray-800 text-gray-500 cursor-not-allowed"}"
      >
        ${saving
          ? html`<span class="flex items-center justify-center gap-2">
              <svg
                class="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                />
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Saving...
            </span>`
          : "Save Changes"}
      </button>
    </div>
  `;
};
