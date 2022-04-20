import type { Octokit } from './types';
import type { Context } from '@actions/github/lib/context';
import type { components } from '@octokit/openapi-types';
import type { OctokitResponse } from '@octokit/types';
import type { Logger } from '@technote-space/github-action-log-helper';
import fs from 'fs';
import path from 'path';
import { exportVariable } from '@actions/core';
import { getSender } from './context-helper';
import {
  getRefForUpdate,
  isPrRef,
  getBranch,
  trimRef,
  versionCompare,
  generateNewPatchVersion,
  generateNewMajorVersion,
  generateNewMinorVersion,
  ensureNotNull,
  objectGet,
} from './utils';

type GitGetCommitResponseData = components['schemas']['git-commit'];
type PullsGetResponseData = components['schemas']['pull-request'];
type GitCreateTreeResponseData = components['schemas']['git-tree'];
type GitCreateCommitResponseData = components['schemas']['git-commit'];
type GitGetRefResponseData = components['schemas']['git-ref'];
type PullsListResponseData = components['schemas']['pull-request-simple'];
type PullsCreateResponseData = components['schemas']['pull-request'];
type PullsUpdateResponseData = components['schemas']['pull-request'];
type UserResponseData = components['schemas']['public-user'];

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
  id: number;
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

export default class ApiHelper {
  private readonly sender?: string | undefined             = undefined;
  private readonly suppressBPError?: boolean | undefined   = undefined;
  private readonly refForUpdate?: string | undefined       = undefined;
  private prCache: { [key: number]: PullsGetResponseData } = {};

  constructor(
    private readonly octokit: Octokit,
    private readonly context: Context,
    private readonly logger?: Logger,
    options?: { sender?: string; refForUpdate?: string; suppressBPError?: boolean },
  ) {
    this.sender          = options?.sender;
    this.refForUpdate    = options?.refForUpdate;
    this.suppressBPError = options?.suppressBPError;
  }

  private getResponseData = async <T>(response: Promise<OctokitResponse<T>>): Promise<T> => (await response).data;

  private callLogger = (caller: (logger: Logger) => void): void => {
    if (this.logger) {
      caller(this.logger);
    }
  };

  private getSender = (): string | false => this.sender ? this.sender : getSender(this.context);

  public getRefForUpdate = async(encode: boolean): Promise<string> => {
    const ref = this.refForUpdate ? this.refForUpdate : (
      isPrRef(this.context) ? ('heads/' + (await this.getPR()).head.ref) : getRefForUpdate(this.context)
    );
    return encode ? encodeURIComponent(ref) : ref;
  };

  private createBlob = async(rootDir: string, filepath: string): Promise<{ path: string; sha: string }> => {
    const blob = await this.octokit.rest.git.createBlob({
      ...this.context.repo,
      content: Buffer.from(fs.readFileSync(path.resolve(rootDir, filepath), 'utf8')).toString('base64'),
      encoding: 'base64',
    });

    return {
      path: filepath,
      sha: blob.data.sha,
    };
  };

  private getCommitSha = (): string => this.context.payload.pull_request ? this.context.payload.pull_request.head.sha : this.context.sha;

  private getCommit = async(): Promise<GitGetCommitResponseData> => this.getResponseData(this.octokit.rest.git.getCommit({
    ...this.context.repo,
    'commit_sha': this.getCommitSha(),
  }));

  private getPR = async(): Promise<PullsGetResponseData> => {
    const key = parseInt(this.context.payload.number, 10);
    if (!(key in this.prCache)) {
      this.prCache[key] = await this.getResponseData(this.octokit.rest.pulls.get({
        ...this.context.repo,
        'pull_number': this.context.payload.number,
      }));
    }

    return this.prCache[key];
  };

  public filesToBlobs = async(rootDir: string, files: Array<string>): Promise<Array<{ path: string; sha: string }>> => await Promise.all(files.map(file => this.createBlob(rootDir, file)));

  public createTree = async(blobs: Array<{ path: string; sha: string }>): Promise<GitCreateTreeResponseData> => this.getResponseData(this.octokit.rest.git.createTree({
    ...this.context.repo,
    'base_tree': ensureNotNull(objectGet((await this.getCommit()), 'tree.sha')),
    tree: blobs.map(blob => ({
      path: blob.path,
      type: 'blob',
      mode: '100644',
      sha: blob.sha,
    })),
  }));

  public createCommit = async(commitMessage: string, tree: GitCreateTreeResponseData): Promise<GitCreateCommitResponseData> => this.getResponseData(this.octokit.rest.git.createCommit({
    ...this.context.repo,
    tree: tree.sha,
    parents: [this.getCommitSha()],
    message: commitMessage,
  }));

