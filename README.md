<p align="center">
  <img src="docs/icon.png" width="96" height="96" alt="Lumen Dark icon">
</p>

<h1 align="center">Lumen Dark</h1>

<p align="center">
  A proper dark mode for BITS Pilani Digital's Lumen LMS.<br>
  <em>Unofficial student project, not affiliated with BITS Pilani or D2L.</em>
</p>

---

Lumen is built on D2L Brightspace, which has no dark theme. Studying late at night meant staring into a wall of white, so I built one.

Lumen Dark darkens the whole platform (the header, navigation, course tree and homepage) while keeping lesson content readable and leaving photos, diagrams and lecture videos exactly as they were meant to look.

## Features

- **Three modes:** Dark, Auto (follows your system's light or dark setting, live) and Light.
- **Keyboard shortcut:** <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> flips whatever the page is currently showing. You can change it at `chrome://extensions/shortcuts`.
- **Real images and videos:** course thumbnails, banners, lecture videos and embedded players are never left as photo negatives.
- **No white flash** when moving between lessons.
- **Runs on one site only:** `lumen.bitspilani-digital.edu.in`, and nowhere else.
- **Private by design:** no accounts, no analytics, no tracking and no remote code. See [PRIVACY.md](PRIVACY.md).

## Install

**From the Chrome Web Store:** *link coming once the listing is approved.*

**Manually (for development or testing):**

1. Download or clone this repository.
2. Open `chrome://extensions` and switch on **Developer mode** (top right).
3. Click **Load unpacked** and select the `extension` folder.
4. Open Lumen. It should be dark straight away. Click the moon icon in the toolbar to change modes.

## How it works

Lumen turned out to be a surprisingly awkward site to theme, which is what made this project interesting.

**D2L's interface lives in shadow DOM.** Most of Brightspace is built from web components whose styles are sealed off from the page, so ordinary CSS overrides can't reach them. Instead, the extension applies `invert(1) hue-rotate(180deg)` to the root of the page. A filter acts on the rendered output, so it reaches inside shadow roots and iframes alike. The hue rotation keeps colours recognisable, so purple stays purple.

**Lesson content is recoloured, not inverted.** Lessons are author-written HTML inside iframes, where inversion turns rich colours into pastel glare. Each frame cancels the inherited inversion and then recolours element by element: light backgrounds become dark, dark text becomes light, hues are preserved, and saturated surfaces such as coloured card headers are left as they are. Frames tell their children whether they are currently shown inverted, so the two strategies can nest without double-flipping.

**Media is flipped back, even inside shadow DOM.** Page CSS can't select an `<img>` or `<video>` inside a shadow root, but an inline style on the element itself still applies. The extension watches every open shadow root with a `MutationObserver` and flips pictures and video players back the moment D2L renders them. Components that receive their shadow root after insertion are polled briefly until they render.

## Project structure

```
extension/        The extension itself (load this folder in Chrome)
  manifest.json
  content.js      Theming logic, runs on Lumen pages and their frames
  dark.css        Inversion and recolouring rules
  background.js   Toolbar icon state and the keyboard shortcut
  popup.*         Mode switcher
  icons/
store-assets/     Chrome Web Store listing copy, icon and promo tiles
scripts/          Packaging script for store uploads
```

To build a store-ready zip with `manifest.json` at its root:

```sh
./scripts/package.sh
```

## Support

Found a page that still looks wrong? Please [open an issue](../../issues) with a screenshot and the page's URL, or email **ojashguptadev@gmail.com**. The popup also has a "Report a problem" link.

## Disclaimer

Lumen Dark is an independent project by a student. It is not affiliated with, endorsed by, or connected to BITS Pilani, BITS Pilani Digital or D2L. "Lumen" is used only to describe the site the extension works on.

## License

[MIT](LICENSE) © 2026 Ojash Kumar Gupta
