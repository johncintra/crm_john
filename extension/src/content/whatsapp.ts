import type { CurrentConversation } from '../shared/types';
import { extractPhoneFromText, firstString, normalizePhone } from '../shared/utils';

const CHAT_HEADER_SELECTORS = [
  '[data-testid="conversation-info-header-chat-title"]',
  'header [title]',
  'header span[dir="auto"]',
  'main header [title]',
  'main header span[dir="auto"]'
];

const SEARCH_BOX_SELECTORS = [
  '[data-testid="chat-list-search"] [contenteditable="true"]',
  'div[contenteditable="true"][data-tab="3"]',
  'div[role="textbox"][contenteditable="true"][data-tab="3"]'
];

const COMPOSE_BOX_SELECTORS = [
  '[aria-label="Digite uma mensagem"]',
  '[aria-label="Type a message"]',
  '[data-testid="conversation-compose-box-input"]',
  'footer [contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][data-tab]'
];

let lastComposeBoxLog = '';

export function getMessageComposeBox(): HTMLElement | null {
  const matches = COMPOSE_BOX_SELECTORS.map((selector) => ({
    selector,
    node: document.querySelector(selector)
  }));
  const found = matches.find((m): m is { selector: string; node: HTMLElement } => m.node instanceof HTMLElement);

  const summary = matches.map((m) => `${m.selector} => ${m.node ? 'OK' : 'null'}`).join(' | ');
  if (summary !== lastComposeBoxLog) {
    lastComposeBoxLog = summary;
    // eslint-disable-next-line no-console
    console.log('[CRM macro] busca pelo compose box:', summary);
  }

  return found?.node ?? null;
}

// Replaces the trailing "/shortcut" the seller just typed with the macro's
// full content — collapses the selection to the end of the box, then
// extends it backward by the slash command's own length so
// execCommand('insertText', ...) overwrites exactly that span instead of
// just appending after it.
export function replaceComposerSlashCommand(typedLength: number, replacement: string): boolean {
  // eslint-disable-next-line no-console
  console.log('[CRM macro] substituindo', typedLength, 'caracteres por:', JSON.stringify(replacement));
  const element = getMessageComposeBox();
  if (!element) {
    return false;
  }

  element.focus();
  const selection = window.getSelection();
  if (!selection) {
    return false;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);

  for (let i = 0; i < typedLength; i += 1) {
    selection.modify('extend', 'backward', 'character');
  }

  const inserted = document.execCommand?.('insertText', false, replacement) ?? false;
  if (inserted) {
    return true;
  }

  element.textContent = replacement;
  element.dispatchEvent(
    new InputEvent('input', { bubbles: true, cancelable: true, data: replacement, inputType: 'insertText' })
  );
  return true;
}

export function getCurrentConversation(): CurrentConversation {
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.get('phone');
  const titleCandidates = CHAT_HEADER_SELECTORS.map((selector) => {
    const node = document.querySelector(selector);
    const candidate = node?.getAttribute('title') ?? node?.textContent ?? null;
    return sanitizeConversationLabel(candidate);
  });
  const label = firstString(titleCandidates);
  const phoneFromLabel = label ? extractPhoneFromText(label) : null;
  const phone = normalizeDetectedPhone(fromQuery) ?? normalizeDetectedPhone(phoneFromLabel);

  return {
    phone,
    label
  };
}

export interface WhatsAppConversationItem {
  id: string;
  name: string;
  phone: string | null;
  avatarUrl: string | null;
}

export function getConversationIdentity(item: Pick<WhatsAppConversationItem, 'name' | 'phone'>): string {
  const normalizedPhone = normalizeDetectedPhone(item.phone ?? null);
  const normalizedName = (item.name ?? '').trim().toLowerCase();

  return normalizedPhone ? `phone:${normalizedPhone}` : `name:${normalizedName}`;
}

