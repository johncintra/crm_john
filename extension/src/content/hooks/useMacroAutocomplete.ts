import { useCallback, useEffect, useRef, useState } from 'react';
import type { Macro } from '../../shared/types';
import { getMessageComposeBox, replaceComposerSlashCommand } from '../whatsapp';

// Matches a "/" followed by word characters (no spaces) at the very end of
// the compose box's text — i.e. an in-progress slash command the seller is
// still typing. Anything before it (other words, line breaks) is ignored.
const TRAILING_SLASH_COMMAND = /\/(\S*)$/;

export function useMacroAutocomplete(macros: Macro[]) {
  const [query, setQuery] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const composeBoxRef = useRef<HTMLElement | null>(null);

  const matches = query === null ? [] : macros.filter((macro) => macro.shortcut.toLowerCase().startsWith(query.toLowerCase()));
  const isOpen = query !== null && matches.length > 0;

  const checkComposeBoxText = useCallback(() => {
    const element = getMessageComposeBox();
    const text = element?.textContent ?? '';
    const match = text.match(TRAILING_SLASH_COMMAND);
    setQuery(match ? match[1] : null);
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    const attach = () => {
      const element = getMessageComposeBox();
      if (!element || element === composeBoxRef.current) return;
      composeBoxRef.current?.removeEventListener('input', checkComposeBoxText);
      composeBoxRef.current = element;
      element.addEventListener('input', checkComposeBoxText);
    };

    attach();
    const observer = new MutationObserver(() => {
      attach();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const interval = window.setInterval(attach, 1000);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      composeBoxRef.current?.removeEventListener('input', checkComposeBoxText);
    };
  }, [checkComposeBoxText]);

  const selectMacro = useCallback(
    (macro: Macro) => {
      const typedLength = 1 + (query?.length ?? 0); // "/" plus whatever was typed after it
      replaceComposerSlashCommand(typedLength, macro.content);
      setQuery(null);
    },
    [query]
  );

  // Intercepted at the document capture phase — earliest possible point —
  // so Enter/Arrow keys are stopped before WhatsApp's own handlers see
  // them (Enter would otherwise send the half-typed "/shortcut" as a
  // message instead of picking a macro).
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target !== composeBoxRef.current) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((index) => (index + 1) % matches.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        event.stopPropagation();
        setSelectedIndex((index) => (index - 1 + matches.length) % matches.length);
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        event.stopPropagation();
        const macro = matches[selectedIndex];
        if (macro) selectMacro(macro);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setQuery(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, matches, selectedIndex, selectMacro]);

  return {
    isOpen,
    matches,
    selectedIndex,
    selectMacro,
    composeBox: composeBoxRef.current
  };
}
