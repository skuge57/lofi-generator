import { describe, expect, it } from 'vitest';
import { DEFAULT_PARAMS } from './defaults';
import { parseParamsFromSearch, serializeParamsToSearch } from './urlState';

describe('URL bass personality state', () => {
  it('parses current bass personality ids', () => {
    expect(parseParamsFromSearch('?bass=off-grid')).toMatchObject({
      bassStyle: 'off-grid',
    });
  });

  it('keeps legacy bass style URLs playable', () => {
    expect(parseParamsFromSearch('?bass=simple')).toMatchObject({
      bassStyle: 'root-only',
    });
    expect(parseParamsFromSearch('?bass=walking')).toMatchObject({
      bassStyle: 'walking-jazz',
    });
    expect(parseParamsFromSearch('?bass=lazy')).toMatchObject({
      bassStyle: 'lazy-guitarist',
    });
    expect(parseParamsFromSearch('?bass=bounce')).toMatchObject({
      bassStyle: 'upright',
    });
    expect(parseParamsFromSearch('?bass=pedal')).toMatchObject({
      bassStyle: 'synth-sub',
    });
  });

  it('serializes the current personality id', () => {
    expect(serializeParamsToSearch({
      ...DEFAULT_PARAMS,
      bassStyle: 'walking-jazz',
    })).toContain('bass=walking-jazz');
  });
});
