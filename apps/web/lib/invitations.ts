export function extractInvitationToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';

  try {
    const url = new URL(trimmed);
    return url.searchParams.get('token') || trimmed;
  } catch {
    const match = trimmed.match(/token=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : trimmed;
  }
}
