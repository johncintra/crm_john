// Floating "send as voice note" button placed over WhatsApp's own mic
// button. Ported from the standalone Envia_audio_wpp project — talks to
// audio-sender-bridge.js (registered in manifest.json, world: "MAIN"),
// which patches getUserMedia/MediaRecorder so a chosen audio file gets
// delivered as a real PTT voice message instead of a file attachment.
//
// Fully self-contained: its own element ids/classes (whatsapp-audio-*),
// its own observers, no shared state with the rest of the app. Safe to
// remove this file + its manifest entries without touching anything else.
// (Fixed-size 46x46px button, positioned via inline left/top — never had
// the "empty stretched hitbox" problem that .crm-app-shell/.crm-stagebar
// had; that unrelated bug was what actually blocked the native mic
// button before, not this.)

import { getMessageComposeBox } from './whatsapp';

const BUTTON_ID = 'whatsapp-audio-sender-button';
const INPUT_ID = 'whatsapp-audio-sender-input';
const TOAST_ID = 'whatsapp-audio-sender-toast';

// document.querySelector('footer') grabs whichever <footer> happens to be
// first in the document — WhatsApp Web can have more than one (e.g. the
// chat list's own footer), which silently put every position calculation
// below relative to the wrong box. Anchoring on the actual compose box
// (already validated by the macro-autocomplete feature) and walking up to
// its nearest <footer> is reliable regardless of how many other <footer>
// elements exist elsewhere on the page.
function getComposerFooter(): HTMLElement | null {
  const composeBox = getMessageComposeBox();
  return composeBox?.closest('footer') ?? document.querySelector('footer');
}

let footerObserver: MutationObserver | undefined;
let repositionTimer: number | undefined;
let bridgeReady = false;

interface MediaInfo {
  data: string;
  mimetype: string;
  filename: string;
  filesize: number;
}

export function initAudioSender() {
  createHiddenFileInput();
  createFooterButton();
  observeFooter();
}

function createHiddenFileInput() {
  if (document.getElementById(INPUT_ID)) return;
  const input = document.createElement('input');
  input.id = INPUT_ID;
  input.type = 'file';
  input.accept = 'audio/*';
  input.style.display = 'none';
  input.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    showToast(`Preparando ${file.name}...`, 'info');
    try {
      await sendAudioFromFile(file);
      showToast('Audio enviado com sucesso!', 'success');
    } catch (error) {
      showToast('Erro ao enviar audio: ' + (error instanceof Error ? error.message : 'desconhecido'), 'error');
    } finally {
      input.value = '';
    }
  });
  document.body.appendChild(input);
}

function createFooterButton() {
  // Don't gate this on a <footer> existing at all — WhatsApp Web's DOM
  // isn't guaranteed to wrap the composer in one. The compose box itself
  // (or the mic button) reliably existing is what actually means "a
  // conversation is open and there's somewhere to anchor this button".
  if (!getMessageComposeBox() && !findMicButton()) {
    logPlacement('createFooterButton: nenhuma conversa aberta ainda (sem compose box nem mic), botao nao criado');
    return;
  }

  let button = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
  if (button) {
    placeButtonOverMic(button);
    return;
  }

  button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.title = 'Enviar como audio gravado';
  button.style.cssText = `
    width: 46px;
    height: 46px;
    border-radius: 50%;
    border: 2px solid white;
    background: #7c3aed;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0,0,0,0.45);
    transition: background 0.15s ease, opacity 0.15s ease;
    z-index: 40;
  `;

  // Bright violet, distinct from WhatsApp's own dark-theme green message
  // bubbles (#075e54-ish) — the button blended into the background almost
  // invisibly with that color, which is most of why it went unnoticed in
  // testing even though it was rendering correctly the whole time.
  button.addEventListener('mouseenter', () => { button!.style.background = '#8b5cf6'; });
  button.addEventListener('mouseleave', () => { button!.style.background = '#7c3aed'; });
  button.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M12 3C11.4477 3 11 3.44772 11 4V13.5858L8.70711 11.2929C8.31658 10.9024 7.68342 10.9024 7.29289 11.2929C6.90237 11.6834 6.90237 12.3166 7.29289 12.7071L11.2929 16.7071C11.6834 17.0976 12.3166 17.0976 12.7071 16.7071L16.7071 12.7071C17.0976 12.3166 17.0976 11.6834 16.7071 11.2929C16.3166 10.9024 15.6834 10.9024 15.2929 11.2929L13 13.5858V4C13 3.44772 12.5523 3 12 3Z" fill="white"/>' +
    '<path d="M5 19C5 17.8954 5.89543 17 7 17H17C18.1046 17 19 17.8954 19 19C19 20.1046 18.1046 21 17 21H7C5.89543 21 5 20.1046 5 19Z" fill="white"/>' +
    '</svg>';

  button.addEventListener('click', () => {
    document.getElementById(INPUT_ID)?.click();
  });

  document.body.appendChild(button);
  placeButtonOverMic(button);
}

