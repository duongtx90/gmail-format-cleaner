# Privacy Policy for Format Cleaner for Gmail

Last updated: October 22, 2026

## Overview

**Format Cleaner for Gmail** is a Chrome extension designed to standardize email font, size, colors, line spacing, and clean up messy pasted formatting directly inside Gmail's compose window.

Your privacy is paramount. **This extension does NOT collect, store remotely, sell, or transmit any user data, personal communications, or browsing history.**

---

## Data Collection & Usage

1. **No Personal Data Collected**: The extension does not read, log, or transmit any email contents, recipient information, subject lines, or attachments.
2. **On-Device DOM Processing Only**: All format cleaning and text sanitization occurs 100% locally in your browser's memory. No data ever leaves your computer.
3. **Local Preferences (`chrome.storage.sync` / `chrome.storage.local`)**:
   - The extension stores only your formatting preferences (e.g., chosen default font family, font size, line spacing, color, and feature toggles).
   - This data is stored strictly in your browser's extension storage and is never sent to any third-party servers.
4. **No Analytics or Tracking**: We do not use Google Analytics, telemetry, trackers, cookies, or remote logging.
5. **No Third-Party Services**: No external APIs or remote scripts are executed.

---

## Permissions Disclosure

- **`storage`**: Used solely to save your local formatting preferences (font, font size, spacing).
- **`https://mail.google.com/*` (Content Script)**: Used solely to inject the formatting toolbar button and clean up pasted text within the Gmail message compose editor.

---

## Contact & Support

If you have questions about this privacy policy or the extension, please open an issue on GitHub:
https://github.com/duongtx90/gmail-format-cleaner/issues
