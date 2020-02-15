import fs from 'fs';
import { Context } from '@actions/github/lib/context';
import { Command, Logger } from './index';
import { getBranch, isBranch, isPrRef, getRefspec, isCloned, split, generateNewPatchVersion, arrayChunk, versionCompare, getAccessToken } from './utils';
import { getGitUrlWithToken } from './context-helper';

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
	private readonly token: string;
	private origin?: string  = undefined;
	private quietIfNotOrigin = true;

	/**
	 * @param {Logger} logger logger
	 * @param {object} options options
	 * @param {number|undefined} options.depth depth
	 * @param {function|undefined} options.filter filter
	 */
	constructor(private readonly logger: Logger, options?: { depth?: number; filter?: (string: string) => boolean; token?: string }) {
		this.command = new Command(logger);
		this.token   = options?.token ?? getAccessToken(true);

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
	 * @param {boolean} refresh refresh?
	 * @return {Promise<void>} void
	 */
	private initialize = async(workDir: string, refresh = true): Promise<void> => {
		if (isCloned(workDir) && !refresh) {
			return;
		}

		if (fs.existsSync(workDir)) {
			await this.runCommand(workDir, {command: 'rm', args: ['-rdf', workDir]});
		}
		fs.mkdirSync(workDir, {recursive: true});
		await this.runCommand(workDir, {command: 'git init', args: ['.']});
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
	 * @return {string} origin name
	 */
	public getRemoteName = (): string | never => this.origin ?? 'origin';

	/**
	 * @param {Context} context context
	 * @return {string} origin
	 */
	private getRemote = (context: Context): string => this.origin ?? getGitUrlWithToken(context, this.token);

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public addOrigin = async(workDir: string, context: Context): Promise<void> => {
		await this.initialize(workDir, false);
		await this.runCommand(workDir, {
			command: 'git remote add',
			args: [this.getRemoteName(), getGitUrlWithToken(context, this.token)],
			quiet: this.isQuiet(),
			altCommand: `git remote add ${this.getRemoteName()}`,
			suppressError: true,
		});
	};

	/**
	 * @return {boolean} is quiet?
	 */
	private isQuiet = (): boolean => !this.origin || this.quietIfNotOrigin;

	/**
	 * @param {string} workDir work dir
	 * @return {Promise<string>} branch name
	 */
	public getCurrentBranchName = async(workDir: string): Promise<string> => {
		if (!isCloned(workDir)) {
			return '';
		}
		return (await this.runCommand(workDir, {
			command: 'git rev-parse',
			args: ['--abbrev-ref', 'HEAD'],
			suppressError: true,
			stderrToStdout: true,
		}))[0].stdout[0]?.trim() ?? '';
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public cloneBranch = async(workDir: string, branch: string, context: Context): Promise<void> => {
		await this.runCommand(workDir, {
			command: 'git clone',
			args: [`--branch=${branch}`, this.cloneDepth, this.getRemote(context), '.'],
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
		await this.runCommand(workDir, [
			{
				command: 'git clone',
				args: [this.cloneDepth, this.getRemote(context), '.'],
				quiet: this.isQuiet(),
				altCommand: 'git clone',
				suppressError: true,
			},
			{
				command: 'git fetch',
				args: [this.getRemote(context), `+${context.ref}`],
				quiet: this.isQuiet(),
				altCommand: `git fetch ${this.getRemoteName()} ${context.ref}`,
				stderrToStdout: true,
			},
			{
				command: 'git checkout',
				args: ['-qf', 'FETCH_HEAD'],
			},
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
	 * @param {string[]} options options
	 * @param {string[]} refspec refspec
	 * @return {Promise<void>} void
	 */
	public fetchOrigin = async(workDir: string, context: Context, options?: string[], refspec?: string[]): Promise<void> => {
		await this.addOrigin(workDir, context);
		await this.runCommand(workDir, {
			command: 'git fetch',
			args: [
				...(options ?? []),
				this.getRemoteName(),
				...(refspec ?? []),
			],
			suppressError: true,
			stderrToStdout: true,
		});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public checkout = async(workDir: string, context: Context): Promise<void> => {
		await this.fetchOrigin(workDir, context, ['--no-tags'], [getRefspec(context)]);
		await this.runCommand(workDir, [
			{
				command: 'git checkout',
				args: ['-qf', context.sha],
				stderrToStdout: true,
			},
		]);
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public fetchBranch = async(workDir: string, branch: string, context: Context): Promise<void> => {
		const branchName = getBranch(branch, false);
		await this.runCommand(workDir, {
			command: 'git fetch',
			args: ['--prune', '--no-recurse-submodules', this.cloneDepth, this.getRemote(context), `+refs/heads/${branchName}:refs/remotes/${this.getRemoteName()}/${branchName}`],
			quiet: this.isQuiet(),
			altCommand: `git fetch --prune --no-recurse-submodules${this.cloneDepth} ${this.getRemoteName()} +refs/heads/${branchName}:refs/remotes/${this.getRemoteName()}/${branchName}`,
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
			args: ['-b', branch, `${this.getRemoteName()}/${branch}`],
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
				isPrRef(ref) ? ref.replace(/^refs\//, '') : `${this.getRemoteName()}/${getBranch(ref, false)}`
			);
		return (await this.runCommand(workDir, {
			command: 'git diff',
			args: [`${toDiffRef(baseRef)}${dot ?? '...'}${toDiffRef(compareRef)}`, '--name-only', diffFilter ? `--diff-filter=${diffFilter}` : ''],
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
	 * @param {object} options options
	 */
	public commit = async(workDir: string, message: string, options?: { count?: number; allowEmpty?: boolean; args?: Array<string> }): Promise<boolean> => {
		await this.runCommand(workDir, {command: 'git add', args: ['--all']});

		if (!options?.allowEmpty && !await this.checkDiff(workDir)) {
			this.logger.info('There is no diff.');
			return false;
		}

		await this.makeCommit(workDir, message, options);
		return true;
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} message message
	 * @param {object} options options
	 */
	public makeCommit = async(workDir: string, message: string, options?: { count?: number; allowEmpty?: boolean; args?: Array<string> }): Promise<void> => {
		const count      = options?.count ?? 10; // eslint-disable-line no-magic-numbers
		const allowEmpty = options?.allowEmpty ?? false;
		const args       = options?.args ?? [];

		await this.runCommand(workDir, [
			{
				command: 'git commit',
				args: [allowEmpty ? '--allow-empty' : '', ...args, '-qm', message],
			},
			{
				command: 'git show',
				args: [`--stat-count=${count}`, 'HEAD'],
			},
		]);
	};

	/**
	 * @param {string} workDir work dir
	 * @param {object} options options
	 * @return {Promise<string[]>} tags
	 */
	public getTags = async(workDir: string, options?: { quiet?: boolean; suppressOutput?: boolean }): Promise<string[]> => (await this.runCommand(workDir, {
		command: 'git tag',
		suppressOutput: options?.suppressOutput || options?.quiet,
		altCommand: options?.quiet ? '' : undefined,
	}))[0].stdout;

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @param {number} splitSize split size
	 * @return {Promise<void>} void
	 * @see https://qiita.com/ngyuki/items/ca7bed067d7e538fd0cd
	 */
	public fetchTags = async(workDir: string, context: Context, splitSize = 20): Promise<void> => { // eslint-disable-line no-magic-numbers
		await this.runCommand(workDir, [
			...arrayChunk(await this.getTags(workDir, {quiet: true}), splitSize).map(tags => ({
				command: 'git tag',
				args: ['-d', ...tags],
				quiet: true,
			})),
			{
				command: 'git fetch',
				args: [this.getRemote(context), '--tags'],
				quiet: this.isQuiet(),
				altCommand: `git fetch ${this.getRemoteName()} --tags`,
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
		const regexp    = /^(refs\/)?tags\//;
		const getTagRef = (tag: string): string => regexp.test(tag) ? tag : `tags/${tag}`;
		const getTag    = (tag: string): string => tag.replace(regexp, '');
		await this.runCommand(workDir, [
			...arrayChunk((typeof tags === 'string' ? [tags] : tags).map(getTagRef), splitSize).map(tags => ({
				command: 'git push',
				args: [this.getRemote(context), '--delete', ...tags],
				quiet: this.isQuiet(),
				altCommand: `git push ${this.getRemoteName()} --delete ${tags.join(' ')}`,
				suppressError: true,
			})),
			...arrayChunk((typeof tags === 'string' ? [tags] : tags).map(getTag), splitSize).map(tags => ({
				command: 'git tag',
				args: ['-d', ...tags],
				suppressError: true,
				stderrToStdout: true,
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
		await this.deleteTag(workDir, newTag, context);
		await this.runCommand(workDir, [
			{
				command: 'git tag',
				args: [newTag, fromTag],
			},
			{
				command: 'git push',
				args: [this.getRemote(context), `refs/tags/${newTag}`],
				quiet: this.isQuiet(),
				altCommand: `git push ${this.getRemoteName()} refs/tags/${newTag}`,
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
	 * @param {Context} context context
	 * @param {object} options options
	 * @return {Promise<void>} void
	 */
	public push = async(workDir: string, branch: string, context: Context, options?: { withTag?: boolean; force?: boolean; args?: Array<string> }): Promise<void> => {
		const args: Array<string> = [];
		if (options?.withTag) {
			args.push('--tags');
		}
		if (options?.force) {
			args.push('--force');
		}
		if (options?.args) {
			args.push(...options.args);
		}
		await this.runCommand(workDir, {
			command: 'git push',
			args: args.concat([this.getRemote(context), `${branch}:refs/heads/${branch}`]),
			quiet: this.isQuiet(),
			altCommand: `git push ${args.concat([this.getRemoteName(), `${branch}:refs/heads/${branch}`]).join(' ')}`,
			suppressError: true,
		});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public forcePush = async(workDir: string, branch: string, context: Context): Promise<void> => this.push(workDir, branch, context, {force: true});

	/**
	 * @param {string} workDir work dir
	 * @return {string} tag
	 */
	public getLastTag = async(workDir: string): Promise<string> => {
		if (!isCloned(workDir)) {
			throw new Error('Not a git repository');
		}

		return 'v' + ((await this.getTags(workDir)).filter(tag => /^v?\d+(\.\d+)*$/.test(tag)).sort(versionCompare).reverse()[0]?.replace(/^v/, '') ?? '0.0.0');
	};

	/**
	 * @param {string} workDir work dir
	 * @return {string} tag
	 */
	public getNewPatchVersion = async(workDir: string): Promise<string> => generateNewPatchVersion(await this.getLastTag(workDir));
}
