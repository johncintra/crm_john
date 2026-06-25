import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { SidebarApp } from './SidebarApp';

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

