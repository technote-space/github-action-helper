/* eslint-disable no-magic-numbers */
import global from './global';
import { Logger, Command } from '../src';
import { spyOnSignale, testLogger } from './util';

describe('Command', () => {
	testLogger();
	afterEach(() => {
		global.mockChildProcess.stdout = 'stdout';
		global.mockChildProcess.stderr = '';
		global.mockChildProcess.error = null;
	});

	const command = new Command(new Logger());

	it('should run command', async() => {
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const {logMock} = spyOnSignale();

		expect(await command.execAsync({command: 'test'})).toBe('stdout');

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test');
		expect(logMock).toBeCalledTimes(2);
		expect(logMock.mock.calls[0][0]).toBe('[command]test');
		expect(logMock.mock.calls[1][0]).toBe('  >> stdout');
	});

	it('should run command with cwd, altCommand', async() => {
		global.mockChildProcess.stderr = 'stderr';
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const {logMock, warnMock} = spyOnSignale();

		expect(await command.execAsync({command: 'test', cwd: 'dir', altCommand: 'alt'})).toBe('stdout');

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test');
		expect(execMock.mock.calls[0][1]).toEqual({'cwd': 'dir'});
		expect(logMock).toBeCalledTimes(2);
		expect(logMock.mock.calls[0][0]).toBe('[command]alt');
		expect(logMock.mock.calls[1][0]).toBe('  >> stdout');
		expect(warnMock).toBeCalledTimes(1);
		expect(warnMock.mock.calls[0][0]).toBe('  >> stderr');
	});

	it('should catch error 1', async() => {
		global.mockChildProcess.error = new Error('test message');
		global.mockChildProcess.error.code = 123;

		await expect(command.execAsync({
			command: 'test',
		})).rejects.toBe('command [test] exited with code 123. message: test message');
	});

	it('should catch error 2', async() => {
		global.mockChildProcess.error = new Error('test message');
		global.mockChildProcess.error.code = 123;

		await expect(command.execAsync({
			command: 'test',
			altCommand: 'alt',
		})).rejects.toBe('command [alt] exited with code 123. message: test message');
	});

	it('should catch error 3', async() => {
		global.mockChildProcess.error = new Error('test message');
		global.mockChildProcess.error.code = 123;

		await expect(command.execAsync({
			command: 'test',
			altCommand: 'alt',
			quiet: true,
		})).rejects.toBe('command [alt] exited with code 123.');
	});

	it('should catch error 4', async() => {
		global.mockChildProcess.error = new Error('test message');
		global.mockChildProcess.error.code = 123;

		await expect(command.execAsync({
			command: 'test',
			quiet: true,
		})).rejects.toBe('command exited with code 123.');
	});

	it('should suppress stdout', async() => {
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const {logMock} = spyOnSignale();

		await command.execAsync({
			command: 'test',
			suppressOutput: true,
		});

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test');
		expect(logMock).toBeCalledTimes(1);
		expect(logMock.mock.calls[0][0]).toBe('[command]test');
	});

	it('should not output stdout', async() => {
		global.mockChildProcess.stdout = '';
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const {logMock} = spyOnSignale();

		await command.execAsync({
			command: 'test',
		});

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test');
		expect(logMock).toBeCalledTimes(1);
		expect(logMock.mock.calls[0][0]).toBe('[command]test');
	});

	it('should run suppress error command', async() => {
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const {logMock} = spyOnSignale();

		await command.execAsync({
			command: 'test',
			suppressError: true,
		});

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test || :');
		expect(logMock).toBeCalledTimes(2);
		expect(logMock.mock.calls[0][0]).toBe('[command]test');
		expect(logMock.mock.calls[1][0]).toBe('  >> stdout');
	});
});
