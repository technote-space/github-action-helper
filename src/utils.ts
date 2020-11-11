import fs from 'fs';
import path from 'path';
import {getInput} from '@actions/core' ;
import {Context} from '@actions/github/lib/context';
import {getOctokit as getOctokitInstance} from '@actions/github';
import {Octokit} from './types';

type RefObject = { ref: string }
const getRef = (ref: string | RefObject): string => typeof ref === 'string' ? ref : ref.ref;

export const getBuildInfo = (filepath: string): {
  owner?: string;
  repo?: string;
  sha?: string;
  ref?: string;
  tagName: string;
  branch: string;
  tags: string[];
  'updated_at': string;
} | false => {
  if (!fs.existsSync(filepath)) {
    return false;
  }

  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch {
    return false;
  }
};

export const isCloned = (workDir: string): boolean => fs.existsSync(path.resolve(workDir, '.git'));

export const parseVersion = (version: string, options?: { fill?: boolean, cut?: boolean }): {
  core: string;
  preRelease: string | undefined;
  build: string | undefined;
  fragments: Array<string>;
} | undefined => {
  // https://semver.org/spec/v2.0.0.html
  const regex   = /^v?((0|[1-9]\d*)(\.(0|[1-9]\d*))*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
  const matches = version.trim().replace(/^[=v]+/, '').match(regex);
  if (!matches) {
    return undefined;
  }

  const fragments = split(matches[1], '.');
  // eslint-disable-next-line no-magic-numbers
  while (options?.fill !== false && fragments.length < 3) {
    fragments.push('0');
  }

  return {
    // eslint-disable-next-line no-magic-numbers
    core: (options?.cut === false ? fragments : fragments.slice(0, 3)).join('.'),
    preRelease: matches[5],
    build: matches[6],
    fragments,
  };
};

export const normalizeVersion = (version: string, options?: { fill?: boolean, cut?: boolean }): string | never => {
  const parsed = parseVersion(version, options);
  if (parsed === undefined) {
    throw new Error('Invalid versioning');
  }

  return parsed.core + (parsed.preRelease ? `-${parsed.preRelease}` : '') + (parsed.build ? `+${parsed.build}` : '');
};

export const getSemanticVersion = (version: string, cut = true): string | undefined => parseVersion(version, {cut})?.core;

export const isSemanticVersioningTagName = (tagName: string): boolean => getSemanticVersion(tagName) !== undefined;

export const isRef = (ref: string | RefObject): boolean => /^refs\//.test(getRef(ref));

export const isBranch = (ref: string | RefObject): boolean => /^refs\/heads\//.test(getRef(ref));

export const isTagRef = (ref: string | RefObject): boolean => /^refs\/tags\//.test(getRef(ref));

export const isRemoteBranch = (ref: string | RefObject): boolean => /^refs\/remotes\/origin\//.test(getRef(ref));

export const isPrRef = (ref: string | RefObject): boolean => /^refs\/pull\/\d+\/(merge|head)$/.test(getRef(ref));

export const getPrMergeRef = (ref: string | RefObject): string => getRef(ref).replace(/^refs\/pull\/(\d+)\/(merge|head)$/, 'refs/pull/$1/merge');

export const getPrHeadRef = (ref: string | RefObject): string => getRef(ref).replace(/^refs\/pull\/(\d+)\/(merge|head)$/, 'refs/pull/$1/head');

export const getRefForUpdate = (ref: string | RefObject): string => getRef(ref).replace(/^refs\//, '');

export const getBranch = (ref: string | RefObject, defaultIsEmpty = true): string =>
  isBranch(ref) ?
    getRef(ref).replace(/^refs\/heads\//, '') :
    (
      isRemoteBranch(ref) ? getRef(ref).replace(/^refs\/remotes\/origin\//, '') :
        (
          defaultIsEmpty ? '' : getRefForUpdate(ref)
        )
    );

export const getPrBranch = (context: Context): string => context.payload.pull_request?.head.ref ?? '';

export const normalizeRef = (ref: string | RefObject): string => isRef(ref) ? getRef(ref) : `refs/heads/${getRef(ref)}`;

export const trimRef = (ref: string | RefObject): string => getRef(ref).replace(/^refs\/(heads|tags|pull)\//, '');

export const getTag = (ref: string | RefObject): string => isTagRef(ref) ? trimRef(ref) : '';

const saveTarget = (ref: string | RefObject, origin: string): string => isTagRef(ref) ? 'tags' : isPrRef(ref) ? `${origin}/pull` : origin;

// e.g.
//  refs/heads/master
//  refs/pull/123/merge
//  refs/tags/v1.2.3
export const getRemoteRefspec = (ref: string | RefObject): string => normalizeRef(ref);

// e.g.
//  origin/master
//  origin/pull/123/merge
//  tags/v1.2.3
export const getLocalRefspec = (ref: string | RefObject, origin = 'origin'): string => `${saveTarget(ref, origin)}/${trimRef(ref)}`;

// e.g.
//  refs/heads/master:refs/remotes/origin/master
//  refs/pull/123/merge:refs/pull/123/merge
//  refs/tags/v1.2.3:refs/tags/v1.2.3
export const getRefspec = (ref: string | RefObject, origin = 'origin'): string => `${getRemoteRefspec(ref)}:refs/${getLocalRefspec(ref, `remotes/${origin}`)}`;

export const getAccessToken = (required: boolean): string => getInput('GITHUB_TOKEN', {required});

export const getOctokit = (token?: string): Octokit => getOctokitInstance(token ?? getAccessToken(true), {});

export const getActor = (): string => process.env.GITHUB_ACTOR || '';

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getRegExp = (value: string): RegExp => new RegExp(escapeRegExp(value));

export const getPrefixRegExp = (value: string, flags = ''): RegExp => new RegExp('^' + escapeRegExp(value), flags);

export const getSuffixRegExp = (value: string, flags = ''): RegExp => new RegExp(escapeRegExp(value) + '$', flags);

export const getBoolValue = (input: string): boolean => !['false', '0', '', 'no', 'n'].includes(input.trim().toLowerCase());

export const uniqueArray = <T>(array: T[]): T[] => [...new Set<T>(array)];

export const getWorkspace = (): string => process.env.GITHUB_WORKSPACE || '';

export const split = (value: string, separator: string | RegExp = /\r?\n/, limit?: number): string[] => value.length ? value.split(separator, limit) : [];

export const getArrayInput = (name: string, required = false, separator = ',', unique = true): string[] => {
  const arrayInput = getInput(name, {required}).split(/\r?\n/).reduce<string[]>(
    (acc, line) => acc.concat(separator ? line.split(separator) : line).filter(item => item).map(item => item.trim()),
    [],
  );
  return unique ? uniqueArray<string>(arrayInput) : arrayInput;
};

export const sleep = async(millisecond: number): Promise<void> => new Promise(resolve => setTimeout(resolve, millisecond));

export const useNpm = (workDir: string, pkgManager = ''): boolean =>
  'npm' === pkgManager ||
  (
    'yarn' !== pkgManager && (
      fs.existsSync(path.resolve(workDir, 'package-lock.json')) ||
      !fs.existsSync(path.resolve(workDir, 'yarn.lock'))
    )
  );

export const replaceAll = (string: string, key: string | RegExp, value: string): string => string.split(key).join(value);

export const generateNewVersion = (lastTag: string, position?: number): string => {
  if (!/^v?\d+(\.\d+)*$/.test(lastTag)) {
    throw new Error('Invalid tag');
  }

  const fragments = split(lastTag.replace(/^v/, ''), '.');
  // eslint-disable-next-line no-magic-numbers
  while (fragments.length < 3) {
    fragments.push('0');
  }

  const target      = Math.max(Math.min(position ?? 2, 2), 0);  // eslint-disable-line no-magic-numbers
  fragments[target] = (Number(fragments[target]) + 1).toString();  // eslint-disable-line no-magic-numbers
  [...Array(2 - target).keys()].forEach(key => fragments[2 - key] = '0'); // eslint-disable-line no-magic-numbers
  return 'v' + fragments.slice(0, 3).join('.');  // eslint-disable-line no-magic-numbers
};

export const generateNewPatchVersion = (lastTag: string): string => generateNewVersion(lastTag);
export const generateNewMinorVersion = (lastTag: string): string => generateNewVersion(lastTag, 1); // eslint-disable-line no-magic-numbers
export const generateNewMajorVersion = (lastTag: string): string => generateNewVersion(lastTag, 0); // eslint-disable-line no-magic-numbers

// eslint-disable-next-line no-magic-numbers
export const arrayChunk = <T>(array: T[], size = 100): T[][] => {
  const result: T[][] = [];
  const length        = array.length;
  for (let index = 0; index < length; index += size) {
    result.push(array.slice(index, index + size));
  }
  return result;
};

export const versionCompare = (version1: string, version2: string, checkDifferentLevel = true): number => {
  const splitVersion = (version: string): number[] => version.split('.').map(item => Number(item));
  // eslint-disable-next-line no-magic-numbers
  const compare      = (version1: number[], version2: number[], num = 0): number => {
    if (version1.length <= num && version2.length <= num) {
      // eslint-disable-next-line no-magic-numbers
      return checkDifferentLevel ? Math.sign(version1.length - version2.length) : 0;
    }

    // eslint-disable-next-line no-magic-numbers
    const val1 = version1[num] ?? (checkDifferentLevel ? 0 : version2[num]);
    // eslint-disable-next-line no-magic-numbers
    const val2 = version2[num] ?? (checkDifferentLevel ? 0 : version1[num]);
    return val1 === val2 ? compare(version1, version2, ++num) : Math.sign(val1 - val2);
  };
  return compare(splitVersion(version1.replace(/^v/, '')), splitVersion(version2.replace(/^v/, '')));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any,@typescript-eslint/explicit-module-boundary-types
export const mask = (value: any, target = 'token'): any => {
  Object.keys(value).forEach(key => {
    if (value[key] && typeof value[key] === 'object') {
      value[key] = mask(value[key], target);
    } else if (target === key) {
      value[key] = '***';
    }
  });

  return value;
};

export const replaceVariables = async(string: string, variables: { key: string; replace: (() => Promise<string> | string) | string }[]): Promise<string> => {
  let replaced = string;
  for (const variable of variables) {
    if (getRegExp(`\${${variable.key}}`).test(replaced)) {
      if (typeof variable.replace === 'string') {
        replaced = replaceAll(replaced, `\${${variable.key}}`, variable.replace);
      } else {
        replaced = replaceAll(replaced, `\${${variable.key}}`, await variable.replace());
      }
    }
  }

  return replaced;
};
