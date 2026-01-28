document.getElementById('addButton').addEventListener('click', async () => {
  const urlsInput = document.getElementById('asins').value;
  const asins = urlsInput.split(/[\s,]+/).filter(Boolean).map(s => {
    // extract ASIN from URL
    const m = s.match(/\/dp\/([A-Za-z0-9]{10})/);
    return m ? m[1] : null;
  }).filter(Boolean);
    // extract ASIN from URL or raw ASIN
    const m = s.match(/(?:dp\/)?([A-Za-z0-9]{10})$/);
    return m ? m[1] : s;
  });
  if (asins.length === 0) return;
  document.getElementById('status').textContent = 'Adding ' + asins.length + ' items...';

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab.id;

  for (let asin of asins) {
    const url = `https://www.amazon.com/dp/${asin}`;
    try {
      // Navigate current tab to product URL
      await chrome.tabs.update(tabId, { url });

      // Wait for page load complete
      await new Promise((resolve) => {
        const listener = (updatedTabId, info) => {
          if (updatedTabId === tabId && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });

      // Click the Add to Cart button
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const btn = document.querySelector('#add-to-cart-button');
          if (btn) btn.click();
        }
      });

      // Small delay between items
      await new Promise((r) => setTimeout(r, 1500));
    } catch (e) {
      console.error('Error adding ' + asin, e);
    }
  }

  document.getElementById('status').textContent = 'Done.';
});