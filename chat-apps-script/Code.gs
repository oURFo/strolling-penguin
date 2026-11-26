const CHAT_KEY = 'chat-recent-v1';
const CHAT_LIMIT = 50;
const CHAT_RETRY = 'chat-storage-retry';

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Chat')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getChat() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get(CHAT_KEY);
  if (cached !== null) return {ok: true, messages: publicMessages_(JSON.parse(cached))};
  return withStorage_(cache, function () {
    const ready = cache.get(CHAT_KEY);
    const messages = ready === null ? readRecent_(chatSheet_()) : JSON.parse(ready);
    if (ready === null) cacheMessages_(cache, messages);
    return {ok: true, messages: publicMessages_(messages)};
  });
}

function sendChat(input) {
  const name = typeof input?.name === 'string' ? input.name.trim() : '';
  const text = typeof input?.text === 'string' ? input.text.trim() : '';
  const token = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!name || name.length > 20 || !text || text.length > 200 ||
      !token.test(input?.id ?? '') || !token.test(input?.visitor ?? '')) return {ok: false, error: 'invalid'};
  const cache = CacheService.getScriptCache();
  return withStorage_(cache, function () {
    const now = Date.now();
    const cached = cache.get(CHAT_KEY);
    const duplicate = message => message.id === input.id && message.visitor === input.visitor;
    const throttled = message => now - message.time < 1000 ||
      (message.visitor === input.visitor && now - message.time < 8000);
    if (cached !== null) {
      const recent = JSON.parse(cached);
      if (recent.some(duplicate)) return {ok: true, messages: publicMessages_(recent)};
      if (recent.some(throttled)) return {ok: false, error: 'slow'};
    }
    const sheet = chatSheet_();
    const messages = readRecent_(sheet);
    if (messages.some(duplicate)) {
      cacheMessages_(cache, messages);
      return {ok: true, messages: publicMessages_(messages)};
    }
    if (messages.some(throttled)) return {ok: false, error: 'slow'};
    const message = {id: input.id, visitor: input.visitor, name, text, time: now};
    // A JSON object starts with "{", so user text cannot become a spreadsheet formula.
    sheet.appendRow([JSON.stringify(message)]);
    SpreadsheetApp.flush();
    messages.push(message);
    const recent = messages.slice(-CHAT_LIMIT);
    cacheMessages_(cache, recent);
    return {ok: true, messages: publicMessages_(recent)};
  });
}

function chatSheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('CHAT_SHEET_ID');
  if (!id) throw new Error('CHAT_SHEET_ID is missing');
  const sheet = SpreadsheetApp.openById(id).getSheetByName('Chat');
  if (!sheet) throw new Error('Chat sheet tab is missing');
  return sheet;
}

// Run from the Apps Script editor as the account that deployed this room.
function diagnoseChatSetup_() {
  const sheet = chatSheet_();
  const messages = readRecent_(sheet);
  console.log('Chat spreadsheet OK. Recent readable messages: ' + messages.length);
}

function readRecent_(sheet) {
  const last = sheet.getLastRow();
  if (!last) return [];
  const count = Math.min(last, CHAT_LIMIT);
  return sheet.getRange(last - count + 1, 1, count, 1).getValues().flat()
    .flatMap(value => {
      if (!value) return [];
      try {
        const message = JSON.parse(value);
        return typeof message?.id === 'string' && typeof message.name === 'string' &&
          typeof message.text === 'string' && Number.isFinite(message.time) ? [message] : [];
      } catch { return []; }
    });
}

function publicMessages_(messages) {
  return messages.map(({id, visitor, name, text, time}) => ({
    id, name, text, time, tag: typeof visitor === 'string' ? visitor.slice(-5).toUpperCase() : '',
  }));
}

function cacheMessages_(cache, messages) {
  try {
    cache.put(CHAT_KEY, JSON.stringify(messages), 600);
  } catch (error) {
    try { cache.remove(CHAT_KEY); } catch { /* Storage remains authoritative. */ }
    console.error('Chat cache update failed: ' + error.message);
  }
}

function withStorage_(cache, operation) {
  if (cache.get(CHAT_RETRY)) return {ok: false, error: 'unavailable'};
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(300)) return {ok: false, error: 'busy'};
  try {
    if (cache.get(CHAT_RETRY)) return {ok: false, error: 'unavailable'};
    return operation();
  } catch (error) {
    console.error('Chat spreadsheet operation failed: ' + error.message);
    try { cache.put(CHAT_RETRY, '1', 30); } catch { /* Continue returning a retryable error. */ }
    return {ok: false, error: 'unavailable'};
  } finally {
    lock.releaseLock();
  }
}
