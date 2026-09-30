import { isIP } from 'node:net';

export function trustedProxyRanges(
  value: string | undefined,
): false | string[] {
  if (!value?.trim()) return false;
  const ranges = value.split(',').map((range) => range.trim());
  for (const range of ranges) {
    const [address, mask, ...rest] = range.split('/');
    const version = isIP(address);
    if (
      !version ||
      rest.length ||
      (mask !== undefined &&
        (!/^\d+$/.test(mask) ||
          Number(mask) <= 0 ||
          Number(mask) > (version === 4 ? 32 : 128)))
    ) {
      throw new Error(
        'TRUSTED_PROXY_CIDRS must contain explicit IP addresses/CIDRs, never a wildcard or hop count',
      );
    }
  }
  return ranges;
}

export function jiraBrowserRedirect(webOrigin: string): string {
  const url = new URL('/onboarding/integration', webOrigin);
  url.searchParams.set('provider', 'jira');
  return url.toString();
}

export function isPublicHttps(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !/^(localhost|.*\.localhost|127(?:\.\d+){3}|\[::1\])$/.test(url.hostname)
  );
}
