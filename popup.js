document.getElementById('addButton').addEventListener('click', async () => {
  const asins = document.getElementById('asins').value
    .split(/\s*,\s*/)
    .filter(Boolean);
  if (asins.length === 0) return;
  document.getElementById('status').textContent = 'Adding ' + asins.length + ' items...';
  for (let asin of asins) {
    const url = `https://www.amazon.com/dp/${asin}`;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: chrome.tabs.TAB_ID_CURRENT },
        func: async (productUrl) => {
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = productUrl;
          document.body.appendChild(iframe);
          await new Promise(r => iframe.onload = r);
          const btn = iframe.contentDocument.querySelector('#add-to-cart-button');
          if (btn) btn.click();
          document.body.removeChild(iframe);
        },
        args: [url]
      });
    } catch (e) {
      console.error('Error adding ' + asin, e);
    }
  }
  document.getElementById('status').textContent = 'Done.';
});