import { useEffect, useState } from 'react';
import {
  dedupeConversationItems,
  getAllWhatsAppConversationList,
  getConversationIdentity,
  getWhatsAppConversationList,
  type WhatsAppConversationItem
} from '../whatsapp';

// Opening a brand-new contact's chat on a different WhatsApp number requires
// a full page reload (see forceOpenConversationByPhoneNumber), which wipes
// these module-level variables. Without persisting them, every reload makes
// "Últimas Conversas" re-scan from scratch, adding several extra seconds on
// top of the reload itself. sessionStorage survives a reload (cleared only
// when the tab closes), so stash the cache there too.
const SESSION_STORAGE_KEY = 'crm-john-cached-conversations';
const SESSION_STORAGE_SCANNED_KEY = 'crm-john-has-scanned-all-conversations';

function readSessionCache(): WhatsAppConversationItem[] {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as WhatsAppConversationItem[]) : [];
  } catch {
    return [];
  }
}

function writeSessionCache(items: WhatsAppConversationItem[], scannedAll: boolean): void {
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(items));
    window.sessionStorage.setItem(SESSION_STORAGE_SCANNED_KEY, scannedAll ? '1' : '0');
  } catch {
    // sessionStorage can throw in rare cases (quota, privacy mode) — caching
    // is a pure performance optimization, safe to skip silently.
  }
}

let cachedConversationItems: WhatsAppConversationItem[] = readSessionCache();
let hasScannedAllConversations = cachedConversationItems.length > 0 && window.sessionStorage.getItem(SESSION_STORAGE_SCANNED_KEY) === '1';
let hasRequestedAllConversationsScan = false;
let allConversationsScanPromise: Promise<WhatsAppConversationItem[]> | null = null;

interface UseWhatsAppConversationListOptions {
  scanAll?: boolean;
}

export function useWhatsAppConversationList(
  options: UseWhatsAppConversationListOptions = {}
): WhatsAppConversationItem[] {
  const [items, setItems] = useState<WhatsAppConversationItem[]>(() =>
    cachedConversationItems.length ? cachedConversationItems : getWhatsAppConversationList()
  );
  const { scanAll = false } = options;

  useEffect(() => {
    const mergeItems = (previous: WhatsAppConversationItem[], next: WhatsAppConversationItem[]) => {
      const merged: WhatsAppConversationItem[] = [];
      const seen = new Set<string>();

      for (const item of next) {
        const identity = getConversationIdentity(item);
        if (seen.has(identity)) {
          continue;
        }

        seen.add(identity);
        merged.push(item);
      }

      for (const item of previous) {
        const identity = getConversationIdentity(item);
        if (seen.has(identity)) {
          continue;
        }

        seen.add(identity);
        merged.push(item);
      }

      return dedupeConversationItems(merged);
    };

    const emitItems = () => {
      const next = getWhatsAppConversationList();
      setItems((previous) => {
        const merged = hasScannedAllConversations ? mergeItems(previous, next) : next;
        const prevSerialized = JSON.stringify(previous);
        const nextSerialized = JSON.stringify(merged);
        if (prevSerialized === nextSerialized) {
          return previous;
        }

        cachedConversationItems = merged;
        writeSessionCache(merged, hasScannedAllConversations);
        return merged;
      });
    };

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(emitItems);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    const interval = window.setInterval(emitItems, 1500);
    emitItems();

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!scanAll) {
      return;
    }

    if (hasScannedAllConversations) {
      if (cachedConversationItems.length) {
        setItems((previous) => {
          const prevSerialized = JSON.stringify(previous);
          const nextSerialized = JSON.stringify(cachedConversationItems);
          return prevSerialized === nextSerialized ? previous : cachedConversationItems;
        });
      }
      return;
    }

    let cancelled = false;

    const scan = async () => {
      if (!allConversationsScanPromise) {
        hasRequestedAllConversationsScan = true;
        allConversationsScanPromise = getAllWhatsAppConversationList();
      }

      const next = await allConversationsScanPromise;
      if (cancelled) {
        return;
      }

      hasScannedAllConversations = true;
      cachedConversationItems = next;
      writeSessionCache(next, true);
      setItems((previous) => {
        const prevSerialized = JSON.stringify(previous);
        const nextSerialized = JSON.stringify(next);
        return prevSerialized === nextSerialized ? previous : next;
      });
    };

    if (hasRequestedAllConversationsScan && !hasScannedAllConversations && allConversationsScanPromise) {
      void scan();
      return () => {
        cancelled = true;
      };
    }

    const timeout = window.setTimeout(() => {
      void scan();
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [scanAll]);

  return items;
}
