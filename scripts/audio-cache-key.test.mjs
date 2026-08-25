import assert from 'node:assert/strict';
import test from 'node:test';
import { audioCacheDescriptor, audioCacheKey, edgeTtsRateArgument, normalizeAudioText } from './lib/audio-cache-key.mjs';

const base = {
  text: '  cancio\u0301n  ',
  voice: 'es-ES-ElviraNeural',
  rate: 0.9,
  pronunciationOverride: '',
  engineVersion: 'edge-tts-7',
  provider: 'edge-tts',
};

test('normalization produces one stable cache key', () => {
  assert.equal(normalizeAudioText('  hola\nmundo '), 'hola mundo');
  assert.equal(audioCacheKey(audioCacheDescriptor(base)), audioCacheKey(audioCacheDescriptor({ ...base, text: 'canción' })));
});

test('voice, rate, override, engine, and normalized text all affect the cache key', () => {
  const original = audioCacheKey(audioCacheDescriptor(base));
  for (const patch of [
    { text: 'adiós' },
    { voice: 'es-MX-DaliaNeural' },
    { rate: 1 },
    { pronunciationOverride: 'canción' },
    { engineVersion: 'edge-tts-8' },
  ]) {
    assert.notEqual(audioCacheKey(audioCacheDescriptor({ ...base, ...patch })), original);
  }
});

test('edge-tts rate is one argument even when the adjustment is negative', () => {
  assert.equal(edgeTtsRateArgument(0.9), '--rate=-10%');
  assert.equal(edgeTtsRateArgument(1), '--rate=+0%');
  assert.equal(edgeTtsRateArgument(1.15), '--rate=+15%');
});
