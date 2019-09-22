/* eslint-disable no-magic-numbers */
import nock from 'nock';
import path from 'path';
import { EOL } from 'os';
import { GitHub } from '@actions/github' ;
import { Response, GitCreateTreeResponse, GitCreateCommitResponse } from '@octokit/rest';
import { disableNetConnect, testEnv, getContext, getApiFixture } from '@technote-space/github-action-test-helper';
import { testLogger } from './util';
import { ApiHelper, Logger } from '../src';
import global from './global';

describe('ApiHelper', () => {
	disableNetConnect(nock);
	testEnv();
	testLogger();

	const helper = new ApiHelper(new Logger());
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
		},
	});
	const octokit = new GitHub('');

	/**
	 * @param {T} data data
	 * @return {Response<T>} response
	 */
	function createResponse<T>(data: T): Response<T> {
		return {
			data,
			status: 0,
			headers: {
				date: '',
				'x-ratelimit-limit': '',
				'x-ratelimit-remaining': '',
				'x-ratelimit-reset': '',
				'x-Octokit-request-id': '',
				'x-Octokit-media-type': '',
				link: '',
				'last-modified': '',
				etag: '',
				status: '',
			},
			[Symbol.iterator](): Iterator<boolean> {
				return {
					next(): IteratorResult<boolean> {
						return {
							done: true,
							value: true,
						};
					},
				};
			},
		};
	}

	describe('filesToBlobs', () => {
		it('should return empty', async() => {
			expect(await helper.filesToBlobs(path.resolve(__dirname, 'fixtures'), [], new GitHub(''), context)).toHaveLength(0);
		});

		it('should return blobs', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.post('/repos/hello/world/git/blobs', body => {
					fn1();
					expect(body).toHaveProperty('content');
					expect(body).toHaveProperty('encoding');
					return body;
				})
				.reply(201, () => {
					fn2();
					return getApiFixture(path.resolve(__dirname, 'fixtures'), 'repos.git.blobs');
				});

			const blobs = await helper.filesToBlobs(path.resolve(__dirname, 'fixtures'), ['build1.json', 'build2.json'], octokit, context);
			expect(blobs).toHaveLength(2);
			expect(fn1).toBeCalledTimes(2);
			expect(fn2).toBeCalledTimes(2);
		});
	});

	describe('createTree', () => {
		it('should create tree', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			const fn3 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/git/commits/7638417db6d59f3c431d3e1f261cc637155684cd')
				.reply(200, () => {
					fn1();
					return getApiFixture(path.resolve(__dirname, 'fixtures'), 'repos.git.commits.get');
				})
				.post('/repos/hello/world/git/trees', body => {
					fn2();
					expect(body).toHaveProperty('base_tree');
					expect(body).toHaveProperty('tree');
					return body;
				})
				.reply(201, () => {
					fn3();
					return getApiFixture(path.resolve(__dirname, 'fixtures'), 'repos.git.trees');
				});

			const tree = await helper.createTree([
				{
					path: 'test-path1',
					sha: 'test-sha1',
				},
				{
					path: 'test-path2',
					sha: 'test-sha2',
				},
			], octokit, context);

			expect(fn1).toBeCalledTimes(1);
			expect(fn2).toBeCalledTimes(1);
			expect(fn3).toBeCalledTimes(1);
			expect(tree).toHaveProperty('status');
			expect(tree).toHaveProperty('url');
			expect(tree).toHaveProperty('headers');
			expect(tree).toHaveProperty('data');
			expect(tree.status).toBe(201);
		});
	});

	describe('createCommit', () => {
		it('should create commit', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			nock('https://api.github.com')
				.post('/repos/hello/world/git/commits', body => {
					fn1();
					expect(body).toHaveProperty('tree');
					expect(body).toHaveProperty('parents');
					return body;
				})
				.reply(201, () => {
					fn2();
					return getApiFixture(path.resolve(__dirname, 'fixtures'), 'repos.git.commits');
				});

			const commit = await helper.createCommit('test commit message', createResponse<GitCreateTreeResponse>({
				sha: 'tree-sha',
				tree: [],
				url: '',
			}), octokit, context);

			expect(fn1).toBeCalledTimes(1);
			expect(fn2).toBeCalledTimes(1);
			expect(commit).toHaveProperty('status');
			expect(commit).toHaveProperty('url');
			expect(commit).toHaveProperty('headers');
			expect(commit).toHaveProperty('data');
			expect(commit.status).toBe(201);
		});
	});

	describe('updateRef', () => {
		it('should update ref', async() => {
			const fn1 = jest.fn();
			const fn2 = jest.fn();
			nock('https://api.github.com')
				.patch('/repos/hello/world/git/refs/' + encodeURIComponent('heads/test'), body => {
					fn1();
					expect(body).toHaveProperty('sha');
					return body;
				})
				.reply(200, () => {
					fn2();
					return getApiFixture(path.resolve(__dirname, 'fixtures'), 'repos.git.refs');
				});

			await helper.updateRef(createResponse<GitCreateCommitResponse>({
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
			}), octokit, context);

			expect(fn1).toBeCalledTimes(1);
			expect(fn2).toBeCalledTimes(1);
		});
	});

	describe('checkProtected', () => {
		it('should return true', async() => {
			const fn1 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/branches/test/protection')
				.reply(200, () => {
					fn1();
					return getApiFixture(path.resolve(__dirname, 'fixtures'), 'repos.branches.protection');
				});

			expect(await helper.checkProtected(octokit, context)).toBeTruthy();
			expect(fn1).toBeCalledTimes(1);
		});

		it('should return false', async() => {
			const fn1 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/branches/test/protection')
				.reply(404, (uri, body) => {
					fn1();
					return body;
				});

			expect(await helper.checkProtected(octokit, context)).toBeFalsy();
			expect(fn1).toBeCalledTimes(1);
		});
	});

	describe('commit', () => {
		it('should not commit 1', async() => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			expect(await helper.commit(path.resolve(__dirname, '..'), 'test commit message', [], octokit, context)).toBeFalsy();

			expect(mockStdout).toBeCalledWith('> There is no diff.' + EOL);
		});

		it('should not commit 2', async() => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/branches/test/protection')
				.reply(200, () => getApiFixture(path.resolve(__dirname, 'fixtures'), 'repos.branches.protection'));

			expect(await helper.commit(path.resolve(__dirname, 'fixtures'), 'test commit message', ['build1.json', 'build2.json'], octokit, context)).toBeFalsy();

			expect(mockStdout).toBeCalledWith('##[warning]Branch [test] is protected' + EOL);
		});

		it('should commit', async() => {
			nock('https://api.github.com')
				.persist()
				.get('/repos/hello/world/branches/test/protection')
				.reply(404)
				.post('/repos/hello/world/git/blobs')
				.reply(201, () => {
					return getApiFixture(path.resolve(__dirname, 'fixtures'), 'repos.git.blobs');
				})
				.get('/repos/hello/world/git/commits/7638417db6d59f3c431d3e1f261cc637155684cd')
				.reply(200, () => getApiFixture(path.resolve(__dirname, 'fixtures'), 'repos.git.commits.get'))
				.post('/repos/hello/world/git/trees')
				.reply(201, () => getApiFixture(path.resolve(__dirname, 'fixtures'), 'repos.git.trees'))
				.post('/repos/hello/world/git/commits')
				.reply(201, () => getApiFixture(path.resolve(__dirname, 'fixtures'), 'repos.git.commits'))
				.patch('/repos/hello/world/git/refs/' + encodeURIComponent('heads/test'))
				.reply(200, () => getApiFixture(path.resolve(__dirname, 'fixtures'), 'repos.git.refs'));

			expect(await helper.commit(path.resolve(__dirname, 'fixtures'), 'test commit message', ['build1.json', 'build2.json'], octokit, context)).toBeTruthy();
		});
	});

	describe('getUser', () => {
		it('should throw error 1', async() => {
			const fn1 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.get('/users/octocat')
				.reply(200, () => {
					fn1();
					return getApiFixture(path.resolve(__dirname, 'fixtures'), 'users.get');
				});

			await expect(helper.getUser(octokit, getContext({}))).rejects.toThrow('Sender is not valid.');
			expect(fn1).not.toBeCalled();
		});

		it('should throw error 2', async() => {
			const fn1 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.get('/users/octocat')
				.reply(404, () => {
					fn1();
					return JSON.parse('{"message": "Not Found", "documentation_url": "https://developer.github.com/v3/users/#get-a-single-user"}');
				});

			await expect(helper.getUser(octokit, context)).rejects.toThrow('Not Found');
			expect(fn1).toBeCalledTimes(1);
		});

		it('should get user', async() => {
			const fn1 = jest.fn();
			nock('https://api.github.com')
				.persist()
				.get('/users/octocat')
				.reply(200, () => {
					fn1();
					return getApiFixture(path.resolve(__dirname, 'fixtures'), 'users.get');
				});

			const user = await helper.getUser(octokit, context);
			expect(fn1).toBeCalledTimes(1);
			expect(user.login).toBe('octocat');
			expect(user.email).toBe('octocat@github.com');
			expect(user.name).toBe('monalisa octocat');
			expect(user.id).toBe(1);
		});
	});
});
