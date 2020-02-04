import fs from 'fs';
import path from 'path';
import { Context } from '@actions/github/lib/context';
import { Octokit } from '@octokit/rest';
import { exportVariable } from '@actions/core';
import { Logger } from './index';
import { getRefForUpdate, isPrRef, getBranch } from './utils';
import { getSender } from './context-helper';

type PullsUpdateParams = {
	body?: string;
	draft?: boolean;
	state?: 'open' | 'closed' | undefined;
	title?: string;
	base?: string;
};

type PullsCreateParams = PullsUpdateParams & {
	title: string;
};

type PullsInfo = {
	'html_url': string;
	'commits_url': string;
	'comments_url': string;
	number: number;
	isPrCreated: boolean;
};

type PullsListParams = {
	base?: string;
	direction?: 'asc' | 'desc';
	head?: string;
	sort?: 'created' | 'updated' | 'popularity' | 'long-running';
	state?: 'open' | 'closed' | 'all';
}

/**
 * API Helper
 */
export default class ApiHelper {

	private readonly branch?: string | undefined                   = undefined;
	private readonly sender?: string | undefined                   = undefined;
	private readonly suppressBPError?: boolean | undefined         = undefined;
	private readonly refForUpdate?: string | undefined             = undefined;
	private prCache: { [key: number]: Octokit.Response<Octokit.PullsGetResponse> } = {};

	/**
	 * @param {Octokit} octokit octokit
	 * @param {Context} context context
	 * @param {Logger} logger logger
	 * @param {object} options options
	 * @param {string|undefined} options.branch branch
	 * @param {string|undefined} options.sender sender
	 * @param {string|undefined} options.refForUpdate ref for update
	 * @param {boolean|undefined} options.suppressBPError suppress branch protection error?
	 */
	constructor(
		private readonly octokit: Octokit,
		private readonly context: Context,
		private readonly logger: Logger,
		options?: { branch?: string; sender?: string; refForUpdate?: string; suppressBPError?: boolean },
	) {
		this.branch          = options?.branch;
		this.sender          = options?.sender;
		this.refForUpdate    = options?.refForUpdate;
		this.suppressBPError = options?.suppressBPError;
	}

	/**
	 * @return {string|boolean} sender
	 */
	private getSender = (): string | false => this.sender ? this.sender : getSender(this.context);

	/**
	 * @param {boolean} encode encode?
	 * @return {string} ref for update
	 */
	public getRefForUpdate = async(encode: boolean): Promise<string> => {
		const ref = this.refForUpdate ? this.refForUpdate : (
			isPrRef(this.context) ? ('heads/' + (await this.getPR()).data.head.ref) : getRefForUpdate(this.context)
		);
		return encode ? encodeURIComponent(ref) : ref;
	};

	/**
	 * @param {string} rootDir root dir
	 * @param {string} filepath filepath
	 * @return {Promise<{ path: string, sha: string }>} blob
	 */
	private createBlob = async(rootDir: string, filepath: string): Promise<{ path: string; sha: string }> => {
		const blob = await this.octokit.git.createBlob({
			owner: this.context.repo.owner,
			repo: this.context.repo.repo,
			content: Buffer.from(fs.readFileSync(path.resolve(rootDir, filepath), 'utf8')).toString('base64'),
			encoding: 'base64',
		});

		return {
			path: filepath,
			sha: blob.data.sha,
		};
	};

	/**
	 * @return {string} commit sha
	 */
	private getCommitSha = (): string => isPrRef(this.context) && this.context.payload.pull_request ? this.context.payload.pull_request.head.sha : this.context.sha;

	/**
	 * @return {Promise<Octokit.Response<Octokit.GitGetCommitResponse>>} commit
	 */
	private getCommit = async(): Promise<Octokit.Response<Octokit.GitGetCommitResponse>> => this.octokit.git.getCommit({
		owner: this.context.repo.owner,
		repo: this.context.repo.repo,
		'commit_sha': this.getCommitSha(),
	});

