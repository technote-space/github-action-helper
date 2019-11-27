import fs from 'fs';
import path from 'path';
import { getInput } from '@actions/core' ;
import { Context } from '@actions/github/lib/context';

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

export const isBranch = (ref: string | Context): boolean => /^(refs\/)?heads/.test(getRef(ref));

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

export const getAccessToken = (required: boolean): string => getInput('GITHUB_TOKEN', {required});

export const getActor = (): string => process.env.GITHUB_ACTOR || '';

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getRegExp = (value: string): RegExp => new RegExp(escapeRegExp(value));

export const getPrefixRegExp = (value: string): RegExp => new RegExp('^' + escapeRegExp(value));

export const getSuffixRegExp = (value: string): RegExp => new RegExp(escapeRegExp(value) + '$');

export const getBoolValue = (input: string): boolean => !['false', '0', ''].includes(input.trim().toLowerCase());

export const uniqueArray = <T>(array: T[]): T[] => [...new Set<T>(array)];

export const getWorkspace = (): string => process.env.GITHUB_WORKSPACE || '';

export const split = (value: string, separator: string | RegExp = /\r?\n/, limit?: number): string[] => value.length ? value.split(separator, limit) : [];

export const getArrayInput = (name: string, required = false, separator = ','): string[] => uniqueArray<string>(getInput(name, {required}).split(/\r?\n/).reduce<string[]>(
	(acc, line) => acc.concat(separator ? line.split(separator) : line).filter(item => item).map(item => item.trim()),
	[],
));

export const sleep = async(millisecond: number): Promise<void> => new Promise(resolve => setTimeout(resolve, millisecond));

export const useNpm = (workDir: string, pkgManager = ''): boolean =>
	'npm' === pkgManager ||
	(
		'yarn' !== pkgManager && (
			fs.existsSync(path.resolve(workDir, 'package-lock.json')) ||
			!fs.existsSync(path.resolve(workDir, 'yarn.lock'))
		)
	);

export const replaceAll = (string: string, key: string, value: string): string => string.split(key).join(value);

export const generateNewPatchTag = (lastTag: string): string => {
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
