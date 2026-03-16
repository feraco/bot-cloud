interface ProxyRequestOptions {
  action: string;
  payload?: Record<string, unknown>;
  bridgeUrl?: string | null;
}

export function resolveZ4rtcBridgeBaseUrl(bridgeUrl?: string | null): string | null {
  const rawUrl = bridgeUrl || process.env.Z4RTC_BRIDGE_URL || process.env.NEXT_PUBLIC_Z4RTC_BRIDGE_URL;

  if (!rawUrl) {
    return null;
  }

  return rawUrl.replace(/\/$/, '');
}

export async function proxyZ4rtcBridgeRequest({
  action,
  payload = {},
  bridgeUrl,
}: ProxyRequestOptions): Promise<Response> {
  const baseUrl = resolveZ4rtcBridgeBaseUrl(bridgeUrl);

  if (!baseUrl) {
    throw new Error('Z4RTC bridge URL is not configured');
  }

  const response = await fetch(`${baseUrl}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  return response;
}
