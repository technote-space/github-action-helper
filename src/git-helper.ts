import fs from 'fs';
import { Context } from '@actions/github/lib/context';
import { Command, Logger } from './index';
import { getBranch, isBranch, isPrRef, isCloned, split, generateNewPatchVersion, arrayChunk, versionCompare } from './utils';
import { getGitUrl } from './context-helper';

type CommandType = string | {
	command: string;
	args?: string[];
	quiet?: boolean;
	altCommand?: string;
	suppressError?: boolean;
	suppressOutput?: boolean;
	stderrToStdout?: boolean;
};

/**
 * Git Helper
 */
export default class GitHelper {

	private readonly command: Command;
	private readonly cloneDepth: string;
	private readonly filter: (string) => boolean;
	private origin?: string  = undefined;
	private quietIfNotOrigin = true;

	/**
	 * @param {Logger} logger logger
	 * @param {object} options options
	 * @param {number|undefined} options.depth depth
	 * @param {function|undefined} options.filter filter
	 */
	constructor(private readonly logger: Logger, options?: { depth?: number; filter?: (string: string) => boolean }) {
		this.command = new Command(logger);
		if (options && options.depth) {
			this.cloneDepth = options.depth > 0 ? `--depth=${options.depth}` : ''; // eslint-disable-line no-magic-numbers
		} else {
			this.cloneDepth = '--depth=3';
		}
		if (options && options.filter) {
			this.filter = options.filter;
		} else {
			this.filter = (line: string): boolean => !!line.trim();
		}
	}

	/**
	 * @param {string} workDir work dir
	 * @param {string[]} commands commands
	 * @return {Promise<{}[]>} void
	 */
	public runCommand = async(workDir: string, commands: CommandType | CommandType[]): Promise<{ command: string; stdout: string[]; stderr: string[] }[]> => {
		const result: { command: string; stdout: string[]; stderr: string[] }[] = [];
		try {
			for (const command of (Array.isArray(commands) ? commands : [commands])) {
				if (typeof command === 'string') {
					const output = (await this.command.execAsync({command, cwd: workDir}));
					result.push({
						command: output.command,
						stdout: split(output.stdout),
						stderr: split(output.stderr),
					});
				} else {
					const output = (await this.command.execAsync({cwd: workDir, ...command}));
					result.push({
						command: output.command,
						stdout: split(output.stdout),
						stderr: split(output.stderr),
					});
				}
			}
			return result;
		} catch (error) {
			console.log();
			console.log(error);
			throw error;
		}
	};

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public addOrigin = async(workDir: string, context: Context): Promise<void> => {
		const url = this.getOrigin(context);
		await this.initialize(workDir);
		await this.runCommand(workDir, {
			command: 'git remote add',
			args: ['origin', url],
			quiet: this.isQuiet(),
			altCommand: 'git remote add origin',
			suppressError: true,
		});
	};

	/**
	 * @param {string|boolean} origin origin
	 * @param {boolean} quiet quiet?
	 */
	public useOrigin = (origin: string | boolean, quiet?: boolean): void => {
		this.origin = typeof origin === 'boolean' ? (origin ? 'origin' : undefined) : origin;
		if (quiet !== undefined) {
			this.quietIfNotOrigin = quiet;
		}
	};

	/**
	 * @return {boolean} is quiet?
	 */
	private isQuiet = (): boolean => !this.origin || this.quietIfNotOrigin;

	/**
	 * @param {Context} context context
	 * @return {string} origin
	 */
	private getOrigin = (context: Context): string => !this.origin ? getGitUrl(context) : this.origin;

