/* eslint-disable no-magic-numbers */
import path from 'path';
import { testEnv, getContext, testFs } from '@technote-space/github-action-test-helper';
import { Utils } from '../src';

const {getWorkspace, getActor, escapeRegExp, getRegExp, getPrefixRegExp, getSuffixRegExp, useNpm, sleep}        = Utils;
const {isSemanticVersioningTagName, isPrRef, getPrMergeRef, getBoolValue, replaceAll, getPrHeadRef, arrayChunk} = Utils;
const {getBranch, getRefForUpdate, uniqueArray, getBuildInfo, split, getArrayInput, generateNewPatchVersion}    = Utils;

jest.useFakeTimers();

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
	});
});

describe('getSuffixRegExp', () => {
	it('should get RegExp', () => {
		expect(getSuffixRegExp('?t*e^s$t*/abc').test('123/?t*e^s$t*/abc')).toBe(true);
		expect(getSuffixRegExp('?t*e^s$t*/abc').test('123/?t*e^s$t*/abc/xyz')).toBe(false);
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

describe('isSemanticVersioningTagName', () => {
	it('should return true', () => {
		expect(isSemanticVersioningTagName('v1')).toBe(true);
		expect(isSemanticVersioningTagName('v1.2')).toBe(true);
		expect(isSemanticVersioningTagName('v12.23.34')).toBe(true);
		expect(isSemanticVersioningTagName('1.2.3')).toBe(true);
	});

	it('should return false', () => {
		expect(isSemanticVersioningTagName('')).toBe(false);
		expect(isSemanticVersioningTagName('v')).toBe(false);
		expect(isSemanticVersioningTagName('abc')).toBe(false);
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

	it('should get branch 3', () => {
		expect(getBranch(getContext({
			ref: 'heads/test',
		}))).toBe('test');
	});

	it('should get branch 4', () => {
		expect(getBranch(getContext({
			ref: 'remotes/origin/test',
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
			'sha': 'ed968e840d10d2d313a870bc131a4e2c311d7ad09bdf32b3418147221f51a6e2',
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

	it('should throw error', () => {
		expect(() => {
			getArrayInput('test', true);
		}).toThrow();
	});
});

describe('sleep', () => {
	it('should sleep', done => {
		const fn = jest.fn();

		sleep(1000).then(() => {
			fn();
			done();
		});

		expect(fn).not.toBeCalled();
		jest.runTimersToTime(1500);
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
		expect(replaceAll('test1;test2\\;test3', /[^/];/, '\\;')).toBe('test\\;test2\\;test3');
	});
});

describe('generateNewPatchVersion', () => {
	it('should generate new patch tag', () => {
		expect(generateNewPatchVersion('v1.2.3')).toBe('v1.2.4');
		expect(generateNewPatchVersion('v1')).toBe('v1.0.1');
		expect(generateNewPatchVersion('v1.2')).toBe('v1.2.1');
		expect(generateNewPatchVersion('v1.2.3.4')).toBe('v1.2.3.5');
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

describe('arrayChunk', () => {
	it('should split array', () => {
		expect(arrayChunk([])).toEqual([]);
		expect(arrayChunk([1, 2, 3])).toEqual([[1, 2, 3]]);
		expect(arrayChunk([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
	});
});
