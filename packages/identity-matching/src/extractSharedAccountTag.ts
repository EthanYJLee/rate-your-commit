const TAG_PATTERN = /\[([^[\]]+)]/;

/**
 * Pulls a hand-tagged real-contributor name out of a commit message,
 * e.g. "[개발자T] fixed the null check" or a message that's just
 * "[개발자T]" on its own — the exact 공유계정 pattern from the
 * original 화면설계서's 병목 진단 scenario (a shared server account's
 * author field hides who actually wrote the commit; some authors
 * hand-tag their real name in the message as the only trace).
 *
 * Only the first bracket group is used — messages are not expected to
 * tag more than one person. Returns null when there's no non-empty
 * bracket group at all.
 */
export function extractSharedAccountTag(message: string): string | null {
  const match = message.match(TAG_PATTERN);
  if (!match) return null;

  const tag = match[1].trim();
  return tag.length > 0 ? tag : null;
}
