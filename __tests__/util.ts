import { Logger } from '../src';
import global from './global';

export const spyOnSignale = (): { infoMock; logMock; warnMock } => {
	const infoMock = jest.spyOn(global.mockSignale, 'info');
	const logMock = jest.spyOn(global.mockSignale, 'log');
	const warnMock = jest.spyOn(global.mockSignale, 'warn');
	return {infoMock, logMock, warnMock};
};

export const testLogger = (): void => {
	beforeEach(() => {
		Logger.resetForTesting();
	});
};