	/**
	 * @return {Promise<Octokit.Response<Octokit.PullsGetResponse>>} commit
	 */
	private getPR = async(): Promise<Octokit.Response<Octokit.PullsGetResponse>> => {
		const key = parseInt(this.context.payload.number, 10);
		if (!(key in this.prCache)) {
			this.prCache[key] = await this.octokit.pulls.get({
				owner: this.context.repo.owner,
				repo: this.context.repo.repo,
				'pull_number': this.context.payload.number,
			});
		}

		return this.prCache[key];
	};

	/**
	 * @param {string} rootDir root dir
	 * @param {object} files files
	 * @return {Promise<{ path: string, sha: string }[]>} blobs
	 */
	public filesToBlobs = async(rootDir: string, files: object): Promise<{ path: string; sha: string }[]> => await Promise.all(Object.values(files).map(file => this.createBlob(rootDir, file)));

	/**
	 * @param {{ path: string, sha: string }[]} blobs blobs
	 * @return {Promise<Octokit.Response<Octokit.GitCreateTreeResponse>>} tree
	 */
	public createTree = async(blobs: { path: string; sha: string }[]): Promise<Octokit.Response<Octokit.GitCreateTreeResponse>> => this.octokit.git.createTree({
		owner: this.context.repo.owner,
		repo: this.context.repo.repo,
		'base_tree': (await this.getCommit()).data.tree.sha,
		tree: Object.values(blobs).map(blob => ({
			path: blob.path,
			type: 'blob',
			mode: '100644',
			sha: blob.sha,
		})),
	});

	/**
	 * @param {string} commitMessage commit message
	 * @param {Octokit.Response<Octokit.GitCreateTreeResponse>} tree tree
	 * @return {Promise<Octokit.Response<Octokit.GitCreateCommitResponse>>} commit
	 */
	public createCommit = async(commitMessage: string, tree: Octokit.Response<Octokit.GitCreateTreeResponse>): Promise<Octokit.Response<Octokit.GitCreateCommitResponse>> => this.octokit.git.createCommit({
		owner: this.context.repo.owner,
		repo: this.context.repo.repo,
		tree: tree.data.sha,
		parents: [this.getCommitSha()],
		message: commitMessage,
	});

	/**
	 * @param {string} refName refName
	 * @return {Promise<Octokit.AnyResponse|null>} refName
	 */
	private getRef = async(refName: string): Promise<Octokit.AnyResponse | null> => {
		try {
			return await this.octokit.git.getRef({
				owner: this.context.repo.owner,
				repo: this.context.repo.repo,
				ref: refName,
			});
		} catch (error) {
			return null;
		}
	};

