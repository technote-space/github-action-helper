import fs from 'fs';
import path from 'path';
import { Context } from '@actions/github/lib/context';
import { Command, Logger } from './index';
import { getGitUrl, getBranch, isBranch, isPrRef } from './utils';

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
	 * @return {boolean} is cloned?
	 */
	private isCloned = (workDir: string): boolean => fs.existsSync(path.resolve(workDir, '.git'));

	/**
	 * @param {string} workDir work dir
	 * @return {Promise<string>} branch name
	 */
	public getCurrentBranchName = async(workDir: string): Promise<string> => {
		if (!this.isCloned(workDir)) {
			return '';
		}
		return (await this.command.execAsync({command: `git -C ${workDir} branch -a | grep -E '^\\*' | cut -b 3-`})).trim();
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public cloneBranch = async(workDir: string, branch: string, context: Context): Promise<void> => {
		const url = getGitUrl(context);
		await this.command.execAsync({
			command: `git -C ${workDir} clone --branch=${branch}${this.cloneDepth} ${url} .`,
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
		await this.command.execAsync({
			command: `git -C ${workDir} clone${this.cloneDepth} ${url} .`,
			quiet: true,
			altCommand: `git clone${this.cloneDepth}`,
			suppressError: true,
		});
		await this.command.execAsync({command: `git -C ${workDir} fetch origin +${context.ref}`});
		await this.command.execAsync({command: `git -C ${workDir} checkout -qf FETCH_HEAD`});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public clone = async(workDir: string, context: Context): Promise<void> => {
		if (this.isCloned(workDir)) {
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
			await this.command.execAsync({command: `git -C ${workDir} clone${this.cloneDepth} ${url} .`, quiet: true, altCommand: `git clone${this.cloneDepth}`});
			await this.command.execAsync({command: `git -C ${workDir} fetch ${url} ${context.ref}`, quiet: true, altCommand: `git fetch origin ${context.ref}`});
			await this.command.execAsync({command: `git -C ${workDir} checkout -qf ${context.sha}`});
		} else {
			const checkout = context.sha || getBranch(context) || context.ref;
			if (!checkout) {
				throw new Error('Invalid context.');
			}
			await this.command.execAsync({command: `git -C ${workDir} clone ${url} .`, quiet: true, altCommand: 'git clone'});
			await this.command.execAsync({command: `git -C ${workDir} checkout -qf ${checkout}`});
		}
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} branch branch
	 * @return {Promise<void>} void
	 */
	public gitInit = async(workDir: string, branch: string): Promise<void> => {
		await this.command.execAsync({command: `rm -rdf ${workDir}`});
		fs.mkdirSync(workDir, {recursive: true});
		await this.command.execAsync({command: `git -C ${workDir} init .`});
		await this.command.execAsync({command: `git -C ${workDir} checkout --orphan "${branch}"`});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string} name name
	 * @param {string} email email
	 * @return {Promise<void>} void
	 */
	public config = async(workDir: string, name: string, email: string): Promise<void> => {
		await this.command.execAsync({command: `git -C ${workDir} config user.name "${name}"`});
		await this.command.execAsync({command: `git -C ${workDir} config user.email "${email}"`});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string[]} commands commands
	 * @return {Promise<void>} void
	 */
	public runCommand = async(workDir: string, commands: string[]): Promise<void> => {
		for (const command of commands) {
			await this.command.execAsync({command, cwd: workDir});
		}
	};

	/**
	 * @param {string} workDir work dir
	 * @return {Promise<string[]>} diff
	 */
	public getDiff = async(workDir: string): Promise<string[]> => (await this.command.execAsync({
		command: `git -C ${workDir} status --short -uno`,
		suppressOutput: true,
	}))
		.split(/\r\n|\n/)
		.filter(line => line.match(/^[MDA]\s+/))
		.filter(this.filter)
		.map(line => line.replace(/^[MDA]\s+/, ''));

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
		await this.command.execAsync({command: `git -C ${workDir} add --all`});

		if (!await this.checkDiff(workDir)) {
			this.logger.info('There is no diff.');
			return false;
		}

		await this.command.execAsync({command: `git -C ${workDir} commit -qm "${message.replace('"', '\\"')}"`});
		await this.command.execAsync({command: `git -C ${workDir} show --stat-count=10 HEAD`});
		return true;
	};

	/**
	 * @param {string} workDir work dir
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public fetchTags = async(workDir: string, context: Context): Promise<void> => {
		const url = getGitUrl(context);
		await this.command.execAsync({command: `git -C ${workDir} tag -l | xargs git -C ${workDir} tag -d`});
		await this.command.execAsync({command: `git -C ${workDir} fetch "${url}" --tags`, quiet: true, altCommand: 'git fetch origin --tags'});
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
			await this.command.execAsync({
				command: `git -C ${workDir} push --delete "${url}" tag ${tags}`,
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
		await this.command.execAsync({command: `git -C ${workDir} tag ${newTag} ${fromTag}`});
		await this.command.execAsync({
			command: `git -C ${workDir} push "${url}" "refs/tags/${newTag}"`,
			quiet: true,
			altCommand: `git push "refs/tags/${newTag}"`,
		});
	};

	/**
	 * @param {string} workDir work dir
	 * @param {string|string[]} tags tags
	 * @return {Promise<void>} void
	 */
	public addLocalTag = async(workDir: string, tags: string | string[]): Promise<void> => {
		if ('string' === typeof tags) {
			await this.command.execAsync({command: `git -C ${workDir} tag ${tags}`});
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
	 * @return {Promise<void>} void
	 */
	public push = async(workDir: string, branch: string, context: Context): Promise<void> => {
		const url = getGitUrl(context);
		await this.command.execAsync({
			command: `git -C ${workDir} push --tags "${url}" "${branch}":"refs/heads/${branch}"`,
			quiet: true,
			altCommand: `git push --tags "${branch}":"refs/heads/${branch}"`,
		});
	};
}
