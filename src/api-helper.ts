import fs from 'fs';
import path from 'path';
import { GitHub } from '@actions/github/lib/github';
import { Context } from '@actions/github/lib/context';
import { Response, GitCreateTreeResponse, GitCreateCommitResponse, GitGetCommitResponse } from '@octokit/rest';
import { Logger } from './index';
import { getBranch, getSender, getRefForUpdate } from './utils';

/**
 * API Helper
 */
export default class ApiHelper {

	private readonly branch?: string | undefined = undefined;
	private readonly sender?: string | undefined = undefined;
	private readonly refForUpdate?: string | undefined = undefined;

	/**
	 * @param {Logger} logger logger
	 * @param {object} options options
	 * @param {string|undefined} options.branch branch
	 * @param {string|undefined} options.sender sender
	 * @param {string|undefined} options.refForUpdate ref for update
	 */
	constructor(private readonly logger: Logger, options?: { branch?: string; sender?: string; refForUpdate?: string }) {
		if (options) {
			this.branch = options.branch;
			this.sender = options.sender;
			this.refForUpdate = options.refForUpdate;
		}
	}

	/**
	 * @param {Context} context context
	 * @return {string} branch
	 */
	private getBranch = (context: Context): string => this.branch ? this.branch : getBranch(context);

	/**
	 * @param {Context} context context
	 * @return {string|boolean} sender
	 */
	private getSender = (context: Context): string | false => this.sender ? this.sender : getSender(context);

	/**
	 * @param {Context} context context
	 * @return {string} ref for update
	 */
	private getRefForUpdate = (context: Context): string => this.refForUpdate ? this.refForUpdate : getRefForUpdate(context);

	/**
	 * @param {string} rootDir root dir
	 * @param {string} filepath filepath
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<{ path: string, sha: string }>} blob
	 */
	private createBlob = async(rootDir: string, filepath: string, octokit: GitHub, context: Context): Promise<{ path: string; sha: string }> => {
		const blob = await octokit.git.createBlob({
			owner: context.repo.owner,
			repo: context.repo.repo,
			content: Buffer.from(fs.readFileSync(path.resolve(rootDir, filepath), 'utf8')).toString('base64'),
			encoding: 'base64',
		});

		return {
			path: filepath,
			sha: blob.data.sha,
		};
	};

	/**
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<Response<GitGetCommitResponse>>} commit
	 */
	private getCommit = async(octokit: GitHub, context: Context): Promise<Response<GitGetCommitResponse>> => {
		return await octokit.git.getCommit({
			owner: context.repo.owner,
			repo: context.repo.repo,
			'commit_sha': context.sha,
		});
	};

	/**
	 * @param {string} rootDir root dir
	 * @param {object} files files
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<{ path: string, sha: string }[]>} blobs
	 */
	public filesToBlobs = async(rootDir: string, files: object, octokit: GitHub, context: Context): Promise<{ path: string; sha: string }[]> => await Promise.all(Object.values(files).map(file => this.createBlob(rootDir, file, octokit, context)));

	/**
	 * @param {{ path: string, sha: string }[]} blobs blobs
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<Response<GitCreateTreeResponse>>} tree
	 */
	public createTree = async(blobs: { path: string; sha: string }[], octokit: GitHub, context: Context): Promise<Response<GitCreateTreeResponse>> => {
		return await octokit.git.createTree({
			owner: context.repo.owner,
			repo: context.repo.repo,
			'base_tree': (await this.getCommit(octokit, context)).data.tree.sha,
			tree: Object.values(blobs).map(blob => ({
				path: blob.path,
				type: 'blob',
				mode: '100644',
				sha: blob.sha,
			})),
		});
	};

	/**
	 * @param {string} commitMessage commit message
	 * @param {Response<GitCreateTreeResponse>} tree tree
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<Response<GitCreateCommitResponse>>} commit
	 */
	public createCommit = async(commitMessage: string, tree: Response<GitCreateTreeResponse>, octokit: GitHub, context: Context): Promise<Response<GitCreateCommitResponse>> => {
		return await octokit.git.createCommit({
			owner: context.repo.owner,
			repo: context.repo.repo,
			tree: tree.data.sha,
			parents: [context.sha],
			message: commitMessage,
		});
	};

	/**
	 * @param {Response<GitCreateCommitResponse>} commit commit
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public updateRef = async(commit: Response<GitCreateCommitResponse>, octokit: GitHub, context: Context): Promise<void> => {
		try {
			await octokit.git.updateRef({
				owner: context.repo.owner,
				repo: context.repo.repo,
				ref: this.getRefForUpdate(context),
				sha: commit.data.sha,
			});
		} catch (error) {
			if (this.isProtectedBranchError(error)) {
				this.logger.warn('Branch [%s] is protected.', this.getBranch(context));
			} else {
				throw error;
			}
		}
	};

	/**
	 * @param {Error} error error
	 * @return {boolean} result
	 */
	private isProtectedBranchError = (error: Error): boolean => {
		return /required status checks?.* (is|are) expected/i.test(error.message);
	};

	/**
	 * @param {string} rootDir root dir
	 * @param {string} commitMessage commit message
	 * @param {string[]} files files
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<boolean>} result
	 */
	public commit = async(rootDir: string, commitMessage: string, files: string[], octokit: GitHub, context: Context): Promise<boolean> => {
		if (!files.length) {
			this.logger.info('There is no diff.');
			return false;
		}

		this.logger.startProcess('Start push to branch [%s]', this.getBranch(context));

		this.logger.startProcess('Creating blobs...');
		const blobs = await this.filesToBlobs(rootDir, files, octokit, context);

		this.logger.startProcess('Creating tree...');
		const tree = await this.createTree(blobs, octokit, context);

		this.logger.startProcess('Creating commit... [%s]', tree.data.sha);
		const commit = await this.createCommit(commitMessage, tree, octokit, context);

		this.logger.startProcess('Updating ref... [%s] [%s]', this.getRefForUpdate(context), commit.data.sha);
		await this.updateRef(commit, octokit, context);

		process.env.GITHUB_SHA = commit.data.sha;

		this.logger.endProcess();
		return true;
	};

	/**
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<{ login: string, email: string, name: string, id: number }>} user
	 */
	public getUser = async(octokit: GitHub, context: Context): Promise<{ login: string; email: string; name: string; id: number }> => {
		const sender = this.getSender(context);
		if (false === sender) {
			throw new Error('Sender is not valid.');
		}

		const {data: user} = await octokit.users.getByUsername({
			username: sender,
		});

		return {
			login: user.login,
			email: user.email,
			name: user.name,
			id: user.id,
		};
	};
}
