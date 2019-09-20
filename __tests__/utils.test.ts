/* eslint-disable no-magic-numbers */
import path from 'path';
import Logger from '../src/logger';
import { testEnv, getContext } from '../src/test/utils';
import {
	isRelease,
	getWorkspace,
	getGitUrl,
	escapeRegExp,
	getBoolValue,
	getRepository,
	getTagName,
	uniqueArray,
	getBuildVersion,
	showActionInfo,
} from '../src/utils';
import { spyOnSignale } from './util';

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

describe('getGitUrl', () => {
	testEnv();

	it('should return git url with access token', () => {
		process.env.INPUT_ACCESS_TOKEN = 'test';
		expect(getGitUrl(getContext({
			repo: {
				owner: 'Hello',
				repo: 'World',
			},
		}))).toBe('https://test@github.com/Hello/World.git');
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
	it('should show action info', () => {
		const {infoMock} = spyOnSignale();

		showActionInfo(path.resolve(__dirname, 'fixtures'), new Logger(), getContext({
			eventName: 'push',
			ref: 'refs/tags/test',
			payload: {
				action: 'rerequested',
			},
		}));

		expect(infoMock).toBeCalledTimes(4);
		expect(infoMock.mock.calls).toEqual([
			['Version: %s', 'v1.2.3'],
			['Event: %s', 'push'],
			['Action: %s', 'rerequested'],
			['Tag name: %s', 'test'],
		]);
	});

	it('should show action info without version', () => {
		const {infoMock} = spyOnSignale();

		showActionInfo(path.resolve(__dirname, 'a'), new Logger(), getContext({
			eventName: 'push',
			ref: 'refs/tags/test',
			payload: {
				action: 'rerequested',
			},
		}));

		expect(infoMock).toBeCalledTimes(3);
		expect(infoMock.mock.calls).toEqual([
			['Event: %s', 'push'],
			['Action: %s', 'rerequested'],
			['Tag name: %s', 'test'],
		]);
	});
});
