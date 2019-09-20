/* eslint-disable no-magic-numbers */
import Logger from '../src/logger';
import { spyOnSignale } from './util';

describe('Logger', () => {
	const logger = new Logger();

	describe('info', () => {
		it('should output info', () => {
			const {infoMock} = spyOnSignale();

			logger.info('test');

			expect(infoMock).toBeCalledWith('test');
		});
	});

	describe('note', () => {
		it('should output info', () => {
			const {processMock} = spyOnSignale();

			logger.note('test');

			expect(processMock).toBeCalledWith('[test]');
		});
	});

	describe('displayCommand', () => {
		it('should output command', () => {
			const {commandMock} = spyOnSignale();

			logger.displayCommand('test');

			expect(commandMock).toBeCalledWith('  > test');
		});
	});

	describe('displayStdout', () => {
		it('should output command', () => {
			const {commandMock} = spyOnSignale();

			logger.displayStdout('test1\ntest2\n');

			expect(commandMock).toBeCalledTimes(2);
			expect(commandMock.mock.calls[0][0]).toBe('    >> test1');
			expect(commandMock.mock.calls[1][0]).toBe('    >> test2');
		});
	});

	describe('displayStderr', () => {
		it('should output warn', () => {
			const {warnMock} = spyOnSignale();

			logger.displayStderr('test1\ntest2\n');

			expect(warnMock).toBeCalledTimes(2);
			expect(warnMock.mock.calls[0][0]).toBe('    >> test1');
			expect(warnMock.mock.calls[1][0]).toBe('    >> test2');
		});
	});

	describe('startProcess', () => {
		it('should output process', () => {
			const {processMock} = spyOnSignale();

			logger.startProcess('test');

			expect(processMock).toBeCalledWith('[test]');
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

	describe('note output process with args', () => {
		const {processMock} = spyOnSignale();

		logger.note('message with args %s %d: <replace target>', '<replace target>', 2);

		expect(processMock).toBeCalledWith('[message with args %s %d: <replaced>]', '<replaced>', 2);
	});

	describe('displayCommand output command with args', () => {
		const {commandMock} = spyOnSignale();

		logger.displayCommand('message with args %s %d: <replace target>', '<replace target>', 2);

		expect(commandMock).toBeCalledWith('  > message with args %s %d: <replaced>', '<replaced>', 2);
	});

	describe('startProcess', () => {
		it('should output process with args', () => {
			const {processMock} = spyOnSignale();

			logger.startProcess('message with args %s %d: <replace target>', '<replace target>', 2);

			expect(processMock).toBeCalledWith('[message with args %s %d: <replaced>]', '<replaced>', 2);
		});
	});
});
