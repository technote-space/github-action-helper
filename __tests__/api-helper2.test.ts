/* eslint-disable no-magic-numbers */
import nock from 'nock';
import path from 'path';
import { GitHub } from '@actions/github' ;
import { GitCreateCommitResponse } from '@octokit/rest';
import {
	disableNetConnect,
	testEnv,
	getContext,
	getApiFixture,
	createResponse,
	spyOnStdout,
	stdoutCalledWith,
} from '@technote-space/github-action-test-helper';
import { ApiHelper, Logger } from '../src';

const rootDir = path.resolve(__dirname, 'fixtures');
const context = getContext({
	ref: 'refs/heads/test',
	repo: {
		owner: 'hello',
		repo: 'world',
	},
	sha: '7638417db6d59f3c431d3e1f261cc637155684cd',
	payload: {
		sender: {
			type: 'User',
			login: 'octocat',
		},
		number: 123,
	},
});
const octokit = new GitHub('');

const createCommitResponse = createResponse<GitCreateCommitResponse>({
	author: {
		date: '',
		email: '',
		name: '',
	},
	committer: {
		date: '',
		email: '',
		name: '',
	},
	message: '',
	'node_id': '',
	parents: [],
	sha: '',
	tree: {
		sha: '',
		url: '',
	},
	url: '',
	verification: {
		payload: null,
		reason: '',
		signature: null,
		verified: true,
	},
});

describe('ApiHelper with params', () => {
	disableNetConnect(nock);
	testEnv();
	beforeEach(() => {
		Logger.resetForTesting();
	});

	const helper = new ApiHelper(new Logger(), {branch: 'test-branch', sender: 'test-sender', refForUpdate: 'test-ref', suppressBPError: true});

	describe('updateRef', () => {
		it('should output warning 1', async() => {
			const mockStdout = spyOnStdout();
			nock('https://api.github.com')
				.patch('/repos/hello/world/git/refs/' + encodeURIComponent('test-ref'), body => {
					expect(body).toHaveProperty('sha');
					return body;
				})
				.reply(403, {
					'message': 'Required status check "Test" is expected.',
				});

			await helper.updateRef(createCommitResponse, 'test-ref', false, octokit, context);

			stdoutCalledWith(mockStdout, [
				'::warning::Branch is protected.',
			]);
		});

		it('should output warning 2', async() => {
			const mockStdout = spyOnStdout();
			nock('https://api.github.com')
				.patch('/repos/hello/world/git/refs/' + encodeURIComponent('test-ref'), body => {
					expect(body).toHaveProperty('sha');
					return body;
				})
				.reply(403, {
					'message': '5 of 5 required status checks are expected.',
				});

			await helper.updateRef(createCommitResponse, 'test-ref', false, octokit, context);

			stdoutCalledWith(mockStdout, [
				'::warning::Branch is protected.',
			]);
		});

		it('should throw error', async() => {
			nock('https://api.github.com')
				.patch('/repos/hello/world/git/refs/' + encodeURIComponent('test-ref'), body => {
					expect(body).toHaveProperty('sha');
					return body;
				})
				.reply(404, {
					'message': 'Not Found',
				});

			await expect(helper.updateRef(createCommitResponse, 'test-ref', false, octokit, context)).rejects.toThrow('Not Found');
		});
	});

	describe('commit', () => {
		it('should commit without update ref', async() => {
			const fn1        = jest.fn();
			const fn2        = jest.fn();
			const mockStdout = spyOnStdout();
			nock('https://api.github.com')
				.persist()
				.post('/repos/hello/world/git/blobs')
				.reply(201, () => {
					return getApiFixture(rootDir, 'repos.git.blobs');
				})
				.get('/repos/hello/world/git/commits/7638417db6d59f3c431d3e1f261cc637155684cd')
				.reply(200, () => getApiFixture(rootDir, 'repos.git.commits.get'))
				.post('/repos/hello/world/git/trees')
				.reply(201, () => getApiFixture(rootDir, 'repos.git.trees'))
				.post('/repos/hello/world/git/commits')
				.reply(201, () => getApiFixture(rootDir, 'repos.git.commits'))
				.patch('/repos/hello/world/git/refs/' + encodeURIComponent('heads/test'))
				.reply(200, () => {
					fn1();
					return getApiFixture(rootDir, 'repos.git.refs.update');
				})
				.patch('/repos/hello/world/git/refs/' + encodeURIComponent('test-ref'))
				.reply(403, () => {
					fn2();
					return {'message': 'Required status check "Test" is expected.'};
				});

			expect(await helper.commit(rootDir, 'test commit message', ['build1.json', 'build2.json'], octokit, context)).toBe(true);
			expect(fn1).not.toBeCalled();
			expect(fn2).toBeCalledTimes(1);
			stdoutCalledWith(mockStdout, [
				'::group::Creating blobs...',
				'::endgroup::',
				'::group::Creating tree...',
				'::endgroup::',
				'::group::Creating commit... [cd8274d15fa3ae2ab983129fb037999f264ba9a7]',
				'::endgroup::',
				'::group::Updating ref... [test-ref] [7638417db6d59f3c431d3e1f261cc637155684cd]',
				'::warning::Branch is protected.',
				'::endgroup::',
			]);
		});
	});

	describe('getUser', () => {
		it('should get user', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.get('/users/octocat')
				.reply(200, () => {
					fn1();
					return getApiFixture(rootDir, 'users.get');
				})
				.get('/users/test-sender')
				.reply(200, () => {
					fn2();
					return getApiFixture(rootDir, 'users.get');
				});

			const user = await helper.getUser(octokit, context);
			expect(fn1).not.toBeCalled();
			expect(fn2).toBeCalledTimes(1);
			expect(user.login).toBe('octocat');
			expect(user.email).toBe('octocat@github.com');
			expect(user.name).toBe('monalisa octocat');
			expect(user.id).toBe(1);
		});
	});
});