export function dedupeConversationItems(items: WhatsAppConversationItem[]): WhatsAppConversationItem[] {
  const deduped: WhatsAppConversationItem[] = [];

  for (const item of items) {
    const normalizedPhone = normalizeDetectedPhone(item.phone ?? null);
    const normalizedName = normalizeConversationLabel(item.name);

    const existingIndex = deduped.findIndex((current) => {
      const currentPhone = normalizeDetectedPhone(current.phone ?? null);
      const currentName = normalizeConversationLabel(current.name);

      if (normalizedPhone && currentPhone && normalizedPhone === currentPhone) {
        return true;
      }

      if (normalizedName && currentName && normalizedName === currentName) {
        return true;
      }

      return false;
    });

    if (existingIndex === -1) {
      deduped.push({
        ...item,
        id: getConversationIdentity(item)
      });
      continue;
    }

    const existing = deduped[existingIndex];
    const mergedName = existing.name.length >= item.name.length ? existing.name : item.name;
    const mergedPhone = existing.phone ?? item.phone;

    deduped[existingIndex] = {
      id: getConversationIdentity({ name: mergedName, phone: mergedPhone }),
      name: mergedName,
      phone: mergedPhone,
      avatarUrl: existing.avatarUrl ?? item.avatarUrl
    };
  }

  return deduped;
}

function parseConversationRow(row: HTMLElement): WhatsAppConversationItem | null {
  if (isLikelyGroupOrCommunityRow(row)) {
    return null;
  }

  const textCandidates = [
    row.querySelector('img')?.getAttribute('alt') ?? null,
    row.querySelector('[title]')?.getAttribute('title') ?? null,
    ...Array.from(row.querySelectorAll('span[dir="auto"], div[dir="auto"]')).map((node) =>
      node.textContent?.trim() ?? null
    )
  ];

  const name = firstString(textCandidates);
  if (!name || ['WhatsApp', 'Meta AI'].includes(name)) {
    return null;
  }

  const phone = normalizeDetectedPhone(extractPhoneFromText(name) ?? extractPhoneFromText(row.textContent));
  const avatar = row.querySelector('img');
  const avatarUrl = avatar instanceof HTMLImageElement ? avatar.src : null;
  const dedupeKey = getConversationIdentity({ name, phone });

  return {
    id: dedupeKey,
    name,
    phone,
    avatarUrl
  };
}

function isLikelyGroupOrCommunityRow(row: HTMLElement): boolean {
  const iconSelectors = [
    '[data-icon*="group" i]',
    '[data-icon*="community" i]',
    '[data-icon*="newsletter" i]',
    '[aria-label*="grupo" i]',
    '[aria-label*="comunidade" i]',
    '[aria-label*="community" i]'
  ];

  if (row.querySelector(iconSelectors.join(', '))) {
    return true;
  }

  const rowText = normalizeConversationLabel(row.textContent);
  if (!rowText) {
    return false;
  }

  if (/(^|\s)my files(\s|$)/i.test(rowText)) {
    return true;
  }

  if (/(^|\s)grupos?(\s|$)|comunidade|community|newsletter/i.test(rowText)) {
    return true;
  }

  if (/~[^:]{2,60}:/.test(rowText)) {
    return true;
  }

  return false;
}

export function getCurrentConversationAvatar(): string | null {
  const selectedConversation = getSelectedConversationFromList();
  if (selectedConversation?.avatarUrl) {
    return selectedConversation.avatarUrl;
  }

  const selectors = [
    'main header img',
    'header img',
    '[data-testid="conversation-info-header"] img',
    '[data-testid="cell-frame-container"] img'
  ];

  for (const selector of selectors) {
    const image = document.querySelector(selector);
    if (image instanceof HTMLImageElement && image.src) {
      return image.src;
    }
  }

  return null;
}

export function getSelectedConversationFromList(): WhatsAppConversationItem | null {
  const paneSide = document.querySelector('#pane-side');
  if (!(paneSide instanceof HTMLElement)) {
    return null;
  }

  const selectedNode = paneSide.querySelector(
    '[aria-selected="true"], [data-testid="cell-frame-container"][aria-selected="true"]'
  );

  if (!(selectedNode instanceof HTMLElement)) {
    return null;
  }

  const row =
    selectedNode.closest('[role="listitem"]') ??
    selectedNode.closest('[data-testid="cell-frame-container"]') ??
    selectedNode;

  return row instanceof HTMLElement ? parseConversationRow(row) : null;
}

export function getWhatsAppConversationList(): WhatsAppConversationItem[] {
  const rows = getConversationRowElements();
  const items: WhatsAppConversationItem[] = [];

  for (const row of rows) {
    if (!(row instanceof HTMLElement)) {
      continue;
    }

    const item = parseConversationRow(row);
    if (!item) {
      continue;
    }

    items.push(item);
  }

  return dedupeConversationItems(items);
}

