/* eslint-disable no-magic-numbers */
import { EOL } from 'os';
import { Logger } from '../src';
import { testLogger } from './util';
import global from './global';

describe('Logger', () => {
	testLogger();

	const logger = new Logger();

	describe('log', () => {
		it('should output log', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.info('test');

			expect(mockStdout).toBeCalledWith('> test' + EOL);
		});
	});

	describe('info', () => {
		it('should output info', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.info('test');

			expect(mockStdout).toBeCalledWith('> test' + EOL);
		});
	});

	describe('debug', () => {
		it('should output debug', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.debug('test');

			expect(mockStdout).toBeCalledWith('##[debug]test' + EOL);
		});
	});

	describe('error', () => {
		it('should output debug', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.error('test');

			expect(mockStdout).toBeCalledWith('##[error]test' + EOL);
		});
	});

	describe('warn', () => {
		it('should output debug', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.warn('test');

			expect(mockStdout).toBeCalledWith('##[warning]test' + EOL);
		});
	});

	describe('displayCommand', () => {
		it('should output command', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.displayCommand('test');

			expect(mockStdout).toBeCalledWith('[command]test' + EOL);
		});
	});

	describe('displayStdout', () => {
		it('should output command', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.displayStdout('test1\ntest2\n');

			expect(mockStdout).toBeCalledTimes(2);
			expect(mockStdout.mock.calls[0][0]).toBe('  >> test1' + EOL);
			expect(mockStdout.mock.calls[1][0]).toBe('  >> test2' + EOL);
		});
	});

	describe('displayStderr', () => {
		it('should output warn', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.displayStderr('test1\ntest2\n');

			expect(mockStdout).toBeCalledTimes(2);
			expect(mockStdout.mock.calls[0][0]).toBe('##[warning]  >> test1' + EOL);
			expect(mockStdout.mock.calls[1][0]).toBe('##[warning]  >> test2' + EOL);
		});
	});

	describe('startProcess', () => {
		it('should output process', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.startProcess('test');

			expect(mockStdout).toBeCalledWith('##[group]test' + EOL);
		});
	});
});

describe('Logger with string array', () => {
	testLogger();

	const logger = new Logger();

	describe('info', () => {
		it('should output info', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.info(['test1', 'test2']);

			expect(mockStdout).toBeCalledTimes(2);
			expect(mockStdout.mock.calls[0][0]).toBe('> test1' + EOL);
			expect(mockStdout.mock.calls[1][0]).toBe('> test2' + EOL);
		});
	});

	describe('displayCommand', () => {
		it('should output command', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.displayCommand(['test1', 'test2']);

			expect(mockStdout).toBeCalledTimes(2);
			expect(mockStdout.mock.calls[0][0]).toBe('[command]test1' + EOL);
			expect(mockStdout.mock.calls[1][0]).toBe('[command]test2' + EOL);
		});
	});

	describe('displayStdout', () => {
		it('should output command', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.displayStdout(['test1\ntest2\n', 'test3']);

			expect(mockStdout).toBeCalledTimes(3);
			expect(mockStdout.mock.calls[0][0]).toBe('  >> test1' + EOL);
			expect(mockStdout.mock.calls[1][0]).toBe('  >> test2' + EOL);
			expect(mockStdout.mock.calls[2][0]).toBe('  >> test3' + EOL);
		});
	});

	describe('displayStderr', () => {
		it('should output warn', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.displayStderr(['test1\ntest2\n', 'test3']);

			expect(mockStdout).toBeCalledTimes(3);
			expect(mockStdout.mock.calls[0][0]).toBe('##[warning]  >> test1' + EOL);
			expect(mockStdout.mock.calls[1][0]).toBe('##[warning]  >> test2' + EOL);
			expect(mockStdout.mock.calls[2][0]).toBe('##[warning]  >> test3' + EOL);
		});
	});
});

describe('Logger with replacer', () => {
	const logger = new Logger((string: string): string => string.replace('<replace target>', '<replaced>'));

	describe('info output info with args', () => {
		const mockStdout = jest.spyOn(global.mockStdout, 'write');

		logger.info('message with args %s %d: <replace target>', '<replace target>', 2);

		expect(mockStdout).toBeCalledWith('> message with args <replaced> 2: <replaced>' + EOL);
	});

	describe('displayCommand output command with args', () => {
		const mockStdout = jest.spyOn(global.mockStdout, 'write');

		logger.displayCommand('message with args %s %d: <replace target>', '<replace target>', 2);

		expect(mockStdout).toBeCalledWith('[command]message with args <replaced> 2: <replaced>' + EOL);
	});

	describe('startProcess', () => {
		it('should output process with args', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.startProcess('message with args %s %d: <replace target>', '<replace target>', 2);

			expect(mockStdout).toBeCalledWith('##[group]message with args <replaced> 2: <replaced>' + EOL);
		});
	});
});

describe('Logger with mixed', () => {
	const logger = new Logger((string: string): string => string.replace('<replace target>', '<replaced>'));

	describe('debug', () => {
		it('should output debug', () => {
			const mockStdout = jest.spyOn(global.mockStdout, 'write');

			logger.debug(['test1: %s %d: <replace target>', 'test2: %s %d: <replace target>'], '<replace target>', 2);

			expect(mockStdout).toBeCalledTimes(2);
			expect(mockStdout.mock.calls[0][0]).toBe('##[debug]test1: <replaced> 2: <replaced>' + EOL);
			expect(mockStdout.mock.calls[1][0]).toBe('##[debug]test2: <replaced> 2: <replaced>' + EOL);
		});
	});
});