	/**
	 * @param {string} workDir work dir
	 * @return {Promise<string>} branch name
	 */
	public getCurrentBranchName = async(workDir: string): Promise<string> => {
		if (!isCloned(workDir)) {
			return '';
		}
		// eslint-disable-next-line no-magic-numbers
		return (await this.runCommand(workDir, {command: 'git branch', args: ['-a']}))[0].stdout.find(branch => branch.startsWith('*'))?.slice(2).trim() ?? '';
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public cloneBranch = async(workDir: string, branch: string, context: Context): Promise<void> => {
		const url = this.getOrigin(context);
		await this.runCommand(workDir, {
			command: 'git clone',
			args: [`--branch=${branch}`, this.cloneDepth, url, '.'],
			quiet: this.isQuiet(),
			altCommand: `git clone --branch=${branch}`,
			suppressError: true,
		});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	private clonePR = async(workDir: string, context: Context): Promise<void> => {
		const url = this.getOrigin(context);
		await this.runCommand(workDir, [
			{
				command: 'git clone',
				args: [this.cloneDepth, url, '.'],
				quiet: this.isQuiet(),
				altCommand: 'git clone',
				suppressError: true,
			},
			{
				command: 'git fetch',
				args: [url, `+${context.ref}`],
				quiet: this.isQuiet(),
				altCommand: `git fetch origin ${context.ref}`,
				stderrToStdout: true,
			},
			'git checkout -qf FETCH_HEAD',
		]);
	};

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public clone = async(workDir: string, context: Context): Promise<void> => {
		if (isCloned(workDir)) {
			return;
		}

		if (isBranch(context)) {
			await this.cloneBranch(workDir, getBranch(context), context);
		} else if (isPrRef(context)) {
			await this.clonePR(workDir, context);
		} else {
			await this.checkout(workDir, context);
		}
	};

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public checkout = async(workDir: string, context: Context): Promise<void> => {
		const url = this.getOrigin(context);
		if (this.cloneDepth && context.sha) {
			await this.runCommand(workDir, [
				{
					command: 'git clone',
					args: [this.cloneDepth, url, '.'],
					quiet: this.isQuiet(),
					altCommand: 'git clone',
				},
				{
					command: 'git fetch',
					args: [url, context.ref],
					quiet: this.isQuiet(),
					altCommand: `git fetch origin ${context.ref}`,
				},
				{
					command: 'git checkout',
					args: ['-qf', context.sha],
				},
			]);
		} else {
			const checkout = context.sha || getBranch(context) || context.ref;
			if (!checkout) {
				throw new Error('Invalid context.');
			}
			await this.runCommand(workDir, [
				{
					command: 'git clone',
					args: [url, '.'],
					quiet: this.isQuiet(),
					altCommand: 'git clone',
				},
				{
					command: 'git checkout',
					args: ['-qf', checkout],
				},
			]);
		}
	};

	/**
	 * @param {string} workDir work dir
	 * @return {Promise<void>} void
	 */
	private initialize = async(workDir: string): Promise<void> => {
		await this.runCommand(workDir, {command: 'rm', args: ['-rdf', workDir]});
		fs.mkdirSync(workDir, {recursive: true});
		await this.runCommand(workDir, {command: 'git init', args: ['.']});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @return {Promise<void>} void
	 */
	public gitInit = async(workDir: string, branch: string): Promise<void> => {
		await this.initialize(workDir);
		await this.runCommand(workDir, {command: 'git checkout', args: ['--orphan', branch], stderrToStdout: true});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public fetchOrigin = async(workDir: string, context: Context): Promise<void> => {
		await this.addOrigin(workDir, context);
		await this.runCommand(workDir, {command: 'git fetch', args: ['origin'], stderrToStdout: true});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public fetchBranch = async(workDir: string, branch: string, context: Context): Promise<void> => {
		const url        = this.getOrigin(context);
		const branchName = getBranch(branch, false);
		await this.runCommand(workDir, {
			command: 'git fetch',
			args: ['--prune', '--no-recurse-submodules', this.cloneDepth, url, `+refs/heads/${branchName}:refs/remotes/origin/${branchName}`],
			quiet: this.isQuiet(),
			altCommand: `git fetch --prune --no-recurse-submodules${this.cloneDepth} origin +refs/heads/${branchName}:refs/remotes/origin/${branchName}`,
			suppressError: true,
		});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @return {Promise<void>} void
	 */
	public createBranch = async(workDir: string, branch: string): Promise<void> => {
		await this.runCommand(workDir, {command: 'git checkout', args: ['-b', branch], stderrToStdout: true});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @return {Promise<void>} void
	 */
	public switchBranch = async(workDir: string, branch: string): Promise<void> => {
		await this.runCommand(workDir, {
			command: 'git checkout',
			args: ['-b', branch, `origin/${branch}`],
			suppressError: true,
			stderrToStdout: true,
		});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} name name
	 * @param {string} email email
	 * @return {Promise<void>} void
	 */
	public config = async(workDir: string, name: string, email: string): Promise<void> => {
		await this.runCommand(workDir, [
			{
				command: 'git config',
				args: ['user.name', name],
			},
			{
				command: 'git config',
				args: ['user.email', email],
			},
		]);
	};

	/**
	 * @param {string} workDir work dir
	 * @return {Promise<string[]>} diff
	 */
	public getDiff = async(workDir: string): Promise<string[]> => (await this.runCommand(workDir, {
		command: 'git status',
		args: ['--short', '-uno'],
		suppressOutput: true,
	}))[0].stdout.filter(line => line.match(/^[MDA]\s+/)).filter(this.filter).map(line => line.replace(/^[MDA]\s+/, ''));

	/**
	 * @param {string} workDir work dir
	 * @param {string} baseRef base ref
	 * @param {string} compareRef compare ref
	 * @param {string} diffFilter diff filter
	 * @param {string} dot dot
	 * @return {Promise<string[]>} diff
	 */
	public getRefDiff = async(workDir: string, baseRef: string, compareRef: string, diffFilter?: string, dot?: '..' | '...'): Promise<string[]> => {
		const toDiffRef = (ref: string): string =>
			'HEAD' === ref ? 'HEAD' : (
				isPrRef(ref) ? ref.replace(/^refs\//, '') : `origin/${getBranch(ref, false)}`
			);
		return (await this.runCommand(workDir, {
			command: 'git diff',
			args: [`${toDiffRef(baseRef)}${dot ? dot : '...'}${toDiffRef(compareRef)}`, `--name-only${diffFilter ? ` --diff-filter=${diffFilter}` : ''}`],
			suppressOutput: true,
		}))[0].stdout.filter(item => !!item.trim());
	};

	/**
	 * @param {string} workDir work dir
	 * @return {Promise<boolean>} result
	 */
	public checkDiff = async(workDir: string): Promise<boolean> => !!(await this.getDiff(workDir)).length;

	/**
	 * @param {string} workDir work dir
	 * @param {string} message message
	 */
	public commit = async(workDir: string, message: string): Promise<boolean> => {
		await this.runCommand(workDir, {command: 'git add', args: ['--all']});

		if (!await this.checkDiff(workDir)) {
			this.logger.info('There is no diff.');
			return false;
		}

		await this.makeCommit(workDir, message);
		return true;
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} message message
	 * @param {number} count stat count
	 */
	public makeCommit = async(workDir: string, message: string, count = 10): Promise<void> => { // eslint-disable-line no-magic-numbers
		await this.runCommand(workDir, [
			{
				command: 'git commit',
				args: ['-qm', message],
			},
			{
				command: 'git show',
				args: [`--stat-count=${count}`, 'HEAD'],
			},
		]);
	};

	/**
	 * @param {string} workDir work dir
	 * @return {Promise<string[]>} tags
	 */
	public getTags = async(workDir: string): Promise<string[]> => (await this.runCommand(workDir, {
		command: 'git tag', args: ['-l'],
	}))[0].stdout;

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @param {number} splitSize split size
	 * @return {Promise<void>} void
	 * @see https://qiita.com/ngyuki/items/ca7bed067d7e538fd0cd
	 */
	public fetchTags = async(workDir: string, context: Context, splitSize = 20): Promise<void> => { // eslint-disable-line no-magic-numbers
		const url = this.getOrigin(context);
		await this.runCommand(workDir, [
			...arrayChunk(await this.getTags(workDir), splitSize).map(tags => ({
				command: 'git tag',
				args: ['-d', ...tags],
			})),
			{
				command: 'git fetch',
				args: [url, '--tags'],
				quiet: this.isQuiet(),
				altCommand: 'git fetch origin --tags',
			},
		]);
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string|string[]} tags tags
	 * @param {Context} context context
	 * @param {number} splitSize split size
	 * @return {Promise<void>} void
	 */
	public deleteTag = async(workDir: string, tags: string | string[], context: Context, splitSize = 20): Promise<void> => { // eslint-disable-line no-magic-numbers
		const url       = this.getOrigin(context);
		const regexp    = /^(refs\/)?tags\//;
		const getTagRef = (tag: string): string => regexp.test(tag) ? tag : `tags/${tag}`;
		const getTag    = (tag: string): string => tag.replace(regexp, '');
		await this.runCommand(workDir, [
			...arrayChunk((typeof tags === 'string' ? [tags] : tags).map(getTagRef), splitSize).map(tags => ({
				command: 'git push',
				args: [url, '--delete', ...tags],
				quiet: this.isQuiet(),
				altCommand: `git push origin --delete ${tags.join(' ')}`,
				suppressError: true,
			})),
			...arrayChunk((typeof tags === 'string' ? [tags] : tags).map(getTag), splitSize).map(tags => ({
				command: 'git tag',
				args: ['-d', ...tags],
				suppressError: true,
			})),
		]);
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} newTag new tag
	 * @param {string} fromTag from tag
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public copyTag = async(workDir: string, newTag: string, fromTag: string, context: Context): Promise<void> => {
		const url = this.getOrigin(context);
		await this.deleteTag(workDir, newTag, context);
		await this.runCommand(workDir, [
			{
				command: 'git tag',
				args: [newTag, fromTag],
			},
			{
				command: 'git push',
				args: [url, `refs/tags/${newTag}`],
				quiet: this.isQuiet(),
				altCommand: `git push origin refs/tags/${newTag}`,
			},
		]);
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string|string[]} tags tags
	 * @return {Promise<void>} void
	 */
	public addLocalTag = async(workDir: string, tags: string | string[]): Promise<void> => {
		if ('string' === typeof tags) {
			await this.runCommand(workDir, {command: 'git tag', args: [tags]});
		} else {
			for (const tag of tags) {
				await this.addLocalTag(workDir, tag);
			}
		}
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @param {boolean} withTag with tag?
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public push = async(workDir: string, branch: string, withTag: boolean, context: Context): Promise<void> => {
		const url  = this.getOrigin(context);
		const tags = withTag ? ' --tags' : '';
		await this.runCommand(workDir, {
			command: 'git push',
			args: [withTag ? '--tags' : '', url, `${branch}:refs/heads/${branch}`],
			quiet: this.isQuiet(),
			altCommand: `git push${tags} origin ${branch}:refs/heads/${branch}`,
		});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public forcePush = async(workDir: string, branch: string, context: Context): Promise<void> => {
		const url = this.getOrigin(context);
		await this.runCommand(workDir, {
			command: 'git push',
			args: ['--force', url, `${branch}:refs/heads/${branch}`],
			quiet: this.isQuiet(),
			altCommand: `git push --force origin ${branch}:refs/heads/${branch}`,
		});
	};

	/**
	 * @param {string} workDir work dir
	 * @return {string} tag
	 */
	public getLastTag = async(workDir: string): Promise<string> => {
		if (!isCloned(workDir)) {
			throw new Error('Not a git repository');
		}
		const tags       = (await this.getTags(workDir)).filter(tag => /^v?\d+(\.\d+)*$/.test(tag));
		const compareTag = (tag1: string, tag2: string): number => versionCompare(tag1, tag2);
		return 'v' + (tags.slice().sort(compareTag).reverse()[0]?.replace(/^v/, '') ?? '0.0.0');
	};

	/**
	 * @param {string} workDir work dir
	 * @return {string} tag
	 */
	public getNewPatchVersion = async(workDir: string): Promise<string> => generateNewPatchVersion(await this.getLastTag(workDir));
}
