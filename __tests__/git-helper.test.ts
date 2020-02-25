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

	const helper = new GitHelper(new Logger(), {token: 'token1'});

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
				'git clone \'--branch=test\' \'--depth=3\' \'https://octocat:token1@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
			]);
		});

		it('should run git clone PR', async() => {
			setExists(false);
			const mockExec = spyOnExec();

			await helper.clone(workDir, context({
				ref: 'refs/pull/123/merge',
			}));

			execCalledWith(mockExec, [
				'git clone \'--depth=3\' \'https://octocat:token1@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
				'git fetch \'https://octocat:token1@github.com/hello/world.git\' \'+refs/pull/123/merge\' > /dev/null 2>&1',
				'git checkout -qf FETCH_HEAD',
			]);
		});

		it('should run checkout', async() => {
			setExists(false);
			const mockExec = spyOnExec();

			await helper.clone(workDir, context({
				ref: 'refs/tags/v1.2.3',
				sha: '1234567890',
			}));

			execCalledWith(mockExec, [
				'git init \'.\'',
				'git remote add origin \'https://octocat:token1@github.com/hello/world.git\' > /dev/null 2>&1 || :',
				'git fetch --no-tags origin \'refs/tags/v1.2.3:refs/tags/v1.2.3\' || :',
				'git checkout -qf 1234567890',
			]);
		});
	});

	describe('checkout', () => {
		it('should run checkout branch', async() => {
			const mockExec = spyOnExec();

			await helper.checkout(workDir, context());

			execCalledWith(mockExec, [
				'git remote add origin \'https://octocat:token1@github.com/hello/world.git\' > /dev/null 2>&1 || :',
				'git fetch --no-tags origin \'refs/heads/test-ref:refs/remotes/origin/test-ref\' || :',
				'git checkout -qf test-sha',
			]);
		});

		it('should run checkout merge ref', async() => {
			const mockExec = spyOnExec();

			await helper.checkout(workDir, context({ref: 'refs/pull/123/merge'}));

			execCalledWith(mockExec, [
				'git remote add origin \'https://octocat:token1@github.com/hello/world.git\' > /dev/null 2>&1 || :',
				'git fetch --no-tags origin \'refs/pull/123/merge:refs/pull/123/merge\' || :',
				'git checkout -qf test-sha',
			]);
		});

		it('should run checkout tag', async() => {
			const mockExec = spyOnExec();

			await helper.checkout(workDir, context({ref: 'refs/tags/v1.2.3'}));

			execCalledWith(mockExec, [
				'git remote add origin \'https://octocat:token1@github.com/hello/world.git\' > /dev/null 2>&1 || :',
				'git fetch --no-tags origin \'refs/tags/v1.2.3:refs/tags/v1.2.3\' || :',
				'git checkout -qf test-sha',
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
				'git remote add origin \'https://octocat:token1@github.com/hello/world.git\' > /dev/null 2>&1 || :',
			]);
		});

		it('should run git init and git remote add', async() => {
			const mockExec = spyOnExec();
			setExists([false, true]);

			await helper.addOrigin(workDir, context());

			execCalledWith(mockExec, [
				`rm -rdf '${workDir}'`,
				'git init \'.\'',
				'git remote add origin \'https://octocat:token1@github.com/hello/world.git\' > /dev/null 2>&1 || :',
			]);
		});
	});

	describe('fetchOrigin', () => {
		it('should fetch origin', async() => {
			const mockExec = spyOnExec();

			await helper.fetchOrigin(workDir, context());

			execCalledWith(mockExec, [
				'git remote add origin \'https://octocat:token1@github.com/hello/world.git\' > /dev/null 2>&1 || :',
				'git fetch origin || :',
			]);
		});

		it('should fetch origin with options', async() => {
			const mockExec = spyOnExec();

			await helper.fetchOrigin(workDir, context(), ['--no-tags']);

			execCalledWith(mockExec, [
				'git remote add origin \'https://octocat:token1@github.com/hello/world.git\' > /dev/null 2>&1 || :',
				'git fetch --no-tags origin || :',
			]);
		});

		it('should fetch origin with refspec', async() => {
			const mockExec = spyOnExec();

			await helper.fetchOrigin(workDir, context(), undefined, ['+refs/pull/*/merge:refs/remotes/pull/*/merge', '+refs/heads/hoge:refs/remotes/origin/hoge']);

			execCalledWith(mockExec, [
				'git remote add origin \'https://octocat:token1@github.com/hello/world.git\' > /dev/null 2>&1 || :',
				'git fetch origin \'+refs/pull/*/merge:refs/remotes/pull/*/merge\' \'+refs/heads/hoge:refs/remotes/origin/hoge\' || :',
			]);
		});
	});

	describe('fetchBranch', () => {
		it('should run fetch', async() => {
			const mockExec = spyOnExec();

			await helper.fetchBranch(workDir, 'test-branch', context());

			execCalledWith(mockExec, [
				'git fetch --prune --no-recurse-submodules \'--depth=3\' \'https://octocat:token1@github.com/hello/world.git\' \'+refs/heads/test-branch:refs/remotes/origin/test-branch\' > /dev/null 2>&1 || :',
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

			const helper = new GitHelper(new ThrowErrorLogger(), {token: 'token'});
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
			expect(await helper.checkDiff(workDir)).toBe(true);
		});

		it('should return false', async() => {
			setChildProcessParams({stdout: '   file1\n\nB  file2\n'});
			expect(await helper.checkDiff(workDir)).toBe(false);
		});
	});

	describe('commit', () => {
		it('should do nothing', async() => {
			const mockExec = spyOnExec();

			expect(await helper.commit(workDir, 'test message')).toBe(false);

			execCalledWith(mockExec, [
				'git add --all',
				'git status --short -uno',
			]);
		});

		it('should run git commit', async() => {
			setChildProcessParams({stdout: 'M  file1\n\nM  file2\n'});
			const mockExec = spyOnExec();

			expect(await helper.commit(workDir, 'hello! how are you doing $USER "double" \'single\'')).toBe(true);

			execCalledWith(mockExec, [
				'git add --all',
				'git status --short -uno',
				'git commit -qm \'hello! how are you doing $USER "double" \'\\\'\'single\'\\\'',
				'git show \'--stat-count=10\' HEAD',
			]);
		});

		it('should run git commit with options', async() => {
			setChildProcessParams({stdout: 'M  file1\n\nM  file2\n'});
			const mockExec = spyOnExec();

			expect(await helper.commit(workDir, 'test', {
				count: 20,
				allowEmpty: true,
				args: ['--dry-run'],
			})).toBe(true);

			execCalledWith(mockExec, [
				'git add --all',
				'git commit --allow-empty --dry-run -qm test',
				'git show \'--stat-count=20\' HEAD',
			]);
		});
	});

	describe('fetchTags', () => {
		it('should run fetch tags 1', async() => {
			setChildProcessParams({stdout: 'v1.2.3\nv1.2.4\nv1.2.5\nv1.2.6'});
			const mockExec = spyOnExec();

			await helper.fetchTags(workDir, context());

			execCalledWith(mockExec, [
				'git tag',
				'git tag -d \'v1.2.3\' \'v1.2.4\' \'v1.2.5\' \'v1.2.6\' > /dev/null 2>&1',
				'git fetch \'https://octocat:token1@github.com/hello/world.git\' --tags > /dev/null 2>&1',
			]);
		});

		it('should run fetch tags 2', async() => {
			setChildProcessParams({stdout: 'v1.2.3\nv1.2.4\nv1.2.5\nv1.2.6'});
			const mockExec = spyOnExec();

			await helper.fetchTags(workDir, context(), 3);

			execCalledWith(mockExec, [
				'git tag',
				'git tag -d \'v1.2.3\' \'v1.2.4\' \'v1.2.5\' > /dev/null 2>&1',
				'git tag -d \'v1.2.6\' > /dev/null 2>&1',
				'git fetch \'https://octocat:token1@github.com/hello/world.git\' --tags > /dev/null 2>&1',
			]);
		});
	});

	describe('deleteTag', () => {
		it('should run delete tag', async() => {
			const mockExec = spyOnExec();

			await helper.deleteTag(workDir, 'delete-tag', context());

			execCalledWith(mockExec, [
				'git push \'https://octocat:token1@github.com/hello/world.git\' --delete tags/delete-tag > /dev/null 2>&1 || :',
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
				'git push \'https://octocat:token1@github.com/hello/world.git\' --delete tags/delete-tag1 tags/delete-tag2 > /dev/null 2>&1 || :',
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
				'git push \'https://octocat:token1@github.com/hello/world.git\' --delete tags/delete-tag1 tags/delete-tag2 tags/delete-tag3 > /dev/null 2>&1 || :',
				'git push \'https://octocat:token1@github.com/hello/world.git\' --delete tags/delete-tag4 refs/tags/delete-tag5 > /dev/null 2>&1 || :',
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
				'git push \'https://octocat:token1@github.com/hello/world.git\' --delete tags/new-tag > /dev/null 2>&1 || :',
				'git tag -d new-tag || :',
				'git tag new-tag from-tag',
				'git push \'https://octocat:token1@github.com/hello/world.git\' refs/tags/new-tag > /dev/null 2>&1',
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

			await helper.push(workDir, 'test-branch', context(), {withTag: true, args: ['--prune', '--verbose']});

			execCalledWith(mockExec, [
				'git push --tags --prune --verbose \'https://octocat:token1@github.com/hello/world.git\' \'test-branch:refs/heads/test-branch\' > /dev/null 2>&1 || :',
			]);
		});

		it('should run push without tags', async() => {
			const mockExec = spyOnExec();

			await helper.push(workDir, 'test-branch', context());

			execCalledWith(mockExec, [
				'git push \'https://octocat:token1@github.com/hello/world.git\' \'test-branch:refs/heads/test-branch\' > /dev/null 2>&1 || :',
			]);
		});
	});

	describe('forcePush', () => {
		it('should run force push', async() => {
			const mockExec = spyOnExec();

			await helper.forcePush(workDir, 'test-branch', context());

			execCalledWith(mockExec, [
				'git push --force \'https://octocat:token1@github.com/hello/world.git\' \'test-branch:refs/heads/test-branch\' > /dev/null 2>&1 || :',
			]);
		});
	});

	describe('getLastTag', () => {
		it('should get last tag 1', async() => {
			setChildProcessParams({stdout: 'v1.2.3\ntest\nv1.2.5\ndevelop\n1.2.4\nmaster'});
			const mockExec = spyOnExec();

			expect(await helper.getLastTag(workDir)).toBe('v1.2.5');

			execCalledWith(mockExec, [
				'git tag',
			]);
		});

		it('should get last tag 2', async() => {
			setChildProcessParams({stdout: 'v1\nv1.2.3\n1.2'});
			const mockExec = spyOnExec();

			expect(await helper.getLastTag(workDir)).toBe('v1.2.3');

			execCalledWith(mockExec, [
				'git tag',
			]);
		});

		it('should get last tag 3', async() => {
			setChildProcessParams({stdout: 'v1\n1.0.0\n1.0'});
			const mockExec = spyOnExec();

			expect(await helper.getLastTag(workDir)).toBe('v1.0.0');

			execCalledWith(mockExec, [
				'git tag',
			]);
		});

		it('should get last tag 4', async() => {
			setChildProcessParams({stdout: 'v1.0.9\nv1.0.11\nv1.0.10.1'});
			const mockExec = spyOnExec();

			expect(await helper.getLastTag(workDir)).toBe('v1.0.11');

			execCalledWith(mockExec, [
				'git tag',
			]);
		});

		it('should get initial tag', async() => {
			setChildProcessParams({stdout: ''});
			const mockExec = spyOnExec();

			expect(await helper.getLastTag(workDir)).toBe('v0.0.0');

			execCalledWith(mockExec, [
				'git tag',
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
				'git tag',
			]);
		});
	});

	describe('getNewMinorVersion', () => {
		it('should get new patch tag', async() => {
			setChildProcessParams({stdout: '1.2.3'});
			const mockExec = spyOnExec();

			expect(await helper.getNewMinorVersion(workDir)).toBe('v1.3.0');

			execCalledWith(mockExec, [
				'git tag',
			]);
		});
	});

	describe('getNewMajorVersion', () => {
		it('should get new patch tag', async() => {
			setChildProcessParams({stdout: '1.2.3'});
			const mockExec = spyOnExec();

			expect(await helper.getNewMajorVersion(workDir)).toBe('v2.0.0');

			execCalledWith(mockExec, [
				'git tag',
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
			await helper.switchBranch(workDir, 'abc');
			helper.useOrigin(true);
			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));
			await helper.switchBranch(workDir, 'abc');
			helper.useOrigin('test');
			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));
			await helper.switchBranch(workDir, 'abc');
			helper.useOrigin(true, false);
			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));
			await helper.switchBranch(workDir, 'abc');
			helper.useOrigin(false);
			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));
			await helper.switchBranch(workDir, 'abc');

			execCalledWith(mockExec, [
				'git clone \'--branch=test\' \'--depth=3\' \'https://octocat:token1@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
				'git checkout -b abc origin/abc || :',
				'git clone \'--branch=test\' \'--depth=3\' origin \'.\' > /dev/null 2>&1 || :',
				'git checkout -b abc origin/abc || :',
				'git clone \'--branch=test\' \'--depth=3\' test \'.\' > /dev/null 2>&1 || :',
				'git checkout -b abc test/abc || :',
				'git clone \'--branch=test\' \'--depth=3\' origin \'.\' || :',
				'git checkout -b abc origin/abc || :',
				'git clone \'--branch=test\' \'--depth=3\' \'https://octocat:token1@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
				'git checkout -b abc origin/abc || :',
			]);
		});
	});
});

