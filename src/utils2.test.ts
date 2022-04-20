/* eslint-disable no-magic-numbers */
import { testEnv } from '@technote-space/github-action-test-helper';
import { describe, expect, it, vi } from 'vitest';
import { Utils } from '../src';

const { generateNewPatchVersion, generateNewMinorVersion, generateNewMajorVersion, arrayChunk, versionCompare, isCommandDebug, isOutputDebug, objectGet, mask }             = Utils;
const { isBranch, isTagRef, normalizeRef, trimRef, getTag, getRefspec, getRemoteRefspec, getLocalRefspec, getOctokit, replaceVariables, ensureNotNullValue, ensureNotNull } = Utils;

vi.useFakeTimers();

describe('generateNewPatchVersion', () => {
  it('should generate new patch tag', () => {
    expect(generateNewPatchVersion('v1.2.3')).toBe('v1.2.4');
    expect(generateNewPatchVersion('v1')).toBe('v1.0.1');
    expect(generateNewPatchVersion('v1.2')).toBe('v1.2.1');
    expect(generateNewPatchVersion('v1.2.3.4')).toBe('v1.2.4');
    expect(generateNewPatchVersion('1.2.3')).toBe('v1.2.4');
  });

  it('should throw error', () => {
    expect(() => {
      generateNewPatchVersion('');
    }).toThrow();
    expect(() => {
      generateNewPatchVersion('test');
    }).toThrow();
  });
});

describe('generateNewMinorVersion', () => {
  it('should generate new minor tag', () => {
    expect(generateNewMinorVersion('v1.2.3')).toBe('v1.3.0');
    expect(generateNewMinorVersion('v1')).toBe('v1.1.0');
    expect(generateNewMinorVersion('v1.2')).toBe('v1.3.0');
    expect(generateNewMinorVersion('v1.2.3.4')).toBe('v1.3.0');
    expect(generateNewMinorVersion('1.2.3')).toBe('v1.3.0');
  });

  it('should throw error', () => {
    expect(() => {
      generateNewMinorVersion('');
    }).toThrow();
    expect(() => {
      generateNewMinorVersion('test');
    }).toThrow();
  });
});

describe('generateNewMajorVersion', () => {
  it('should generate new major tag', () => {
    expect(generateNewMajorVersion('v1.2.3')).toBe('v2.0.0');
    expect(generateNewMajorVersion('v1')).toBe('v2.0.0');
    expect(generateNewMajorVersion('v1.2')).toBe('v2.0.0');
    expect(generateNewMajorVersion('v1.2.3.4')).toBe('v2.0.0');
    expect(generateNewMajorVersion('1.2.3')).toBe('v2.0.0');
  });

  it('should throw error', () => {
    expect(() => {
      generateNewMajorVersion('');
    }).toThrow();
    expect(() => {
      generateNewMajorVersion('test');
    }).toThrow();
  });
});

