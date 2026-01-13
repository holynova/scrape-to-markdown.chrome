console.log('Scrape-to-Markdown Background Script Loaded');

// Allow clicking the extension icon to open the side panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));
