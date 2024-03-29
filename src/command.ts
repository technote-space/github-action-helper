import type { Logger } from '@technote-space/github-action-log-helper';
import type { ExecException } from 'child_process';
import { exec, spawn } from 'child_process';
import escape from 'shell-escape';

class CommandError extends Error {
  constructor(message: string, public code: number) {
    super(message);
  }
}

export default class Command {
  constructor(private readonly logger: Logger, private readonly useExec = false) {
  }

  private getCommand = (command: string, quiet: boolean, suppressError: boolean): string => command + (quiet ? ' > /dev/null 2>&1' : '') + (suppressError ? ' || :' : '');

  private getRejectedErrorMessage = (command: string, altCommand: string | undefined, quiet: boolean, error: ExecException): string => {
    if ('string' === typeof altCommand) {
      if (!quiet) {
        return `command [${altCommand}] exited with code ${error.code}. message: ${error.message}`;
      } else {
        return `command [${altCommand}] exited with code ${error.code}.`;
      }
    } else if (!quiet) {
      return `command [${command}] exited with code ${error.code}. message: ${error.message}`;
    }
    return `command exited with code ${error.code}.`;
  };

  private getCommandResult = (
    command: string,
    altCommand: string | undefined,
    stderrToStdout: boolean,
    stdout: string,
    stderr: string,
  ): { stdout: string; stderr: string; command: string } => {
    let trimmedStdout = stdout.trim();
    let trimmedStderr = stderr.trim();
    if (trimmedStderr && stderrToStdout) {
      trimmedStdout += `\n${trimmedStderr}`;
      trimmedStderr = '';
    }

    return { stdout: trimmedStdout, stderr: trimmedStderr, command: 'string' === typeof altCommand ? altCommand : command };
  };

  private outputStdout = (
    stdout: string,
    quiet: boolean,
    suppressOutput: boolean,
  ): void => {
    const trimmedStdout = stdout.trim();
    if (!quiet && !suppressOutput) {
      if (trimmedStdout) {
        this.logger.displayStdout(trimmedStdout);
      }
    }
  };

  private outputStderr = (
    stderr: string,
    quiet: boolean,
    suppressOutput: boolean,
    stderrToStdout: boolean,
  ): void => {
    const trimmedStderr = stderr.trim();
    if (!quiet && !suppressOutput) {
      if (trimmedStderr) {
        if (stderrToStdout) {
          this.logger.displayStdout(trimmedStderr);
        } else {
          this.logger.displayStderr(trimmedStderr);
        }
      }
    }
  };

  private execCommand = (
    command: string,
    quiet: boolean,
    suppressOutput: boolean,
    stderrToStdout: boolean,
    cwd?: string,
  ): Promise<{ stdout: string; stderr: string }> => {
    return new Promise((resolve, reject) => {
      const subProcess = spawn(command, [], { shell: true, cwd, stdio: [process.stdin, 'pipe', 'pipe'] });
      let stdout       = '';
      let stderr       = '';
      subProcess.stdout.on('data', (data) => {
        this.outputStdout(data.toString(), quiet, suppressOutput);
        stdout += data.toString();
      });

      subProcess.stderr.on('data', (data) => {
        this.outputStderr(data.toString(), quiet, suppressOutput, stderrToStdout);
        stderr += data.toString();
      });

      subProcess.on('error', (err) => {
        reject(err);
      });
      subProcess.on('close', (code) => {
        if (code) {
          reject(new CommandError(stderr, code));
        }

        resolve({ stdout, stderr });
      });
    });
  };

  private execCallback = (
    command: string,
    altCommand: string | undefined,
    quiet: boolean,
    suppressOutput: boolean,
    stderrToStdout: boolean,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve: (value: any) => void,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    reject: (value: any) => void,
  ): (error: ExecException | null, stdout: string, stderr: string) => void => (error: ExecException | null, stdout: string, stderr: string): void => {
    if (error) {
      reject(new Error(this.getRejectedErrorMessage(command, altCommand, quiet, error)));
    } else {
      let trimmedStdout = stdout.trim();
      let trimmedStderr = stderr.trim();
      if (!quiet && !suppressOutput) {
        if (trimmedStdout) {
          this.logger.displayStdout(trimmedStdout);
        }
        if (trimmedStderr) {
          if (stderrToStdout) {
            this.logger.displayStdout(trimmedStderr);
            trimmedStdout += `\n${trimmedStderr}`;
            trimmedStderr = '';
          } else {
            this.logger.displayStderr(trimmedStderr);
          }
        }
      }
      resolve({ stdout: trimmedStdout, stderr: trimmedStderr, command: 'string' === typeof altCommand ? altCommand : command });
    }
  };

  public execAsync = async(options: {
    command: string;
    args?: string[];
    cwd?: string;
    quiet?: boolean;
    altCommand?: string;
    suppressError?: boolean;
    suppressOutput?: boolean;
    stderrToStdout?: boolean;
  }): Promise<{ stdout: string; stderr: string; command: string }> | never => {
    const { command, args, cwd, altCommand, quiet = false, suppressError = false, suppressOutput = false, stderrToStdout = false } = options;

    const commandArgs     = undefined === args ? '' : escape(args.map(item => item.trim()).filter(item => item.length));
    const commandWithArgs = command + (commandArgs.length ? ' ' + commandArgs : '');
    if (undefined !== altCommand) {
      if (altCommand) {
        this.logger.displayCommand(altCommand);
      }
    } else if (!quiet) {
      this.logger.displayCommand(commandWithArgs);
    }

    if (this.useExec) {
      return new Promise((resolve, reject) => {
        if (typeof cwd === 'undefined') {
          exec(this.getCommand(commandWithArgs, quiet, suppressError), this.execCallback(commandWithArgs, altCommand, quiet, suppressOutput, stderrToStdout, resolve, reject));
        } else {
          exec(this.getCommand(commandWithArgs, quiet, suppressError), { cwd }, this.execCallback(commandWithArgs, altCommand, quiet, suppressOutput, stderrToStdout, resolve, reject));
        }
      });
    } else {
      try {
        const { stdout, stderr } = await this.execCommand(this.getCommand(commandWithArgs, quiet, suppressError), quiet, suppressOutput, stderrToStdout, cwd);
        return this.getCommandResult(commandWithArgs, altCommand, stderrToStdout, stdout, stderr);
      } catch (error) {
        throw new Error(this.getRejectedErrorMessage(command, altCommand, quiet, error as ExecException));
      }
    }
  };
}
