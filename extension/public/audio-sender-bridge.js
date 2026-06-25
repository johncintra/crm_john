(() => {
  if (window.__whatsappAudioSenderBridgeInstalled) {
    window.postMessage({ type: 'WAS_BRIDGE_READY' }, '*');
    return;
  }

  window.__whatsappAudioSenderBridgeInstalled = true;

  const mediaDevices = navigator.mediaDevices;
  const originalGetUserMedia = mediaDevices && mediaDevices.getUserMedia
    ? mediaDevices.getUserMedia.bind(mediaDevices)
    : null;
  const OriginalMediaRecorder = window.MediaRecorder;

  let armedAudio = null;
  let preparedStream = null;
  const realMicrophoneStreams = new Set();

  function notify(type, payload = {}) {
    window.postMessage({ type, ...payload }, '*');
  }

  function wantsAudio(constraints) {
    return constraints && constraints.audio;
  }

  async function prepareVirtualStream(payload) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const context = new AudioContextClass();
    const buffer = await context.decodeAudioData(payload.audioBuffer.slice(0));
    const source = context.createBufferSource();
    const destination = context.createMediaStreamDestination();

    source.buffer = buffer;
    source.connect(destination);
    source.onended = () => {
      notify('WAS_PLAYBACK_ENDED');
      setTimeout(() => context.close().catch(() => {}), 500);
    };

    let started = false;

    return {
      stream: destination.stream,
      start: async () => {
        if (started) return;
        started = true;
        await context.resume();
        source.start(0);
        notify('WAS_PLAYBACK_STARTED', { durationMs: payload.durationMs });
      }
    };
  }

  function consumePreparedStream() {
    if (!preparedStream) return null;
    const virtual = preparedStream;
    armedAudio = null;
    preparedStream = null;

    Object.defineProperty(virtual.stream, '__wasStartVirtualAudio', {
      value: () => {
        virtual.start().catch((error) => {
          notify('WAS_VOICE_ERROR', { message: error.message });
        });
      },
      configurable: true
    });

    return virtual.stream;
  }

  function wrapRecorderStart(recorder, stream) {
    if (!stream || typeof stream.__wasStartVirtualAudio !== 'function') {
      return recorder;
    }

    const originalStart = recorder.start.bind(recorder);
    let startedVirtualAudio = false;

    recorder.start = function patchedRecorderStart(...args) {
      if (!startedVirtualAudio) {
        startedVirtualAudio = true;
        setTimeout(() => {
          stream.__wasStartVirtualAudio();
        }, 80);
      }

      return originalStart(...args);
    };

    return recorder;
  }

  function getRecorderStream(stream) {
    if (armedAudio) {
      const virtualStream = consumePreparedStream();
      if (virtualStream) return virtualStream;
    }

    return stream;
  }

  function scheduleFallbackPlayback(stream) {
    if (!stream || typeof stream.__wasStartVirtualAudio !== 'function') return;

    setTimeout(() => {
      stream.__wasStartVirtualAudio();
    }, 700);
  }

  if (!mediaDevices || !originalGetUserMedia) {
    notify('WAS_VOICE_ERROR', { message: 'Este navegador não disponibilizou o microfone para a página.' });
    return;
  }

  mediaDevices.getUserMedia = async function patchedGetUserMedia(constraints) {
    if (!wantsAudio(constraints)) {
      return originalGetUserMedia(constraints);
    }

    if (!armedAudio) {
      const stream = await originalGetUserMedia(constraints);
      realMicrophoneStreams.add(stream);

      stream.getTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          realMicrophoneStreams.delete(stream);
        }, { once: true });
      });

      return stream;
    }

    try {
      stopRealMicrophoneStreams();
      const virtualStream = consumePreparedStream();
      if (virtualStream) {
        scheduleFallbackPlayback(virtualStream);
        return virtualStream;
      }

      throw new Error('Áudio virtual não estava pronto. O microfone real foi bloqueado para não gravar ambiente.');
    } catch (error) {
      notify('WAS_VOICE_ERROR', { message: error.message || 'Não foi possível usar o áudio virtual.' });
      throw error;
    }
  };

  if (OriginalMediaRecorder) {
    window.MediaRecorder = function PatchedMediaRecorder(stream, options) {
      if (armedAudio) {
        stopRealMicrophoneStreams();
      }

      const recorderStream = getRecorderStream(stream);
      if (armedAudio && recorderStream === stream) {
        throw new Error('Gravação bloqueada: o áudio virtual não estava pronto.');
      }

      const recorder = new OriginalMediaRecorder(recorderStream, options);
      return wrapRecorderStart(recorder, recorderStream);
    };

    window.MediaRecorder.prototype = OriginalMediaRecorder.prototype;
    Object.setPrototypeOf(window.MediaRecorder, OriginalMediaRecorder);
    window.MediaRecorder.isTypeSupported = OriginalMediaRecorder.isTypeSupported.bind(OriginalMediaRecorder);
  }

  window.addEventListener('message', async (event) => {
    if (event.source !== window || !event.data) {
      return;
    }

    if (event.data.type === 'WAS_BRIDGE_PING') {
      notify('WAS_BRIDGE_READY');
      return;
    }

    if (event.data.type === 'WAS_SEND_VOICE_MEDIA') {
      try {
        const msg = await sendVoiceMedia(event.data.payload.mediaInfo);
        notify('WAS_VOICE_MEDIA_SENT', { messageId: msg?.id?._serialized || null });
      } catch (error) {
        notify('WAS_VOICE_MEDIA_ERROR', {
          message: error.message || 'Não foi possível enviar o áudio como voz.'
        });
      }
      return;
    }

    if (event.source !== window || !event.data || event.data.type !== 'WAS_ARM_VOICE_NOTE') {
      return;
    }

    armedAudio = {
      audioBuffer: event.data.payload.audioBuffer,
      mimeType: event.data.payload.mimeType,
      durationMs: event.data.payload.durationMs,
      expiresAt: Date.now() + 15000
    };

    try {
      preparedStream = await prepareVirtualStream(armedAudio);
      stopRealMicrophoneStreams();
      notify('WAS_VOICE_ARMED');
    } catch (error) {
      armedAudio = null;
      preparedStream = null;
      notify('WAS_VOICE_ERROR', { message: error.message || 'Não foi possível preparar o MP3.' });
      return;
    }

    setTimeout(() => {
      if (armedAudio && armedAudio.expiresAt <= Date.now()) {
        armedAudio = null;
        preparedStream = null;
      }
    }, 15100);
  });

  function stopRealMicrophoneStreams() {
    realMicrophoneStreams.forEach((stream) => {
      stream.getAudioTracks().forEach((track) => {
        try {
          track.enabled = false;
          track.stop();
        } catch (error) {
          console.warn('[WhatsApp Audio Sender] Falha ao parar microfone real:', error);
        }
      });
    });

    realMicrophoneStreams.clear();
  }

  async function sendVoiceMedia(mediaInfo) {
    if (!window.require) {
      throw new Error('Internos do WhatsApp Web ainda não estão disponíveis. Aguarde carregar e tente novamente.');
    }

    const chat = getActiveChat();
    if (!chat) {
      throw new Error('Abra uma conversa antes de enviar o áudio.');
    }

    const mediaOptions = await processMediaData(mediaInfo, { forceVoice: true });
    const message = await createOutgoingMessage(chat, mediaOptions);
    const [msgPromise, sendResultPromise] = window
      .require('WAWebSendMsgChatAction')
      .addAndSendMsgToChat(chat, message);

    await msgPromise;
    await sendResultPromise;

    return window
      .require('WAWebCollections')
      .Msg.get(message.id._serialized);
  }

  function getActiveChat() {
    const collections = window.require('WAWebCollections');
    const chat = collections.Chat.getModelsArray().find((model) => model.active);

    if (chat) return chat;
    if (collections.Newsletter) {
      return collections.Newsletter.getModelsArray().find((model) => model.active);
    }

    return null;
  }

  async function processMediaData(mediaInfo, { forceVoice }) {
    const file = mediaInfoToFile(mediaInfo);
    const OpaqueData = window.require('WAWebMediaOpaqueData');
    const opaqueData = await OpaqueData.createFromData(file, mediaInfo.mimetype);
    const mediaPrep = window
      .require('WAWebPrepRawMedia')
      .prepRawMedia(opaqueData, {
        isPtt: forceVoice,
        asDocument: false,
        asGif: false,
        asSticker: false
      });

    const mediaData = await mediaPrep.waitForPrep();
    if (!mediaData.filehash) {
      throw new Error('Falha ao preparar o áudio: filehash vazio.');
    }

    const mediaObject = window
      .require('WAWebMediaStorage')
      .getOrCreateMediaObject(mediaData.filehash);
    const mediaType = window.require('WAWebMmsMediaTypes').msgToMediaType({
      type: mediaData.type,
      isGif: mediaData.isGif,
      isNewsletter: false
    });

    if (forceVoice && mediaData.type === 'ptt') {
      mediaData.waveform = mediaObject.contentInfo.waveform || await generateWaveform(file);
    }

    if (!(mediaData.mediaBlob instanceof OpaqueData)) {
      mediaData.mediaBlob = await OpaqueData.createFromData(
        mediaData.mediaBlob,
        mediaData.mediaBlob.type
      );
    }

    mediaData.renderableUrl = mediaData.mediaBlob.url();
    mediaObject.consolidate(mediaData.toJSON());
    mediaData.mediaBlob.autorelease();

    const shouldUseMediaCache = window
      .require('WAWebMediaDataUtils')
      .shouldUseMediaCache(
        window.require('WAWebMmsMediaTypes').castToV4(mediaObject.type)
      );

    if (shouldUseMediaCache && mediaData.mediaBlob instanceof OpaqueData) {
      window
        .require('WAWebMediaInMemoryBlobCache')
        .InMemoryMediaBlobCache.put(mediaObject.filehash, mediaData.mediaBlob.formData());
    }

    const { uploadMedia } = window.require('WAWebMediaMmsV4Upload');
    const uploadedMedia = await uploadMedia({
      mimetype: mediaData.mimetype,
      mediaObject,
      mediaType
    });

    const mediaEntry = uploadedMedia.mediaEntry;
    if (!mediaEntry) {
      throw new Error('Falha no upload do áudio.');
    }

    mediaData.set({
      clientUrl: mediaEntry.mmsUrl,
      deprecatedMms3Url: mediaEntry.deprecatedMms3Url,
      directPath: mediaEntry.directPath,
      mediaKey: mediaEntry.mediaKey,
      mediaKeyTimestamp: mediaEntry.mediaKeyTimestamp,
      filehash: mediaObject.filehash,
      encFilehash: mediaEntry.encFilehash,
      uploadhash: mediaEntry.uploadHash,
      size: mediaObject.size,
      streamingSidecar: mediaEntry.sidecar,
      firstFrameSidecar: mediaEntry.firstFrameSidecar,
      mediaHandle: null
    });

    return {
      ...mediaData,
      ...(mediaData.toJSON ? mediaData.toJSON() : {})
    };
  }

  async function createOutgoingMessage(chat, mediaOptions) {
    const { getMaybeMeLidUser, getMaybeMePnUser } = window.require('WAWebUserPrefsMeUser');
    const lidUser = getMaybeMeLidUser();
    const meUser = getMaybeMePnUser();
    const from = chat.id.isLid() ? lidUser : meUser;
    const newId = await window.require('WAWebMsgKey').newId();
    let participant;

    if (typeof chat.id?.isGroup === 'function' && chat.id.isGroup()) {
      participant = window.require('WAWebWidFactory').asUserWidOrThrow(from);
    }

    const id = new (window.require('WAWebMsgKey'))({
      from,
      to: chat.id,
      id: newId,
      participant,
      selfDir: 'out'
    });

    const ephemeralFields = window
      .require('WAWebGetEphemeralFieldsMsgActionsUtils')
      .getEphemeralFields(chat);

    return {
      id,
      ack: 0,
      body: mediaOptions.preview,
      from,
      to: chat.id,
      local: true,
      self: 'out',
      t: Math.floor(Date.now() / 1000),
      isNewMsg: true,
      type: 'chat',
      ...ephemeralFields,
      ...mediaOptions,
      ...(mediaOptions.toJSON ? mediaOptions.toJSON() : {})
    };
  }

  function mediaInfoToFile({ data, mimetype, filename }) {
    const binaryData = window.atob(data);
    const buffer = new ArrayBuffer(binaryData.length);
    const view = new Uint8Array(buffer);

    for (let i = 0; i < binaryData.length; i++) {
      view[i] = binaryData.charCodeAt(i);
    }

    return new File([new Blob([buffer], { type: mimetype })], filename, {
      type: mimetype,
      lastModified: Date.now()
    });
  }

  async function generateWaveform(audioFile) {
    try {
      const audioData = await audioFile.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      const rawData = audioBuffer.getChannelData(0);
      const samples = 64;
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData = [];

      for (let i = 0; i < samples; i++) {
        const blockStart = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[blockStart + j]);
        }
        filteredData.push(sum / blockSize);
      }

      const multiplier = Math.pow(Math.max(...filteredData), -1);
      return new Uint8Array(filteredData.map((n) => Math.floor(100 * n * multiplier)));
    } catch (error) {
      return undefined;
    }
  }

  notify('WAS_BRIDGE_READY');
})();
