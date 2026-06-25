import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { SidebarApp } from './SidebarApp';
import { initAudioSender } from './audioSender';

const ROOT_ID = 'crm-whatsapp-sidebar-root';

function ensureRoot(): HTMLElement {
  const existing = document.getElementById(ROOT_ID);
  if (existing) {
    return existing;
  }

  const root = document.createElement('div');
  root.id = ROOT_ID;
  document.body.appendChild(root);
  return root;
}

function mountSidebar() {
  const rootElement = ensureRoot();
  if (rootElement.dataset.mounted === 'true') {
    return;
  }

  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <SidebarApp />
    </React.StrictMode>
  );
  rootElement.dataset.mounted = 'true';
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountSidebar, { once: true });
} else {
  mountSidebar();
}

// Re-enabled in diagnostic mode only: the button has pointer-events: none
// (see audioSender.ts) so it can never block clicks on WhatsApp's native
// mic button again, while we collect console logs to see where it's
// actually landing and why it wasn't visible.
initAudioSender();
