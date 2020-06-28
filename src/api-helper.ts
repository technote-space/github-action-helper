import fs from 'fs';
import path from 'path';
import {Context} from '@actions/github/lib/context';
import {PaginateInterface} from '@octokit/plugin-paginate-rest';
import {RestEndpointMethods} from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types';
import {
  OctokitResponse,
  GitGetCommitResponseData,
  PullsGetResponseData,
  GitCreateTreeResponseData,
  GitCreateCommitResponseData,
  GitGetRefResponseData,
  PullsListResponseData,
  PullsCreateResponseData,
  PullsUpdateResponseData,
  GitListMatchingRefsResponseData,
} from '@octokit/types';
import {exportVariable} from '@actions/core';
import {Logger} from './index';
import {getRefForUpdate, isPrRef, getBranch, trimRef, versionCompare, generateNewPatchVersion, generateNewMajorVersion, generateNewMinorVersion} from './utils';
import {getSender} from './context-helper';
import {Octokit} from './types';

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

/**
 * API Helper
 */
export default class ApiHelper {

  private readonly branch?: string | undefined             = undefined;
  private readonly sender?: string | undefined             = undefined;
  private readonly suppressBPError?: boolean | undefined   = undefined;
  private readonly refForUpdate?: string | undefined       = undefined;
  private prCache: { [key: number]: PullsGetResponseData } = {};

  /**
   * @param {RestEndpointMethods} octokit octokit
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
    private readonly logger?: Logger,
    options?: { branch?: string; sender?: string; refForUpdate?: string; suppressBPError?: boolean },
  ) {
    this.branch          = options?.branch;
    this.sender          = options?.sender;
    this.refForUpdate    = options?.refForUpdate;
    this.suppressBPError = options?.suppressBPError;
  }

  /**
   * @param {OctokitResponse} response response
   * @return {any} data
   */
  private getResponseData = async <T>(response: Promise<OctokitResponse<T>>): Promise<T> => (await response).data;

