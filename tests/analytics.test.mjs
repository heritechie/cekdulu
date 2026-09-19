import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fireShareClick,
  fireShareSuccess,
  shareClickParams,
  shareSuccessParams,
} from '../src/lib/analytics.ts';

/**
 * Tests for the wishlist share funnel contract (share_click / share_success).
 */

function spyEmitter() {
  const events = [];
  const emit = (name, params) => events.push({ name, params });
  return { events, emit };
}

describe('share funnel param builders', () => {
  test('share_click params carry context, target and optional financing type', () => {
    assert.deepEqual(shareClickParams({ share_context: 'calculator', share_target: 'image', financing_type: 'kpr' }), {
      share_context: 'calculator',
      share_target: 'image',
      financing_type: 'kpr',
    });
    assert.deepEqual(shareClickParams({ share_context: 'challenge', share_target: 'text' }), {
      share_context: 'challenge',
      share_target: 'text',
      financing_type: undefined,
    });
  });

  test('share_success params add the native share method', () => {
    assert.deepEqual(shareSuccessParams({ share_context: 'wishlist', share_target: 'image', share_method: 'web_share' }), {
      share_context: 'wishlist',
      share_target: 'image',
      share_method: 'web_share',
      financing_type: undefined,
    });
  });
});

describe('fireShare* emitters', () => {
  test('fireShareClick emits the event through the passed emitter', () => {
    const { events, emit } = spyEmitter();
    fireShareClick(emit, { share_context: 'calculator', share_target: 'image' });
    assert.equal(events.length, 1);
    assert.equal(events[0].name, 'share_click');
    assert.equal(events[0].params.share_context, 'calculator');
  });

  test('fireShareSuccess emits share_success with the native method', () => {
    const { events, emit } = spyEmitter();
    fireShareSuccess(emit, { share_context: 'challenge', share_target: 'image', share_method: 'web_share' });
    assert.equal(events.length, 1);
    assert.equal(events[0].name, 'share_success');
    assert.equal(events[0].params.share_method, 'web_share');
  });
});
