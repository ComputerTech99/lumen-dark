// Mode is "on" (always dark), "auto" (follow the system) or "off".
async function getMode() {
  const { mode, enabled } = await chrome.storage.local.get(["mode", "enabled"]);
  return mode ?? (enabled === false ? "off" : "on"); // migrate from v1.3
}

function setIcon(mode) {
  const v = mode === "off" ? "icon-off" : "icon";
  chrome.action.setIcon({ path: { 16: `icons/${v}-16.png`, 32: `icons/${v}-32.png` } });
}

chrome.runtime.onInstalled.addListener(async () => {
  const mode = await getMode();
  await chrome.storage.local.set({ mode });
  await chrome.storage.local.remove("enabled");
  setIcon(mode);
});
chrome.runtime.onStartup.addListener(async () => setIcon(await getMode()));
chrome.storage.onChanged.addListener((c) => { if (c.mode) setIcon(c.mode.newValue); });

// Keyboard shortcut: flip whatever the page is currently showing.
chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (cmd !== "toggle-dark") return;
  let dark;
  try { dark = await chrome.tabs.sendMessage(tab.id, "lumen-state", { frameId: 0 }); } catch {}
  if (typeof dark !== "boolean") dark = (await getMode()) !== "off";
  await chrome.storage.local.set({ mode: dark ? "off" : "on" });
});
