import "server-only";

/**
 * Lit le corps d'une requête en **streaming** et s'arrête dès que la taille
 * dépasse `maxBytes` (retourne `null`). Contrairement à un contrôle sur
 * `Content-Length`, cela reste efficace quand l'en-tête est absent (transfert
 * `chunked`) : la mémoire reste bornée.
 */
export async function readBodyLimited(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array | null> {
  const reader = request.body?.getReader();
  if (!reader) {
    const buffer = new Uint8Array(await request.arrayBuffer());
    return buffer.length > maxBytes ? null : buffer;
  }

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}
