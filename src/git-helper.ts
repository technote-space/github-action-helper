import type { Context } from '@actions/github/lib/context';
import type { Logger } from '@technote-space/github-action-log-helper';
import fs from 'fs';
import Command from './command';
import { getGitUrlWithToken } from './context-helper';
import {
  getBranch,
  isBranch,
  isPrRef,
  getRefspec,
  isCloned,
  split,
  generateNewPatchVersion,
  arrayChunk,
  versionCompare,
  getAccessToken,
  generateNewMinorVersion,
  generateNewMajorVersion,
  isCommandDebug,
  isOutputDebug,
} from './utils';

type CommandType = string | {
  command: string;
  args?: string[];
  quiet?: boolean;
  altCommand?: string;
  suppressError?: boolean;
  suppressOutput?: boolean;
  stderrToStdout?: boolean;
};

export default class GitHelper {
  private readonly command: Command;
  private readonly cloneDepth: string;
  private readonly filter: (string) => boolean;
  private readonly token: string;
  private origin?: string  = undefined;
  private quietIfNotOrigin = true;

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

  private shouldSuppressError = (): boolean => !isCommandDebug();

  private isQuiet = (): boolean => !isOutputDebug() && (!this.origin || this.quietIfNotOrigin);

  public runCommand = async(workDir: string, commands: CommandType | CommandType[]): Promise<{ command: string; stdout: string[]; stderr: string[] }[]> => {
    const result: { command: string; stdout: string[]; stderr: string[] }[] = [];
    try {
      for (const command of (Array.isArray(commands) ? commands : [commands])) {
        if (typeof command === 'string') {
          const output = (await this.command.execAsync({ command, cwd: workDir }));
          result.push({
            command: output.command,
            stdout: split(output.stdout),
            stderr: split(output.stderr),
          });
        } else {
          const output = (await this.command.execAsync({ cwd: workDir, ...command }));
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

  private initialize = async(workDir: string, refresh = true): Promise<void> => {
    if (isCloned(workDir) && !refresh) {
      return;
    }

    if (fs.existsSync(workDir)) {
      await this.runCommand(workDir, { command: 'rm', args: ['-rdf', workDir] });
    }
    fs.mkdirSync(workDir, { recursive: true });
    await this.runCommand(workDir, { command: 'git init', args: ['.'] });
  };

  public useOrigin = (origin: string | boolean, quiet?: boolean): void => {
    this.origin = typeof origin === 'boolean' ? (origin ? 'origin' : undefined) : origin;
    if (quiet !== undefined) {
      this.quietIfNotOrigin = quiet;
    }
  };

  public getRemoteName = (): string | never => this.origin ?? 'origin';

  private getRemote = (context: Context): string => this.origin ?? getGitUrlWithToken(context, this.token);

  public addOrigin = async(workDir: string, context: Context): Promise<void> => {
    await this.initialize(workDir, false);
    await this.runCommand(workDir, {
      command: 'git remote add',
      args: [this.getRemoteName(), getGitUrlWithToken(context, this.token)],
      stderrToStdout: this.isQuiet(),
      altCommand: `git remote add ${this.getRemoteName()}`,
      suppressError: this.shouldSuppressError(),
    });
  };

  public getCurrentBranchName = async(workDir: string): Promise<string> => {
    if (!isCloned(workDir)) {
      return '';
    }
    return (await this.runCommand(workDir, {
      command: 'git rev-parse',
      args: ['--abbrev-ref', 'HEAD'],
      suppressError: this.shouldSuppressError(),
      stderrToStdout: true,
    }))[0].stdout[0]?.trim() ?? '';
  };

  public cloneBranch = async(workDir: string, branch: string, context: Context): Promise<void> => {
    await this.runCommand(workDir, {
      command: 'git clone',
      args: [`--branch=${branch}`, this.cloneDepth, this.getRemote(context), '.'],
      stderrToStdout: this.isQuiet(),
      altCommand: `git clone --branch=${branch}`,
      suppressError: this.shouldSuppressError(),
    });
  };

  private clonePR = async(workDir: string, context: Context): Promise<void> => {
    await this.runCommand(workDir, [
      {
        command: 'git clone',
        args: [this.cloneDepth, this.getRemote(context), '.'],
        stderrToStdout: this.isQuiet(),
        altCommand: 'git clone',
        suppressError: this.shouldSuppressError(),
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

  public gitInit = async(workDir: string, branch: string): Promise<void> => {
    await this.initialize(workDir);
    await this.runCommand(workDir, { command: 'git checkout', args: ['--orphan', branch], stderrToStdout: true });
  };

  public fetchOrigin = async(workDir: string, context: Context, options?: string[], refspec?: string[]): Promise<void> => {
    await this.addOrigin(workDir, context);
    await this.runCommand(workDir, {
      command: 'git fetch',
      args: [
        ...(options ?? []),
        this.getRemoteName(),
        ...(refspec ?? []),
      ],
      suppressError: this.shouldSuppressError(),
      stderrToStdout: true,
    });
  };

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

  public fetchBranch = async(workDir: string, branch: string, context: Context): Promise<void> => {
    const branchName = getBranch(branch, false);
    await this.runCommand(workDir, {
      command: 'git fetch',
      args: ['--prune', '--no-tags', '--no-recurse-submodules', this.cloneDepth, this.getRemote(context), `+refs/heads/${branchName}:refs/remotes/${this.getRemoteName()}/${branchName}`],
      altCommand: `git fetch --prune --no-tags --no-recurse-submodules${this.cloneDepth} ${this.getRemoteName()} +refs/heads/${branchName}:refs/remotes/${this.getRemoteName()}/${branchName}`,
      suppressError: this.shouldSuppressError(),
      stderrToStdout: true,
    });
  };

  public createBranch = async(workDir: string, branch: string): Promise<void> => {
    await this.runCommand(workDir, { command: 'git checkout', args: ['-b', branch], stderrToStdout: true });
  };

  public switchBranch = async(workDir: string, branch: string): Promise<void> => {
    await this.runCommand(workDir, {
      command: 'git checkout',
      args: ['-b', branch, `${this.getRemoteName()}/${branch}`],
      suppressError: this.shouldSuppressError(),
      stderrToStdout: true,
    });
    await this.runCommand(workDir, {
      command: 'git checkout',
      args: [branch],
      suppressError: this.shouldSuppressError(),
      stderrToStdout: true,
    });
  };

  public config = async(workDir: string, config: { name?: string, email?: string, defaultBranch?: string }): Promise<void> => {
    if (config.defaultBranch) {
      await this.runCommand(workDir, [
        {
          command: 'git config',
          args: ['--global', 'init.defaultBranch', config.defaultBranch],
        },
      ]);
    }
    if (config.name) {
      await this.runCommand(workDir, [
        {
          command: 'git config',
          args: ['user.name', config.name],
        },
      ]);
    }
    if (config.email) {
      await this.runCommand(workDir, [
        {
          command: 'git config',
          args: ['user.email', config.email],
        },
      ]);
    }
  };

  public getDiff = async(workDir: string): Promise<string[]> => (await this.runCommand(workDir, {
    command: 'git status',
    args: ['--short', '-uno'],
    suppressOutput: true,
  }))[0].stdout.filter(line => line.match(/^[MDA]\s+/)).filter(this.filter).map(line => line.replace(/^[MDA]\s+/, ''));

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

  public checkDiff = async(workDir: string): Promise<boolean> => !!(await this.getDiff(workDir)).length;

  public commit = async(workDir: string, message: string, options?: { count?: number; allowEmpty?: boolean; args?: Array<string> }): Promise<boolean> => {
    await this.runCommand(workDir, { command: 'git add', args: ['--all'] });

    if (!options?.allowEmpty && !await this.checkDiff(workDir)) {
      this.logger.info('There is no diff.');
      return false;
    }

    await this.makeCommit(workDir, message, options);
    return true;
  };

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

  public getTags = async(workDir: string, options?: { quiet?: boolean; suppressOutput?: boolean }): Promise<string[]> => (await this.runCommand(workDir, {
    command: 'git tag',
    suppressOutput: options?.suppressOutput || options?.quiet,
    altCommand: options?.quiet ? '' : undefined,
  }))[0].stdout;

  public fetchTags = async(workDir: string, context: Context, splitSize = 20): Promise<void> => { // eslint-disable-line no-magic-numbers
    await this.runCommand(workDir, [
      ...arrayChunk(await this.getTags(workDir, { quiet: true }), splitSize).map(tags => ({
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

  public deleteTag = async(workDir: string, tags: string | string[], context: Context, splitSize = 20): Promise<void> => { // eslint-disable-line no-magic-numbers
    const getTagRef = (tag: string): string => /^(refs\/)?tags\//.test(tag) ? tag : `tags/${tag}`;
    await this.runCommand(workDir,
      arrayChunk((typeof tags === 'string' ? [tags] : tags).map(getTagRef), splitSize).map(tags => ({
        command: 'git push',
        args: [this.getRemote(context), '--delete', ...tags],
        stderrToStdout: this.isQuiet(),
        altCommand: `git push ${this.getRemoteName()} --delete ${tags.join(' ')}`,
        suppressError: this.shouldSuppressError(),
      })),
    );
    await this.deleteLocalTag(workDir, tags, splitSize);
  };

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
        stderrToStdout: this.isQuiet(),
        altCommand: `git push ${this.getRemoteName()} refs/tags/${newTag}`,
      },
    ]);
  };

  public deleteLocalTag = async(workDir: string, tags: string | string[], splitSize = 20): Promise<void> => { // eslint-disable-line no-magic-numbers
    const getTag = (tag: string): string => tag.replace(/^(refs\/)?tags\//, '');
    await this.runCommand(workDir, arrayChunk((typeof tags === 'string' ? [tags] : tags).map(getTag), splitSize).map(
      tags => ({
        command: 'git tag',
        args: ['-d', ...tags],
        suppressError: this.shouldSuppressError(),
        stderrToStdout: true,
      }),
    ));
  };

  public addLocalTag = async(workDir: string, tags: string | string[]): Promise<void> => {
    if ('string' === typeof tags) {
      await this.runCommand(workDir, { command: 'git tag', args: [tags] });
    } else {
      for (const tag of tags) {
        await this.addLocalTag(workDir, tag);
      }
    }
  };

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
      stderrToStdout: this.isQuiet(),
      altCommand: `git push ${args.concat([this.getRemoteName(), `${branch}:refs/heads/${branch}`]).join(' ')}`,
    });
  };

  public forcePush = async(workDir: string, branch: string, context: Context): Promise<void> => this.push(workDir, branch, context, { force: true });

  public getLastTag = async(workDir: string): Promise<string> => {
    if (!isCloned(workDir)) {
      throw new Error('Not a git repository');
    }

    return 'v' + ((await this.getTags(workDir)).filter(tag => /^v?\d+(\.\d+)*$/.test(tag)).sort(versionCompare).reverse()[0]?.replace(/^v/, '') ?? '0.0.0');
  };

  public getNewPatchVersion = async(workDir: string): Promise<string> => generateNewPatchVersion(await this.getLastTag(workDir));

  public getNewMinorVersion = async(workDir: string): Promise<string> => generateNewMinorVersion(await this.getLastTag(workDir));

  public getNewMajorVersion = async(workDir: string): Promise<string> => generateNewMajorVersion(await this.getLastTag(workDir));
}
