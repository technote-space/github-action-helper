import { Logger } from '../src';
import global from './global';

export const spyOnSignale = (): { infoMock; logMock; commandMock; warnMock } => {
	const infoMock = jest.spyOn(global.mockSignale, 'info');
	const logMock = jest.spyOn(global.mockSignale, 'log');
	const commandMock = jest.spyOn(global.mockSignale, 'command');
	const warnMock = jest.spyOn(global.mockSignale, 'warn');
	return {infoMock, logMock, commandMock, warnMock};
};

export const testLogger = (): void => {
	beforeEach(() => {
		Logger.resetForTesting();
	});
};
