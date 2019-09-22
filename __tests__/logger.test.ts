/* eslint-disable no-magic-numbers */
import { Logger } from '../src';
import { spyOnSignale, testLogger } from './util';

describe('Logger', () => {
	testLogger();

	const logger = new Logger();

	describe('info', () => {
		it('should output info', () => {
			const {infoMock} = spyOnSignale();

			logger.info('test');

			expect(infoMock).toBeCalledWith('test');
		});
	});

	describe('displayCommand', () => {
		it('should output command', () => {
			const {commandMock} = spyOnSignale();

			logger.displayCommand('test');

			expect(commandMock).toBeCalledWith('[command]test');
		});
	});

	describe('displayStdout', () => {
		it('should output command', () => {
			const {commandMock} = spyOnSignale();

			logger.displayStdout('test1\ntest2\n');

			expect(commandMock).toBeCalledTimes(2);
			expect(commandMock.mock.calls[0][0]).toBe('  >> test1');
			expect(commandMock.mock.calls[1][0]).toBe('  >> test2');
		});
	});

	describe('displayStderr', () => {
		it('should output warn', () => {
			const {warnMock} = spyOnSignale();

			logger.displayStderr('test1\ntest2\n');

			expect(warnMock).toBeCalledTimes(2);
			expect(warnMock.mock.calls[0][0]).toBe('  >> test1');
			expect(warnMock.mock.calls[1][0]).toBe('  >> test2');
		});
	});

	describe('startProcess', () => {
		it('should output process', () => {
			const {logMock} = spyOnSignale();

			logger.startProcess('test');

			expect(logMock).toBeCalledWith('##[group]test');
		});
	});

	describe('log', () => {
		it('should exists', () => {
			const {logMock} = spyOnSignale();

			logger.log('test');

			expect(logMock).toBeCalledWith('test');
		});
	});
});

describe('Logger with replacer', () => {
	const logger = new Logger((string: string): string => string.replace('<replace target>', '<replaced>'), {});

	describe('info output info with args', () => {
		const {infoMock} = spyOnSignale();

		logger.info('message with args %s %d: <replace target>', '<replace target>', 2);

		expect(infoMock).toBeCalledWith('message with args %s %d: <replaced>', '<replaced>', 2);
	});

	describe('displayCommand output command with args', () => {
		const {commandMock} = spyOnSignale();

		logger.displayCommand('message with args %s %d: <replace target>', '<replace target>', 2);

		expect(commandMock).toBeCalledWith('[command]message with args %s %d: <replaced>', '<replaced>', 2);
	});

	describe('startProcess', () => {
		it('should output process with args', () => {
			const {logMock} = spyOnSignale();

			logger.startProcess('message with args %s %d: <replace target>', '<replace target>', 2);

			expect(logMock).toBeCalledWith('##[group]message with args %s %d: <replaced>', '<replaced>', 2);
		});
	});
});
