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

// Temporarily disabled — it was blocking clicks on WhatsApp's own native
// mic/record-audio button. Re-enable once the positioning/hit-testing is
// fixed (see audioSender.ts).
// initAudioSender();
void initAudioSender;
