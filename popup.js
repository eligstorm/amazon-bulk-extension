// Bulk Add to Cart (Amazon US)
// NOTE: This is a best-effort helper. Amazon UI/flows vary and may require manual confirmation.

function extractAsin(input) {
  const s = (input || '').trim();
  if (!s) return null;

  // Common URL patterns: /dp/ASIN, /gp/product/ASIN, or bare ASIN
  const m = s.match(/(?:\/dp\/|\/gp\/product\/)?([A-Za-z0-9]{10})(?:[/?]|$)/);
  if (m) return m[1];

  // If the user pasted exactly 10 chars (ASIN-like), accept it.
  if (/^[A-Za-z0-9]{10}$/.test(s)) return s;

  return null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForTabLoadComplete(tabId) {
  await new Promise((resolve) => {
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function dismissProtectionModal(tabId) {
  // Best-effort: Amazon sometimes shows an Asurion/protection plan side sheet.
  // Clicking the backdrop or "No thanks" closes it and proceeds without protection.
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const norm = (s) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();

        const clickIf = (el) => {
          if (!el) return false;
          try {
            el.click();
            return true;
          } catch (_) {
            return false;
          }
        };

        // 1) Try explicit "No thanks" buttons/links.
        const candidates = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"]'));
        for (const el of candidates) {
          const text = norm(el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('title'));
          if (text === 'no thanks' || text === 'no, thanks' || text === 'no thanks,' || text === 'no thanks.' || text.includes('no thanks')) {
            if (clickIf(el)) return { dismissed: true, method: 'no-thanks' };
          }
        }

        // 2) Common close affordances.
        const closeSelectors = [
          '#attach-close_sideSheet-link',
          'button[aria-label="Close"]',
          'button[aria-label="close"]',
          '.a-button-close',
          '.a-popover-close',
          '#a-popover-1 .a-popover-header .a-close-button'
        ];
        for (const sel of closeSelectors) {
          const el = document.querySelector(sel);
          if (clickIf(el)) return { dismissed: true, method: 'close-x' };
        }

        // 3) Click obvious backdrops/overlays.
        const overlaySelectors = [
          '.a-modal-overlay',
          '.a-popover-overlay',
          '#a-popover-lgtbox',
          '.a-dimmer',
          '.a-sheet-overlay'
        ];
        for (const sel of overlaySelectors) {
          const el = document.querySelector(sel);
          if (clickIf(el)) return { dismissed: true, method: 'backdrop' };
        }

        // 4) Last resort: click near the top-left corner of the page to try to hit the dimmed area.
        // (Avoid clicking the side sheet itself.)
        try {
          const evt = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
          document.elementFromPoint(5, 5)?.dispatchEvent(evt);
          return { dismissed: true, method: 'corner-click' };
        } catch (_) {
          return { dismissed: false, method: 'none' };
        }
      }
    });
  } catch (e) {
    // Ignore; this is best-effort.
  }
}

async function openAddAndClose(asin) {
  const url = `https://www.amazon.com/dp/${asin}`;

  // Create a new background tab for this item.
  const tab = await chrome.tabs.create({ url, active: false });

  try {
    await waitForTabLoadComplete(tab.id);

    // Try to click "Add to Cart" if present.
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const btn = document.querySelector('#add-to-cart-button');
        if (btn) {
          btn.click();
          return { clicked: true };
        }
        return { clicked: false };
      }
    });

    // Give Amazon a moment to process any add-to-cart navigation/requests.
    await sleep(1500);

    // If Amazon shows the protection side sheet, dismiss it (no protection).
    await dismissProtectionModal(tab.id);

    // Give it another moment after dismissing.
    await sleep(1000);

    // Close the tab when done.
    await chrome.tabs.remove(tab.id);

    return result;
  } catch (e) {
    // Best effort: try to close the tab even if something went wrong.
    try { await chrome.tabs.remove(tab.id); } catch (_) {}
    throw e;
  }
}

document.getElementById('addButton').addEventListener('click', async () => {
  const input = document.getElementById('asins').value;
  const asins = input
    .split(/[\s,]+/)
    .map(extractAsin)
    .filter(Boolean);

  const statusEl = document.getElementById('status');

  if (asins.length === 0) {
    statusEl.textContent = 'No ASINs found.';
    return;
  }

  let clickedCount = 0;
  statusEl.textContent = `Adding ${asins.length} item(s)...`;

  for (let i = 0; i < asins.length; i++) {
    const asin = asins[i];
    statusEl.textContent = `Adding ${i + 1}/${asins.length} (${asin})...`;

    try {
      const res = await openAddAndClose(asin);
      if (res?.clicked) clickedCount++;
    } catch (e) {
      console.error('Error adding ASIN', asin, e);
    }

    // Small gap between items to reduce flakiness / rate limiting
    await sleep(750);
  }

  statusEl.textContent = `Done. Clicked Add to Cart on ${clickedCount}/${asins.length} item(s).`;
});
