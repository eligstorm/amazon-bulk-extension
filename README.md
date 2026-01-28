# Amazon Bulk Add to Cart Extension

A simple Chrome extension that lets you bulk-add ASINs to your Amazon cart with one click.

## Installation

1. Clone this repo: `git clone <repo-url> amazon-bulk-extension`
2. Go to Chrome **chrome://extensions**
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `amazon-bulk-extension` folder
5. Click the extension icon and paste your ASIN list, then click **Add to Cart**.

## Files

- `manifest.json`: Extension manifest
- `popup.html`: Popup UI for inputting ASINs
- `popup.js`: Logic to inject iframes and click "Add to Cart"
- `background.js`: Opens popup on icon click
- `icons/`: Place your extension icons here

## Usage

1. Click the extension icon in the toolbar.
2. Enter ASINs (comma-separated) in the textarea.
3. Click **Add to Cart**.

Items will be added in the background. — gpt-5-mini