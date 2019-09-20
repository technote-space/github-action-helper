import fs from 'fs';
import path from 'path';
import { getInput } from '@actions/core' ;
import { Context } from '@actions/github/lib/context';
import { Logger } from './logger';

export const getBuildVersion = (filepath: string): string | boolean => {
	if (!fs.existsSync(filepath)) {
		return false;
	}

	const json = JSON.parse(fs.readFileSync(filepath, 'utf8'));
	if (json && 'tagName' in json) {
		return json['tagName'];
	}

	return false;
};

export const isRelease = (context: Context): boolean => 'release' === context.eventName;

export const getTagName = (context: Context): string => isRelease(context) ? context.payload.release.tag_name : context.ref.replace(/^refs\/tags\//, '');

export const getRepository = (context: Context): string => `${context.repo.owner}/${context.repo.repo}`;

const getAccessToken = (required: boolean): string => getInput('GITHUB_TOKEN', {required});

export const getActor = (): string => process.env.GITHUB_ACTOR || '';

export const getGitUrl = (context: Context, accessTokenRequired = true): string => {
	const token = getAccessToken(accessTokenRequired);
	if (token) {
		return `https://${getActor()}:${token}@github.com/${context.repo.owner}/${context.repo.repo}.git`;
	} else {
		return `https://github.com/${context.repo.owner}/${context.repo.repo}.git`;
	}
};

export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getBoolValue = (input: string): boolean => !['false', '0', ''].includes(input.trim().toLowerCase());

export const uniqueArray = <T>(array: T[]): T[] => [...new Set<T>(array)];

export const getWorkspace = (): string => process.env.GITHUB_WORKSPACE || '';

export const showActionInfo = (rootDir: string, logger: Logger, context: Context): void => {
	const version = getBuildVersion(path.resolve(rootDir, 'build.json'));
	const tagName = getTagName(context);
	if ('string' === typeof version) {
		logger.info('Version: %s', version);
	}
	logger.info('Event: %s', context.eventName);
	logger.info('Action: %s', context.payload.action);
	logger.info('Tag name: %s', tagName);
};
