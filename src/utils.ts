import fs from 'fs';
import path from 'path';
import { getInput } from '@actions/core' ;
import { GitHub } from '@actions/github';
import { Context } from '@actions/github/lib/context';
import { Octokit } from '@octokit/rest';

const getRef = (ref: string | Context): string => typeof ref === 'string' ? ref : ref.ref;

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

export const isSemanticVersioningTagName = (tagName: string): boolean => /^v?\d+(\.\d+)*$/i.test(tagName);

export const isRef = (ref: string | Context): boolean => /^refs\//.test(getRef(ref));

export const isBranch = (ref: string | Context): boolean => /^(refs\/)?heads\//.test(getRef(ref));

export const isTagRef = (ref: string | Context): boolean => /^refs\/?tags\//.test(getRef(ref));

export const isRemoteBranch = (ref: string | Context): boolean => /^(refs\/)?remotes\/origin\//.test(getRef(ref));

export const isPrRef = (ref: string | Context): boolean => /^refs\/pull\/\d+\/(merge|head)$/.test(getRef(ref));

export const getPrMergeRef = (ref: string | Context): string => getRef(ref).replace(/^refs\/pull\/(\d+)\/(merge|head)$/, 'refs/pull/$1/merge');

export const getPrHeadRef = (ref: string | Context): string => getRef(ref).replace(/^refs\/pull\/(\d+)\/(merge|head)$/, 'refs/pull/$1/head');

export const getRefForUpdate = (ref: string | Context): string => getRef(ref).replace(/^refs\//, '');

export const getBranch = (ref: string | Context, defaultIsEmpty = true): string =>
	isBranch(ref) ?
		getRef(ref).replace(/^(refs\/)?heads\//, '') :
		(
			isRemoteBranch(ref) ? getRef(ref).replace(/^(refs\/)?remotes\/origin\//, '') :
				(
					defaultIsEmpty ? '' : getRefForUpdate(ref)
				)
		);

export const getPrBranch = (context: Context): string => context.payload.pull_request?.head.ref ?? '';

export const normalizeRef = (ref: string | Context): string => isRef(ref) ? getRef(ref) : `refs/heads/${getRef(ref)}`;

export const trimRef = (ref: string | Context): string => getRef(ref).replace(/^refs\/(heads|tags|pull)\//, '');

export const getTag = (ref: string | Context): string => isTagRef(ref) ? trimRef(ref) : '';

const saveTarget = (ref: string | Context, origin: string): string => isTagRef(ref) ? 'tags' : isPrRef(ref) ? 'pull' : origin;

// e.g.
//  refs/heads/master
//  refs/pull/123/merge
//  refs/tags/v1.2.3
export const getRemoteRefspec = (ref: string | Context): string => normalizeRef(ref);

// e.g.
//  origin/master
//  pull/123/merge
//  tags/v1.2.3
export const getLocalRefspec = (ref: string | Context, origin = 'origin'): string => `${saveTarget(ref, origin)}/${trimRef(ref)}`;

// e.g.
//  refs/heads/master:refs/remotes/origin/master
//  refs/pull/123/merge:refs/pull/123/merge
//  refs/tags/v1.2.3:refs/tags/v1.2.3
export const getRefspec = (ref: string | Context, origin = 'origin'): string => `${getRemoteRefspec(ref)}:refs/${getLocalRefspec(ref, `remotes/${origin}`)}`;

export const getAccessToken = (required: boolean): string => getInput('GITHUB_TOKEN', {required});

// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
export const getOctokit = (token?: string): Octokit => new GitHub(token ?? getAccessToken(true), {
	log: {
		// eslint-disable-next-line @typescript-eslint/no-empty-function
		warn: function(): void {
		},
	},
});

export const getActor = (): string => process.env.GITHUB_ACTOR || '';

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getRegExp = (value: string): RegExp => new RegExp(escapeRegExp(value));

export const getPrefixRegExp = (value: string): RegExp => new RegExp('^' + escapeRegExp(value));

export const getSuffixRegExp = (value: string): RegExp => new RegExp(escapeRegExp(value) + '$');

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

export const generateNewPatchVersion = (lastTag: string): string => {
	if (!/^v?\d+(\.\d+)*$/.test(lastTag)) {
		throw new Error('Invalid tag');
	}
	const fragments = split(lastTag.replace(/^v/, ''), '.');
	// eslint-disable-next-line no-magic-numbers
	while (fragments.length < 3) {
		fragments.push('0');
	}
	// eslint-disable-next-line no-magic-numbers
	fragments[fragments.length - 1] = (Number(fragments[fragments.length - 1]) + 1).toString();
	return 'v' + fragments.join('.');
};

// eslint-disable-next-line no-magic-numbers
export const arrayChunk = <T>(array: T[], size = 100): T[][] => {
	const result: T[][] = [], length = array.length;
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
		const val1 = version1[num] ?? (checkDifferentLevel ? 0 : version2[num]), val2 = version2[num] ?? (checkDifferentLevel ? 0 : version1[num]);
		return val1 === val2 ? compare(version1, version2, ++num) : Math.sign(val1 - val2);
	};
	return compare(splitVersion(version1.replace(/^v/, '')), splitVersion(version2.replace(/^v/, '')));
};
