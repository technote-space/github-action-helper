import { Context } from '@actions/github/lib/context';
import path from 'path';
import fs from 'fs';

export const getContext = (override: object): Context => Object.assign({
	payload: {
		action: '',
	},
	eventName: '',
	sha: '',
	ref: '',
	workflow: '',
	action: '',
	actor: '',
	issue: {
		owner: '',
		repo: '',
		number: 1,
	},
	repo: {
		owner: '',
		repo: '',
	},
}, override);

export const encodeContent = (content: string): string => Buffer.from(content).toString('base64');

export const getConfigFixture = (rootDir: string, fileName = 'config.yml'): object => ({
	type: 'file',
	encoding: 'base64',
	size: 5362,
	name: fileName,
	path: `.github/${fileName}`,
	content: encodeContent(fs.readFileSync(path.resolve(rootDir, fileName)).toString()),
	sha: '3d21ec53a331a6f037a91c368710b99387d012c1',
	url:
		'https://api.github.com/repos/Codertocat/Hello-World/contents/.github/release-drafter.yml',
	'git_url':
		'https://api.github.com/repos/Codertocat/Hello-World/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1',
	'html_url':
		'https://github.com/Codertocat/Hello-World/blob/master/.github/release-drafter.yml',
	'download_url':
		'https://raw.githubusercontent.com/Codertocat/Hello-World/master/.github/release-drafter.yml',
	_links: {
		git:
			'https://api.github.com/repos/Codertocat/Hello-World/git/blobs/3d21ec53a331a6f037a91c368710b99387d012c1',
		self:
			'https://api.github.com/repos/Codertocat/Hello-World/contents/.github/release-drafter.yml',
		html:
			'https://github.com/Codertocat/Hello-World/blob/master/.github/release-drafter.yml',
	},
});

export const getApiFixture = (rootDir: string, name: string): object => JSON.parse(fs.readFileSync(path.resolve(rootDir, `${name}.json`)).toString());

export const disableNetConnect = (nock): void => {
	beforeEach(() => {
		nock.disableNetConnect();
	});

	afterEach(() => {
		nock.cleanAll();
		nock.enableNetConnect();
	});
};

export const testEnv = (): void => {
	const OLD_ENV = process.env;

	beforeEach(() => {
		jest.resetModules();
		process.env = {...OLD_ENV};
		delete process.env.NODE_ENV;
	});

	afterEach(() => {
		process.env = OLD_ENV;
	});
};
