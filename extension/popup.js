const hints = {
  on: "Lumen is always dark.",
  auto: "Follows your system's light or dark setting.",
  off: "Lumen looks the way BITS designed it.",
};
const radios = [...document.querySelectorAll('input[name="mode"]')];
const hint = document.getElementById("hint");

function show(mode) {
  radios.forEach((r) => (r.checked = r.value === mode));
  hint.textContent = hints[mode];
}

chrome.storage.local.get(["mode", "enabled"], (r) =>
  show(r.mode ?? (r.enabled === false ? "off" : "on")));

radios.forEach((r) =>
  r.addEventListener("change", () => {
    chrome.storage.local.set({ mode: r.value });
    show(r.value);
  }));

chrome.commands.getAll((cmds) => {
  const el = document.getElementById("shortcut");
  const key = cmds.find((c) => c.name === "toggle-dark")?.shortcut;
  if (key) {
    el.append("Toggle anytime with ");
    const k = document.createElement("kbd");
    k.textContent = key;
    el.append(k);
  } else {
    el.textContent = "Set a shortcut in chrome://extensions/shortcuts";
  }
});