	/**
	 * @param {Octokit.Response<Octokit.GitCreateCommitResponse>} commit commit
	 * @param {string} refName refName
	 * @param {boolean} force force
	 * @return {Promise<void>} void
	 */
	public updateRef = async(commit: Octokit.Response<Octokit.GitCreateCommitResponse>, refName: string, force: boolean): Promise<boolean> => {
		try {
			await this.octokit.git.updateRef({
				owner: this.context.repo.owner,
				repo: this.context.repo.repo,
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
	 * @param {Octokit.Response<Octokit.GitCreateCommitResponse>} commit commit
	 * @param {string} refName refName
	 * @return {Promise<void>} void
	 */
	public createRef = async(commit: Octokit.Response<Octokit.GitCreateCommitResponse>, refName: string): Promise<void> => {
		await this.octokit.git.createRef({
			owner: this.context.repo.owner,
			repo: this.context.repo.repo,
			ref: refName,
			sha: commit.data.sha,
		});
	};

	/**
	 * @param {string} refName refName
	 * @return {Promise<void>} void
	 */
	public deleteRef = async(refName: string): Promise<void> => {
		await this.octokit.git.deleteRef({
			owner: this.context.repo.owner,
			repo: this.context.repo.repo,
			ref: refName,
		});
	};

	/**
	 * @param {string} branchName branch name
	 * @return {Promise<Octokit.PullsListResponseItem>} pull request
	 */
	public findPullRequest = async(branchName: string): Promise<Octokit.PullsListResponseItem | null> => {
		const response = await this.octokit.pulls.list({
			owner: this.context.repo.owner,
			repo: this.context.repo.repo,
			head: `${this.context.repo.owner}:${getBranch(branchName, false)}`,
		});
		if (response.data.length) {
			return response.data[0];
		}

		return null;
	};

	/**
	 * @param {PullsListParams} params params
	 * @return {AsyncIterable<Octokit.PullsListResponseItem>} pull request list
	 */
	public async* pullsList(params: PullsListParams): AsyncIterable<Octokit.PullsListResponseItem> {
		const perPage = 100;
		let page      = 1;
		while (true) {
			const list = await this.octokit.pulls.list(Object.assign({
				sort: 'created',
				direction: 'asc',
			}, params, {
				owner: this.context.repo.owner,
				repo: this.context.repo.repo,
				'per_page': perPage,
				page: page++,
			}));
			if (!list.data.length) {
				break;
			}

			yield* list.data;
		}
	}

	/**
	 * @param {string} branchName branch name
	 * @param {PullsCreateParams} detail detail
	 * @return {Promise<Octokit.Response<Octokit.PullsCreateResponse>>} pull
	 */
	public pullsCreate = async(branchName: string, detail: PullsCreateParams): Promise<Octokit.Response<Octokit.PullsCreateResponse>> => this.octokit.pulls.create({
		owner: this.context.repo.owner,
		repo: this.context.repo.repo,
		head: `${this.context.repo.owner}:${getBranch(branchName, false)}`,
		base: (await this.getRefForUpdate(false)).replace(/^heads\//, ''),
		...detail,
	});

	/**
	 * @param {number} number pull number
	 * @param {PullsUpdateParams} detail detail
	 * @return {Promise<Octokit.Response<Octokit.PullsUpdateResponse>>} pull
	 */
	public pullsUpdate = async(number: number, detail: PullsUpdateParams): Promise<Octokit.Response<Octokit.PullsUpdateResponse>> => this.octokit.pulls.update({
		owner: this.context.repo.owner,
		repo: this.context.repo.repo,
		'pull_number': number,
		base: (await this.getRefForUpdate(false)).replace(/^heads\//, ''),
		state: 'open',
		...detail,
	});

	/**
	 * @param {string} branch branch
	 * @return {object} branch info
	 */
	public getBranchInfo = (branch: string): { branchName: string; headName: string; refName: string } => {
		const branchName = getBranch(branch, false);
		const headName   = `heads/${branchName}`;
		const refName    = `refs/${headName}`;
		return {branchName, headName, refName};
	};

	/**
	 * @param {string} createBranchName branch name
	 * @param {PullsCreateParams} detail detail
	 * @return {Promise<PullsInfo>} info
	 */
	public pullsCreateOrUpdate = async(createBranchName: string, detail: PullsCreateParams): Promise<PullsInfo> => {
		const pullRequest = await this.findPullRequest(createBranchName);
		if (pullRequest) {
			this.logger.startProcess('Updating PullRequest... [%s] -> [%s]', getBranch(createBranchName, false), await this.getRefForUpdate(false));
			const updated = await this.pullsUpdate(pullRequest.number, detail);
			this.logger.endProcess();
			return Object.assign({isPrCreated: false}, updated.data);
		} else {
			this.logger.startProcess('Creating PullRequest... [%s] -> [%s]', getBranch(createBranchName, false), await this.getRefForUpdate(false));
			const created = await this.pullsCreate(createBranchName, detail);
			this.logger.endProcess();
			return Object.assign({isPrCreated: true}, created.data);
		}
	};

	/**
	 * @param {string} createBranchName branch name
	 * @param {PullsCreateParams} detail detail
	 * @return {Promise<PullsInfo>} info
	 */
	public pullsCreateOrComment = async(createBranchName: string, detail: PullsCreateParams): Promise<PullsInfo> => {
		const pullRequest = await this.findPullRequest(createBranchName);
		if (pullRequest) {
			this.logger.startProcess('Creating comment to PullRequest... [%s] -> [%s]', getBranch(createBranchName, false), await this.getRefForUpdate(false));
			await this.createCommentToPr(createBranchName, detail.body);
			this.logger.endProcess();
			return Object.assign({isPrCreated: false}, pullRequest);
		} else {
			this.logger.startProcess('Creating PullRequest... [%s] -> [%s]', getBranch(createBranchName, false), await this.getRefForUpdate(false));
			const created = await this.pullsCreate(createBranchName, detail);
			this.logger.endProcess();
			return Object.assign({isPrCreated: true}, created.data);
		}
	};

	/**
	 * @param {string} branch branch
	 * @param {string} body body
	 * @return {Promise<boolean>} result
	 */
	public createCommentToPr = async(branch: string, body: string | undefined): Promise<boolean> => {
		if (!body) {
			return false;
		}

		const pullRequest = await this.findPullRequest(branch);
		if (!pullRequest) {
			return false;
		}

		await this.octokit.issues.createComment({
			owner: this.context.repo.owner,
			repo: this.context.repo.repo,
			'issue_number': pullRequest.number,
			body,
		});

		return true;
	};

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
	 * @return {Promise<Octokit.Response<Octokit.GitCreateCommitResponse>>} commit
	 */
	private prepareCommit = async(rootDir: string, commitMessage: string, files: string[]): Promise<Octokit.Response<Octokit.GitCreateCommitResponse>> => {
		this.logger.startProcess('Creating blobs...');
		const blobs = await this.filesToBlobs(rootDir, files);

		this.logger.startProcess('Creating tree...');
		const tree = await this.createTree(blobs);

		this.logger.startProcess('Creating commit... [%s]', tree.data.sha);
		return this.createCommit(commitMessage, tree);
	};

	/**
	 * @param {string} rootDir root dir
	 * @param {string} commitMessage commit message
	 * @param {string[]} files files
	 * @return {Promise<boolean>} result
	 */
	public commit = async(rootDir: string, commitMessage: string, files: string[]): Promise<boolean> => {
		if (!this.checkDiff(files)) {
			return false;
		}

		const commit = await this.prepareCommit(rootDir, commitMessage, files);
		const ref    = await this.getRefForUpdate(true);

		this.logger.startProcess('Updating ref... [%s] [%s]', ref, commit.data.sha);
		if (await this.updateRef(commit, ref, false)) {
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
	 * @return {Promise<boolean|PullsInfo>} result
	 */
	public createPR = async(rootDir: string, commitMessage: string, files: string[], createBranchName: string, detail: PullsCreateParams): Promise<boolean | PullsInfo> => {
		if (!this.checkDiff(files)) {
			return false;
		}

		const {branchName, headName, refName} = this.getBranchInfo(createBranchName);
		const commit                          = await this.prepareCommit(rootDir, commitMessage, files);
		const ref                             = await this.getRef(headName);
		if (null === ref) {
			this.logger.startProcess('Creating reference... [%s] [%s]', refName, commit.data.sha);
			await this.createRef(commit, refName);
		} else {
			this.logger.startProcess('Updating reference... [%s] [%s]', refName, commit.data.sha);
			await this.updateRef(commit, headName, true);
		}

		return this.pullsCreateOrUpdate(branchName, detail);
	};

	/**
	 * @param {string} createBranchName branch name
	 * @param {string} message message
	 */
	public closePR = async(createBranchName: string, message?: string): Promise<void> => {
		const {branchName, headName, refName} = this.getBranchInfo(createBranchName);
		const pullRequest                     = await this.findPullRequest(branchName);
		if (pullRequest) {
			this.logger.startProcess('Closing PullRequest... [%s]', branchName);
			if (message) {
				await this.createCommentToPr(branchName, message);
			}

			await this.pullsUpdate(pullRequest.number, {
				state: 'closed',
				base: undefined,
			});
		} else {
			this.logger.info('There is no PullRequest named [%s]', branchName);

			const ref = await this.getRef(headName);
			if (!ref) {
				this.logger.info('There is no reference named [%s]', refName);
				return;
			}
		}

		this.logger.startProcess('Deleting reference... [%s]', refName);
		await this.deleteRef(headName);
		this.logger.endProcess();
	};

	/**
	 * @return {Promise<{ login: string, email: string, name: string, id: number }>} user
	 */
	public getUser = async(): Promise<{ login: string; email: string; name: string; id: number }> => {
		const sender = this.getSender();
		if (false === sender) {
			throw new Error('Sender is not valid.');
		}

		const {data: user} = await this.octokit.users.getByUsername({
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
