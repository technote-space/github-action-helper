/* eslint-disable no-magic-numbers */
import path from 'path';
import { testEnv, getContext, testFs } from '@technote-space/github-action-test-helper';
import { describe, expect, it, vi } from 'vitest';
import { Utils } from '../src/index.js';

const { getWorkspace, getActor, escapeRegExp, getRegExp, getPrefixRegExp, getSuffixRegExp, getPrBranch, getPrHeadRef } = Utils;
const { parseVersion, normalizeVersion, isValidSemanticVersioning, isPrRef, getPrMergeRef, replaceAll, sleep }         = Utils;
const { getBranch, getRefForUpdate, uniqueArray, getBuildInfo, split, getArrayInput, useNpm, getBoolValue }            = Utils;

vi.useFakeTimers();

describe('getWorkspace', () => {
  testEnv();

  it('should get workspace', () => {
    process.env.GITHUB_WORKSPACE = 'test';
    expect(getWorkspace()).toBe('test');
  });

  it('should not get workspace', () => {
    process.env.GITHUB_WORKSPACE = undefined;
    expect(getWorkspace()).toBe('');
  });
});

describe('getActor', () => {
  testEnv();

  it('should get actor', () => {
    process.env.GITHUB_ACTOR = 'test';
    expect(getActor()).toBe('test');
  });

  it('should not get actor', () => {
    process.env.GITHUB_ACTOR = undefined;
    expect(getActor()).toBe('');
  });
});