function getConversationListScroller(): HTMLElement | null {
  const paneSide = document.querySelector('#pane-side');
  if (!(paneSide instanceof HTMLElement)) {
    return null;
  }

  const candidates = [
    paneSide,
    ...Array.from(paneSide.querySelectorAll<HTMLElement>('*'))
  ];

  return (
    candidates.find(
      (element) => element.scrollHeight > element.clientHeight + 100 && element.clientHeight > 200
    ) ?? null
  );
}

export async function getAllWhatsAppConversationList(): Promise<WhatsAppConversationItem[]> {
  const scroller = getConversationListScroller();
  if (!scroller) {
    return getWhatsAppConversationList();
  }

  const originalScrollTop = scroller.scrollTop;
  const seen = new Map<string, WhatsAppConversationItem>();
  let stablePasses = 0;

  try {
    for (let iteration = 0; iteration < 60; iteration += 1) {
      for (const row of getConversationRowElements()) {
        if (!(row instanceof HTMLElement)) {
          continue;
        }

        const item = parseConversationRow(row);
        if (item && !seen.has(item.id)) {
          seen.set(item.id, item);
        }
      }

      const nextScrollTop = Math.min(scroller.scrollTop + scroller.clientHeight - 120, scroller.scrollHeight);
      const reachedEnd = nextScrollTop <= scroller.scrollTop || scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 8;

      if (reachedEnd) {
        stablePasses += 1;
        if (stablePasses >= 2) {
          break;
        }
        scroller.scrollTop = 0;
      } else {
        stablePasses = 0;
        scroller.scrollTop = nextScrollTop;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 120));
    }
  } finally {
    scroller.scrollTop = originalScrollTop;
  }

  return dedupeConversationItems(Array.from(seen.values()));
}

function getChatListSearchBox(): HTMLElement | null {
  const sideRoot =
    document.querySelector('#side') ??
    document.querySelector('#pane-side')?.parentElement ??
    document.querySelector('[data-testid="chat-list-search"]')?.parentElement;

  if (!(sideRoot instanceof HTMLElement)) {
    return null;
  }

  return (
    SEARCH_BOX_SELECTORS.map((selector) => sideRoot.querySelector(selector)).find(
      (node): node is HTMLElement => node instanceof HTMLElement
    ) ?? null
  );
}

function getConversationRowElements(): HTMLElement[] {
  const paneSide = document.querySelector('#pane-side');
  if (!(paneSide instanceof HTMLElement)) {
    return [];
  }

  const candidates = Array.from(
    paneSide.querySelectorAll(
      [
        '[role="listitem"]',
        '[data-testid="cell-frame-container"]',
        'div[tabindex="0"]',
        'div[tabindex="-1"]'
      ].join(', ')
    )
  );

  const uniqueRows: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  for (const element of candidates) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    const row =
      element.closest('[role="listitem"]') ??
      element.closest('[data-testid="cell-frame-container"]') ??
      element;

    if (!(row instanceof HTMLElement) || seen.has(row)) {
      continue;
    }

    const titleNode = row.querySelector('[title], span[dir="auto"], div[dir="auto"]');
    const hasAvatar = row.querySelector('img');
    const hasButtonLikeShape = row.getBoundingClientRect().height > 40;

    if (!titleNode || !hasAvatar || !hasButtonLikeShape) {
      continue;
    }

    seen.add(row);
    uniqueRows.push(row);
  }

  return uniqueRows;
}

function getFirstConversationRow(): HTMLElement | null {
  return getConversationRowElements()[0] ?? null;
}

function getFirstSearchResultRow(): HTMLElement | null {
  const paneSide = document.querySelector('#pane-side');
  if (!(paneSide instanceof HTMLElement)) {
    return null;
  }

  const candidates = Array.from(
    paneSide.querySelectorAll(
      [
        '[role="listitem"]',
        '[data-testid="cell-frame-container"]',
        'div[tabindex="0"]',
        'div[tabindex="-1"]'
      ].join(', ')
    )
  );

  for (const element of candidates) {
    if (!(element instanceof HTMLElement)) {
      continue;
    }

    const row =
      element.closest('[role="listitem"]') ??
      element.closest('[data-testid="cell-frame-container"]') ??
      element;

    if (!(row instanceof HTMLElement)) {
      continue;
    }

    const hasSearchableText = Boolean(
      row.textContent?.trim() || row.querySelector('[title], span[dir="auto"], div[dir="auto"]')
    );
    const hasButtonLikeShape = row.getBoundingClientRect().height > 40;

    if (hasSearchableText && hasButtonLikeShape) {
      return row;
    }
  }

  return null;
}

