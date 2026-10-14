const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function wikiFetch(url, options) {
  for (let attempt = 0; attempt < 5; attempt++) {
    await pause(1500);
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(25000),
      headers: {
        "User-Agent":
          "BlindRankEverything/1.0 (Wikipedia discovery game; local catalog builder)",
      },
    });
    if (response.status !== 429 && response.status !== 503) return response;
    if (attempt === 4) break;
    const retryAfter = response.headers.get("retry-after");
    const delay = Math.max(
      5000 * 2 ** attempt,
      Number(retryAfter) * 1000 || Date.parse(retryAfter) - Date.now() || 0,
    );
    console.warn(
      `Waiting ${Math.ceil(delay / 1000)} seconds for Wikipedia's rate limit.`,
    );
    await pause(delay);
  }
  throw new Error("Wikipedia is rate limiting requests. Try again later.");
}
