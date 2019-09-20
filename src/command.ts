import { exec, ExecException } from 'child_process';
import Logger from './logger';

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
	 * @param {function} resolve resolve
	 * @param {function} reject reject
	 * @return {void} void
	 */
	private execCallback = (
		command: string,
		altCommand: string | undefined,
		quiet: boolean,
		suppressOutput: boolean,
		resolve: Function,
		reject: Function,
	): (error: ExecException | null, stdout: string, stderr: string) => void => (error: ExecException | null, stdout: string, stderr: string): void => {
		if (error) {
			reject(this.getRejectedErrorMessage(command, altCommand, quiet, error));
		} else {
			if (!quiet && !suppressOutput) {
				if (stdout) {
					this.logger.displayStdout(stdout);
				}
				if (stderr) {
					this.logger.displayStderr(stderr);
				}
			}
			resolve(stdout);
		}
	};

	/**
	 * @param {object} args args
	 * @param {string} args.command command
	 * @param {string|undefined} args.cwd cwd
	 * @param {boolean|undefined} args.quiet quiet?
	 * @param {string|undefined} args.altCommand alt command
	 * @param {boolean|undefined} args.suppressError suppress error?
	 * @param {boolean|undefined} args.suppressOutput suppress output?
	 * @return {Promise<string>} output
	 */
	public execAsync = (args: {
		command: string;
		cwd?: string;
		quiet?: boolean;
		altCommand?: string;
		suppressError?: boolean;
		suppressOutput?: boolean;
	}): Promise<string> => new Promise<string>((resolve, reject): void => {
		const {command, cwd, altCommand, quiet = false, suppressError = false, suppressOutput = false} = args;

		if ('string' === typeof altCommand) {
			this.logger.displayCommand(altCommand);
		} else if (!quiet) {
			this.logger.displayCommand(command);
		}

		if (typeof cwd === 'undefined') {
			exec(this.getCommand(command, quiet, suppressError), this.execCallback(command, altCommand, quiet, suppressOutput, resolve, reject));
		} else {
			exec(this.getCommand(command, quiet, suppressError), {cwd}, this.execCallback(command, altCommand, quiet, suppressOutput, resolve, reject));
		}
	});
}