  private getRef = async(refName: string): Promise<GitGetRefResponseData | null> => {
    try {
      return await this.getResponseData(this.octokit.rest.git.getRef({
        ...this.context.repo,
        ref: refName,
      }));
    } catch (error) {
      return null;
    }
  };

  public updateRef = async(commit: GitCreateCommitResponseData, refName: string, force: boolean): Promise<boolean> => {
    try {
      await this.octokit.rest.git.updateRef({
        ...this.context.repo,
        ref: refName,
        sha: ensureNotNull(commit.sha),
        force,
      });

      return true;
    } catch (error) {
      if (this.suppressBPError === true && this.isProtectedBranchError(error as Error)) {
        this.callLogger(logger => logger.warn('Branch is protected.'));
      } else {
        throw error;
      }

      return false;
    }
  };

  public createRef = async(commit: GitCreateCommitResponseData, refName: string): Promise<void> => {
    await this.octokit.rest.git.createRef({
      ...this.context.repo,
      ref: refName,
      sha: ensureNotNull(commit.sha),
    });
  };

  public deleteRef = async(refName: string): Promise<void> => {
    await this.octokit.rest.git.deleteRef({
      ...this.context.repo,
      ref: refName,
    });
  };

  public findPullRequest = async(branchName: string): Promise<PullsListResponseData | null> => {
    const response = await this.octokit.rest.pulls.list({
      ...this.context.repo,
      head: `${this.context.repo.owner}:${getBranch(branchName, false)}`,
    });
    if (response.data.length) {
      return response.data[0];
    }

    return null;
  };

  public pullsList = (params: PullsListParams): Promise<Array<PullsListResponseData>> => this.octokit.paginate(
    this.octokit.rest.pulls.list,
    Object.assign({
      sort: 'created',
      direction: 'asc',
    }, params, {
      ...this.context.repo,
    }),
  );

