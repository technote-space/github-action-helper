/* eslint-disable no-magic-numbers */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  testChildProcess,
  setChildProcessParams,
  spyOnSpawn,
  execCalledWith,
  spyOnStdout,
  stdoutCalledWith,
} from '@technote-space/github-action-test-helper';
import { Logger } from '@technote-space/github-action-log-helper';
import { Command } from '../src';

describe('execAsync', () => {
  testChildProcess();
  beforeEach(() => {
    Logger.resetForTesting();
  });

  const command = new Command(new Logger());

  it('should run command', async() => {
    const mockExec   = spyOnSpawn();
    const mockStdout = spyOnStdout();

    expect(await command.execAsync({ command: 'test' })).toEqual({ stdout: 'stdout', stderr: '', command: 'test' });

    execCalledWith(mockExec, [
      'test',
    ]);
    stdoutCalledWith(mockStdout, [
      '[command]test',
      '  >> stdout',
    ]);
  });

  it('should run command with cwd, altCommand', async() => {
    setChildProcessParams({ stderr: 'stderr' });
    const mockExec   = spyOnSpawn();
    const mockStdout = spyOnStdout();

    expect(await command.execAsync({ command: 'test', cwd: 'dir', altCommand: 'alt' })).toEqual({ stdout: 'stdout', stderr: 'stderr', command: 'alt' });

    execCalledWith(mockExec, [
      'test',
    ]);
    stdoutCalledWith(mockStdout, [
      '[command]alt',
      '  >> stdout',
      '::warning::  >> stderr',
    ]);
  });

  it('should run command with args', async() => {
    const mockExec   = spyOnSpawn();
    const mockStdout = spyOnStdout();

    expect(await command.execAsync({ command: 'test', args: ['hello!', 'how are you doing $USER', '"double"', '\'single\''] })).toEqual({
      stdout: 'stdout',
      stderr: '',
      command: 'test \'hello!\' \'how are you doing $USER\' \'"double"\' \\\'\'single\'\\\'',
    });

    execCalledWith(mockExec, [
      'test \'hello!\' \'how are you doing $USER\' \'"double"\' \\\'\'single\'\\\'',
    ]);
    stdoutCalledWith(mockStdout, [
      '[command]test \'hello!\' \'how are you doing $USER\' \'"double"\' \\\'\'single\'\\\'',
      '  >> stdout',
    ]);
  });

  it('should run command with args, altCommand', async() => {
    const mockExec   = spyOnSpawn();
    const mockStdout = spyOnStdout();

    expect(await command.execAsync({ command: 'test', args: ['hello!', 'how are you doing $USER', '"double"', '\'single\''], altCommand: 'alt' })).toEqual({
      stdout: 'stdout',
      stderr: '',
      command: 'alt',
    });

    execCalledWith(mockExec, [
      'test \'hello!\' \'how are you doing $USER\' \'"double"\' \\\'\'single\'\\\'',
    ]);
    stdoutCalledWith(mockStdout, [
      '[command]alt',
      '  >> stdout',
    ]);
  });

  it('should not output empty stdout', async() => {
    setChildProcessParams({ stdout: ' \n\n  \n' });
    const mockExec   = spyOnSpawn();
    const mockStdout = spyOnStdout();

    expect(await command.execAsync({ command: 'test' })).toEqual({ stdout: '', stderr: '', command: 'test' });

    execCalledWith(mockExec, [
      'test',
    ]);
    stdoutCalledWith(mockStdout, [
      '[command]test',
    ]);
  });

  it('should not output empty stderr', async() => {
    setChildProcessParams({ stderr: ' \n\n  \n' });
    const mockExec   = spyOnSpawn();
    const mockStdout = spyOnStdout();

    expect(await command.execAsync({ command: 'test' })).toEqual({ stdout: 'stdout', stderr: '', command: 'test' });

    execCalledWith(mockExec, [
      'test',
    ]);
    stdoutCalledWith(mockStdout, [
      '[command]test',
      '  >> stdout',
    ]);
  });

  it('should catch error 1', async() => {
    const error   = new Error('test message');
    error['code'] = 123;
    setChildProcessParams({ error: error });

    await expect(command.execAsync({
      command: 'test',
    })).rejects.toThrow('command [test] exited with code 123. message: test message');
  });

  it('should catch error 2', async() => {
    const error   = new Error('test message');
    error['code'] = 123;
    setChildProcessParams({ error: error });

    await expect(command.execAsync({
      command: 'test',
      altCommand: 'alt',
    })).rejects.toThrow('command [alt] exited with code 123. message: test message');
  });

  it('should catch error 3', async() => {
    const error   = new Error('test message');
    error['code'] = 123;
    setChildProcessParams({ error: error });

    await expect(command.execAsync({
      command: 'test',
      altCommand: 'alt',
      quiet: true,
    })).rejects.toThrow('command [alt] exited with code 123.');
  });

  it('should catch error 4', async() => {
    const error   = new Error('test message');
    error['code'] = 123;
    setChildProcessParams({ error: error });

    await expect(command.execAsync({
      command: 'test',
      quiet: true,
    })).rejects.toThrow('command exited with code 123.');
  });

  it('should catch error 5', async() => {
    setChildProcessParams({ stderr: 'error message', code: 123 });

    await expect(command.execAsync({
      command: 'test',
    })).rejects.toThrow('command [test] exited with code 123. message: error message');
  });

  it('should suppress stdout', async() => {
    const mockExec   = spyOnSpawn();
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

  it('should output stdout instead of stderr', async() => {
    setChildProcessParams({ stderr: 'stderr' });
    const mockExec   = spyOnSpawn();
    const mockStdout = spyOnStdout();

    await command.execAsync({
      command: 'test',
      stderrToStdout: true,
    });

    execCalledWith(mockExec, [
      'test',
    ]);
    stdoutCalledWith(mockStdout, [
      '[command]test',
      '  >> stdout',
      '  >> stderr',
    ]);
  });

  it('should not output stdout', async() => {
    setChildProcessParams({ stdout: '' });
    const mockExec   = spyOnSpawn();
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
    const mockExec   = spyOnSpawn();
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
