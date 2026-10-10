import 'server-only'

import type { SourceAdapter } from './types'
import { spotifyAdapter } from './spotify'

const ADAPTERS: Record<string, SourceAdapter> = {
  spotify: spotifyAdapter,
}

export function getAdapter(type: string): SourceAdapter | null {
  return ADAPTERS[type] ?? null
}

export const SUPPORTED_SYNC_SOURCES = Object.keys(ADAPTERS)
