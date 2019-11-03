/* eslint-disable no-magic-numbers */
import path from 'path';
import {
	spyOnStdout,
	stdoutCalledWith,
} from '@technote-space/github-action-test-helper';
import { testEnv, getContext } from '@technote-space/github-action-test-helper';
import { Logger, Utils } from '../src';
import { testLogger } from './util';

const {isRelease, isPush, isPr, isIssue, isCron, getWorkspace, getActor, getGitUrl, escapeRegExp, getBoolValue} = Utils;
const {getRepository, getTagName, isSemanticVersioningTagName, isPrRef, getPrMergeRef, getPrHeadRef, sleep}     = Utils;
const {getBranch, getRefForUpdate, getSender, uniqueArray, getBuildInfo, showActionInfo, getArrayInput}         = Utils;

jest.useFakeTimers();

describe('isRelease', () => {
	it('should return true', () => {
		expect(isRelease(getContext({
			eventName: 'release',
		}))).toBe(true);
	});

	it('should return false', () => {
		expect(isRelease(getContext({
			eventName: 'push',
		}))).toBe(false);
	});
});

describe('isPush', () => {
	it('should return true', () => {
		expect(isPush(getContext({
			eventName: 'push',
		}))).toBe(true);
	});

	it('should return false', () => {
		expect(isPush(getContext({
			eventName: 'release',
		}))).toBe(false);
	});
});

describe('isPr', () => {
	it('should return true', () => {
		expect(isPr(getContext({
			eventName: 'pull_request',
		}))).toBe(true);
	});

	it('should return false', () => {
		expect(isPr(getContext({
			eventName: 'release',
		}))).toBe(false);
	});
});

describe('isIssue', () => {
	it('should return true', () => {
		expect(isIssue(getContext({
			eventName: 'issues',
		}))).toBe(true);
	});

	it('should return false', () => {
		expect(isIssue(getContext({
			eventName: 'release',
		}))).toBe(false);
	});
});

