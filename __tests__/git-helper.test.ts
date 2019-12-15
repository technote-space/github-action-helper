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
			setChildProcessParams({stdout: '  master\n* test-branch\n  develop'});
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
				'git clone \'--branch=test\' \'--depth=3\' \'https://octocat:token@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
			]);
		});

		it('should run git checkout', async() => {
			setExists(false);
			const mockExec = spyOnExec();

			expect(await helper.clone(workDir, context({
				ref: 'refs/pull/123/merge',
			})));

			execCalledWith(mockExec, [
				'git clone \'--depth=3\' \'https://octocat:token@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
				'git fetch \'https://octocat:token@github.com/hello/world.git\' \'+refs/pull/123/merge\' > /dev/null 2>&1',
				'git checkout -qf FETCH_HEAD',
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
				'git clone \'--depth=3\' \'https://octocat:token@github.com/hello/world.git\' \'.\' > /dev/null 2>&1',
				'git fetch \'https://octocat:token@github.com/hello/world.git\' refs/heads/test-ref > /dev/null 2>&1',
				'git checkout -qf test-sha',
			]);
		});

		it('should run checkout 2', async() => {
			const mockExec = spyOnExec();

			await helper.checkout(workDir, context({sha: ''}));

			execCalledWith(mockExec, [
				'git clone \'https://octocat:token@github.com/hello/world.git\' \'.\' > /dev/null 2>&1',
				'git checkout -qf test-ref',
			]);
		});

		it('should run checkout 3', async() => {
			const mockExec = spyOnExec();

			await helper.checkout(workDir, context({sha: '', ref: 'refs/tags/test-tag'}));

			execCalledWith(mockExec, [
				'git clone \'https://octocat:token@github.com/hello/world.git\' \'.\' > /dev/null 2>&1',
				'git checkout -qf refs/tags/test-tag',
			]);
		});
	});

	describe('gitInit', () => {
		it('should run git init', async() => {
			const mockExec = spyOnExec();

			await helper.gitInit(workDir, 'test-branch');

			execCalledWith(mockExec, [
				`rm -rdf '${workDir}'`,
				'git init \'.\'',
				'git checkout --orphan test-branch',
			]);
		});

		it('should run git init without rm dir', async() => {
			const mockExec = spyOnExec();
			setExists(false);

			await helper.gitInit(workDir, 'test-branch');

			execCalledWith(mockExec, [
				'git init \'.\'',
				'git checkout --orphan test-branch',
			]);
		});
	});

	describe('addOrigin', () => {
		it('should run git remote add', async() => {
			const mockExec = spyOnExec();

			await helper.addOrigin(workDir, context());

			execCalledWith(mockExec, [
				`rm -rdf '${workDir}'`,
				'git init \'.\'',
				'git remote add origin \'https://octocat:token@github.com/hello/world.git\' > /dev/null 2>&1 || :',
			]);
		});
	});

	describe('fetchOrigin', () => {
		it('should fetch origin', async() => {
			const mockExec = spyOnExec();

			await helper.fetchOrigin(workDir, context());

			execCalledWith(mockExec, [
				`rm -rdf '${workDir}'`,
				'git init \'.\'',
				'git remote add origin \'https://octocat:token@github.com/hello/world.git\' > /dev/null 2>&1 || :',
				'git fetch origin',
			]);
		});

		it('should fetch origin with options', async() => {
			const mockExec = spyOnExec();

			await helper.fetchOrigin(workDir, context(), ['--no-tags']);

			execCalledWith(mockExec, [
				`rm -rdf '${workDir}'`,
				'git init \'.\'',
				'git remote add origin \'https://octocat:token@github.com/hello/world.git\' > /dev/null 2>&1 || :',
				'git fetch --no-tags origin',
			]);
		});

		it('should fetch origin with refspec', async() => {
			const mockExec = spyOnExec();

			await helper.fetchOrigin(workDir, context(), undefined, ['+refs/pull/*/merge:refs/remotes/pull/*/merge', '+refs/heads/hoge:refs/remotes/origin/hoge']);

			execCalledWith(mockExec, [
				`rm -rdf '${workDir}'`,
				'git init \'.\'',
				'git remote add origin \'https://octocat:token@github.com/hello/world.git\' > /dev/null 2>&1 || :',
				'git fetch origin \'+refs/pull/*/merge:refs/remotes/pull/*/merge\' \'+refs/heads/hoge:refs/remotes/origin/hoge\'',
			]);
		});
	});

	describe('fetchBranch', () => {
		it('should run fetch', async() => {
			const mockExec = spyOnExec();

			await helper.fetchBranch(workDir, 'test-branch', context());

			execCalledWith(mockExec, [
				'git fetch --prune --no-recurse-submodules \'--depth=3\' \'https://octocat:token@github.com/hello/world.git\' \'+refs/heads/test-branch:refs/remotes/origin/test-branch\' > /dev/null 2>&1 || :',
			]);
		});
	});

	describe('createBranch', () => {
		it('should run git checkout', async() => {
			const mockExec = spyOnExec();

			await helper.createBranch(workDir, 'test-branch');

			execCalledWith(mockExec, [
				'git checkout -b test-branch',
			]);
		});
	});

	describe('switchBranch', () => {
		it('should run git checkout', async() => {
			const mockExec = spyOnExec();

			await helper.switchBranch(workDir, 'test-branch');

			execCalledWith(mockExec, [
				'git checkout -b test-branch origin/test-branch || :',
			]);
		});
	});

	describe('config', () => {
		it('should run git config', async() => {
			const mockExec = spyOnExec();

			await helper.config(workDir, 'test-name', 'test-email');

			execCalledWith(mockExec, [
				'git config \'user.name\' test-name',
				'git config \'user.email\' test-email',
			]);
		});
	});

	describe('runCommand', () => {
		it('should run command', async() => {
			const mockExec = spyOnExec();

			await helper.runCommand(workDir, [
				'command1',
				'command2',
				{command: 'command3'},
			]);

			execCalledWith(mockExec, [
				['command1', {cwd: workDir}],
				['command2', {cwd: workDir}],
				['command3', {cwd: workDir}],
			]);
		});

		it('should return stdout', async() => {
			const mockExec = spyOnExec();
			setChildProcessParams({stdout: 'test1\ntest2'});

			expect(await helper.runCommand(workDir, [
				'command1',
				'command2',
				{command: 'command3', quiet: true},
			])).toEqual([
				{
					command: 'command1',
					stdout: [
						'test1',
						'test2',
					],
					stderr: [],
				},
				{
					command: 'command2',
					stdout: [
						'test1',
						'test2',
					],
					stderr: [],
				},
				{
					command: 'command3',
					stdout: [
						'test1',
						'test2',
					],
					stderr: [],
				},
			]);

			execCalledWith(mockExec, [
				['command1', {cwd: workDir}],
				['command2', {cwd: workDir}],
				['command3 > /dev/null 2>&1', {cwd: workDir}],
			]);
		});

		it('should throw error', async() => {
			/**
			 * Logger
			 */
			class ThrowErrorLogger extends Logger {
				/**
				 * @return {void}
				 */
				public displayStdout = (): void => {
					throw new Error('test');
				};
			}

			const helper = new GitHelper(new ThrowErrorLogger());
			await expect(helper.runCommand(workDir, [
				'command1',
				'command2',
				{command: 'command3'},
			])).rejects.toThrow();
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
			const mockExec = spyOnExec();
			setChildProcessParams({stdout: 'file1\nfile2\nfile3\n'});

			expect(await helper.getRefDiff(workDir, 'master', 'refs/pull/123/merge')).toEqual([
				'file1',
				'file2',
				'file3',
			]);
			execCalledWith(mockExec, [
				'git diff \'origin/master...pull/123/merge\' --name-only',
			]);
		});

		it('should get diff with diffFilter', async() => {
			const mockExec = spyOnExec();
			setChildProcessParams({stdout: 'file1\nfile2\nfile3\n'});

			expect(await helper.getRefDiff(workDir, 'master', 'refs/pull/123/merge', 'AM')).toEqual([
				'file1',
				'file2',
				'file3',
			]);

			execCalledWith(mockExec, [
				'git diff \'origin/master...pull/123/merge\' --name-only \'--diff-filter=AM\'',
			]);
		});

		it('should get diff with 2 dots', async() => {
			const mockExec = spyOnExec();
			setChildProcessParams({stdout: 'file1\nfile2\nfile3\n'});

			expect(await helper.getRefDiff(workDir, 'master', 'refs/pull/123/merge', undefined, '..')).toEqual([
				'file1',
				'file2',
				'file3',
			]);

			execCalledWith(mockExec, [
				'git diff \'origin/master..pull/123/merge\' --name-only',
			]);
		});

		it('should get HEAD diff', async() => {
			const mockExec = spyOnExec();
			setChildProcessParams({stdout: 'file1\nfile2\nfile3\n'});

			expect(await helper.getRefDiff(workDir, 'HEAD', 'refs/pull/123/merge')).toEqual([
				'file1',
				'file2',
				'file3',
			]);

			execCalledWith(mockExec, [
				'git diff \'HEAD...pull/123/merge\' --name-only',
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
				'git add --all',
				'git status --short -uno',
			]);
		});

		it('should run git commit', async() => {
			setChildProcessParams({stdout: 'M  file1\n\nM  file2\n'});
			const mockExec = spyOnExec();

			expect(await helper.commit(workDir, 'hello! how are you doing $USER "double" \'single\'')).toBeTruthy();

			execCalledWith(mockExec, [
				'git add --all',
				'git status --short -uno',
				'git commit -qm \'hello! how are you doing $USER "double" \'\\\'\'single\'\\\'',
				'git show \'--stat-count=10\' HEAD',
			]);
		});
	});

	describe('fetchTags', () => {
		it('should run fetch tags 1', async() => {
			setChildProcessParams({stdout: 'v1.2.3\nv1.2.4\nv1.2.5\nv1.2.6'});
			const mockExec = spyOnExec();

			await helper.fetchTags(workDir, context());

			execCalledWith(mockExec, [
				'git tag -l',
				'git tag -d \'v1.2.3\' \'v1.2.4\' \'v1.2.5\' \'v1.2.6\' || :',
				'git fetch \'https://octocat:token@github.com/hello/world.git\' --tags > /dev/null 2>&1',
			]);
		});

		it('should run fetch tags 2', async() => {
			setChildProcessParams({stdout: 'v1.2.3\nv1.2.4\nv1.2.5\nv1.2.6'});
			const mockExec = spyOnExec();

			await helper.fetchTags(workDir, context(), 3);

			execCalledWith(mockExec, [
				'git tag -l',
				'git tag -d \'v1.2.3\' \'v1.2.4\' \'v1.2.5\' || :',
				'git tag -d \'v1.2.6\' || :',
				'git fetch \'https://octocat:token@github.com/hello/world.git\' --tags > /dev/null 2>&1',
			]);
		});
	});

	describe('deleteTag', () => {
		it('should run delete tag', async() => {
			const mockExec = spyOnExec();

			await helper.deleteTag(workDir, 'delete-tag', context());

			execCalledWith(mockExec, [
				'git push \'https://octocat:token@github.com/hello/world.git\' --delete tags/delete-tag > /dev/null 2>&1 || :',
				'git tag -d delete-tag || :',
			]);
		});

		it('should run delete tags', async() => {
			const mockExec = spyOnExec();

			await helper.deleteTag(workDir, [
				'delete-tag1',
				'delete-tag2',
			], context());

			execCalledWith(mockExec, [
				'git push \'https://octocat:token@github.com/hello/world.git\' --delete tags/delete-tag1 tags/delete-tag2 > /dev/null 2>&1 || :',
				'git tag -d delete-tag1 delete-tag2 || :',
			]);
		});

		it('should chunk delete tags', async() => {
			const mockExec = spyOnExec();

			await helper.deleteTag(workDir, [
				'delete-tag1',
				'delete-tag2',
				'delete-tag3',
				'tags/delete-tag4',
				'refs/tags/delete-tag5',
			], context(), 3);

			execCalledWith(mockExec, [
				'git push \'https://octocat:token@github.com/hello/world.git\' --delete tags/delete-tag1 tags/delete-tag2 tags/delete-tag3 > /dev/null 2>&1 || :',
				'git push \'https://octocat:token@github.com/hello/world.git\' --delete tags/delete-tag4 refs/tags/delete-tag5 > /dev/null 2>&1 || :',
				'git tag -d delete-tag1 delete-tag2 delete-tag3 || :',
				'git tag -d delete-tag4 delete-tag5 || :',
			]);
		});
	});

	describe('copyTag', () => {
		it('should run copy tag', async() => {
			const mockExec = spyOnExec();

			await helper.copyTag(workDir, 'new-tag', 'from-tag', context());

			execCalledWith(mockExec, [
				'git push \'https://octocat:token@github.com/hello/world.git\' --delete tags/new-tag > /dev/null 2>&1 || :',
				'git tag -d new-tag || :',
				'git tag new-tag from-tag',
				'git push \'https://octocat:token@github.com/hello/world.git\' refs/tags/new-tag > /dev/null 2>&1',
			]);
		});
	});

	describe('addLocalTag', () => {
		it('should run add tag', async() => {
			const mockExec = spyOnExec();

			await helper.addLocalTag(workDir, 'add-tag');

			execCalledWith(mockExec, [
				'git tag add-tag',
			]);
		});

		it('should run add tags', async() => {
			const mockExec = spyOnExec();

			await helper.addLocalTag(workDir, ['add-tag1', 'add-tag2']);

			execCalledWith(mockExec, [
				'git tag add-tag1',
				'git tag add-tag2',
			]);
		});
	});

	describe('push', () => {
		it('should run push', async() => {
			const mockExec = spyOnExec();

			await helper.push(workDir, 'test-branch', true, context());

			execCalledWith(mockExec, [
				'git push --tags \'https://octocat:token@github.com/hello/world.git\' \'test-branch:refs/heads/test-branch\' > /dev/null 2>&1',
			]);
		});

		it('should run push without tags', async() => {
			const mockExec = spyOnExec();

			await helper.push(workDir, 'test-branch', false, context());

			execCalledWith(mockExec, [
				'git push \'https://octocat:token@github.com/hello/world.git\' \'test-branch:refs/heads/test-branch\' > /dev/null 2>&1',
			]);
		});
	});

	describe('forcePush', () => {
		it('should run force push', async() => {
			const mockExec = spyOnExec();

			await helper.forcePush(workDir, 'test-branch', context());

			execCalledWith(mockExec, [
				'git push --force \'https://octocat:token@github.com/hello/world.git\' \'test-branch:refs/heads/test-branch\' > /dev/null 2>&1',
			]);
		});
	});

	describe('getLastTag', () => {
		it('should get last tag 1', async() => {
			setChildProcessParams({stdout: 'v1.2.3\ntest\nv1.2.5\ndevelop\n1.2.4\nmaster'});
			const mockExec = spyOnExec();

			expect(await helper.getLastTag(workDir)).toBe('v1.2.5');

			execCalledWith(mockExec, [
				'git tag -l',
			]);
		});

		it('should get last tag 2', async() => {
			setChildProcessParams({stdout: 'v1\nv1.2.3\n1.2'});
			const mockExec = spyOnExec();

			expect(await helper.getLastTag(workDir)).toBe('v1.2.3');

			execCalledWith(mockExec, [
				'git tag -l',
			]);
		});

		it('should get last tag 3', async() => {
			setChildProcessParams({stdout: 'v1\n1.0.0\n1.0'});
			const mockExec = spyOnExec();

			expect(await helper.getLastTag(workDir)).toBe('v1.0.0');

			execCalledWith(mockExec, [
				'git tag -l',
			]);
		});

		it('should get last tag 4', async() => {
			setChildProcessParams({stdout: 'v1.0.9\nv1.0.11\nv1.0.10.1'});
			const mockExec = spyOnExec();

			expect(await helper.getLastTag(workDir)).toBe('v1.0.11');

			execCalledWith(mockExec, [
				'git tag -l',
			]);
		});

		it('should get initial tag', async() => {
			setChildProcessParams({stdout: ''});
			const mockExec = spyOnExec();

			expect(await helper.getLastTag(workDir)).toBe('v0.0.0');

			execCalledWith(mockExec, [
				'git tag -l',
			]);
		});

		it('should throw error', async() => {
			setExists(false);

			await expect(helper.getLastTag(workDir)).rejects.toThrow('Not a git repository');
		});
	});

	describe('getNewPatchVersion', () => {
		it('should get new patch tag', async() => {
			setChildProcessParams({stdout: '1.2.3'});
			const mockExec = spyOnExec();

			expect(await helper.getNewPatchVersion(workDir)).toBe('v1.2.4');

			execCalledWith(mockExec, [
				'git tag -l',
			]);
		});
	});

	describe('useOrigin', () => {
		it('should use origin', async() => {
			setExists(false);
			const mockExec = spyOnExec();

			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));
			helper.useOrigin(true);
			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));
			helper.useOrigin('test');
			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));
			helper.useOrigin(true, false);
			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));
			helper.useOrigin(false);
			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));

			execCalledWith(mockExec, [
				'git clone \'--branch=test\' \'--depth=3\' \'https://octocat:token@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
				'git clone \'--branch=test\' \'--depth=3\' origin \'.\' > /dev/null 2>&1 || :',
				'git clone \'--branch=test\' \'--depth=3\' test \'.\' > /dev/null 2>&1 || :',
				'git clone \'--branch=test\' \'--depth=3\' origin \'.\' || :',
				'git clone \'--branch=test\' \'--depth=3\' \'https://octocat:token@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
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
				'git clone \'--branch=test\' \'--depth=1\' \'https://octocat:token@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
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
				'git clone \'--branch=test\' \'https://octocat:token@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
			]);
		});
	});
});
