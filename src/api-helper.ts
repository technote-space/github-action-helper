import fs from 'fs';
import path from 'path';
import { GitHub } from '@actions/github/lib/github';
import { Context } from '@actions/github/lib/context';
import {
	Response,
	AnyResponse,
	GitCreateTreeResponse,
	GitCreateCommitResponse,
	GitGetCommitResponse,
	PullsGetResponse,
	PullsListResponse,
	PullsCreateResponse,
	PullsUpdateResponse,
} from '@octokit/rest';
import { exportVariable } from '@actions/core';
import { Logger } from './index';
import { getSender, getRefForUpdate, isPrRef } from './utils';

type PullsCreateParams = {
	body?: string;
	draft?: boolean;
	title: string;
};

type PullsInfo = {
	'html_url': string;
	'commits_url': string;
	'comments_url': string;
	number: number;
};

/**
 * API Helper
 */
export default class ApiHelper {

	private readonly branch?: string | undefined = undefined;
	private readonly sender?: string | undefined = undefined;
	private readonly suppressBPError?: boolean | undefined = undefined;
	private readonly refForUpdate?: string | undefined = undefined;
	private prCache: { [key: number]: Response<PullsGetResponse> } = {};

	/**
	 * @param {Logger} logger logger
	 * @param {object} options options
	 * @param {string|undefined} options.branch branch
	 * @param {string|undefined} options.sender sender
	 * @param {string|undefined} options.refForUpdate ref for update
	 * @param {boolean|undefined} options.suppressBPError suppress branch protection error?
	 */
	constructor(private readonly logger: Logger, options?: { branch?: string; sender?: string; refForUpdate?: string; suppressBPError?: boolean }) {
		if (options) {
			this.branch = options.branch;
			this.sender = options.sender;
			this.refForUpdate = options.refForUpdate;
			this.suppressBPError = options.suppressBPError;
		}
	}

	/**
	 * @param {Context} context context
	 * @return {string|boolean} sender
	 */
	private getSender = (context: Context): string | false => this.sender ? this.sender : getSender(context);

	/**
	 * @param {boolean} encode encode?
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {string} ref for update
	 */
	public getRefForUpdate = async(encode: boolean, octokit: GitHub, context: Context): Promise<string> => {
		const ref = this.refForUpdate ? this.refForUpdate : (
			isPrRef(context) ? ('heads/' + (await this.getPR(octokit, context)).data.head.ref) : getRefForUpdate(context)
		);
		return encode ? encodeURIComponent(ref) : ref;
	};

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
	 * @param {Context} context context
	 * @return {string} commit sha
	 */
	private getCommitSha = (context: Context): string => isPrRef(context) ? context.payload.after : context.sha;

	/**
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<Response<GitGetCommitResponse>>} commit
	 */
	private getCommit = async(octokit: GitHub, context: Context): Promise<Response<GitGetCommitResponse>> => octokit.git.getCommit({
		owner: context.repo.owner,
		repo: context.repo.repo,
		'commit_sha': this.getCommitSha(context),
	});

