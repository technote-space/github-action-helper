import { exec, ExecException } from 'child_process';
import escape from 'shell-escape';
import { Logger } from './index';

/**
 * Command
 */
export default class Command {

	/**
	 * @param {Logger} logger logger
	 */
	constructor(private logger: Logger) {
	}

	/**
	 * @param {string} command command
	 * @param {boolean} quiet quiet?
	 * @param {boolean} suppressError suppress error?
	 * @return {string} command
	 */
	private getCommand = (command: string, quiet: boolean, suppressError: boolean): string => command + (quiet ? ' > /dev/null 2>&1' : '') + (suppressError ? ' || :' : '');

	/**
	 * @param {string} command command
	 * @param {string} altCommand alt command
	 * @param {boolean} quiet quiet?
	 * @param {ExecException} error error
	 * @return {string} message
	 */
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

	/**
	 * @param {string} command command
	 * @param {string|undefined} altCommand alt command
	 * @param {boolean} quiet quiet?
	 * @param {boolean} suppressOutput suppress output?
	 * @param {boolean} stderrToStdout output to stdout instead of stderr
	 * @param {function} resolve resolve
	 * @param {function} reject reject
	 * @return {void} void
	 */
	private execCallback = (
		command: string,
		altCommand: string | undefined,
		quiet: boolean,
		suppressOutput: boolean,
		stderrToStdout: boolean,
		resolve: Function,
		reject: Function,
	): (error: ExecException | null, stdout: string, stderr: string) => void => (error: ExecException | null, stdout: string, stderr: string): void => {
		if (error) {
			reject(this.getRejectedErrorMessage(command, altCommand, quiet, error));
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
			resolve({stdout: trimmedStdout, stderr: trimmedStderr, command: 'string' === typeof altCommand ? altCommand : command});
		}
	};

	/**
	 * @param {object} options options
	 * @param {string} options.command command
	 * @param {string[]|undefined} options.args command
	 * @param {string|undefined} options.cwd cwd
	 * @param {boolean|undefined} options.quiet quiet?
	 * @param {string|undefined} options.altCommand alt command
	 * @param {boolean|undefined} options.suppressError suppress error?
	 * @param {boolean|undefined} options.suppressOutput suppress output?
	 * @param {boolean|undefined} options.stderrToStdout output to stdout instead of stderr
	 * @return {Promise<object>} output
	 */
	public execAsync = (options: {
		command: string;
		args?: string[];
		cwd?: string;
		quiet?: boolean;
		altCommand?: string;
		suppressError?: boolean;
		suppressOutput?: boolean;
		stderrToStdout?: boolean;
	}): Promise<{ stdout: string; stderr: string; command: string }> => new Promise<{ stdout: string; stderr: string; command: string }>((resolve, reject): void => {
		const {command, args, cwd, altCommand, quiet = false, suppressError = false, suppressOutput = false, stderrToStdout = false} = options;

		const commandArgs     = undefined === args ? '' : escape(args.map(item => item.trim()).filter(item => item.length));
		const commandWithArgs = command + (commandArgs.length ? ' ' + commandArgs : '');
		if (undefined !== altCommand) {
			if (altCommand) {
				this.logger.displayCommand(altCommand);
			}
		} else if (!quiet) {
			this.logger.displayCommand(commandWithArgs);
		}

		if (typeof cwd === 'undefined') {
			exec(this.getCommand(commandWithArgs, quiet, suppressError), this.execCallback(commandWithArgs, altCommand, quiet, suppressOutput, stderrToStdout, resolve, reject));
		} else {
			exec(this.getCommand(commandWithArgs, quiet, suppressError), {cwd}, this.execCallback(commandWithArgs, altCommand, quiet, suppressOutput, stderrToStdout, resolve, reject));
		}
	});
}
