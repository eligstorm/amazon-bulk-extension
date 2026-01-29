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
    await sleep(2000);

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
