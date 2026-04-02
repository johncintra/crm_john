import { useCallback } from 'react';
import type { BackgroundRequest, BackgroundResponse } from '../../shared/types';

export function useBackground() {
  return useCallback(async <TData = unknown>(message: BackgroundRequest): Promise<TData> => {
    const response = (await chrome.runtime.sendMessage(message)) as BackgroundResponse;

    if (!response?.ok) {
      throw new Error(response?.error ?? 'Unexpected background response.');
    }

    return response.data as TData;
  }, []);
}
