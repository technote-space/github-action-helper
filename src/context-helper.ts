import path from 'path';
import { Context } from '@actions/github/lib/context';
import { Logger } from './index';
import { getAccessToken, getActor, getBuildInfo } from './utils';

export const isRelease = (context: Context): boolean => 'release' === context.eventName;

export const isPush = (context: Context): boolean => 'push' === context.eventName;

export const isPr = (context: Context): boolean => 'pull_request' === context.eventName;

export const isIssue = (context: Context): boolean => 'issues' === context.eventName;

export const isCron = (context: Context): boolean => 'schedule' === context.eventName;

export const getTagName = (context: Context): string => isRelease(context) ? context.payload.release.tag_name : (/^refs\/tags\//.test(context.ref) ? context.ref.replace(/^refs\/tags\//, '') : '');

export const getSender = (context: Context): string | false => context.payload.sender && context.payload.sender.type === 'User' ? context.payload.sender.login : false;

export const getRepository = (context: Context): string => `${context.repo.owner}/${context.repo.repo}`;

export const getGitUrl = (context: Context, accessTokenRequired = true): string => {
	const token = getAccessToken(accessTokenRequired);
	if (token) {
		return `https://${getActor()}:${token}@github.com/${context.repo.owner}/${context.repo.repo}.git`;
	} else {
		return `https://github.com/${context.repo.owner}/${context.repo.repo}.git`;
	}
};

export const showActionInfo = (rootDir: string, logger: Logger, context: Context): void => {
	const info    = getBuildInfo(path.resolve(rootDir, 'build.json'));
	const tagName = getTagName(context);
	logger.log();
	logger.log('==================================================');
	if (false !== info) {
		if ('owner' in info) {
			logger.log('Version:  %s/%s@%s', info.owner, info.repo, info.tagName);
		} else {
			logger.log('Version:  %s', info.tagName);
		}
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
	logger.log();
	logger.startProcess('Dump context');
	console.log(context);
	logger.startProcess('Dump Payload');
	console.log(context.payload);
	logger.endProcess();
	logger.log('==================================================');
	logger.log();
};