function normalizeDetectedPhone(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = normalizePhone(value);
  if (normalized.length < 10) {
    return null;
  }

  return normalized;
}

function normalizeConversationLabel(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function sanitizeConversationLabel(value: string | null | undefined): string | null {
  const label = (value ?? '').trim();
  if (!label) {
    return null;
  }

  const normalized = label.toLowerCase();
  const blockedLabels = new Set([
    'dados do perfil',
    'profile details',
    'info do contato',
    'contact info',
    'informacoes do contato',
    'informações do contato',
    'pesquisar ou começar uma nova conversa',
    'search or start new chat'
  ]);

  if (blockedLabels.has(normalized)) {
    return null;
  }

  return label;
}

function clickConversationRow(row: HTMLElement): boolean {
  const clickableTarget =
    row.querySelector<HTMLElement>('[role="gridcell"]') ??
    row.querySelector<HTMLElement>('[tabindex]') ??
    row;

  row.scrollIntoView({ block: 'nearest' });
  clickableTarget.focus();
  clickableTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  clickableTarget.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  clickableTarget.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  clickableTarget.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  clickableTarget.click();

  return true;
}

function navigateWithinWhatsApp(relativeUrl: string): void {
  const appRoot =
    document.querySelector('#app') ??
    document.querySelector('[data-testid="app-wrapper-web"]') ??
    document.body;

  const anchor = document.createElement('a');
  anchor.href = relativeUrl;
  anchor.style.display = 'none';
  appRoot.appendChild(anchor);

  anchor.dispatchEvent(
    new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      view: window
    })
  );

  anchor.remove();
}

function findConversationRow(target: string, phone?: string | null): HTMLElement | null {
  const normalizedTarget = normalizeConversationLabel(target);
  const normalizedPhone = normalizeDetectedPhone(phone ?? null);
  let bestMatch: { row: HTMLElement; score: number } | null = null;

  for (const row of getConversationRowElements()) {
    const textCandidates = [
      row.querySelector('img')?.getAttribute('alt') ?? null,
      row.querySelector('[title]')?.getAttribute('title') ?? null,
      ...Array.from(row.querySelectorAll('span[dir="auto"], div[dir="auto"]')).map((node) =>
        node.textContent?.trim() ?? null
      )
    ];

    const rowLabel = firstString(textCandidates);
    if (!rowLabel) {
      continue;
    }

    const normalizedRowLabel = normalizeConversationLabel(rowLabel);
    const rowPhone = normalizeDetectedPhone(
      extractPhoneFromText(rowLabel) ?? extractPhoneFromText(row.textContent)
    );

    let score = 0;

    if (normalizedTarget && normalizedRowLabel === normalizedTarget) {
      score += 4;
    } else if (normalizedTarget && normalizedRowLabel.includes(normalizedTarget)) {
      score += 2;
    }

    if (normalizedPhone && rowPhone === normalizedPhone) {
      score += 5;
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { row, score };
    }
  }

  return bestMatch?.row ?? null;
}

export function insertTextIntoWhatsAppComposer(text: string): boolean {
  const candidates = [
    'footer [contenteditable="true"][role="textbox"]',
    '[data-testid="conversation-compose-box-input"]',
    'div[contenteditable="true"][data-tab]'
  ];

  const element = candidates
    .map((selector) => document.querySelector(selector))
    .find((node): node is HTMLElement => node instanceof HTMLElement);

  if (!element) {
    return false;
  }

  element.focus();

  const selection = window.getSelection();
  if (selection) {
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  const inserted = document.execCommand?.('insertText', false, text) ?? false;
  if (inserted) {
    return true;
  }

  element.textContent = text;
  element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      data: text,
      inputType: 'insertText'
    })
  );

  return true;
}

function clearEditableText(element: HTMLElement) {
  element.focus();
  document.execCommand?.('selectAll', false);
  document.execCommand?.('delete', false);
  element.textContent = '';
  element.dispatchEvent(
    new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      data: '',
      inputType: 'deleteContentBackward'
    })
  );
}

function insertEditableText(element: HTMLElement, text: string) {
  element.focus();
  const inserted = document.execCommand?.('insertText', false, text) ?? false;

  if (!inserted) {
    element.textContent = text;
    element.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        data: text,
        inputType: 'insertText'
      })
    );
  }
}

