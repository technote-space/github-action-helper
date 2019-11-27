/* eslint-disable no-magic-numbers */
import {
	spyOnStdout,
	stdoutCalledWith,
} from '@technote-space/github-action-test-helper';
import { Logger } from '../src';

describe('Logger', () => {
	beforeEach(() => {
		Logger.resetForTesting();
	});

	const logger = new Logger();

	describe('log', () => {
		it('should output log', () => {
			const mockStdout = spyOnStdout();

			logger.log('test');

			stdoutCalledWith(mockStdout, ['test']);
		});
	});

	describe('info', () => {
		it('should output info', () => {
			const mockStdout = spyOnStdout();

			logger.info('test');

			stdoutCalledWith(mockStdout, ['> test']);
		});
	});

	describe('debug', () => {
		it('should output debug', () => {
			const mockStdout = spyOnStdout();

			logger.debug('test');

			stdoutCalledWith(mockStdout, ['::debug::test']);
		});
	});

	describe('error', () => {
		it('should output debug', () => {
			const mockStdout = spyOnStdout();

			logger.error('test');

			stdoutCalledWith(mockStdout, ['::error::test']);
		});
	});

	describe('warn', () => {
		it('should output debug', () => {
			const mockStdout = spyOnStdout();

			logger.warn('test');

			stdoutCalledWith(mockStdout, ['::warning::test']);
		});
	});

	describe('displayCommand', () => {
		it('should output command', () => {
			const mockStdout = spyOnStdout();

			logger.displayCommand('test');

			stdoutCalledWith(mockStdout, ['[command]test']);
		});
	});

	describe('displayStdout', () => {
		it('should output command', () => {
			const mockStdout = spyOnStdout();

			logger.displayStdout('test1\ntest2\n');

			stdoutCalledWith(mockStdout, [
				'  >> test1',
				'  >> test2',
			]);
		});
	});

	describe('displayStderr', () => {
		it('should output warn', () => {
			const mockStdout = spyOnStdout();

			logger.displayStderr('test1\ntest2\n');

			stdoutCalledWith(mockStdout, [
				'::warning::  >> test1',
				'::warning::  >> test2',
			]);
		});
	});

	describe('startProcess', () => {
		it('should output process', () => {
			const mockStdout = spyOnStdout();

			logger.startProcess('test');

			stdoutCalledWith(mockStdout, ['::group::test']);
		});
	});

	describe('getColorString', () => {
		it('should return color string', () => {
			expect(logger.getColorString('Hello World!!!', 'blue', 'red', 'bold')).toBe('\x1b[34;41;1mHello World!!!\x1b[0m');
			expect(logger.getColorString('Hello World!!!', 'green')).toBe('\x1b[32;40;0mHello World!!!\x1b[0m');
			expect(logger.c('Hello World!!!', 'green')).toBe('\x1b[32;40;0mHello World!!!\x1b[0m');
			expect(logger.c('Hello World!!!', 'yellow', undefined, 'underline')).toBe('\x1b[33;40;4mHello World!!!\x1b[0m');
		});
	});
});

describe('Logger with string array', () => {
	beforeEach(() => {
		Logger.resetForTesting();
	});

	const logger = new Logger();

	describe('info', () => {
		it('should output info', () => {
			const mockStdout = spyOnStdout();

			logger.info(['test1', 'test2']);

			stdoutCalledWith(mockStdout, [
				'> test1',
				'> test2',
			]);
		});
	});

	describe('displayCommand', () => {
		it('should output command', () => {
			const mockStdout = spyOnStdout();

			logger.displayCommand(['test1', 'test2']);

			stdoutCalledWith(mockStdout, [
				'[command]test1',
				'[command]test2',
			]);
		});
	});

	describe('displayStdout', () => {
		it('should output command', () => {
			const mockStdout = spyOnStdout();

			logger.displayStdout(['test1\ntest2\n', 'test3']);

			stdoutCalledWith(mockStdout, [
				'  >> test1',
				'  >> test2',
				'  >> test3',
			]);
		});
	});

	describe('displayStderr', () => {
		it('should output warn', () => {
			const mockStdout = spyOnStdout();

			logger.displayStderr(['test1\ntest2\n', 'test3']);

			stdoutCalledWith(mockStdout, [
				'::warning::  >> test1',
				'::warning::  >> test2',
				'::warning::  >> test3',
			]);
		});
	});
});

describe('Logger with arguments', () => {
	beforeEach(() => {
		Logger.resetForTesting();
	});

	const logger = new Logger((string: string): string => string.replace('<replace target>', '<replaced>'), true);

	it('info output info with args', () => {
		const mockStdout = spyOnStdout();

		logger.info('message with args %s %d: <replace target>', '<replace target>', 2);

		stdoutCalledWith(mockStdout, ['> message with args <replaced> 2: <replaced>']);
	});

	it('info should not replace placeholder', () => {
		const mockStdout = spyOnStdout();

		logger.info('message with args %s %d: <replace target>');

		stdoutCalledWith(mockStdout, ['> message with args %s %d: <replaced>']);
	});

	it('displayCommand output command with args', () => {
		const mockStdout = spyOnStdout();

		logger.displayCommand('message with args %s %d: <replace target>', '<replace target>', 2);

		stdoutCalledWith(mockStdout, ['[command]message with args <replaced> 2: <replaced>']);
	});

	describe('startProcess', () => {
		it('should output process with args', () => {
			const mockStdout = spyOnStdout();

			logger.startProcess('message with args %s %d: <replace target>', '<replace target>', 2);
			logger.endProcess();

			stdoutCalledWith(mockStdout, ['> message with args <replaced> 2: <replaced>']);
		});
	});
});

describe('Logger with mixed', () => {
	beforeEach(() => {
		Logger.resetForTesting();
	});

	const logger = new Logger((string: string): string => string.replace('<replace target>', '<replaced>'));

	describe('debug', () => {
		it('should output debug', () => {
			const mockStdout = spyOnStdout();

			logger.debug(['test1: %s %d: <replace target>', 'test2: %s %d: <replace target>'], '<replace target>', 2);

			stdoutCalledWith(mockStdout, [
				'::debug::test1: <replaced> 2: <replaced>',
				'::debug::test2: <replaced> 2: <replaced>',
			]);
		});
	});
});
