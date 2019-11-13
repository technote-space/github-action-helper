import fs from 'fs';
import { Context } from '@actions/github/lib/context';
import { Command, Logger } from './index';
import { getBranch, isBranch, isPrRef, isCloned } from './utils';
import { getGitUrl } from './context-helper';

type CommandType = string | {
	command: string;
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

	/**
	 * @param {Logger} logger logger
	 * @param {object} options options
	 * @param {number|undefined} options.depth depth
	 * @param {function|undefined} options.filter filter
	 */
	constructor(private readonly logger: Logger, options?: { depth?: number; filter?: (string: string) => boolean }) {
		this.command = new Command(logger);
		if (options && options.depth) {
			this.cloneDepth = options.depth > 0 ? ` --depth=${options.depth}` : ''; // eslint-disable-line no-magic-numbers
		} else {
			this.cloneDepth = ' --depth=3';
		}
		if (options && options.filter) {
			this.filter = options.filter;
		} else {
			this.filter = (line: string): boolean => !!line.trim();
		}
	}

	/**
	 * @param {string} workDir work dir
	 * @return {Promise<string>} branch name
	 */
	public getCurrentBranchName = async(workDir: string): Promise<string> => {
		if (!isCloned(workDir)) {
			return '';
		}
		return (await this.runCommand(workDir, 'git branch -a | grep -E \'^\\*\' | cut -b 3-'))[0].stdout[0].trim();
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public cloneBranch = async(workDir: string, branch: string, context: Context): Promise<void> => {
		const url = getGitUrl(context);
		await this.runCommand(workDir, {
			command: `git clone --branch=${branch}${this.cloneDepth} ${url} .`,
			quiet: true,
			altCommand: `git clone --branch=${branch}${this.cloneDepth}`,
			suppressError: true,
		});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	private clonePR = async(workDir: string, context: Context): Promise<void> => {
		const url = getGitUrl(context);
		await this.runCommand(workDir, [
			{
				command: `git clone${this.cloneDepth} ${url} .`,
				quiet: true,
				altCommand: `git clone${this.cloneDepth}`,
				suppressError: true,
			},
			{command: `git fetch origin +${context.ref}`, stderrToStdout: true},
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
		const url = getGitUrl(context);
		if (this.cloneDepth && context.sha) {
			await this.runCommand(workDir, [
				{command: `git clone${this.cloneDepth} ${url} .`, quiet: true, altCommand: `git clone${this.cloneDepth}`},
				{command: `git fetch ${url} ${context.ref}`, quiet: true, altCommand: `git fetch origin ${context.ref}`},
				{command: `git checkout -qf ${context.sha}`},
			]);
		} else {
			const checkout = context.sha || getBranch(context) || context.ref;
			if (!checkout) {
				throw new Error('Invalid context.');
			}
			await this.runCommand(workDir, [
				{command: `git clone ${url} .`, quiet: true, altCommand: 'git clone'},
				{command: `git checkout -qf ${checkout}`},
			]);
		}
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @return {Promise<void>} void
	 */
	public gitInit = async(workDir: string, branch: string): Promise<void> => {
		await this.runCommand(workDir, {command: `rm -rdf ${workDir}`});
		fs.mkdirSync(workDir, {recursive: true});
		await this.runCommand(workDir, [
			{command: 'git init .'},
			{command: `git checkout --orphan "${branch}"`},
		]);
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public fetchBranch = async(workDir: string, branch: string, context: Context): Promise<void> => {
		const url        = getGitUrl(context);
		const branchName = getBranch(branch, false);
		await this.runCommand(workDir, {
			command: `git fetch --prune --no-recurse-submodules${this.cloneDepth} ${url} +refs/heads/${branchName}:refs/remotes/origin/${branchName}`,
			quiet: true,
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
		await this.runCommand(workDir, {command: `git checkout -b "${branch}"`});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} name name
	 * @param {string} email email
	 * @return {Promise<void>} void
	 */
	public config = async(workDir: string, name: string, email: string): Promise<void> => {
		await this.runCommand(workDir, [
			{command: `git config user.name "${name}"`},
			{command: `git config user.email "${email}"`},
		]);
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string[]} commands commands
	 * @return {Promise<{}[]>} void
	 */
	public runCommand = async(workDir: string, commands: CommandType | CommandType[]): Promise<{ command: string; stdout: string[] }[]> => {
		const result: { command: string; stdout: string[] }[] = [];
		try {
			for (const command of (Array.isArray(commands) ? commands : [commands])) {
				if (typeof command === 'string') {
					result.push({
						command,
						stdout: (await this.command.execAsync({command, cwd: workDir})).split(/\r?\n/),
					});
				} else {
					result.push({
						command: command.command,
						stdout: (await this.command.execAsync({cwd: workDir, ...command})).split(/\r?\n/),
					});
				}
			}
			return result;
		} catch (error) {
			console.log();
			this.logger.info(error.message);
			console.trace();
			throw error;
		}
	};

	/**
	 * @param {string} workDir work dir
	 * @return {Promise<string[]>} diff
	 */
	public getDiff = async(workDir: string): Promise<string[]> => (await this.runCommand(workDir, {
		command: 'git status --short -uno',
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
			command: `git diff ${toDiffRef(baseRef)}${dot ? dot : '...'}${toDiffRef(compareRef)} --name-only${diffFilter ? ` --diff-filter=${diffFilter}` : ''}`,
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
		await this.runCommand(workDir, {command: 'git add --all'});

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
			{command: `git commit -qm "${message.replace('"', '\\"')}"`},
			{command: `git show --stat-count=${count} HEAD`},
		]);
	};

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public fetchTags = async(workDir: string, context: Context): Promise<void> => {
		const url = getGitUrl(context);
		await this.runCommand(workDir, [
			{command: 'git tag -l | xargs git tag -d'},
			{command: `git fetch ${url} --tags`, quiet: true, altCommand: 'git fetch origin --tags'},
		]);
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string|string[]} tags tags
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public deleteTag = async(workDir: string, tags: string | string[], context: Context): Promise<void> => {
		if ('string' === typeof tags) {
			const url = getGitUrl(context);
			await this.runCommand(workDir, {
				command: `git push --delete ${url} tag ${tags}`,
				quiet: true,
				altCommand: `git push --delete origin tag ${tags}`,
				suppressError: true,
			});
		} else {
			for (const tag of tags) {
				await this.deleteTag(workDir, tag, context);
			}
		}
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} newTag new tag
	 * @param {string} fromTag from tag
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public copyTag = async(workDir: string, newTag: string, fromTag: string, context: Context): Promise<void> => {
		const url = getGitUrl(context);
		await this.deleteTag(workDir, newTag, context);
		await this.runCommand(workDir, [
			{command: `git tag ${newTag} ${fromTag}`},
			{
				command: `git push ${url} "refs/tags/${newTag}"`,
				quiet: true,
				altCommand: `git push origin "refs/tags/${newTag}"`,
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
			await this.runCommand(workDir, {command: `git tag ${tags}`});
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
		const url  = getGitUrl(context);
		const tags = withTag ? ' --tags' : '';
		await this.runCommand(workDir, {
			command: `git push${tags} ${url} "${branch}":"refs/heads/${branch}"`,
			quiet: true,
			altCommand: `git push${tags} origin "${branch}":"refs/heads/${branch}"`,
		});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public forcePush = async(workDir: string, branch: string, context: Context): Promise<void> => {
		const url = getGitUrl(context);
		await this.runCommand(workDir, {
			command: `git push --force ${url} "${branch}":"refs/heads/${branch}"`,
			quiet: true,
			altCommand: `git push --force origin "${branch}":"refs/heads/${branch}"`,
		});
	};
}
