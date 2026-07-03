export interface DeepSeekBalance {
  currency: string;
  total_balance: string;
  is_available: boolean;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauriRuntime()) {
    throw new Error('DeepSeek balance is available in the desktop app runtime.')
  }
  const api = await import('@tauri-apps/api/core')
  return api.invoke<T>(command, args)
}

export async function getDeepSeekBalance(apiKey: string, baseUrl?: string): Promise<DeepSeekBalance> {
  return invoke<DeepSeekBalance>('get_deepseek_balance', {
    apiKey,
    baseUrl: baseUrl ?? null,
  })
}