describe('isCron', () => {
	it('should return true', () => {
		expect(isCron(getContext({
			eventName: 'schedule',
		}))).toBe(true);
	});

	it('should return false', () => {
		expect(isCron(getContext({
			eventName: 'release',
		}))).toBe(false);
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

	it('should get branch 1', () => {
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
});

describe('getRefForUpdate', () => {
	// https://github.com/octokit/rest.js/issues/1308#issuecomment-480532468
	it('should get ref for update', () => {
		expect(getRefForUpdate(getContext({
			ref: 'refs/heads/test',
		}))).toBe('heads/test');
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
		}))).toBe(false);
	});

	it('should not get sender 2', () => {
		expect(getSender(getContext({
			payload: {
				sender: {
					type: 'test',
					login: 'test',
				},
			},
		}))).toBe(false);
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

describe('showActionInfo', () => {
	testLogger();

	it('should show action info', () => {
		const mockStdout = spyOnStdout();
		const context    = getContext({
			eventName: 'push',
			ref: 'refs/tags/test',
			payload: {
				action: 'rerequested',
			},
			sha: 'test-sha',
			repo: {
				owner: 'hello',
				repo: 'world',
			},
			actor: 'test-actor',
		});

		showActionInfo(path.resolve(__dirname, 'fixtures'), new Logger(), context);

		stdoutCalledWith(mockStdout, [
			'',
			'==================================================',
			'Version:  v1.2.3',
			'Event:    push',
			'Action:   rerequested',
			'sha:      test-sha',
			'ref:      refs/tags/test',
			'Tag name: test',
			'owner:    hello',
			'repo:     world',
			'',
			'::group::Dump context',
			JSON.stringify(context, null, '\t'),
			'::endgroup::',
			'::group::Dump Payload',
			JSON.stringify(context.payload, null, '\t'),
			'::endgroup::',
			'==================================================',
			'',
		]);
	});

	it('should show action info with owner/repo', () => {
		const mockStdout = spyOnStdout();
		const context    = getContext({
			eventName: 'push',
			ref: 'refs/tags/test',
			payload: {
				action: 'rerequested',
			},
			sha: 'test-sha',
			repo: {
				owner: 'hello',
				repo: 'world',
			},
			actor: 'test-actor',
		});

		showActionInfo(path.resolve(__dirname, 'fixtures', 'test'), new Logger(), context);

		stdoutCalledWith(mockStdout, [
			'',
			'==================================================',
			'Version:  hello/world@v1.2.3',
			'Event:    push',
			'Action:   rerequested',
			'sha:      test-sha',
			'ref:      refs/tags/test',
			'Tag name: test',
			'owner:    hello',
			'repo:     world',
			'',
			'::group::Dump context',
			JSON.stringify(context, null, '\t'),
			'::endgroup::',
			'::group::Dump Payload',
			JSON.stringify(context.payload, null, '\t'),
			'::endgroup::',
			'==================================================',
			'',
		]);
	});

	it('should show action info without version and tag', () => {
		const mockStdout = spyOnStdout();
		const context    = getContext({
			eventName: 'push',
			ref: 'refs/heads/test',
			payload: {
				action: 'rerequested',
			},
			sha: 'test-sha',
			repo: {
				owner: 'hello',
				repo: 'world',
			},
			actor: 'test-actor',
		});

		showActionInfo(path.resolve(__dirname, 'a'), new Logger(), context);

		stdoutCalledWith(mockStdout, [
			'',
			'==================================================',
			'Event:    push',
			'Action:   rerequested',
			'sha:      test-sha',
			'ref:      refs/heads/test',
			'owner:    hello',
			'repo:     world',
			'',
			'::group::Dump context',
			JSON.stringify(context, null, '\t'),
			'::endgroup::',
			'::group::Dump Payload',
			JSON.stringify(context.payload, null, '\t'),
			'::endgroup::',
			'==================================================',
			'',
		]);
	});

	it('should show action info with issue labels', () => {
		const mockStdout = spyOnStdout();
		const context    = getContext({
			eventName: 'issues',
			ref: 'refs/heads/test',
			payload: {
				action: 'opened',
				issue: {
					labels: [
						{name: 'Issue Label1'},
						{name: 'Issue Label2'},
					],
				},
			},
			sha: 'test-sha',
			repo: {
				owner: 'hello',
				repo: 'world',
			},
			actor: 'test-actor',
		});

		showActionInfo(path.resolve(__dirname, 'a'), new Logger(), context);

		stdoutCalledWith(mockStdout, [
			'',
			'==================================================',
			'Event:    issues',
			'Action:   opened',
			'sha:      test-sha',
			'ref:      refs/heads/test',
			'Labels:',
			'  - Issue Label1',
			'  - Issue Label2',
			'owner:    hello',
			'repo:     world',
			'',
			'::group::Dump context',
			JSON.stringify(context, null, '\t'),
			'::endgroup::',
			'::group::Dump Payload',
			JSON.stringify(context.payload, null, '\t'),
			'::endgroup::',
			'==================================================',
			'',
		]);
	});

	it('should show action info with PR labels', () => {
		const mockStdout = spyOnStdout();
		const context    = getContext({
			eventName: 'pull_request',
			ref: 'refs/heads/test',
			payload: {
				action: 'opened',
				'pull_request': {
					labels: [
						{name: 'PR Label1'},
						{name: 'PR Label2'},
					],
				},
			},
			sha: 'test-sha',
			repo: {
				owner: 'hello',
				repo: 'world',
			},
			actor: 'test-actor',
		});

		showActionInfo(path.resolve(__dirname, 'a'), new Logger(), context);

		stdoutCalledWith(mockStdout, [
			'',
			'==================================================',
			'Event:    pull_request',
			'Action:   opened',
			'sha:      test-sha',
			'ref:      refs/heads/test',
			'Labels:',
			'  - PR Label1',
			'  - PR Label2',
			'owner:    hello',
			'repo:     world',
			'',
			'::group::Dump context',
			JSON.stringify(context, null, '\t'),
			'::endgroup::',
			'::group::Dump Payload',
			JSON.stringify(context.payload, null, '\t'),
			'::endgroup::',
			'==================================================',
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
