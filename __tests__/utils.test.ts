/* eslint-disable no-magic-numbers */
import path from 'path';
import { EOL } from 'os';
import { testEnv, getContext } from '@technote-space/github-action-test-helper';
import { Logger, Utils } from '../src';
import { testLogger } from './util';
import global from './global';

const {
	isRelease,
	getWorkspace,
	getActor,
	getGitUrl,
	escapeRegExp,
	getBoolValue,
	getRepository,
	getTagName,
	isSemanticVersioningTagName,
	getBranch,
	getRefForUpdate,
	getSender,
	uniqueArray,
	getBuildVersion,
	showActionInfo,
} = Utils;

describe('isRelease', () => {
	it('should return true', () => {
		expect(isRelease(getContext({
			eventName: 'release',
		}))).toBeTruthy();
	});

	it('should return false', () => {
		expect(isRelease(getContext({
			eventName: 'push',
		}))).toBeFalsy();
	});
});

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

describe('getGitUrl', () => {
	testEnv();

	it('should return git url with access token', () => {
		process.env.INPUT_GITHUB_TOKEN = 'test';
		expect(getGitUrl(getContext({
			repo: {
				owner: 'Hello',
				repo: 'World',
			},
		}))).toBe('https://octocat:test@github.com/Hello/World.git');
	});

	it('should throw error', () => {
		expect(() => {
			getGitUrl(getContext({
				repo: {
					owner: 'Hello',
					repo: 'World',
				},
			}));
		}).toThrow();
	});

	it('should return git url without access token', () => {
		expect(getGitUrl(getContext({
			repo: {
				owner: 'Hello',
				repo: 'World',
			},
		}), false)).toBe('https://github.com/Hello/World.git');
	});
});

describe('escapeRegExp', () => {
	it('should escape RegExp', () => {
		expect(escapeRegExp('.*+?^${}()|[]\\')).toBe('\\.\\*\\+\\?\\^\\$\\{\\}\\(\\)\\|\\[\\]\\\\');
	});
});

describe('getBoolValue', () => {
	it('should return true', () => {
		expect(getBoolValue('1')).toBeTruthy();
		expect(getBoolValue('true')).toBeTruthy();
		expect(getBoolValue('a')).toBeTruthy();
	});

	it('should return false', () => {
		expect(getBoolValue('0')).toBeFalsy();
		expect(getBoolValue('false')).toBeFalsy();
		expect(getBoolValue('')).toBeFalsy();
	});
});

describe('getRepository', () => {
	it('should get repository', () => {
		expect(getRepository(getContext({
			repo: {
				owner: 'Hello',
				repo: 'World',
			},
		}))).toBe('Hello/World');
	});
});

describe('getTagName', () => {
	it('should get tag name', () => {
		expect(getTagName(getContext({
			eventName: 'push',
			ref: 'refs/tags/test',
		}))).toBe('test');
	});

	it('should get release tag name', () => {
		expect(getTagName(getContext({
			eventName: 'release',
			payload: {
				release: {
					'tag_name': 'test',
				},
			},
		}))).toBe('test');
	});

	it('should be empty', () => {
		expect(getTagName(getContext({
			eventName: 'push',
			ref: 'refs/heads/test',
		}))).toBe('');
	});
});

describe('isSemanticVersioningTagName', () => {
	it('should return true', () => {
		expect(isSemanticVersioningTagName('v1')).toBeTruthy();
		expect(isSemanticVersioningTagName('v1.2')).toBeTruthy();
		expect(isSemanticVersioningTagName('v12.23.34')).toBeTruthy();
		expect(isSemanticVersioningTagName('1.2.3')).toBeTruthy();
	});

	it('should return false', () => {
		expect(isSemanticVersioningTagName('')).toBeFalsy();
		expect(isSemanticVersioningTagName('v')).toBeFalsy();
		expect(isSemanticVersioningTagName('abc')).toBeFalsy();
	});
});

describe('getBranch', () => {
	it('should get branch', () => {
		expect(getBranch(getContext({
			ref: 'refs/heads/test',
		}))).toBe('test');
	});
});

describe('getRefForUpdate', () => {
	// https://github.com/octokit/rest.js/issues/1308#issuecomment-480532468
	it('should get ref for update', () => {
		expect(getRefForUpdate(getContext({
			ref: 'refs/heads/test',
		}))).toBe(encodeURIComponent('heads/test'));
	});
});

describe('getSender', () => {
	it('should get sender', () => {
		expect(getSender(getContext({
			payload: {
				sender: {
					type: 'User',
					login: 'test',
				},
			},
		}))).toBe('test');
	});

	it('should not get sender 1', () => {
		expect(getSender(getContext({
			payload: {},
		}))).toBeFalsy();
	});

	it('should not get sender 2', () => {
		expect(getSender(getContext({
			payload: {
				sender: {
					type: 'test',
					login: 'test',
				},
			},
		}))).toBeFalsy();
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

describe('getBuildVersion', () => {
	it('should get build version', () => {
		expect(getBuildVersion(path.resolve(__dirname, 'fixtures', 'build1.json'))).toBe('v1.2.3');
	});

	it('should return false 1', () => {
		expect(getBuildVersion(path.resolve(__dirname, 'fixtures', 'build2.json'))).toBeFalsy();
	});

	it('should return false 2', () => {
		expect(getBuildVersion(path.resolve(__dirname, 'fixtures', 'build.test.json'))).toBeFalsy();
	});
});

describe('showActionInfo', () => {
	testLogger();

	it('should show action info', () => {
		const mockStdout = jest.spyOn(global.mockStdout, 'write');

		showActionInfo(path.resolve(__dirname, 'fixtures'), new Logger(), getContext({
			eventName: 'push',
			ref: 'refs/tags/test',
			payload: {
				action: 'rerequested',
			},
			sha: 'test-sha',
		}));

		expect(mockStdout).toBeCalledTimes(6);
		expect(mockStdout.mock.calls).toEqual([
			['> Version: v1.2.3' + EOL],
			['> Event: push' + EOL],
			['> Action: rerequested' + EOL],
			['> Tag name: test' + EOL],
		]);
	});

	it('should show action info without version and tag', () => {
		const mockStdout = jest.spyOn(global.mockStdout, 'write');

		showActionInfo(path.resolve(__dirname, 'a'), new Logger(), getContext({
			eventName: 'push',
			ref: 'refs/heads/test',
			payload: {
				action: 'rerequested',
			},
			sha: 'test-sha',
		}));

		expect(mockStdout).toBeCalledTimes(4);
		expect(mockStdout.mock.calls).toEqual([
			['> Event: push' + EOL],
			['> Action: rerequested' + EOL],
			['> Tag name: test' + EOL],
		]);
	});
});
