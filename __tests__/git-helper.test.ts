/* eslint-disable no-magic-numbers */
import { Context } from '@actions/github/lib/context';
import {
	testEnv,
	getContext,
	testFs,
	setChildProcessParams,
	testChildProcess,
	spyOnExec,
	execCalledWith,
} from '@technote-space/github-action-test-helper';
import { GitHelper, Logger } from '../src';

const workDir   = '.work';
const setExists = testFs(true);
const context   = (override: object = {}): Context => getContext(Object.assign({
	repo: {
		owner: 'hello',
		repo: 'world',
	},
	ref: 'refs/heads/test-ref',
	sha: 'test-sha',
}, override));

describe('GitHelper', () => {
	testEnv();
	testChildProcess();
	beforeEach(() => {
		process.env.INPUT_GITHUB_TOKEN = 'token';
	});

	const helper = new GitHelper(new Logger());

	describe('getCurrentBranchName', () => {
		it('should return empty 1', async() => {
			setExists(false);
			expect(await helper.getCurrentBranchName(workDir)).toBe('');
		});

		it('should return empty 2', async() => {
			setChildProcessParams({stdout: ''});
			expect(await helper.getCurrentBranchName(workDir)).toBe('');
		});

		it('should get current branch name', async() => {
			setChildProcessParams({stdout: 'test-branch'});
			expect(await helper.getCurrentBranchName(workDir)).toBe('test-branch');
		});
	});

	describe('clone', () => {
		it('should do nothing', async() => {
			setExists(true);
			const mockExec = spyOnExec();

			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));

			execCalledWith(mockExec, []);
		});

		it('should run git clone', async() => {
			setExists(false);
			const mockExec = spyOnExec();

			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));

			execCalledWith(mockExec, [
				`git -C ${workDir} clone --branch=test --depth=3 https://octocat:token@github.com/hello/world.git . > /dev/null 2>&1 || :`,
			]);
		});

		it('should run git checkout', async() => {
			setExists(false);
			const mockExec = spyOnExec();

			expect(await helper.clone(workDir, context({
				ref: 'refs/pull/123/merge',
			})));

			execCalledWith(mockExec, [
				`git -C ${workDir} clone --depth=3 https://octocat:token@github.com/hello/world.git . > /dev/null 2>&1 || :`,
				`git -C ${workDir} fetch origin +refs/pull/123/merge`,
				`git -C ${workDir} checkout -qf FETCH_HEAD`,
			]);
		});

		it('should throw error', async() => {
			setExists(false);

			await expect(helper.clone(workDir, context({
				ref: '',
				sha: '',
			}))).rejects.toThrow('Invalid context.');
		});
	});

	describe('checkout', () => {
		it('should run checkout 1', async() => {
			const mockExec = spyOnExec();

			await helper.checkout(workDir, context());

			execCalledWith(mockExec, [
				`git -C ${workDir} clone --depth=3 https://octocat:token@github.com/hello/world.git . > /dev/null 2>&1`,
				`git -C ${workDir} fetch https://octocat:token@github.com/hello/world.git refs/heads/test-ref > /dev/null 2>&1`,
				`git -C ${workDir} checkout -qf test-sha`,
			]);
		});

		it('should run checkout 2', async() => {
			const mockExec = spyOnExec();

			await helper.checkout(workDir, context({sha: ''}));

			execCalledWith(mockExec, [
				`git -C ${workDir} clone https://octocat:token@github.com/hello/world.git . > /dev/null 2>&1`,
				`git -C ${workDir} checkout -qf test-ref`,
			]);
		});

		it('should run checkout 3', async() => {
			const mockExec = spyOnExec();

			await helper.checkout(workDir, context({sha: '', ref: 'refs/tags/test-tag'}));

			execCalledWith(mockExec, [
				`git -C ${workDir} clone https://octocat:token@github.com/hello/world.git . > /dev/null 2>&1`,
				`git -C ${workDir} checkout -qf refs/tags/test-tag`,
			]);
		});
	});

	describe('gitInit', () => {
		it('should run git init', async() => {
			const mockExec = spyOnExec();

			await helper.gitInit(workDir, 'test-branch');

			execCalledWith(mockExec, [
				`rm -rdf ${workDir}`,
				`git -C ${workDir} init .`,
				`git -C ${workDir} checkout --orphan "test-branch"`,
			]);
		});
	});

	describe('createBranch', () => {
		it('should run git branch', async() => {
			const mockExec = spyOnExec();

			await helper.createBranch(workDir, 'test-branch');

			execCalledWith(mockExec, [
				`git -C ${workDir} checkout -b "test-branch"`,
			]);
		});
	});

	describe('config', () => {
		it('should run git config', async() => {
			const mockExec = spyOnExec();

			await helper.config(workDir, 'test-name', 'test-email');

			execCalledWith(mockExec, [
				`git -C ${workDir} config user.name "test-name"`,
				`git -C ${workDir} config user.email "test-email"`,
			]);
		});
	});

	describe('runCommand', () => {
		it('should run command', async() => {
			const mockExec = spyOnExec();

			await helper.runCommand(workDir, [
				'command1',
				'command2',
			]);

			execCalledWith(mockExec, [
				['command1', {cwd: workDir}],
				['command2', {cwd: workDir}],
			]);
		});

		it('should return stdout', async() => {
			const mockExec = spyOnExec();
			setChildProcessParams({stdout: 'test1\ntest2'});

			expect(await helper.runCommand(workDir, [
				'command1',
				'command2',
			])).toEqual([
				{
					command: 'command1',
					stdout: [
						'test1',
						'test2',
					],
				},
				{
					command: 'command2',
					stdout: [
						'test1',
						'test2',
					],
				},
			]);

			execCalledWith(mockExec, [
				['command1', {cwd: workDir}],
				['command2', {cwd: workDir}],
			]);
		});
	});

	describe('getDiff', () => {
		it('should get diff', async() => {
			setChildProcessParams({stdout: 'M  file1\nA  file2\nD  file3\n   file4\n\nB  file5\n'});
			expect(await helper.getDiff(workDir)).toEqual([
				'file1',
				'file2',
				'file3',
			]);
		});
	});

	describe('getRefDiff', () => {
		it('should get diff', async() => {
			setChildProcessParams({stdout: 'file1\nfile2\nfile3\n'});
			expect(await helper.getRefDiff(workDir, 'master', 'refs/pull/123/merge')).toEqual([
				'file1',
				'file2',
				'file3',
			]);
		});
	});

	describe('checkDiff', () => {
		it('should return true', async() => {
			setChildProcessParams({stdout: 'M  file1\nA  file2\nD  file3\n   file4\n\nB  file5\n'});
			expect(await helper.checkDiff(workDir)).toBeTruthy();
		});

		it('should return false', async() => {
			setChildProcessParams({stdout: '   file1\n\nB  file2\n'});
			expect(await helper.checkDiff(workDir)).toBeFalsy();
		});
	});

	describe('commit', () => {
		it('should do nothing', async() => {
			const mockExec = spyOnExec();

			expect(await helper.commit(workDir, 'test message')).toBeFalsy();

			execCalledWith(mockExec, [
				`git -C ${workDir} add --all`,
				`git -C ${workDir} status --short -uno`,
			]);
		});

		it('should run git commit', async() => {
			setChildProcessParams({stdout: 'M  file1\n\nM  file2\n'});
			const mockExec = spyOnExec();

			expect(await helper.commit(workDir, 'test message')).toBeTruthy();

			execCalledWith(mockExec, [
				`git -C ${workDir} add --all`,
				`git -C ${workDir} status --short -uno`,
				`git -C ${workDir} commit -qm "test message"`,
				`git -C ${workDir} show --stat-count=10 HEAD`,
			]);
		});
	});

	describe('fetchTags', () => {
		it('should run fetch tags', async() => {
			const mockExec = spyOnExec();

			await helper.fetchTags(workDir, context());

			execCalledWith(mockExec, [
				`git -C ${workDir} tag -l | xargs git -C ${workDir} tag -d`,
				`git -C ${workDir} fetch "https://octocat:token@github.com/hello/world.git" --tags > /dev/null 2>&1`,
			]);
		});
	});

	describe('deleteTag', () => {
		it('should run delete tag', async() => {
			const mockExec = spyOnExec();

			await helper.deleteTag(workDir, 'delete-tag', context());

			execCalledWith(mockExec, [
				`git -C ${workDir} push --delete "https://octocat:token@github.com/hello/world.git" tag delete-tag > /dev/null 2>&1 || :`,
			]);
		});

		it('should run delete tags', async() => {
			const mockExec = spyOnExec();

			await helper.deleteTag(workDir, [
				'delete-tag1',
				'delete-tag2',
			], context());

			execCalledWith(mockExec, [
				`git -C ${workDir} push --delete "https://octocat:token@github.com/hello/world.git" tag delete-tag1 > /dev/null 2>&1 || :`,
				`git -C ${workDir} push --delete "https://octocat:token@github.com/hello/world.git" tag delete-tag2 > /dev/null 2>&1 || :`,
			]);
		});
	});

	describe('copyTag', () => {
		it('should run copy tag', async() => {
			const mockExec = spyOnExec();

			await helper.copyTag(workDir, 'new-tag', 'from-tag', context());

			execCalledWith(mockExec, [
				`git -C ${workDir} push --delete "https://octocat:token@github.com/hello/world.git" tag new-tag > /dev/null 2>&1 || :`,
				`git -C ${workDir} tag new-tag from-tag`,
				`git -C ${workDir} push "https://octocat:token@github.com/hello/world.git" "refs/tags/new-tag" > /dev/null 2>&1`,
			]);
		});
	});

	describe('addLocalTag', () => {
		it('should run add tag', async() => {
			const mockExec = spyOnExec();

			await helper.addLocalTag(workDir, 'add-tag');

			execCalledWith(mockExec, [
				`git -C ${workDir} tag add-tag`,
			]);
		});

		it('should run add tags', async() => {
			const mockExec = spyOnExec();

			await helper.addLocalTag(workDir, ['add-tag1', 'add-tag2']);

			execCalledWith(mockExec, [
				`git -C ${workDir} tag add-tag1`,
				`git -C ${workDir} tag add-tag2`,
			]);
		});
	});

	describe('push', () => {
		it('should run push', async() => {
			const mockExec = spyOnExec();

			await helper.push(workDir, 'test-branch', true, context());

			execCalledWith(mockExec, [
				`git -C ${workDir} push --tags "https://octocat:token@github.com/hello/world.git" "test-branch":"refs/heads/test-branch" > /dev/null 2>&1`,
			]);
		});

		it('should run push without tags', async() => {
			const mockExec = spyOnExec();

			await helper.push(workDir, 'test-branch', false, context());

			execCalledWith(mockExec, [
				`git -C ${workDir} push "https://octocat:token@github.com/hello/world.git" "test-branch":"refs/heads/test-branch" > /dev/null 2>&1`,
			]);
		});
	});
});