function observeFooter() {
  if (footerObserver) footerObserver.disconnect();

  footerObserver = new MutationObserver(() => {
    if (repositionTimer) window.clearTimeout(repositionTimer);
    repositionTimer = window.setTimeout(() => {
      const button = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
      if (!button) {
        createFooterButton();
      } else {
        placeButtonOverMic(button);
      }
    }, 100);
  });

  footerObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-label', 'title', 'data-icon', 'data-testid']
  });

  window.addEventListener('resize', () => {
    const button = document.getElementById(BUTTON_ID) as HTMLButtonElement | null;
    if (button) placeButtonOverMic(button);
  });
}

let lastPlacementLog = '';
function logPlacement(message: string) {
  if (message === lastPlacementLog) return;
  lastPlacementLog = message;
  // eslint-disable-next-line no-console
  console.log('[CRM audio]', message);
}

// WhatsApp's own DOM mutates almost continuously (read receipts,
// timestamps, typing indicators), which re-triggers placement on every
// settle of the observer below. Skipping writes when the new position is
// within a few px of the current one stops the button from visibly
// jittering/drifting in place during normal chat activity.
const POSITION_CHANGE_THRESHOLD_PX = 3;

function applyPosition(button: HTMLButtonElement, left: number, top: number, opacity: string) {
  const currentLeft = parseFloat(button.style.left || '0');
  const currentTop = parseFloat(button.style.top || '0');
  if (Math.abs(currentLeft - left) < POSITION_CHANGE_THRESHOLD_PX && Math.abs(currentTop - top) < POSITION_CHANGE_THRESHOLD_PX) {
    return;
  }
  button.style.left = `${left}px`;
  button.style.top = `${top}px`;
  button.style.opacity = opacity;
}

function placeButtonOverMic(button: HTMLButtonElement) {
  const micButton = findMicButton();
  const footer = getComposerFooter();

  if (micButton) {
    const rect = micButton.getBoundingClientRect();
    const left = Math.max(8, Math.min(window.innerWidth - 54, rect.left + rect.width / 2 - 23));
    const top = Math.max(8, rect.top - 58);
    logPlacement(`mic encontrado, rect=${JSON.stringify(rect)} -> botao left=${left} top=${top}`);

    button.style.right = 'auto';
    button.style.bottom = 'auto';
    applyPosition(button, left, top, '1');
    return;
  }

  if (footer) {
    const rect = footer.getBoundingClientRect();
    logPlacement(`mic NAO encontrado, usando footer rect=${JSON.stringify(rect)}`);
    button.style.right = '18px';
    button.style.bottom = 'auto';
    const left = parseFloat(button.style.left || '0') || window.innerWidth - 64;
    applyPosition(button, left, Math.max(8, rect.top - 56), '0.95');
    return;
  }

  const composeBox = getMessageComposeBox();
  if (composeBox) {
    const rect = composeBox.getBoundingClientRect();
    logPlacement(`mic e footer NAO encontrados, usando compose box rect=${JSON.stringify(rect)}`);
    button.style.left = 'auto';
    button.style.right = '18px';
    button.style.top = `${Math.max(8, rect.top - 56)}px`;
    button.style.bottom = 'auto';
    button.style.opacity = '0.95';
  } else {
    logPlacement('mic, footer e compose box NAO encontrados, botao nao reposicionado');
  }
}

