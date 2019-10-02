import fs from 'fs';
import path from 'path';
import { getInput } from '@actions/core' ;
import { Context } from '@actions/github/lib/context';
import { Logger } from './index';

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

export const getTagName = (context: Context): string => isRelease(context) ? context.payload.release.tag_name : (/^refs\/tags\//.test(context.ref) ? context.ref.replace(/^refs\/tags\//, '') : '');

export const isSemanticVersioningTagName = (tagName: string): boolean => /^v?\d+(\.\d+)*$/i.test(tagName);

export const getBranch = (context: Context): string => context.ref.replace(/^refs\/heads\//, '');

export const getRefForUpdate = (context: Context): string => encodeURIComponent(context.ref.replace(/^refs\//, ''));

export const getSender = (context: Context): string | false => context.payload.sender && context.payload.sender.type === 'User' ? context.payload.sender.login : false;

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
	logger.log('');
	logger.log('==================================================');
	if ('string' === typeof version) {
		logger.log('Version:  %s', version);
	}
	logger.log('Event:    %s', context.eventName);
	logger.log('Action:   %s', context.payload.action);
	logger.log('sha:      %s', context.sha);
	logger.log('ref:      %s', context.ref);
	if (tagName) {
		logger.log('Tag name: %s', tagName);
	}
	if (context.payload.issue) {
		logger.log('Labels:');
		context.payload.issue.labels.map(label => label.name).forEach(label => logger.log('  - %s', label));
	}
	if (context.payload.pull_request) {
		logger.log('Labels:');
		context.payload.pull_request.labels.map(label => label.name).forEach(label => logger.log('  - %s', label));
	}
	logger.log('owner:    %s', context.repo.owner);
	logger.log('repo:     %s', context.repo.repo);
	logger.log('actor:    %s', context.actor);
	logger.log('==================================================');
	logger.log('');
};

export const getArrayInput = (name: string, required = false, separator = ','): string[] => uniqueArray<string>(getInput(name, {required}).split(/\r?\n/).reduce<string[]>(
	(acc, line) => acc.concat(separator ? line.split(separator) : line).filter(item => item).map(item => item.trim()),
	[],
));