export async function openConversationInWhatsApp(
  phone: string,
  label?: string | null
): Promise<boolean> {
  const target = label?.trim() || phone;

  if (target) {
    const visibleRow = findConversationRow(target, phone);
    if (visibleRow) {
      return clickConversationRow(visibleRow);
    }
  }

  const searchBox = getChatListSearchBox();

  if (!searchBox) {
    return false;
  }

  clearEditableText(searchBox);
  insertEditableText(searchBox, target);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));

    const searchedRow = findConversationRow(target, phone);
    if (searchedRow) {
      clearEditableText(searchBox);
      return clickConversationRow(searchedRow);
    }
  }

  searchBox.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true
    })
  );
  searchBox.dispatchEvent(
    new KeyboardEvent('keyup', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true
    })
  );

  await new Promise((resolve) => window.setTimeout(resolve, 220));

  const enteredRow = findConversationRow(target, phone);
  if (enteredRow) {
    clearEditableText(searchBox);
    return clickConversationRow(enteredRow);
  }

  if (target) {
    const firstVisibleResult = getFirstSearchResultRow() ?? getFirstConversationRow();
    if (firstVisibleResult) {
      clearEditableText(searchBox);
      return clickConversationRow(firstVisibleResult);
    }
  }

  clearEditableText(searchBox);

  return false;
}

export async function openConversationFromSearchResult(query: string): Promise<boolean> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return false;
  }

  const searchBox = getChatListSearchBox();
  if (!searchBox) {
    return false;
  }

  clearEditableText(searchBox);
  insertEditableText(searchBox, trimmedQuery);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 220));

    const firstVisibleResult = getFirstSearchResultRow() ?? getFirstConversationRow();
    if (firstVisibleResult) {
      clearEditableText(searchBox);
      return clickConversationRow(firstVisibleResult);
    }
  }

  clearEditableText(searchBox);
  return false;
}

export async function openConversationByPhoneNumber(phone: string): Promise<boolean> {
  const normalizedPhone = normalizeDetectedPhone(phone);
  if (!normalizedPhone) {
    return false;
  }

  const previousConversation = getCurrentConversation();
  const nextUrl = new URL(window.location.href);
  nextUrl.pathname = '/send';
  nextUrl.search = '';
  nextUrl.searchParams.set('phone', normalizedPhone);
  nextUrl.searchParams.set('type', 'phone_number');
  nextUrl.searchParams.set('app_absent', '0');
  const nextRelativeUrl = `${nextUrl.pathname}${nextUrl.search}`;
  const currentRelativeUrl = `${window.location.pathname}${window.location.search}`;

  navigateWithinWhatsApp(nextRelativeUrl);
  await new Promise((resolve) => window.setTimeout(resolve, 120));

  if (`${window.location.pathname}${window.location.search}` !== nextRelativeUrl) {
    if (currentRelativeUrl === nextRelativeUrl) {
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
      window.dispatchEvent(new Event('locationchange'));
      window.dispatchEvent(new Event('hashchange'));
    } else {
      window.history.pushState({}, '', nextRelativeUrl);
      window.dispatchEvent(new Event('pushstate'));
      window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state }));
      window.dispatchEvent(new Event('locationchange'));
      window.dispatchEvent(new Event('hashchange'));
    }
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 300));

    const nextConversation = getCurrentConversation();
    const conversationChanged =
      nextConversation.label !== previousConversation.label ||
      nextConversation.phone !== previousConversation.phone;

    if (conversationChanged && (nextConversation.phone === normalizedPhone || !!nextConversation.label)) {
      return true;
    }
  }

  return false;
}

export function forceOpenConversationByPhoneNumber(phone: string): boolean {
  const normalizedPhone = normalizeDetectedPhone(phone);
  if (!normalizedPhone) {
    return false;
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.pathname = '/send';
  nextUrl.search = '';
  nextUrl.searchParams.set('phone', normalizedPhone);
  nextUrl.searchParams.set('type', 'phone_number');
  nextUrl.searchParams.set('app_absent', '0');
  // A synthetic click (navigateWithinWhatsApp) only works if WhatsApp's own
  // router intercepts it, which turned out to be unreliable in practice
  // (needed several clicks before it "took"). window.location.assign is
  // exactly how official wa.me/click-to-chat links open a brand new
  // conversation, and WhatsApp Web's bootstrap explicitly reads ?phone= on
  // load — it's a full reload, but a reliable one.
  window.location.assign(`${nextUrl.pathname}${nextUrl.search}`);
  return true;
}

export interface ScrapedMessage {
  direction: 'INBOUND' | 'OUTBOUND';
  content: string;
  sentAt: string;
  externalId: string;
}

const MESSAGE_TIMESTAMP_PATTERN = /\[(\d{1,2}:\d{2}),\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})\]/;