describe('GitHelper with params 1', () => {
	testEnv();
	testChildProcess();
	beforeEach(() => {
		process.env.INPUT_GITHUB_TOKEN = 'token';
	});

	const helper = new GitHelper(new Logger(), {depth: 1, filter: (line: string): boolean => line.endsWith('.md')});

	describe('clone', () => {
		it('should run git clone', async() => {
			setExists(false);
			const mockExec = spyOnExec();

			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));

			execCalledWith(mockExec, [
				`git -C ${workDir} clone --branch=test --depth=1 https://octocat:token@github.com/hello/world.git . > /dev/null 2>&1 || :`,
			]);
		});
	});

	describe('getDiff', () => {
		it('should get diff', async() => {
			setChildProcessParams({stdout: 'M  file1\nA  file2.md\nD  file3\n   file4\n\nB  file5\n'});
			expect(await helper.getDiff(workDir)).toEqual([
				'file2.md',
			]);
		});
	});
});

describe('GitHelper with params 2', () => {
	testEnv();
	testChildProcess();
	beforeEach(() => {
		process.env.INPUT_GITHUB_TOKEN = 'token';
	});

	const helper = new GitHelper(new Logger(), {depth: -1});

	describe('clone', () => {
		it('should run git clone', async() => {
			setExists(false);
			const mockExec = spyOnExec();

			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));

			execCalledWith(mockExec, [
				`git -C ${workDir} clone --branch=test https://octocat:token@github.com/hello/world.git . > /dev/null 2>&1 || :`,
			]);
		});
	});
});
