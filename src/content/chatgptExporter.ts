import JSZip from 'jszip';

type ExportOptions = {
  includeImages: boolean;
  concurrency: number;
  requestDelayMs: number;
  requestJitterMs: number;
  maxItems: number;
  startDate?: string;
  endDate?: string;
  locale?: 'en' | 'zh';
};

type ConversationSummary = { id: string; title?: string; create_time?: number };

type FileReference = { fileId: string; filename: string };
type ConversationPart = string | { content_type?: string; asset_pointer?: string; metadata?: { dalle?: { prompt?: string } } };
type ConversationAttachment = { id?: string; name?: string };
type ConversationCitation = { file_id?: string; title?: string; metadata?: { file_id?: string; title?: string } };
type ConversationMessage = { author?: { role?: string }; content?: { parts?: ConversationPart[] }; metadata?: { attachments?: ConversationAttachment[]; citations?: ConversationCitation[] } };
type ConversationNode = { parent?: string | null; children?: string[]; message?: ConversationMessage };
type Conversation = ConversationSummary & { mapping?: Record<string, ConversationNode> };
type ExportMessage = { role: string; text: string; images: string[]; attachments: Array<{ name: string; path: string }> };
type ConversationListResponse = { items?: ConversationSummary[]; total?: number };
type DownloadMetadata = { download_url?: string; file_name?: string };

class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled');
    this.name = 'ExportCancelledError';
  }
}

const API = 'https://chatgpt.com/backend-api';
const PAGE_SIZE = 100;
const MAX_RETRIES = 4;