  /**
   * @param {function} caller caller
   */
  private callLogger = (caller: (logger: Logger) => void): void => {
    if (this.logger) {
      caller(this.logger);
    }
  };

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
      isPrRef(this.context) ? ('heads/' + (await this.getPR()).head.ref) : getRefForUpdate(this.context)
    );
    return encode ? encodeURIComponent(ref) : ref;
  };

  /**
   * @param {string} rootDir root dir
   * @param {string} filepath filepath
   * @return {Promise<{ path: string, sha: string }>} blob
   */
  private createBlob = async(rootDir: string, filepath: string): Promise<{ path: string; sha: string }> => {
    const blob = await (this.octokit as RestEndpointMethods).git.createBlob({
      ...this.context.repo,
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
   * @return {Promise<GitGetCommitResponseData>} commit
   */
  private getCommit = async(): Promise<GitGetCommitResponseData> => this.getResponseData((this.octokit as RestEndpointMethods).git.getCommit({
    ...this.context.repo,
    'commit_sha': this.getCommitSha(),
  }));

  /**
   * @return {Promise<PullsGetResponseData>} commit
   */
  private getPR = async(): Promise<PullsGetResponseData> => {
    const key = parseInt(this.context.payload.number, 10);
    if (!(key in this.prCache)) {
      this.prCache[key] = await this.getResponseData((this.octokit as RestEndpointMethods).pulls.get({
        ...this.context.repo,
        'pull_number': this.context.payload.number,
      }));
    }

    return this.prCache[key];
  };

  /**
   * @param {string} rootDir root dir
   * @param {object} files files
   * @return {Promise<{ path: string, sha: string }[]>} blobs
   */
  public filesToBlobs = async(rootDir: string, files: Array<string>): Promise<{ path: string; sha: string }[]> => await Promise.all(Object.values(files).map(file => this.createBlob(rootDir, file)));

  /**
   * @param {{ path: string, sha: string }[]} blobs blobs
   * @return {Promise<GitCreateTreeResponseData>} tree
   */
  public createTree = async(blobs: { path: string; sha: string }[]): Promise<GitCreateTreeResponseData> => this.getResponseData((this.octokit as RestEndpointMethods).git.createTree({
    ...this.context.repo,
    'base_tree': (await this.getCommit()).tree.sha,
    tree: Object.values(blobs).map(blob => ({
      path: blob.path,
      type: 'blob',
      mode: '100644',
      sha: blob.sha,
    })),
  }));

  /**
   * @param {string} commitMessage commit message
   * @param {GitCreateTreeResponseData} tree tree
   * @return {Promise<GitCreateCommitResponseData>} commit
   */
  public createCommit = async(commitMessage: string, tree: GitCreateTreeResponseData): Promise<GitCreateCommitResponseData> => this.getResponseData((this.octokit as RestEndpointMethods).git.createCommit({
    ...this.context.repo,
    tree: tree.sha,
    parents: [this.getCommitSha()],
    message: commitMessage,
  }));

  /**
   * @param {string} refName refName
   * @return {Promise<GitGetRefResponseData|null>} refName
   */
  private getRef = async(refName: string): Promise<GitGetRefResponseData | null> => {
    try {
      return await this.getResponseData((this.octokit as RestEndpointMethods).git.getRef({
        ...this.context.repo,
        ref: refName,
      }));
    } catch (error) {
      return null;
    }
  };

  /**
   * @param {GitCreateCommitResponseData} commit commit
   * @param {string} refName refName
   * @param {boolean} force force
   * @return {Promise<boolean>} updated?
   */
  public updateRef = async(commit: GitCreateCommitResponseData, refName: string, force: boolean): Promise<boolean> => {
    try {
      await (this.octokit as RestEndpointMethods).git.updateRef({
        ...this.context.repo,
        ref: refName,
        sha: commit.sha,
        force,
      });

      return true;
    } catch (error) {
      if (this.suppressBPError === true && this.isProtectedBranchError(error)) {
        this.callLogger(logger => logger.warn('Branch is protected.'));
      } else {
        throw error;
      }

      return false;
    }
  };

  /**
   * @param {GitCreateCommitResponseData} commit commit
   * @param {string} refName refName
   * @return {Promise<void>} void
   */
  public createRef = async(commit: GitCreateCommitResponseData, refName: string): Promise<void> => {
    await (this.octokit as RestEndpointMethods).git.createRef({
      ...this.context.repo,
      ref: refName,
      sha: commit.sha,
    });
  };

  /**
   * @param {string} refName refName
   * @return {Promise<void>} void
   */
  public deleteRef = async(refName: string): Promise<void> => {
    await (this.octokit as RestEndpointMethods).git.deleteRef({
      ...this.context.repo,
      ref: refName,
    });
  };

  /**
   * @param {string} branchName branch name
   * @return {Promise<PullsListResponseData | null>} pull request
   */
  public findPullRequest = async(branchName: string): Promise<PullsListResponseData[number] | null> => {
    const response = await (this.octokit as RestEndpointMethods).pulls.list({
      ...this.context.repo,
      head: `${this.context.repo.owner}:${getBranch(branchName, false)}`,
    });
    if (response.data.length) {
      return response.data[0];
    }

    return null;
  };

  /**
   * @param {PullsListParams} params params
   * @return {AsyncIterable<PullsListResponseData>} pull request list
   */
  public pullsList = (params: PullsListParams): Promise<PullsListResponseData> => (this.octokit.paginate as PaginateInterface)(
    (this.octokit as RestEndpointMethods).pulls.list,
    Object.assign({
      sort: 'created',
      direction: 'asc',
    }, params, {
      ...this.context.repo,
    }),
  );

  /**
   * @param {string} branchName branch name
   * @param {PullsCreateParams} detail detail
   * @return {Promise<PullsCreateResponseData>} pull
   */
  public pullsCreate = async(branchName: string, detail: PullsCreateParams): Promise<PullsCreateResponseData> => this.getResponseData((this.octokit as RestEndpointMethods).pulls.create({
    ...this.context.repo,
    head: `${this.context.repo.owner}:${getBranch(branchName, false)}`,
    base: (await this.getRefForUpdate(false)).replace(/^heads\//, ''),
    ...detail,
  }));

  /**
   * @param {number} number pull number
   * @param {PullsUpdateParams} detail detail
   * @return {Promise<PullsUpdateResponseData>} pull
   */
  public pullsUpdate = async(number: number, detail: PullsUpdateParams): Promise<PullsUpdateResponseData> => this.getResponseData((this.octokit as RestEndpointMethods).pulls.update({
    ...this.context.repo,
    'pull_number': number,
    base: (await this.getRefForUpdate(false)).replace(/^heads\//, ''),
    state: 'open',
    ...detail,
  }));

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
  private createPulls = async(createBranchName: string, detail: PullsCreateParams): Promise<PullsInfo> => {
    this.callLogger(async logger => logger.startProcess('Creating PullRequest... [%s] -> [%s]', getBranch(createBranchName, false), await this.getRefForUpdate(false)));
    const created = await this.pullsCreate(createBranchName, detail);
    this.callLogger(logger => logger.endProcess());
    return Object.assign({isPrCreated: true}, created);
  };

  /**
   * @param {string} createBranchName branch name
   * @param {PullsCreateParams} detail detail
   * @return {Promise<PullsInfo>} info
   */
  public pullsCreateOrUpdate = async(createBranchName: string, detail: PullsCreateParams): Promise<PullsInfo> => {
    const pullRequest = await this.findPullRequest(createBranchName);
    if (pullRequest) {
      this.callLogger(async logger => logger.startProcess('Updating PullRequest... [%s] -> [%s]', getBranch(createBranchName, false), await this.getRefForUpdate(false)));
      const updated = await this.pullsUpdate(pullRequest.number, detail);
      this.callLogger(logger => logger.endProcess());
      return Object.assign({isPrCreated: false}, updated);
    }

    return this.createPulls(createBranchName, detail);
  };

  /**
   * @param {string} createBranchName branch name
   * @param {PullsCreateParams} detail detail
   * @return {Promise<PullsInfo>} info
   */
  public pullsCreateOrComment = async(createBranchName: string, detail: PullsCreateParams): Promise<PullsInfo> => {
    const pullRequest = await this.findPullRequest(createBranchName);
    if (pullRequest) {
      this.callLogger(async logger => logger.startProcess('Creating comment to PullRequest... [%s] -> [%s]', getBranch(createBranchName, false), await this.getRefForUpdate(false)));
      await this.createCommentToPr(createBranchName, detail.body);
      this.callLogger(logger => logger.endProcess());
      return Object.assign({isPrCreated: false}, pullRequest);
    }

    return this.createPulls(createBranchName, detail);
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

    await (this.octokit as RestEndpointMethods).issues.createComment({
      ...this.context.repo,
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
      this.callLogger(logger => logger.info('There is no diff.'));
      return false;
    }

    return true;
  };

  /**
   * @param {string} rootDir root dir
   * @param {string} commitMessage commit message
   * @param {string[]} files files
   * @return {Promise<GitCreateCommitResponseData>} commit
   */
  private prepareCommit = async(rootDir: string, commitMessage: string, files: string[]): Promise<GitCreateCommitResponseData> => {
    this.callLogger(logger => logger.startProcess('Creating blobs...'));
    const blobs = await this.filesToBlobs(rootDir, files);

    this.callLogger(logger => logger.startProcess('Creating tree...'));
    const tree = await this.createTree(blobs);

    this.callLogger(logger => logger.startProcess('Creating commit... [%s]', tree.sha));
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
    const ref    = await this.getRefForUpdate(false);

    this.callLogger(logger => logger.startProcess('Updating ref... [%s] [%s]', ref, commit.sha));
    if (await this.updateRef(commit, ref, false)) {
      process.env.GITHUB_SHA = commit.sha;
      exportVariable('GITHUB_SHA', commit.sha);
    }

    this.callLogger(logger => logger.endProcess());
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
      this.callLogger(logger => logger.startProcess('Creating reference... [%s] [%s]', refName, commit.sha));
      await this.createRef(commit, refName);
    } else {
      this.callLogger(logger => logger.startProcess('Updating reference... [%s] [%s]', refName, commit.sha));
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
      this.callLogger(logger => logger.startProcess('Closing PullRequest... [%s]', branchName));
      if (message) {
        await this.createCommentToPr(branchName, message);
      }

      await this.pullsUpdate(pullRequest.number, {
        state: 'closed',
        base: undefined,
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

  /**
   * @return {Promise<{ login: string, email: string, name: string, id: number }>} user
   */
  public getUser = async(): Promise<{ login: string; email: string; name: string; id: number }> => {
    const sender = this.getSender();
    if (false === sender) {
      throw new Error('Sender is not valid.');
    }

    const {data: user} = await (this.octokit as RestEndpointMethods).users.getByUsername({
      username: sender,
    });

    return {
      login: user.login,
      email: user.email,
      name: user.name,
      id: user.id,
    };
  };

  /**
   * @return {Promise<string>} default branch
   */
  public getDefaultBranch = async(): Promise<string> => this.context.payload.repository?.default_branch ?? (await (this.octokit as RestEndpointMethods).repos.get({ // eslint-disable-line camelcase
    ...this.context.repo,
  })).data.default_branch;

  /**
   * @return {Promise<Array<string>>} tags
   */
  public getTags = async(): Promise<Array<string>> => (await (this.octokit.paginate as PaginateInterface)(
    (this.octokit as RestEndpointMethods).git.listMatchingRefs,
    {
      ...this.context.repo,
      ref: 'tags/',
    },
  )).map((item): string => trimRef((item as GitListMatchingRefsResponseData[number]).ref));

  /**
   * @return {Promise<string>} tag
   */
  public getLastTag = async(): Promise<string> => 'v' + ((await this.getTags()).filter(tag => /^v?\d+(\.\d+)*$/.test(tag)).sort(versionCompare).reverse()[0]?.replace(/^v/, '') ?? '0.0.0');

  /**
   * @return {Promise<string>} tag
   */
  public getNewPatchVersion = async(): Promise<string> => generateNewPatchVersion(await this.getLastTag());

  /**
   * @return {Promise<string>} tag
   */
  public getNewMinorVersion = async(): Promise<string> => generateNewMinorVersion(await this.getLastTag());

  /**
   * @return {Promise<string>} tag
   */
  public getNewMajorVersion = async(): Promise<string> => generateNewMajorVersion(await this.getLastTag());
}
