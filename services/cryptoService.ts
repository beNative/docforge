export const cryptoService = {
  /**
   * Calculates the SHA-256 hash of a string.
   * @param text The string to hash.
   * @returns A promise that resolves to the hex-encoded SHA-256 hash.
   */
  async sha256(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  },
};
