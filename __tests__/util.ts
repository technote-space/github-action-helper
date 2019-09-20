import global from './global';

export const spyOnSignale = (): { infoMock; logMock; processMock; commandMock; warnMock } => {
	const infoMock = jest.spyOn(global.mockSignale, 'info');
	const logMock = jest.spyOn(global.mockSignale, 'log');
	const processMock = jest.spyOn(global.mockSignale, 'process');
	const commandMock = jest.spyOn(global.mockSignale, 'command');
	const warnMock = jest.spyOn(global.mockSignale, 'warn');
	return {infoMock, logMock, processMock, commandMock, warnMock};
};
