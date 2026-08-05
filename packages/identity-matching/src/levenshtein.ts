/** Classic edit-distance DP. Pure, no dependencies. */
export function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + substitutionCost // substitution
      );
    }
  }

  return dp[rows - 1][cols - 1];
}

/**
 * 0-100 similarity, normalized by the longer string's length so a
 * one-character diff on a short handle isn't scored the same as a
 * one-character diff on a long one. Case-insensitive — git handles
 * are conventionally lowercase but not enforced.
 */
export function handleSimilarityPercent(a: string, b: string): number {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  const maxLength = Math.max(lowerA.length, lowerB.length);
  if (maxLength === 0) return 100;

  const distance = levenshteinDistance(lowerA, lowerB);
  return Math.round((1 - distance / maxLength) * 100);
}
