console.log('Scrape-to-Markdown Background Script Loaded');

import { imageDownloader } from './imageDownloader';

// Allow clicking the extension icon to open the side panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// Helper to send progress to sidepanel
function sendProgress(message: string, progress?: number) {
  console.log(`[Background] Progress: ${progress}% - ${message}`);
  chrome.runtime.sendMessage({
    action: 'DOWNLOAD_PROGRESS',
    message,
    progress
  }).catch(() => {
    // Sidepanel might not be open, ignore error
  });
}

function sendComplete(message: string) {
  console.log('[Background] Sending DOWNLOAD_COMPLETE:', message);
  chrome.runtime.sendMessage({
    action: 'DOWNLOAD_COMPLETE',
    message
  }).catch((err) => {
    console.log('[Background] sendComplete error (sidepanel closed?):', err);
  });
}

function sendError(message: string) {
  chrome.runtime.sendMessage({
    action: 'DOWNLOAD_ERROR',
    message
  }).catch(() => {});
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === 'DOWNLOAD_IMAGES') {
    if (request.urls && Array.isArray(request.urls)) {
      console.log(`Received batch of ${request.urls.length} images.`);
      
      // Start async download process
      imageDownloader.downloadAsZip(request.urls, sendProgress)
        .then(() => {
          console.log('Batch download process completed');
          sendComplete(`Download complete! ${request.urls.length} images saved to ZIP.`);
        })
        .catch((error) => {
          console.error('Batch download failed:', error);
          sendError(`Download failed: ${error.message || error}`);
        });
      
      sendResponse({ success: true, message: 'Download started - preparing ZIP file...' });
    } else {
      sendResponse({ success: false, error: 'Invalid URL list' });
    }
    return true;
  }
});
