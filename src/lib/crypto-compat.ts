function createUuid(): string {
  const cryptoObj = globalThis.crypto as Crypto | undefined;
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function installCryptoCompat(): void {
  const cryptoObj = globalThis.crypto as Crypto & { randomUUID?: () => string } | undefined;
  if (!cryptoObj) return;
  if (typeof cryptoObj.randomUUID !== "function") {
    Object.defineProperty(cryptoObj, "randomUUID", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: createUuid,
    });
  }
}

installCryptoCompat();
