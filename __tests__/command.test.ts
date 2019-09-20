/* eslint-disable no-magic-numbers */
import global from './global';
import { Logger, Command } from '../src';
import { spyOnSignale } from './util';

describe('Command', () => {
	const command = new Command(new Logger());

	afterEach(() => {
		global.mockChildProcess.stdout = 'stdout';
		global.mockChildProcess.stderr = '';
		global.mockChildProcess.error = null;
	});

	it('should run command', async() => {
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const {commandMock} = spyOnSignale();

		expect(await command.execAsync({command: 'test'})).toBe('stdout');

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test');
		expect(commandMock).toBeCalledTimes(2);
		expect(commandMock.mock.calls[0][0]).toBe('  > test');
		expect(commandMock.mock.calls[1][0]).toBe('    >> stdout');
	});

	it('should run command with cwd, altCommand', async() => {
		global.mockChildProcess.stderr = 'stderr';
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const {commandMock, warnMock} = spyOnSignale();

		expect(await command.execAsync({command: 'test', cwd: 'dir', altCommand: 'alt'})).toBe('stdout');

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test');
		expect(execMock.mock.calls[0][1]).toEqual({'cwd': 'dir'});
		expect(commandMock).toBeCalledTimes(2);
		expect(commandMock.mock.calls[0][0]).toBe('  > alt');
		expect(commandMock.mock.calls[1][0]).toBe('    >> stdout');
		expect(warnMock).toBeCalledTimes(1);
		expect(warnMock.mock.calls[0][0]).toBe('    >> stderr');
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
		const {commandMock} = spyOnSignale();

		await command.execAsync({
			command: 'test',
			suppressOutput: true,
		});

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test');
		expect(commandMock).toBeCalledTimes(1);
		expect(commandMock.mock.calls[0][0]).toBe('  > test');
	});

	it('should not output stdout', async() => {
		global.mockChildProcess.stdout = '';
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const {commandMock} = spyOnSignale();

		await command.execAsync({
			command: 'test',
		});

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test');
		expect(commandMock).toBeCalledTimes(1);
		expect(commandMock.mock.calls[0][0]).toBe('  > test');
	});

	it('should run suppress error command', async() => {
		const execMock = jest.spyOn(global.mockChildProcess, 'exec');
		const {commandMock} = spyOnSignale();

		await command.execAsync({
			command: 'test',
			suppressError: true,
		});

		expect(execMock).toBeCalledTimes(1);
		expect(execMock.mock.calls[0][0]).toBe('test || :');
		expect(commandMock).toBeCalledTimes(2);
		expect(commandMock.mock.calls[0][0]).toBe('  > test');
		expect(commandMock.mock.calls[1][0]).toBe('    >> stdout');
	});
});
