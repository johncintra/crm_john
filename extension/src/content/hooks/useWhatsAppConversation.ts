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

    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(emitConversation);
    });

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
    };
  }, []);

  return conversation;
}
