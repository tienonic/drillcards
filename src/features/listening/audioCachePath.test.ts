import { describe, expect, it } from 'vitest';
import { resolveAudioCacheTarget } from '../../../vite-plugins/local-audio-cache.ts';

describe('local pronunciation cache path confinement', () => {
  it('accepts supported files below the cache root', () => {
    expect(resolveAudioCacheTarget('/cache/audio', 'sample/hash.mp3')).toBe('/cache/audio/sample/hash.mp3');
  });

  it('rejects traversal, absolute paths, backslashes, and non-audio files', () => {
    expect(resolveAudioCacheTarget('/cache/audio', '../secret.mp3')).toBeNull();
    expect(resolveAudioCacheTarget('/cache/audio', '/secret.mp3')).toBeNull();
    expect(resolveAudioCacheTarget('/cache/audio', 'sample\\secret.mp3')).toBeNull();
    expect(resolveAudioCacheTarget('/cache/audio', 'sample/manifest.json')).toBeNull();
  });
});