function parseWhatsAppMessageTimestamp(preText: string): Date | null {
  const match = preText.match(MESSAGE_TIMESTAMP_PATTERN);
  if (!match) {
    return null;
  }

  const [, time, day, month, yearRaw] = match;
  const [hours, minutes] = time.split(':').map(Number);
  const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
  const date = new Date(year, Number(month) - 1, Number(day), hours, minutes, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getOpenConversationMessages(sinceMs: number): ScrapedMessage[] {
  const nodes = document.querySelectorAll<HTMLElement>('[data-pre-plain-text]');
  const messages: ScrapedMessage[] = [];

  nodes.forEach((node) => {
    const preText = node.getAttribute('data-pre-plain-text') ?? '';
    const sentAt = parseWhatsAppMessageTimestamp(preText);
    if (!sentAt || sentAt.getTime() < sinceMs) {
      return;
    }

    const bubble = node.closest('[class*="message-out"], [class*="message-in"]');
    const direction = bubble?.className.includes('message-out') ? 'OUTBOUND' : 'INBOUND';

    const textNode = node.querySelector('span.selectable-text, span[dir="ltr"], span[dir="auto"]');
    const content = (textNode?.textContent ?? node.textContent ?? '').trim();
    if (!content) {
      return;
    }

    const externalId = `${sentAt.getTime()}-${direction}-${content.slice(0, 60)}`;
    messages.push({ direction, content, sentAt: sentAt.toISOString(), externalId });
  });

  return messages;
}

function findVisiblePhoneLikeStrings(): Set<string> {
  const text = document.body.innerText || '';
  const matches = text.match(/\+?\d[\d\s\-().]{7,}\d/g) ?? [];
  const result = new Set<string>();

  for (const match of matches) {
    const normalized = normalizePhone(match);
    if (normalized.length >= 10 && normalized.length <= 15) {
      result.add(normalized);
    }
  }

  return result;
}

export async function getRealContactPhoneNumber(): Promise<string | null> {
  let titleEl: HTMLElement | null = null;

  // The conversation header may still be re-rendering right after we just
  // navigated/clicked into it, so retry locating the title a few times
  // instead of giving up on the first miss.
  for (let attempt = 0; attempt < 6 && !titleEl; attempt += 1) {
    titleEl = document.querySelector<HTMLElement>(
      '[data-testid="conversation-info-header-chat-title"], [data-testid="conversation-info-header"]'
    );
    if (!titleEl) {
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
  }

  if (!titleEl) {
    return null;
  }

  // The drawer-right container apparently stays mounted in the DOM even
  // when closed (just empty), so element existence alone doesn't tell us
  // whether it's actually showing content — check for real text instead.
  const existingPanel = document.querySelector<HTMLElement>('[data-testid="drawer-right"]');
  const wasAlreadyOpen = !!existingPanel && (existingPanel.textContent ?? '').trim().length > 20;

  const before = findVisiblePhoneLikeStrings();

  // If the drawer was already open (e.g. left open from a previous lookup),
  // clicking the title would close it instead of opening it — skip the
  // open-click in that case.
  if (!wasAlreadyOpen) {
    titleEl.click();
  }

  let phone: string | null = null;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 250));

    const panel = document.querySelector<HTMLElement>('[data-testid="drawer-right"]');
    if (!panel) {
      continue;
    }

    const direct = extractPhoneFromText(panel.textContent ?? '');
    if (direct) {
      phone = direct;
      break;
    }

    const after = findVisiblePhoneLikeStrings();
    const newPhones = [...after].filter((candidate) => !before.has(candidate));
    if (newPhones.length) {
      phone = newPhones[0];
      break;
    }
  }

  // Close the drawer again so we don't leave the seller's UI in a
  // different state than they had it (only if we were the ones who opened it).
  if (!wasAlreadyOpen) {
    titleEl.click();
  }

  return phone;
}