function findMicButton(): HTMLElement | null {
  const scope = getComposerFooter() ?? document;
  const candidates = Array.from(scope.querySelectorAll('button, div[role="button"], span[data-icon]'));
  const micIconNames = ['microphone', 'mic', 'ptt'];
  const micLabels = ['mensagem de voz', 'voice message', 'microfone', 'microphone', 'gravar', 'record'];

  const icon = candidates.find((el) => {
    const dataIcon = (el.getAttribute('data-icon') ?? '').toLowerCase();
    return micIconNames.some((name) => dataIcon.includes(name));
  });

  const labeled = candidates.find((el) => {
    const label = [el.getAttribute('aria-label'), el.getAttribute('title'), el.getAttribute('data-testid')]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return micLabels.some((text) => label.includes(text));
  });

  const target = icon ?? labeled;
  return target ? (target.closest('button, div[role="button"]') as HTMLElement | null) ?? (target as HTMLElement) : null;
}

async function sendAudioFromFile(file: File) {
  await ensureVoiceBridge();
  const mediaInfo = await fileToMediaInfo(file);
  showToast('Convertendo e enviando como audio gravado...', 'info');
  await sendVoiceMediaViaBridge(mediaInfo);
}

function ensureVoiceBridge(): Promise<void> {
  if (bridgeReady) return Promise.resolve();
  return waitForBridgeEvent('WAS_BRIDGE_READY', 3000).then(() => {
    bridgeReady = true;
  });
}

function sendVoiceMediaViaBridge(mediaInfo: MediaInfo): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('O envio interno nao respondeu. Recarregue o WhatsApp Web e tente novamente.'));
    }, 45000);

    function onMessage(event: MessageEvent) {
      if (event.source !== window || !event.data) return;
      if (event.data.type === 'WAS_VOICE_MEDIA_SENT') {
        window.clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        resolve(event.data);
      }
      if (event.data.type === 'WAS_VOICE_MEDIA_ERROR') {
        window.clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        reject(new Error(event.data.message ?? 'Falha ao enviar como audio gravado.'));
      }
    }

    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'WAS_SEND_VOICE_MEDIA', payload: { mediaInfo } }, '*');
  });
}

function waitForBridgeEvent(type: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error('Ponte de audio nao respondeu.'));
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (event.source !== window || !event.data) return;
      if (event.data.type === type) {
        window.clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        resolve();
      }
      if (event.data.type === 'WAS_VOICE_ERROR') {
        window.clearTimeout(timeout);
        window.removeEventListener('message', onMessage);
        reject(new Error(event.data.message ?? 'Erro no microfone virtual.'));
      }
    }

    window.addEventListener('message', onMessage);
  });
}

function fileToMediaInfo(file: File): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const [, data] = result.split(',');
      resolve({
        data,
        mimetype: file.type || 'audio/mpeg',
        filename: file.name || 'audio.mp3',
        filesize: file.size
      });
    };
    reader.onerror = () => reject(new Error('Nao foi possivel ler o arquivo de audio.'));
    reader.readAsDataURL(file);
  });
}

function showToast(message: string, type: 'info' | 'success' | 'error' = 'info') {
  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.style.cssText = `
      position: fixed;
      bottom: 110px;
      right: 20px;
      z-index: 41;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      color: white;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      max-width: 320px;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.style.background = type === 'success' ? '#28a745' : type === 'error' ? '#d93f3f' : '#0d6efd';
  toast.style.opacity = '1';

  window.clearTimeout((window as unknown as { __audioSenderToastTimer?: number }).__audioSenderToastTimer);
  (window as unknown as { __audioSenderToastTimer?: number }).__audioSenderToastTimer = window.setTimeout(() => {
    toast!.style.opacity = '0';
  }, 2500);
}
