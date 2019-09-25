/* eslint-disable no-magic-numbers */
import {
	testChildProcess,
	setChildProcessParams,
	spyOnExec,
	execCalledWith,
	spyOnStdout,
	stdoutCalledWith,
} from '@technote-space/github-action-test-helper';
import { Logger, Command } from '../src';
import { testLogger } from './util';

describe('Command', () => {
	testLogger();
	testChildProcess();

	const command = new Command(new Logger());

	it('should run command', async() => {
		const mockExec = spyOnExec();
		const mockStdout = spyOnStdout();

		expect(await command.execAsync({command: 'test'})).toBe('stdout');

		execCalledWith(mockExec, [
			'test',
		]);
		stdoutCalledWith(mockStdout, [
			'[command]test',
			'  >> stdout',
		]);
	});

	it('should run command with cwd, altCommand', async() => {
		setChildProcessParams({stderr: 'stderr'});
		const mockExec = spyOnExec();
		const mockStdout = spyOnStdout();

		expect(await command.execAsync({command: 'test', cwd: 'dir', altCommand: 'alt'})).toBe('stdout');

		execCalledWith(mockExec, [
			['test', {'cwd': 'dir'}],
		]);
		stdoutCalledWith(mockStdout, [
			'[command]alt',
			'  >> stdout',
			'::warning::  >> stderr',
		]);
	});

	it('should catch error 1', async() => {
		const error = new Error('test message');
		error['code'] = 123;
		setChildProcessParams({error: error});

		await expect(command.execAsync({
			command: 'test',
		})).rejects.toBe('command [test] exited with code 123. message: test message');
	});

	it('should catch error 2', async() => {
		const error = new Error('test message');
		error['code'] = 123;
		setChildProcessParams({error: error});

		await expect(command.execAsync({
			command: 'test',
			altCommand: 'alt',
		})).rejects.toBe('command [alt] exited with code 123. message: test message');
	});

	it('should catch error 3', async() => {
		const error = new Error('test message');
		error['code'] = 123;
		setChildProcessParams({error: error});

		await expect(command.execAsync({
			command: 'test',
			altCommand: 'alt',
			quiet: true,
		})).rejects.toBe('command [alt] exited with code 123.');
	});

	it('should catch error 4', async() => {
		const error = new Error('test message');
		error['code'] = 123;
		setChildProcessParams({error: error});

		await expect(command.execAsync({
			command: 'test',
			quiet: true,
		})).rejects.toBe('command exited with code 123.');
	});

	it('should suppress stdout', async() => {
		const mockExec = spyOnExec();
		const mockStdout = spyOnStdout();

		await command.execAsync({
			command: 'test',
			suppressOutput: true,
		});

		execCalledWith(mockExec, [
			'test',
		]);
		stdoutCalledWith(mockStdout, [
			'[command]test',
		]);
	});

	it('should not output stdout', async() => {
		setChildProcessParams({stdout: ''});
		const mockExec = spyOnExec();
		const mockStdout = spyOnStdout();

		await command.execAsync({
			command: 'test',
		});

		execCalledWith(mockExec, [
			'test',
		]);
		stdoutCalledWith(mockStdout, [
			'[command]test',
		]);
	});

	it('should run suppress error command', async() => {
		const mockExec = spyOnExec();
		const mockStdout = spyOnStdout();

		await command.execAsync({
			command: 'test',
			suppressError: true,
		});

		execCalledWith(mockExec, [
			'test || :',
		]);
		stdoutCalledWith(mockStdout, [
			'[command]test',
			'  >> stdout',
		]);
	});
});