describe('arrayChunk', () => {
  it('should split array', () => {
    expect(arrayChunk([])).toEqual([]);
    expect(arrayChunk([1, 2, 3])).toEqual([[1, 2, 3]]);
    expect(arrayChunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });
});

describe('versionCompare', () => {
  it('should return 0', () => {
    expect(versionCompare('v1.2.3', 'v1.2.3')).toBe(0);
    expect(versionCompare('v1.2.3', '1.2.3')).toBe(0);
    expect(versionCompare('1.2.3', 'v1.2', false)).toBe(0);
    expect(versionCompare('v1.2.3', 'v1', false)).toBe(0);
    expect(versionCompare('v1', 'v1.2', false)).toBe(0);
  });

  it('should return 1', () => {
    expect(versionCompare('v1.2.3', 'v1.2.2')).toBe(1);
    expect(versionCompare('v1.2.3', '1.2.2')).toBe(1);
    expect(versionCompare('1.2.3', 'v1.2')).toBe(1);
    expect(versionCompare('v1.2.3.0', 'v1.2.3')).toBe(1);
    expect(versionCompare('v1.2.3', 'v1.2.2', false)).toBe(1);
  });

  it('should return -1', () => {
    expect(versionCompare('v1.2.3', 'v1.2.4')).toBe(-1);
    expect(versionCompare('v1.2.3', '1.2.4')).toBe(-1);
    expect(versionCompare('1.2', 'v1.2.3')).toBe(-1);
    expect(versionCompare('v1.2.3', 'v1.2.3.0')).toBe(-1);
    expect(versionCompare('v1.2.3', 'v1.2.4', false)).toBe(-1);
  });
});

describe('getOctokit', () => {
  testEnv();

  it('should use env token', () => {
    process.env.INPUT_GITHUB_TOKEN = 'input token';
    expect(() => getOctokit()).not.toThrow();
  });

  it('should use input token', () => {
    expect(() => getOctokit('input token')).not.toThrow();
  });

  it('should throw error', () => {
    expect(() => getOctokit()).toThrow();
  });
});

describe('isBranch', () => {
  it('should return true', () => {
    expect(isBranch('refs/heads/master')).toBe(true);
  });

  it('should return false', () => {
    expect(isBranch('test')).toBe(false);
    expect(isBranch('heads')).toBe(false);
  });
});

describe('isTagRef', () => {
  it('should return true', () => {
    expect(isTagRef('refs/tags/v1.2.3')).toBe(true);
  });

  it('should return false', () => {
    expect(isTagRef('refs/heads/master')).toBe(false);
    expect(isTagRef('heads/master')).toBe(false);
  });
});

describe('normalizeRef', () => {
  it('should normalize ref', () => {
    expect(normalizeRef('master')).toBe('refs/heads/master');
    expect(normalizeRef('refs/heads/master')).toBe('refs/heads/master');
    expect(normalizeRef('refs/tags/v1.2.3')).toBe('refs/tags/v1.2.3');
    expect(normalizeRef('refs/pull/123/merge')).toBe('refs/pull/123/merge');
  });
});

describe('trimRef', () => {
  it('should trim ref', () => {
    expect(trimRef('master')).toBe('master');
    expect(trimRef('refs/heads/master')).toBe('master');
    expect(trimRef('refs/tags/v1.2.3')).toBe('v1.2.3');
    expect(trimRef('refs/pull/123/merge')).toBe('123/merge');
  });
});

describe('getTag', () => {
  it('should get tag', () => {
    expect(getTag('master')).toBe('');
    expect(getTag('heads/master')).toBe('');
    expect(getTag('refs/heads/master')).toBe('');
    expect(getTag('refs/tags/v1.2.3')).toBe('v1.2.3');
    expect(getTag('refs/pull/123/merge')).toBe('');
  });
});

describe('getRefspec', () => {
  it('should get refspec', () => {
    expect(getRefspec('master')).toBe('refs/heads/master:refs/remotes/origin/master');
    expect(getRefspec('refs/heads/master', 'test')).toBe('refs/heads/master:refs/remotes/test/master');
    expect(getRefspec('refs/tags/v1.2.3')).toBe('refs/tags/v1.2.3:refs/tags/v1.2.3');
    expect(getRefspec('refs/pull/123/merge')).toBe('refs/pull/123/merge:refs/remotes/origin/pull/123/merge');
  });
});

describe('getRemoteRefspec', () => {
  it('should get remote refspec', () => {
    expect(getRemoteRefspec('master')).toBe('refs/heads/master');
    expect(getRemoteRefspec('refs/heads/master')).toBe('refs/heads/master');
    expect(getRemoteRefspec('refs/tags/v1.2.3')).toBe('refs/tags/v1.2.3');
    expect(getRemoteRefspec('refs/pull/123/merge')).toBe('refs/pull/123/merge');
  });
});

describe('getLocalRefspec', () => {
  it('should get remote refspec', () => {
    expect(getLocalRefspec('master')).toBe('origin/master');
    expect(getLocalRefspec('refs/heads/master', 'test')).toBe('test/master');
    expect(getLocalRefspec('refs/tags/v1.2.3')).toBe('tags/v1.2.3');
    expect(getLocalRefspec('refs/pull/123/merge')).toBe('origin/pull/123/merge');
  });
});

describe('mask', () => {
  it('should remove token', () => {
    expect(mask({})).toEqual({});
    expect(mask({
      token: 'test',
      test1: null,
      test2: undefined,
    })).toEqual({
      token: '***',
      test1: null,
      test2: undefined,
    });
    expect(mask({
      test1: {
        token: 'test',
      },
      test2: 2,
      test3: {
        test: 3,

      },
    })).toEqual({
      test1: {
        token: '***',
      },
      test2: 2,
      test3: {
        test: 3,
      },
    });
    expect(mask({
      abc: 'test',
      test1: {
        abc: 'test',
        test2: 2,
        test3: 3,
        test4: {
          test5: {
            abc: 'test',
            test6: 6,
          },
        },
      },
    }, 'abc')).toEqual({
      abc: '***',
      test1: {
        abc: '***',
        test2: 2,
        test3: 3,
        test4: {
          test5: {
            abc: '***',
            test6: 6,
          },
        },
      },
    });
  });
});

describe('replaceVariables', () => {
  it('should replace variables', async() => {
    expect(await replaceVariables('', [])).toBe('');
    expect(await replaceVariables('${test1}/${test2}/${test3}/${test4}', [
      { key: 'test1', replace: '1' },
      { key: 'test2', replace: (): string => '2' },
      { key: 'test3', replace: (): Promise<string> => Promise.resolve('3') },
      { key: 'test5', replace: '5' },
    ])).toBe('1/2/3/${test4}');
  });
});

describe('isCommandDebug', () => {
  testEnv();

  it('should return true 1', () => {
    process.env.INPUT_UTILS_COMMAND_DEBUG = 'true';
    expect(isCommandDebug()).toBe(true);
  });

  it('should return true 2', () => {
    process.env.UTILS_COMMAND_DEBUG = 'true';
    expect(isCommandDebug()).toBe(true);
  });

  it('should return false 1', () => {
    expect(isCommandDebug()).toBe(false);
  });

  it('should return false 2', () => {
    process.env.INPUT_UTILS_COMMAND_DEBUG = '';
    expect(isCommandDebug()).toBe(false);
  });

  it('should return false 3', () => {
    process.env.INPUT_UTILS_COMMAND_DEBUG = '1';
    expect(isCommandDebug()).toBe(false);
  });

  it('should return false 4', () => {
    process.env.INPUT_UTILS_COMMAND_DEBUG = 'abc';
    expect(isCommandDebug()).toBe(false);
  });

  it('should return false 5', () => {
    process.env.UTILS_COMMAND_DEBUG = '';
    expect(isCommandDebug()).toBe(false);
  });
});

describe('isOutputDebug', () => {
  testEnv();

  it('should return true', () => {
    process.env.INPUT_UTILS_OUTPUT_DEBUG = 'true';
    expect(isOutputDebug()).toBe(true);
  });

  it('should return false 1', () => {
    expect(isOutputDebug()).toBe(false);
  });

  it('should return false 2', () => {
    process.env.INPUT_UTILS_OUTPUT_DEBUG = '';
    expect(isOutputDebug()).toBe(false);
  });

  it('should return false 3', () => {
    process.env.INPUT_UTILS_OUTPUT_DEBUG = '1';
    expect(isOutputDebug()).toBe(false);
  });

  it('should return false 4', () => {
    process.env.INPUT_UTILS_OUTPUT_DEBUG = 'abc';
    expect(isOutputDebug()).toBe(false);
  });
});

describe('ensureNotNullValue', () => {
  it('should return value', () => {
    expect(ensureNotNullValue('test', '')).toBe('test');
    expect(ensureNotNullValue(true, false)).toBe(true);
    expect(ensureNotNullValue(1, 0)).toBe(1);
  });

  it('should return default value', () => {
    expect(ensureNotNullValue(null, '')).toBe('');
    expect(ensureNotNullValue(undefined, '')).toBe('');
    expect(ensureNotNullValue(null, false)).toBe(false);
    expect(ensureNotNullValue(undefined, 3)).toBe(3);
  });
});

describe('ensureNotNull', () => {
  it('should return value', () => {
    expect(ensureNotNull('test')).toBe('test');
  });

  it('should return empty string', () => {
    expect(ensureNotNull(null)).toBe('');
    expect(ensureNotNull(undefined)).toBe('');
  });
});

describe('objectGet', () => {
  it('should return object value', () => {
    expect(objectGet({ test1: { test2: 123 } }, 'test1')).toEqual({ test2: 123 });
    expect(objectGet({ test1: { test2: 123 } }, 'test1.test2')).toBe(123);
  });

  it('should return undefined', () => {
    expect(objectGet(undefined, 'test1.test2')).toBeUndefined();
    expect(objectGet({ test1: { test2: 123 } }, '')).toBeUndefined();
    expect(objectGet({ test1: { test2: 123 } }, 'test1.test3')).toBeUndefined();
  });

  it('should return default value', () => {
    expect(objectGet(undefined, 'test1.test2', 123)).toBe(123);
    expect(objectGet({ test1: { test2: 123 } }, '', false)).toBe(false);
  });
});