	/**
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<Response<PullsGetResponse>>} commit
	 */
	private getPR = async(octokit: GitHub, context: Context): Promise<Response<PullsGetResponse>> => {
		const key = parseInt(context.payload.number, 10);
		if (!(key in this.prCache)) {
			this.prCache[key] = await octokit.pulls.get({
				owner: context.repo.owner,
				repo: context.repo.repo,
				'pull_number': context.payload.number,
			});
		}
		return this.prCache[key];
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
	public createTree = async(blobs: { path: string; sha: string }[], octokit: GitHub, context: Context): Promise<Response<GitCreateTreeResponse>> => octokit.git.createTree({
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

	/**
	 * @param {string} commitMessage commit message
	 * @param {Response<GitCreateTreeResponse>} tree tree
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<Response<GitCreateCommitResponse>>} commit
	 */
	public createCommit = async(commitMessage: string, tree: Response<GitCreateTreeResponse>, octokit: GitHub, context: Context): Promise<Response<GitCreateCommitResponse>> => octokit.git.createCommit({
		owner: context.repo.owner,
		repo: context.repo.repo,
		tree: tree.data.sha,
		parents: [this.getCommitSha(context)],
		message: commitMessage,
	});

	/**
	 * @param {string} refName refName
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<AnyResponse|null>} refName
	 */
	private getRef = async(refName: string, octokit: GitHub, context: Context): Promise<AnyResponse | null> => {
		try {
			return await octokit.git.getRef({
				owner: context.repo.owner,
				repo: context.repo.repo,
				ref: refName,
			});
		} catch (error) {
			return null;
		}
	};

	/**
	 * @param {Response<GitCreateCommitResponse>} commit commit
	 * @param {string} refName refName
	 * @param {boolean} force force
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public updateRef = async(commit: Response<GitCreateCommitResponse>, refName: string, force: boolean, octokit: GitHub, context: Context): Promise<boolean> => {
		try {
			await octokit.git.updateRef({
				owner: context.repo.owner,
				repo: context.repo.repo,
				ref: refName,
				sha: commit.data.sha,
				force,
			});
			return true;
		} catch (error) {
			if (this.suppressBPError === true && this.isProtectedBranchError(error)) {
				this.logger.warn('Branch is protected.');
			} else {
				throw error;
			}
			return false;
		}
	};

	/**
	 * @param {Response<GitCreateCommitResponse>} commit commit
	 * @param {string} refName refName
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<void>} void
	 */
	public createRef = async(commit: Response<GitCreateCommitResponse>, refName: string, octokit: GitHub, context: Context): Promise<void> => {
		await octokit.git.createRef({
			owner: context.repo.owner,
			repo: context.repo.repo,
			ref: refName,
			sha: commit.data.sha,
		});
	};

	/**
	 * @param {string} branchName branch name
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<Response<PullsListResponse>>} pulls
	 */
	private pullsList = async(branchName: string, octokit: GitHub, context: Context): Promise<Response<PullsListResponse>> => {
		return octokit.pulls.list({
			owner: context.repo.owner,
			repo: context.repo.repo,
			head: `${context.repo.owner}:${branchName}`,
		});
	};

	/**
	 * @param {string} branchName branch name
	 * @param {PullsCreateParams} detail detail
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<PullsCreateResponse>} pull
	 */
	public pullsCreate = async(branchName: string, detail: PullsCreateParams, octokit: GitHub, context: Context): Promise<Response<PullsCreateResponse>> => octokit.pulls.create({
		owner: context.repo.owner,
		repo: context.repo.repo,
		head: `${context.repo.owner}:${branchName}`,
		base: (await this.getRefForUpdate(false, octokit, context)).replace(/^heads\//, ''),
		...detail,
	});

	/**
	 * @param {number} number pull number
	 * @param {PullsCreateParams} detail detail
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<PullsUpdateResponse>} pull
	 */
	public pullsUpdate = async(number: number, detail: PullsCreateParams, octokit: GitHub, context: Context): Promise<Response<PullsUpdateResponse>> => octokit.pulls.update({
		owner: context.repo.owner,
		repo: context.repo.repo,
		'pull_number': number,
		base: (await this.getRefForUpdate(false, octokit, context)).replace(/^heads\//, ''),
		state: 'open',
		...detail,
	});

	/**
	 * @param {Error} error error
	 * @return {boolean} result
	 */
	private isProtectedBranchError = (error: Error): boolean => /required status checks?.* (is|are) expected/i.test(error.message);

	/**
	 * @param {string[]} files files
	 * @return {boolean} diff?
	 */
	private checkDiff = (files: string[]): boolean => {
		if (!files.length) {
			this.logger.info('There is no diff.');
			return false;
		}
		return true;
	};

	/**
	 * @param {string} rootDir root dir
	 * @param {string} commitMessage commit message
	 * @param {string[]} files files
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<Response<GitCreateCommitResponse>>} commit
	 */
	private prepareCommit = async(rootDir: string, commitMessage: string, files: string[], octokit: GitHub, context: Context): Promise<Response<GitCreateCommitResponse>> => {
		this.logger.startProcess('Creating blobs...');
		const blobs = await this.filesToBlobs(rootDir, files, octokit, context);

		this.logger.startProcess('Creating tree...');
		const tree = await this.createTree(blobs, octokit, context);

		this.logger.startProcess('Creating commit... [%s]', tree.data.sha);
		return this.createCommit(commitMessage, tree, octokit, context);
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
		if (!this.checkDiff(files)) {
			return false;
		}

		const commit = await this.prepareCommit(rootDir, commitMessage, files, octokit, context);
		const ref = await this.getRefForUpdate(true, octokit, context);

		this.logger.startProcess('Updating ref... [%s] [%s]', ref, commit.data.sha);
		if (await this.updateRef(commit, ref, false, octokit, context)) {
			process.env.GITHUB_SHA = commit.data.sha;
			exportVariable('GITHUB_SHA', commit.data.sha);
		}

		this.logger.endProcess();
		return true;
	};

	/**
	 * @param {string} rootDir root dir
	 * @param {string} commitMessage commit message
	 * @param {string[]} files files
	 * @param {string} createBranchName branch name
	 * @param {PullsCreateParams} detail detail
	 * @param {GitHub} octokit octokit
	 * @param {Context} context context
	 * @return {Promise<boolean|PullsInfo>} result
	 */
	public createPR = async(rootDir: string, commitMessage: string, files: string[], createBranchName: string, detail: PullsCreateParams, octokit: GitHub, context: Context): Promise<boolean | PullsInfo> => {
		if (!this.checkDiff(files)) {
			return false;
		}

		const branchName = createBranchName.replace(/^(refs\/)?heads/, '');
		const headName = `heads/${branchName}`;
		const refName = `refs/${headName}`;

		const commit = await this.prepareCommit(rootDir, commitMessage, files, octokit, context);
		const ref = await this.getRef(headName, octokit, context);
		if (null === ref) {
			this.logger.startProcess('Creating reference... [%s] [%s]', refName, commit.data.sha);
			await this.createRef(commit, refName, octokit, context);
		} else {
			this.logger.startProcess('Updating reference... [%s] [%s]', refName, commit.data.sha);
			await this.updateRef(commit, headName, true, octokit, context);
		}

		const pulls = await this.pullsList(branchName, octokit, context);
		if (pulls.data.length) {
			this.logger.startProcess('Updating PullRequest... [%s] -> [%s]', branchName, await this.getRefForUpdate(false, octokit, context));
			const updated = await this.pullsUpdate(pulls.data[0].number, detail, octokit, context);
			this.logger.endProcess();
			return updated.data;
		} else {
			this.logger.startProcess('Creating PullRequest... [%s] -> [%s]', branchName, await this.getRefForUpdate(false, octokit, context));
			const created = await this.pullsCreate(branchName, detail, octokit, context);
			this.logger.endProcess();
			return created.data;
		}
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
