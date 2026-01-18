import JSZip from 'jszip';

interface FetchResult {
  success: boolean;
  blob?: Blob;
  error?: string;
}

type ProgressCallback = (message: string, progress?: number) => void;

export class ImageDownloader {
  private readonly MAX_CONCURRENT = 4;

  constructor() {}

  public async downloadAsZip(urls: string[], onProgress?: ProgressCallback): Promise<void> {
    console.log(`[ImageDownloader] Starting batch download of ${urls.length} images...`);
    
    onProgress?.('Starting download...', 0);
    
    const zip = new JSZip();
    const folder = zip.folder('gemini_images');
    
    if (!folder) {
      console.error('Failed to create folder in zip');
      return;
    }

    // Fetch all images with concurrency limit
    const results = await this.fetchAllImages(urls, onProgress);
    
    // Add successful fetches to zip
    onProgress?.('Packaging images into ZIP...', 90);
    
    let successCount = 0;
    results.forEach((result, index) => {
      if (result.success && result.blob) {
        const filename = `${String(index + 1).padStart(3, '0')}.jpg`;
        folder.file(filename, result.blob);
        successCount++;
      } else {
        console.error(`Failed to fetch image ${index + 1}:`, result.error);
      }
    });

    console.log(`[ImageDownloader] Successfully fetched ${successCount}/${urls.length} images`);

    if (successCount === 0) {
      console.error('No images were fetched successfully');
      throw new Error('No images were fetched successfully');
    }

    // Generate ZIP file
    console.log('[ImageDownloader] Generating ZIP file...');
    onProgress?.(`Compressing ${successCount} images...`, 95);
    
    const zipBlob = await zip.generateAsync({ 
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    // Create download URL and trigger download
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `gemini_images_${timestamp}.zip`;
    
    onProgress?.('Preparing download...', 98);
    
    // Convert blob to data URL for download
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        chrome.downloads.download({
          url: dataUrl,
          filename: filename,
          saveAs: true
        }, (downloadId) => {
          if (chrome.runtime.lastError) {
            console.error('Download failed:', chrome.runtime.lastError);
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            console.log(`[ImageDownloader] ZIP download started with ID: ${downloadId}`);
            onProgress?.('Download ready! Save dialog opened.', 100);
            resolve();
          }
        });
      };
      reader.onerror = () => reject(new Error('Failed to read ZIP file'));
      reader.readAsDataURL(zipBlob);
    });
  }

  private async fetchAllImages(urls: string[], onProgress?: ProgressCallback): Promise<FetchResult[]> {
    const results: FetchResult[] = new Array(urls.length);
    const queue = urls.map((url, index) => ({ url, index }));
    let completed = 0;

    const fetchNext = async (): Promise<void> => {
      while (queue.length > 0) {
        const item = queue.shift()!;
        const { url, index } = item;
        
        try {
          console.log(`[ImageDownloader] Fetching image ${index + 1}/${urls.length}...`);
          const response = await fetch(url);
          
          if (!response.ok) {
            results[index] = { success: false, error: `HTTP ${response.status}` };
          } else {
            const blob = await response.blob();
            results[index] = { success: true, blob };
          }
        } catch (error) {
          results[index] = { success: false, error: String(error) };
        }
        
        completed++;
        const progress = Math.round((completed / urls.length) * 85); // 0-85% for fetching
        onProgress?.(`Downloading images: ${completed}/${urls.length}`, progress);
        console.log(`[ImageDownloader] Progress: ${completed}/${urls.length}`);
      }
    };

    // Start concurrent fetchers
    const workers: Promise<void>[] = [];
    for (let i = 0; i < Math.min(this.MAX_CONCURRENT, urls.length); i++) {
      workers.push(fetchNext());
    }
    
    await Promise.all(workers);
    return results;
  }
}

// Singleton instance
export const imageDownloader = new ImageDownloader();