  public pullsCreate = async(branchName: string, detail: PullsCreateParams): Promise<PullsCreateResponseData> => this.getResponseData(this.octokit.rest.pulls.create({
    ...this.context.repo,
    head: `${this.context.repo.owner}:${getBranch(branchName, false)}`,
    base: (await this.getRefForUpdate(false)).replace(/^heads\//, ''),
    ...detail,
  }));

  public pullsUpdate = async(number: number, detail: PullsUpdateParams): Promise<PullsUpdateResponseData> => this.getResponseData(this.octokit.rest.pulls.update({
    ...this.context.repo,
    'pull_number': number,
    state: 'open',
    ...detail,
  }));

  public getBranchInfo = (branch: string): { branchName: string; headName: string; refName: string } => {
    const branchName = getBranch(branch, false);
    const headName   = `heads/${branchName}`;
    const refName    = `refs/${headName}`;
    return { branchName, headName, refName };
  };

  private createPulls = async(createBranchName: string, detail: PullsCreateParams): Promise<PullsInfo> => {
    this.callLogger(async logger => logger.startProcess('Creating PullRequest... [%s] -> [%s]', getBranch(createBranchName, false), await this.getRefForUpdate(false)));
    const created = await this.pullsCreate(createBranchName, detail);
    this.callLogger(logger => logger.endProcess());
    return Object.assign({ isPrCreated: true }, created);
  };

  public pullsCreateOrUpdate = async(createBranchName: string, detail: PullsCreateParams): Promise<PullsInfo> => {
    const pullRequest = await this.findPullRequest(createBranchName);
    if (pullRequest) {
      this.callLogger(async logger => logger.startProcess('Updating PullRequest... [%s] -> [%s]', getBranch(createBranchName, false), await this.getRefForUpdate(false)));
      const updated = await this.pullsUpdate(pullRequest.number, detail);
      this.callLogger(logger => logger.endProcess());
      return Object.assign({ isPrCreated: false }, updated);
    }

    return this.createPulls(createBranchName, detail);
  };

  public pullsCreateOrComment = async(createBranchName: string, detail: PullsCreateParams): Promise<PullsInfo> => {
    const pullRequest = await this.findPullRequest(createBranchName);
    if (pullRequest) {
      this.callLogger(async logger => logger.startProcess('Creating comment to PullRequest... [%s] -> [%s]', getBranch(createBranchName, false), await this.getRefForUpdate(false)));
      await this.createCommentToPr(createBranchName, detail.body);
      this.callLogger(logger => logger.endProcess());
      return Object.assign({ isPrCreated: false }, pullRequest);
    }

    return this.createPulls(createBranchName, detail);
  };

  public createCommentToPr = async(branch: string, body: string | undefined): Promise<boolean> => {
    if (!body) {
      return false;
    }

    const pullRequest = await this.findPullRequest(branch);
    if (!pullRequest) {
      return false;
    }

    await this.octokit.rest.issues.createComment({
      ...this.context.repo,
      'issue_number': pullRequest.number,
      body,
    });

    return true;
  };

  private isProtectedBranchError = (error: Error): boolean => /required status checks?.* (is|are) expected/i.test(error.message);

  private checkDiff = (files: Array<string>): boolean => {
    if (!files.length) {
      this.callLogger(logger => logger.info('There is no diff.'));
      return false;
    }

    return true;
  };

  private prepareCommit = async(rootDir: string, commitMessage: string, files: Array<string>): Promise<GitCreateCommitResponseData> => {
    this.callLogger(logger => logger.startProcess('Creating blobs...'));
    const blobs = await this.filesToBlobs(rootDir, files);

    this.callLogger(logger => logger.startProcess('Creating tree...'));
    const tree = await this.createTree(blobs);

    this.callLogger(logger => logger.startProcess('Creating commit... [%s]', tree.sha));
    return this.createCommit(commitMessage, tree);
  };

  public commit = async(rootDir: string, commitMessage: string, files: Array<string>): Promise<boolean> => {
    if (!this.checkDiff(files)) {
      return false;
    }

    const commit = await this.prepareCommit(rootDir, commitMessage, files);
    const ref    = await this.getRefForUpdate(false);

    this.callLogger(logger => logger.startProcess('Updating ref... [%s] [%s]', ref, commit.sha));
    if (await this.updateRef(commit, ref, false)) {
      process.env.GITHUB_SHA = commit.sha;
      exportVariable('GITHUB_SHA', commit.sha);
    }

    this.callLogger(logger => logger.endProcess());
    return true;
  };

  public createPR = async(rootDir: string, commitMessage: string, files: Array<string>, createBranchName: string, detail: PullsCreateParams): Promise<boolean | PullsInfo> => {
    if (!this.checkDiff(files)) {
      return false;
    }

    const { branchName, headName, refName } = this.getBranchInfo(createBranchName);
    const commit                            = await this.prepareCommit(rootDir, commitMessage, files);
    const ref                               = await this.getRef(headName);
    if (null === ref) {
      this.callLogger(logger => logger.startProcess('Creating reference... [%s] [%s]', refName, commit.sha));
      await this.createRef(commit, refName);
    } else {
      this.callLogger(logger => logger.startProcess('Updating reference... [%s] [%s]', refName, commit.sha));
      await this.updateRef(commit, headName, true);
    }

    return this.pullsCreateOrUpdate(branchName, detail);
  };

  public closePR = async(createBranchName: string, message?: string): Promise<void> => {
    const { branchName, headName, refName } = this.getBranchInfo(createBranchName);
    const pullRequest                       = await this.findPullRequest(branchName);
    if (pullRequest) {
      this.callLogger(logger => logger.startProcess('Closing PullRequest... [%s]', branchName));
      if (message) {
        await this.createCommentToPr(branchName, message);
      }

      await this.pullsUpdate(pullRequest.number, {
        state: 'closed',
      });
    } else {
      this.callLogger(logger => logger.info('There is no PullRequest named [%s]', branchName));

      const ref = await this.getRef(headName);
      if (!ref) {
        this.callLogger(logger => logger.info('There is no reference named [%s]', refName));
        return;
      }
    }

    this.callLogger(logger => logger.startProcess('Deleting reference... [%s]', refName));
    await this.deleteRef(headName);
    this.callLogger(logger => logger.endProcess());
  };

  public getUser = async(): Promise<{ login: string; email: string; name: string; id: number }> => {
    const sender = this.getSender();
    if (false === sender) {
      throw new Error('Sender is not valid.');
    }

    const { data } = await this.octokit.rest.users.getByUsername({
      username: sender,
    });
    const user     = data as UserResponseData;

    return {
      login: user.login,
      email: ensureNotNull(user.email),
      name: ensureNotNull(user.name),
      id: user.id,
    };
  };

  public getDefaultBranch = async(): Promise<string> => this.context.payload.repository?.default_branch ?? (await this.octokit.rest.repos.get({ // eslint-disable-line camelcase
    ...this.context.repo,
  })).data.default_branch;

  public getTags = async(): Promise<Array<string>> => (await this.octokit.paginate(
    this.octokit.rest.git.listMatchingRefs,
    {
      ...this.context.repo,
      ref: 'tags/',
    },
  )).map((item): string => trimRef(item.ref));

  public getLastTag = async(): Promise<string> => 'v' + ((await this.getTags()).filter(tag => /^v?\d+(\.\d+)*$/.test(tag)).sort(versionCompare).reverse()[0]?.replace(/^v/, '') ?? '0.0.0');

  public getNewPatchVersion = async(): Promise<string> => generateNewPatchVersion(await this.getLastTag());

  public getNewMinorVersion = async(): Promise<string> => generateNewMinorVersion(await this.getLastTag());

  public getNewMajorVersion = async(): Promise<string> => generateNewMajorVersion(await this.getLastTag());
}
