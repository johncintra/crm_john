import { useEffect, useState } from 'react';
import {
  dedupeConversationItems,
  getAllWhatsAppConversationList,
  getConversationIdentity,
  getWhatsAppConversationList,
  type WhatsAppConversationItem
} from '../whatsapp';

let cachedConversationItems: WhatsAppConversationItem[] = [];
let hasScannedAllConversations = false;
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