describe('escapeRegExp', () => {
  it('should escape RegExp', () => {
    expect(escapeRegExp('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
  });
});

describe('getRegExp', () => {
  it('should get RegExp', () => {
    expect(getRegExp('?t*e^s$t*/abc').test('123/?t*e^s$t*/abc/xyz')).toBe(true);
    expect(getRegExp('?t*e^s$t*/abc').test('123/?t*e^s$t*/xyz')).toBe(false);
  });
});

describe('getPrefixRegExp', () => {
  it('should get RegExp', () => {
    expect(getPrefixRegExp('?t*e^s$t*/abc').test('?t*e^s$t*/abc/xyz')).toBe(true);
    expect(getPrefixRegExp('?t*e^s$t*/abc').test('123/?t*e^s$t*/abc/xyz')).toBe(false);
    expect(getPrefixRegExp('src/').test('SRC/test')).toBe(false);
    expect(getPrefixRegExp('src/', 'i').test('SRC/test')).toBe(true);
  });
});

describe('getSuffixRegExp', () => {
  it('should get RegExp', () => {
    expect(getSuffixRegExp('?t*e^s$t*/abc').test('123/?t*e^s$t*/abc')).toBe(true);
    expect(getSuffixRegExp('?t*e^s$t*/abc').test('123/?t*e^s$t*/abc/xyz')).toBe(false);
    expect(getSuffixRegExp('.JPEG').test('test.jpeg')).toBe(false);
    expect(getSuffixRegExp('.JPEG', 'i').test('test.jpeg')).toBe(true);
  });
});

describe('getBoolValue', () => {
  it('should return true', () => {
    expect(getBoolValue('1')).toBe(true);
    expect(getBoolValue('true')).toBe(true);
    expect(getBoolValue('a')).toBe(true);
  });

  it('should return false', () => {
    expect(getBoolValue('0')).toBe(false);
    expect(getBoolValue('false')).toBe(false);
    expect(getBoolValue('')).toBe(false);
  });
});

describe('parseVersion', () => {
  it('should parse version 1', () => {
    const result = parseVersion('v1');
    expect(result).not.toBeUndefined();
    expect(result?.core).toBe('1.0.0');
    expect(result?.preRelease).toBe(undefined);
    expect(result?.build).toBe(undefined);
  });

  it('should parse version 2', () => {
    const result = parseVersion('V1', { fill: false });
    expect(result).not.toBeUndefined();
    expect(result?.core).toBe('1');
    expect(result?.preRelease).toBe(undefined);
    expect(result?.build).toBe(undefined);
  });

  it('should parse version 3', () => {
    const result = parseVersion('v1', { cut: false });
    expect(result).not.toBeUndefined();
    expect(result?.core).toBe('1.0.0');
    expect(result?.preRelease).toBe(undefined);
    expect(result?.build).toBe(undefined);
  });

  it('should parse version 4', () => {
    const result = parseVersion('v1.2.3');
    expect(result).not.toBeUndefined();
    expect(result?.core).toBe('1.2.3');
    expect(result?.preRelease).toBe(undefined);
    expect(result?.build).toBe(undefined);
  });

  it('should parse version 5', () => {
    const result = parseVersion('v1.2.3.4');
    expect(result).not.toBeUndefined();
    expect(result?.core).toBe('1.2.3');
    expect(result?.preRelease).toBe(undefined);
    expect(result?.build).toBe(undefined);
  });

  it('should parse version 6', () => {
    const result = parseVersion('v1.2.3.4', { cut: false });
    expect(result).not.toBeUndefined();
    expect(result?.core).toBe('1.2.3.4');
    expect(result?.preRelease).toBe(undefined);
    expect(result?.build).toBe(undefined);
  });

  it('should parse version 7', () => {
    const result = parseVersion('v1.2.3.4', { slice: 2 });
    expect(result).not.toBeUndefined();
    expect(result?.core).toBe('1.2');
    expect(result?.preRelease).toBe(undefined);
    expect(result?.build).toBe(undefined);
  });

  it('should parse version 8', () => {
    const result = parseVersion('1.0.0-rc.1');
    expect(result).not.toBeUndefined();
    expect(result?.core).toBe('1.0.0');
    expect(result?.preRelease).toBe('rc.1');
    expect(result?.build).toBe(undefined);
  });

  it('should parse version 9', () => {
    const result = parseVersion('v2.0.0-alpha01');
    expect(result).not.toBeUndefined();
    expect(result?.core).toBe('2.0.0');
    expect(result?.preRelease).toBe('alpha01');
    expect(result?.build).toBe(undefined);
  });

  it('should parse version 10', () => {
    const result = parseVersion('v3.0.0+f2eed76');
    expect(result).not.toBeUndefined();
    expect(result?.core).toBe('3.0.0');
    expect(result?.preRelease).toBe(undefined);
    expect(result?.build).toBe('f2eed76');
  });

  it('should parse version 11', () => {
    const result = parseVersion('v1.0.0-beta+exp.sha.5114f85');
    expect(result).not.toBeUndefined();
    expect(result?.core).toBe('1.0.0');
    expect(result?.preRelease).toBe('beta');
    expect(result?.build).toBe('exp.sha.5114f85');
  });

  it('should parse version 12', () => {
    const result = parseVersion('v1.2.3-beta+exp.sha.5114f85', { slice: 4 });
    expect(result).not.toBeUndefined();
    expect(result?.core).toBe('1.2.3.0');
    expect(result?.preRelease).toBe('beta');
    expect(result?.build).toBe('exp.sha.5114f85');
  });

  it('should return undefined', () => {
    expect(parseVersion('abc')).toBeUndefined();
  });
});

describe('normalizeVersion', () => {
  it('should normalize version', () => {
    expect(normalizeVersion('v1')).toBe('1.0.0');
    expect(normalizeVersion('1')).toBe('1.0.0');
    expect(normalizeVersion('v1.2')).toBe('1.2.0');
    expect(normalizeVersion('v1.2.3')).toBe('1.2.3');
    expect(normalizeVersion('v1.2.3.4')).toBe('1.2.3');
    expect(normalizeVersion('v1.2.3.4', { length: 5 })).toBe('1.2.3.4.0');
    expect(normalizeVersion('v1.2.3.4', { cut: false })).toBe('1.2.3.4');
    expect(normalizeVersion('v1.2.3.4.5.6.7.8.9', { slice: 2 })).toBe('1.2');
    expect(normalizeVersion('v1.2.3.4.5.6.7.8.9', { slice: -1 })).toBe('1.2.3.4.5.6.7.8');
    expect(normalizeVersion('v1', { slice: -1 })).toBe('1.0');
    expect(normalizeVersion('v1', { slice: -1, length: 5 })).toBe('1.0.0.0');
    expect(normalizeVersion('v1', { slice: 0 })).toBe('');
    expect(normalizeVersion('1', { fill: false })).toBe('1');
    expect(normalizeVersion('1.0.0.123-rc.1')).toBe('1.0.0-rc.1');
    expect(normalizeVersion('v2.0-alpha01')).toBe('2.0.0-alpha01');
    expect(normalizeVersion('v3.0.0+f2eed76')).toBe('3.0.0+f2eed76');
    expect(normalizeVersion('v1-beta+exp.sha.5114f85')).toBe('1.0.0-beta+exp.sha.5114f85');
    expect(normalizeVersion('v1-beta+exp.sha.5114f85', { onlyCore: true })).toBe('1.0.0');
    expect(normalizeVersion('v1-beta+exp.sha.5114f85', { slice: 2 })).toBe('1.0-beta+exp.sha.5114f85');
    expect(normalizeVersion('v1-beta+exp.sha.5114f85', { slice: 2, onlyCore: true })).toBe('1.0');
  });

  it('should return undefined', () => {
    expect(normalizeVersion('')).toBeUndefined();
    expect(normalizeVersion('v')).toBeUndefined();
    expect(normalizeVersion('abc')).toBeUndefined();
    expect(normalizeVersion('test/v1.2.3')).toBeUndefined();
  });

  it('should return fallback', () => {
    expect(normalizeVersion('', { fallback: '' })).toBe('');
    expect(normalizeVersion('', { fallback: null })).toBe(null);
    expect(normalizeVersion('', { fallback: 'abc' })).toBe('abc');
    expect(normalizeVersion('', { fallback: 123 })).toBe(123);
  });
});

describe('isValidSemanticVersioning', () => {
  it('should return true', () => {
    expect(isValidSemanticVersioning('v1')).toBe(true);
    expect(isValidSemanticVersioning('v1.2')).toBe(true);
    expect(isValidSemanticVersioning('v12.23.34')).toBe(true);
    expect(isValidSemanticVersioning('1.2.3')).toBe(true);
    expect(isValidSemanticVersioning('1.2.3.4')).toBe(true);
    expect(isValidSemanticVersioning('1.2.3-alpha')).toBe(true);
    expect(isValidSemanticVersioning('1.0.0-rc.1')).toBe(true);
    expect(isValidSemanticVersioning('v2.0.0-alpha01')).toBe(true);
    expect(isValidSemanticVersioning('v3.0.0+f2eed76')).toBe(true);
    expect(isValidSemanticVersioning('v1.0.0-beta+exp.sha.5114f85')).toBe(true);
  });

  it('should return false', () => {
    expect(isValidSemanticVersioning('')).toBe(false);
    expect(isValidSemanticVersioning('v')).toBe(false);
    expect(isValidSemanticVersioning('abc')).toBe(false);
    expect(isValidSemanticVersioning('v1', true)).toBe(false);
    expect(isValidSemanticVersioning('v1.2', true)).toBe(false);
    expect(isValidSemanticVersioning('1.2.3.4', true)).toBe(false);
  });
});

describe('isPrRef', () => {
  it('should return false 1', () => {
    expect(isPrRef(getContext({
      ref: 'refs/heads/test',
    }))).toBe(false);
  });

  it('should return false 2', () => {
    expect(isPrRef(getContext({
      ref: 'refs/remotes/origin/test',
    }))).toBe(false);
  });

  it('should return false 3', () => {
    expect(isPrRef(getContext({
      ref: 'refs/tags/test',
    }))).toBe(false);
  });

  it('should return false 4', () => {
    expect(isPrRef('refs/tags/test')).toBe(false);
  });

  it('should return true 1', () => {
    expect(isPrRef(getContext({
      ref: 'refs/pull/123/merge',
    }))).toBe(true);
  });

  it('should return true 2', () => {
    expect(isPrRef(getContext({
      ref: 'refs/pull/123/head',
    }))).toBe(true);
  });

  it('should return true 3', () => {
    expect(isPrRef('refs/pull/123/head')).toBe(true);
  });
});

describe('getPrMergeRef', () => {
  it('should get merge ref 1', () => {
    expect(getPrMergeRef(getContext({
      ref: 'refs/pull/123/merge',
    }))).toBe('refs/pull/123/merge');
  });

  it('should get merge ref 2', () => {
    expect(getPrMergeRef(getContext({
      ref: 'refs/pull/123/head',
    }))).toBe('refs/pull/123/merge');
  });

  it('should get original ref', () => {
    expect(getPrMergeRef(getContext({
      ref: 'refs/heads/test',
    }))).toBe('refs/heads/test');
  });
});

describe('getPrHeadRef', () => {
  it('should get head ref 1', () => {
    expect(getPrHeadRef(getContext({
      ref: 'refs/pull/123/merge',
    }))).toBe('refs/pull/123/head');
  });

  it('should get head ref 2', () => {
    expect(getPrHeadRef(getContext({
      ref: 'refs/pull/123/head',
    }))).toBe('refs/pull/123/head');
  });

  it('should get original ref', () => {
    expect(getPrHeadRef(getContext({
      ref: 'refs/heads/test',
    }))).toBe('refs/heads/test');
  });
});

describe('getBranch', () => {
  it('should get branch 1', () => {
    expect(getBranch(getContext({
      ref: 'refs/heads/test',
    }))).toBe('test');
  });

  it('should get branch 2', () => {
    expect(getBranch(getContext({
      ref: 'refs/remotes/origin/test',
    }))).toBe('test');
  });

  it('should not get branch 1', () => {
    expect(getBranch(getContext({
      ref: 'refs/tags/test',
    }))).toBe('');
  });

  it('should not get branch 2', () => {
    expect(getBranch(getContext({
      ref: 'refs/pull/2/head',
    }))).toBe('');
  });

  it('should not get branch 3', () => {
    expect(getBranch('test')).toBe('');
  });

  it('should not get branch 4', () => {
    expect(getBranch('test', false)).toBe('test');
  });
});

describe('getPrBranch', () => {
  it('should get pr branch', () => {
    expect(getPrBranch(getContext({
      payload: {
        'pull_request': {
          head: {
            ref: 'test/abc',
          },
        },
      },
    }))).toBe('test/abc');
  });

  it('should not get pr branch', () => {
    expect(getPrBranch(getContext({}))).toBe('');
  });
});

describe('getRefForUpdate', () => {
  // https://github.com/octokit/rest.js/issues/1308#issuecomment-480532468
  it('should get ref for update', () => {
    expect(getRefForUpdate(getContext({
      ref: 'refs/heads/test',
    }))).toBe('heads/test');
  });
});

describe('uniqueArray', () => {
  it('should return unique array', () => {
    expect(uniqueArray([])).toEqual([]);
    // eslint-disable-next-line no-magic-numbers
    expect(uniqueArray<number>([1, 2, 2, 3, 4, 3])).toEqual([1, 2, 3, 4]);
    expect(uniqueArray<string>(['1', '2', '2', '3', '4', '3'])).toEqual(['1', '2', '3', '4']);
    expect(uniqueArray<string>(['v1.2', 'v1', 'v1.2'])).toEqual(['v1.2', 'v1']);
  });
});

describe('getBuildInfo', () => {
  it('should get build version 1', () => {
    expect(getBuildInfo(path.resolve(__dirname, 'fixtures', 'build1.json'))).toEqual({
      'tagName': 'v1.2.3',
      'branch': 'gh-actions',
      'tags': [
        'v1.2.3',
        'v1',
        'v1.2',
      ],
      'updated_at': '2020-01-01T01:23:45.000Z',
    });
  });

  it('should get build version 2', () => {
    expect(getBuildInfo(path.resolve(__dirname, 'fixtures', 'build2.json'))).toEqual({
      'owner': 'hello',
      'repo': 'world',
      'sha': '162553222be3497f057501e028b47afc64944d84',
      'ref': 'release/v1.2.3',
      'tagName': 'v1.2.3',
      'branch': 'gh-actions',
      'tags': [
        'v1.2.3',
        'v1',
        'v1.2',
      ],
      'updated_at': '2020-01-01T01:23:45.000Z',
    });
  });

  it('should return false 1', () => {
    expect(getBuildInfo(path.resolve(__dirname, 'fixtures', 'build.test.json'))).toBe(false);
  });

  it('should return false 2', () => {
    expect(getBuildInfo(path.resolve(__dirname, 'fixtures', 'build3.json'))).toBe(false);
  });
});

describe('split', () => {
  it('should return empty array', () => {
    expect(split('')).toEqual([]);
  });

  it('should split string value', () => {
    expect(split('test1\ntest2\n')).toEqual([
      'test1',
      'test2',
      '',
    ]);
  });
});

describe('getArrayInput', () => {
  testEnv();

  it('should get single input', () => {
    process.env.INPUT_TEST = 'test';

    expect(getArrayInput('test')).toEqual(['test']);
  });

  it('should get multiple inputs', () => {
    process.env.INPUT_TEST = 'test1\ntest2, test3\n\ntest4';

    expect(getArrayInput('test')).toEqual(['test1', 'test2', 'test3', 'test4']);
  });

  it('should get multiple inputs with different separator', () => {
    process.env.INPUT_TEST = 'test1\ntest2 && test3\n\ntest4';

    expect(getArrayInput('test', false, '&&')).toEqual(['test1', 'test2', 'test3', 'test4']);
  });

  it('should not separate', () => {
    process.env.INPUT_TEST = 'test1\ntest2 && test3\n\ntest4';

    expect(getArrayInput('test', false, '')).toEqual(['test1', 'test2 && test3', 'test4']);
  });

  it('should unique', () => {
    process.env.INPUT_TEST = 'test1\ntest2 && test3\n\ntest2';

    expect(getArrayInput('test', false, '&&')).toEqual(['test1', 'test2', 'test3']);
  });

  it('should not unique', () => {
    process.env.INPUT_TEST = 'test1\ntest2 && test3\n\ntest2';

    expect(getArrayInput('test', false, '&&', false)).toEqual(['test1', 'test2', 'test3', 'test2']);
  });

  it('should throw error', () => {
    expect(() => {
      getArrayInput('test', true);
    }).toThrow();
  });
});

describe('sleep', () => {
  it('should sleep', done => {
    const fn = vi.fn();

    sleep(1000).then(() => {
      fn();
      done();
    });

    expect(fn).not.toBeCalled();
    vi.advanceTimersByTime(1500);
  });
});

describe('useNpm', () => {
  const setExists = testFs();

  it('should return true (both package-lock.json and yarn.json exist)', () => {
    setExists(true);
    expect(useNpm('test')).toBe(true);
  });

  it('should return true (explicitly specified npm)', () => {
    setExists([false, true]);
    expect(useNpm('test', 'npm')).toBe(true);
  });

  it('should return true (only package-lock.json exists)', () => {
    setExists([true, false]);
    expect(useNpm('test')).toBe(true);
  });

  it('should return true (neither exists package-lock.json and yarn.json)', () => {
    setExists(false);
    expect(useNpm('test')).toBe(true);
  });

  it('should return false (only yarn.json exists)', () => {
    setExists([false, true]);
    expect(useNpm('test')).toBe(false);
  });

  it('should return false (explicitly specified yarn)', () => {
    setExists(true);
    expect(useNpm('test', 'yarn')).toBe(false);
  });
});

describe('replaceAll', () => {
  it('should replace all', () => {
    expect(replaceAll('', ',', ' ')).toBe('');
    expect(replaceAll('test1', ',', ' ')).toBe('test1');
    expect(replaceAll('test1,test2,test3', ',', ' ')).toBe('test1 test2 test3');
    expect(replaceAll('test1;test2\\;test3', /[^\\];/, '\\;')).toBe('test\\;test2\\;test3');
  });
});
