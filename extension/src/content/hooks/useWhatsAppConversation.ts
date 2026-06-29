import { useEffect, useState } from 'react';
import type { CurrentConversation } from '../../shared/types';
import { getCurrentConversation } from '../whatsapp';

export function useWhatsAppConversation(): CurrentConversation {
  const [conversation, setConversation] = useState<CurrentConversation>(() => getCurrentConversation());

  useEffect(() => {
    const emitConversation = () => {
      setConversation((previous) => {
        const next = getCurrentConversation();
        if (previous.phone === next.phone && previous.label === next.label) {
          return previous;
        }
        return next;
      });
    };

    // Debounced (not just requestAnimationFrame, which doesn't cap
    // frequency on its own) so a burst of unrelated DOM mutations
    // elsewhere on the page — e.g. the funnel board's own few hundred
    // cards during normal use — doesn't run this DOM-query work on every
    // single one of them.
    let debounceTimer: number | null = null;
    const scheduleEmit = () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        emitConversation();
      }, 150);
    };

    const observer = new MutationObserver(scheduleEmit);

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });

    const interval = window.setInterval(emitConversation, 1500);
    window.addEventListener('popstate', emitConversation);
    emitConversation();

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      window.removeEventListener('popstate', emitConversation);
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
    };
  }, []);

  return conversation;
}