describe('GitHelper with params 1', () => {
	testEnv();
	testChildProcess();

	const helper = new GitHelper(new Logger(), {depth: 1, filter: (line: string): boolean => line.endsWith('.md'), token: 'token2'});

	describe('clone', () => {
		it('should run git clone', async() => {
			setExists(false);
			const mockExec = spyOnExec();

			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));

			execCalledWith(mockExec, [
				'git clone \'--branch=test\' \'--depth=1\' \'https://octocat:token2@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
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

	describe('clone', () => {
		it('should run git clone', async() => {
			process.env.INPUT_GITHUB_TOKEN = 'token3';
			const helper                   = new GitHelper(new Logger(), {depth: -1});
			setExists(false);
			const mockExec = spyOnExec();

			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));

			execCalledWith(mockExec, [
				'git clone \'--branch=test\' \'https://octocat:token3@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
			]);
		});
	});
});

describe('GitHelper without params', () => {
	testEnv();
	testChildProcess();

	describe('clone', () => {
		it('should run git clone', async() => {
			process.env.INPUT_GITHUB_TOKEN = 'token4';
			const helper                   = new GitHelper(new Logger());
			setExists(false);
			const mockExec = spyOnExec();

			await helper.clone(workDir, context({
				ref: 'refs/heads/test',
			}));

			execCalledWith(mockExec, [
				'git clone \'--branch=test\' \'--depth=3\' \'https://octocat:token4@github.com/hello/world.git\' \'.\' > /dev/null 2>&1 || :',
			]);
		});
	});
});
