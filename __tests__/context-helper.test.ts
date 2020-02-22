/* eslint-disable no-magic-numbers */
import path from 'path';
import {
	spyOnStdout,
	stdoutCalledWith,
} from '@technote-space/github-action-test-helper';
import { testEnv, getContext } from '@technote-space/github-action-test-helper';
import { Logger, ContextHelper } from '../src';

const {isRelease, isPush, isPr, isIssue, isCron, isCustomEvent, isCreateTag}         = ContextHelper;
const {getGitUrl, getRepository, getTagName, getSender, removeToken, showActionInfo} = ContextHelper;

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

describe('isCustomEvent', () => {
	it('should return true', () => {
		expect(isCustomEvent(getContext({
			eventName: 'repository_dispatch',
		}))).toBe(true);
	});

	it('should return false', () => {
		expect(isCustomEvent(getContext({
			eventName: 'release',
		}))).toBe(false);
	});
});

describe('isCreateTag', () => {
	it('should return true', () => {
		expect(isCreateTag(getContext({
			eventName: 'create',
			payload: {
				'ref_type': 'tag',
			},
		}))).toBe(true);
	});

	it('should return false 1', () => {
		expect(isCreateTag(getContext({
			eventName: 'create',
			payload: {
				'ref_type': 'branch',
			},
		}))).toBe(false);
	});

	it('should return false 2', () => {
		expect(isCreateTag(getContext({
			eventName: 'release',
		}))).toBe(false);
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

describe('removeToken', () => {
	it('should remove token', () => {
		expect(removeToken({})).toEqual({});
		expect(removeToken({
			test1: {
				token: 'test',
			},
			test2: 2,
			test3: {
				test: 3,

			},
		})).toEqual({
			test1: {},
			test2: 2,
			test3: {
				test: 3,
			},
		});
		expect(removeToken({
			token: 'test',
			test1: {
				token: 'test',
				test2: 2,
				test3: 3,
				test4: {
					test5: {
						token: 'test',
						test6: 6,
					},
				},
			},
		})).toEqual({
			test1: {
				test2: 2,
				test3: 3,
				test4: {
					test5: {
						test6: 6,
					},
				},
			},
		});
	});
});

describe('showActionInfo', () => {
	beforeEach(() => {
		Logger.resetForTesting();
	});

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
			'          undefined',
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
			'          162553222be3497f057501e028b47afc64944d84',
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