const mimeExtensions: Record<string, string> = {
  'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp',
  'image/svg+xml': '.svg', 'application/pdf': '.pdf', 'text/plain': '.txt',
  'text/html': '.html', 'text/csv': '.csv', 'application/json': '.json',
  'application/zip': '.zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

const sanitize = (name: string) => name.replace(/[<>:"/\\|?*]/g, '_').replace(/^[. ]+|[. ]+$/g, '').slice(0, 80) || 'untitled';
const stripCitations = (value: string) => value.replace(/【[^】]*】/g, '');
const escapeHtml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function dateMatches(conversation: ConversationSummary, startDate?: string, endDate?: string) {
  const createdAt = Number(conversation.create_time);
  if (!Number.isFinite(createdAt)) return true;
  const date = new Date(createdAt * 1000);
  if (startDate && date < new Date(`${startDate}T00:00:00`)) return false;
  return !(endDate && date.getTime() >= new Date(`${endDate}T00:00:00`).getTime() + 24 * 60 * 60 * 1000);
}

function messagesFor(conversation: Conversation): ExportMessage[] {
  const mapping = conversation.mapping || {};
  const rootId = Object.keys(mapping).find(id => mapping[id]?.parent == null);
  if (!rootId) return [];

  const result: ExportMessage[] = [];
  const queue = [rootId];
  while (queue.length) {
    const node = mapping[queue.shift()!] || {};
    const message = node.message;
    if (message?.content?.parts && message.author?.role !== 'system') {
      const role = message.author?.role || 'unknown';
      const parts: string[] = [];
      const images: string[] = [];
      const attachments: Array<{ name: string; path: string }> = [];
      for (const part of message.content.parts) {
        if (typeof part === 'string') parts.push(part);
        else if (part?.content_type === 'image_asset_pointer') {
          const id = part.asset_pointer?.match(/^(?:file-service|sediment):\/\/(.+)$/)?.[1];
          if (id) images.push(id);
        }
      }
      for (const attachment of message.metadata?.attachments || []) {
        if (attachment.id) attachments.push({ name: attachment.name || 'attachment', path: attachment.id });
      }
      const text = stripCitations(parts.join('\n')).trim();
      if (text || images.length || attachments.length) result.push({ role, text, images, attachments });
    }
    queue.push(...(node.children || []));
  }
  return result;
}

function toMarkdown(conversation: Conversation, fileMap: Record<string, string>) {
  const title = conversation.title || 'Untitled';
  const createdAt = Number(conversation.create_time);
  const date = Number.isFinite(createdAt)
    ? new Date(createdAt * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC'
    : '';
  const lines = [`# ${title}`, ''];
  if (date) lines.push(`*${date}*`, '');
  for (const message of messagesFor(conversation)) {
    if (message.role === 'tool') continue;
    const body = [message.text, ...message.images.map(id => fileMap[id] ? `![image](${fileMap[id]})` : '[image]'), ...message.attachments.map(item => fileMap[item.path] ? `📎 [${item.name}](${fileMap[item.path]})` : '')].filter(Boolean).join('\n');
    if (body) lines.push(`## ${message.role[0].toUpperCase()}${message.role.slice(1)}`, '', body, '');
  }
  return lines.join('\n');
}

function toHtml(conversation: Conversation, fileMap: Record<string, string>, allConversations: Array<{ name: string; title: string }>, currentName: string) {
  const title = conversation.title || 'Untitled';
  const renderedMessages = messagesFor(conversation).filter(message => message.role !== 'tool').map(message => {
    const content = escapeHtml(message.text).replace(/\n/g, '<br>');
    const media = [
      ...message.images.map(id => fileMap[id] ? `<a href="${escapeHtml(fileMap[id])}"><img src="${escapeHtml(fileMap[id])}" alt="Generated image"></a>` : ''),
      ...message.attachments.map(item => fileMap[item.path] ? `<a class="attachment" href="${escapeHtml(fileMap[item.path])}">📎 ${escapeHtml(item.name)}</a>` : ''),
    ].join('');
    return `<article class="message ${message.role === 'user' ? 'user' : 'assistant'}"><div class="role">${escapeHtml(message.role)}</div><div class="content">${content}</div>${media ? `<div class="media">${media}</div>` : ''}</article>`;
  }).join('');
  const nav = allConversations.map(item => `<a class="${item.name === currentName ? 'active' : ''}" href="${item.name}.html" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</a>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>*{box-sizing:border-box}body{margin:0;font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#202123;background:#fff;display:flex}.sidebar{width:250px;min-height:100vh;padding:16px 8px;background:#f7f7f8;border-right:1px solid #e5e5e5}.sidebar h2{font-size:13px;margin:0 8px 10px;color:#6b6b6b}.sidebar a{display:block;padding:8px;border-radius:7px;color:inherit;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sidebar a:hover,.sidebar a.active{background:#e7e7e9}.main{max-width:820px;padding:38px 28px;margin:0 auto;flex:1}.main h1{font-size:24px}.message{margin:24px 0}.role{font-size:12px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:6px}.user .content{background:#f3f4f6;border-radius:14px;padding:10px 14px;display:inline-block;max-width:90%;white-space:pre-wrap}.content{word-break:break-word}.media{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.media img{max-width:320px;max-height:320px;border-radius:10px}.attachment{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:8px;padding:7px 10px;color:#111827;text-decoration:none}@media(max-width:700px){body{display:block}.sidebar{width:auto;min-height:0;white-space:nowrap;overflow:auto}.sidebar h2{display:none}.sidebar a{display:inline-block;width:180px}.main{padding:24px 16px}}</style></head><body><nav class="sidebar"><h2>Conversations</h2>${nav}</nav><main class="main"><h1>${escapeHtml(title)}</h1>${renderedMessages}</main></body></html>`;
}

export class ChatGPTConversationExporter {
  private controller: AbortController | null = null;
  private cancelled = false;
  private token = '';
  private nextRequestAt = 0;
  private requestQueue = Promise.resolve();
  private adaptiveDelay = 0;
  private options: ExportOptions | null = null;

  private text(english: string, chinese: string) {
    return this.options?.locale === 'zh' ? chinese : english;
  }

  private send(action: string, payload: Record<string, unknown> = {}) {
    chrome.runtime.sendMessage({ action, ...payload }).catch(() => {});
  }

  cancel() {
    this.cancelled = true;
    this.controller?.abort();
  }

  async scan(options: ExportOptions) {
    this.cancelled = false;
    this.controller = new AbortController();
    this.configure(options);
    await this.getToken();
    const conversations: ConversationSummary[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      this.throwIfCancelled();
      const data = await this.apiGet<ConversationListResponse>(`conversations?offset=${offset}&limit=${PAGE_SIZE}`);
      const items = data.items || [];
      conversations.push(...items);
      this.send('CHATGPT_EXPORT_PROGRESS', { phase: 'scanning', message: this.options?.locale === 'zh' ? `正在扫描对话，已找到 ${conversations.length} 条` : `Scanning conversations, ${conversations.length} found`, progress: data.total ? Math.round(conversations.length / data.total * 100) : undefined });
      if (!items.length || offset + PAGE_SIZE >= (data.total || conversations.length)) break;
    }
    return conversations.filter(item => dateMatches(item, options.startDate, options.endDate));
  }

  async export(conversations: ConversationSummary[], options: ExportOptions) {
    this.cancelled = false;
    this.controller = new AbortController();
    this.configure(options);
    await this.getToken();
    const selected = options.maxItems ? conversations.slice(0, options.maxItems) : conversations;
    const zip = new JSZip();
    const downloaded: Array<{ name: string; title: string; conversation: Conversation; fileMap: Record<string, string> } | undefined> = new Array(selected.length);
    let completed = 0;
    let failed = 0;
    let downloadedFiles = 0;
    let failedFiles = 0;

    await this.mapWithConcurrency(selected, options.concurrency, async (summary, index) => {
      const title = summary.title || 'Untitled';
      const name = `${sanitize(title)}_${summary.id.slice(0, 8)}`;
      try {
        const conversation = await this.apiGet<Conversation>(`conversation/${summary.id}`);
        const fileMap: Record<string, string> = {};
        const usedNames = new Set<string>();
        for (const reference of this.fileReferences(conversation, options.includeImages)) {
          this.throwIfCancelled();
          try {
            const downloadedFile = await this.downloadFile(reference.fileId, reference.filename);
            const filename = this.deduplicate(downloadedFile.filename, usedNames);
            const path = `files/${name}/${filename}`;
            zip.file(path, downloadedFile.data);
            fileMap[reference.fileId] = `../${path}`;
            downloadedFiles++;
          } catch (error) {
            if (this.cancelled) throw error;
            failedFiles++;
          }
        }
        zip.file(`json/${name}.json`, JSON.stringify(conversation, null, 2));
        zip.file(`markdown/${name}.md`, toMarkdown(conversation, fileMap));
        downloaded[index] = { name, title, conversation, fileMap };
      } catch {
        if (!this.cancelled) failed++;
      } finally {
        completed++;
        this.send('CHATGPT_EXPORT_PROGRESS', { phase: 'exporting', message: this.cancelled ? this.text('Stopping and packaging completed conversations...', '正在停止并整理已完成的对话…') : this.options?.locale === 'zh' ? `正在导出 ${completed}/${selected.length}: ${title}` : `Exporting ${completed}/${selected.length}: ${title}`, progress: Math.round(completed / selected.length * 90) });
      }
    });

    const successful = downloaded.filter((item): item is NonNullable<typeof item> => Boolean(item));
    const navItems = successful.map(item => ({ name: item.name, title: item.title }));
    for (const item of successful) zip.file(`html/${item.name}.html`, toHtml(item.conversation, item.fileMap, navItems, item.name));
    this.send('CHATGPT_EXPORT_PROGRESS', { phase: 'packing', message: this.text('Creating ZIP archive...', '正在创建 ZIP 压缩包…'), progress: 94 });
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } }, metadata => {
      this.send('CHATGPT_EXPORT_PROGRESS', { phase: 'packing', message: this.options?.locale === 'zh' ? `正在压缩 ${metadata.percent.toFixed(0)}%` : `Compressing ${metadata.percent.toFixed(0)}%`, progress: 94 + Math.round(metadata.percent * 0.06) });
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chatgpt-export-${new Date().toISOString().slice(0, 10)}.zip`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    const fileSummary = downloadedFiles || failedFiles ? this.options?.locale === 'zh' ? `，附件 ${downloadedFiles}/${downloadedFiles + failedFiles} 个` : `, attachments ${downloadedFiles}/${downloadedFiles + failedFiles}` : '';
    const result = this.cancelled
      ? this.options?.locale === 'zh' ? `已停止，已打包 ${successful.length} 条完整对话${fileSummary}` : `Stopped. Packaged ${successful.length} completed conversations${fileSummary}.`
      : this.options?.locale === 'zh' ? `导出完成：${successful.length}/${selected.length} 条对话${failed ? `，失败 ${failed} 条` : ''}${fileSummary}` : `Export complete: ${successful.length}/${selected.length} conversations${failed ? `, ${failed} failed` : ''}${fileSummary}.`;
    this.send('CHATGPT_EXPORT_COMPLETE', { message: result, progress: 100 });
  }

  private configure(options: ExportOptions) {
    this.options = options;
    this.adaptiveDelay = options.requestDelayMs;
    this.nextRequestAt = 0;
    this.requestQueue = Promise.resolve();
  }

  private throwIfCancelled() {
    if (this.cancelled) throw new ExportCancelledError();
  }

  private async getToken() {
    const response = await fetch('https://chatgpt.com/api/auth/session', { credentials: 'include', signal: this.controller?.signal });
    if (!response.ok) throw new Error(this.options?.locale === 'zh' ? `无法读取 ChatGPT 会话，HTTP ${response.status}` : `Unable to read the ChatGPT session, HTTP ${response.status}`);
    const session = await response.json();
    if (!session.accessToken) throw new Error(this.text('No ChatGPT login was detected. Please sign in first.', '未检测到 ChatGPT 登录状态，请先登录。'));
    this.token = session.accessToken;
  }

  private async waitForRequest() {
    const request = this.requestQueue.then(async () => {
      const remaining = this.nextRequestAt - Date.now();
      if (remaining > 0) await new Promise(resolve => window.setTimeout(resolve, remaining));
      this.throwIfCancelled();
      const jitter = this.options?.requestJitterMs ? Math.floor(Math.random() * (this.options.requestJitterMs + 1)) : 0;
      this.nextRequestAt = Date.now() + this.adaptiveDelay + jitter;
    });
    this.requestQueue = request.catch(() => {});
    return request;
  }

  private async request(url: string, init: RequestInit = {}) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      await this.waitForRequest();
      const response = await fetch(url, { ...init, credentials: 'include', signal: this.controller?.signal });
      if (response.status !== 429 || attempt === MAX_RETRIES) return response;
      const retryAfter = Number.parseFloat(response.headers.get('retry-after') || '');
      const cooldown = Number.isFinite(retryAfter) ? retryAfter * 1000 : Math.min(15_000, 1_000 * 2 ** attempt);
      this.adaptiveDelay = Math.min(60_000, Math.max(this.options?.requestDelayMs || 0, this.adaptiveDelay * 2, cooldown));
      this.nextRequestAt = Math.max(this.nextRequestAt, Date.now() + cooldown);
      this.send('CHATGPT_EXPORT_PROGRESS', { phase: 'rate-limit', message: this.options?.locale === 'zh' ? `触发限流，${Math.ceil(cooldown / 1000)} 秒后重试` : `Rate limited. Retrying in ${Math.ceil(cooldown / 1000)} seconds`, progress: undefined });
    }
    throw new Error(this.text('Request retry limit reached.', '请求重试次数已用尽'));
  }

  private async apiGet<T>(path: string): Promise<T> {
    const response = await this.request(`${API}/${path}`, { headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}`, 'Oai-Device-Id': crypto.randomUUID(), 'Oai-Language': 'en-US' } });
    if (!response.ok) throw new Error(this.options?.locale === 'zh' ? `ChatGPT API 请求失败，HTTP ${response.status}` : `ChatGPT API request failed, HTTP ${response.status}`);
    return response.json() as Promise<T>;
  }

  private async downloadFile(fileId: string, fallbackName: string) {
    const metadata = await this.apiGet<DownloadMetadata>(`files/download/${fileId}`);
    if (!metadata.download_url) throw new Error(this.text('The attachment has no download URL.', '附件缺少下载地址'));
    const response = await this.request(metadata.download_url);
    if (!response.ok) throw new Error(this.options?.locale === 'zh' ? `附件下载失败，HTTP ${response.status}` : `Attachment download failed, HTTP ${response.status}`);
    let filename = metadata.file_name || fallbackName || fileId;
    if (!filename.includes('.')) filename += mimeExtensions[(response.headers.get('content-type') || '').split(';')[0]] || '';
    return { filename: sanitize(filename), data: await response.arrayBuffer() };
  }

  private fileReferences(conversation: Conversation, includeImages: boolean) {
    const references: FileReference[] = [];
    const seen = new Set<string>();
    for (const node of Object.values(conversation.mapping || {})) {
      const message = node.message;
      if (!message) continue;
      for (const part of message.content?.parts || []) {
        if (typeof part === 'string') continue;
        const id = includeImages && part.content_type === 'image_asset_pointer' ? part.asset_pointer?.match(/^(?:file-service|sediment):\/\/(.+)$/)?.[1] : undefined;
        if (id && !seen.has(id)) { seen.add(id); references.push({ fileId: id, filename: part.metadata?.dalle?.prompt ? 'dalle_image.png' : 'image.png' }); }
      }
      for (const attachment of message.metadata?.attachments || []) {
        if (attachment.id && !seen.has(attachment.id)) { seen.add(attachment.id); references.push({ fileId: attachment.id, filename: attachment.name || 'attachment' }); }
      }
      for (const citation of message.metadata?.citations || []) {
        const id = citation.metadata?.file_id || citation.file_id;
        if (id && !seen.has(id)) { seen.add(id); references.push({ fileId: id, filename: citation.metadata?.title || citation.title || 'citation' }); }
      }
    }
    return references;
  }

  private deduplicate(filename: string, used: Set<string>) {
    if (!used.has(filename)) { used.add(filename); return filename; }
    const index = filename.lastIndexOf('.');
    const base = index > 0 ? filename.slice(0, index) : filename;
    const extension = index > 0 ? filename.slice(index) : '';
    let suffix = 1;
    while (used.has(`${base}_${suffix}${extension}`)) suffix++;
    const result = `${base}_${suffix}${extension}`;
    used.add(result);
    return result;
  }

  private async mapWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>) {
    let index = 0;
    const run = async () => {
      while (!this.cancelled) {
        const current = index++;
        if (current >= items.length) return;
        await worker(items[current], current);
      }
    };
    await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, run));
  }
}
