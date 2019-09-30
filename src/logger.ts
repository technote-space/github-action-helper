import { sprintf } from 'sprintf-js';
import { info, debug, error, warning, startGroup, endGroup } from '@actions/core';

/**
 * Logger
 */
export default class Logger {

	private readonly replacer: (string) => string;
	private static isRequiredEndGroup = false;

	/**
	 * @param {function|undefined} replacer replacer
	 */
	constructor(replacer?: (string: string) => string) {
		this.replacer = replacer ? replacer : (text: string): string => text;
	}

	/**
	 * @param {string} message message
	 * @return {string[]} message
	 */
	private splitMessage = (message: string): string[] => message.replace(/\r?\n$/, '').split(/\r?\n/);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private getOutputString = (message: string, ...args: any[]): string => sprintf(this.replacer(message), ...args.map(arg => 'string' === typeof arg ? this.replacer(arg) : arg));

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private multiLineOutput = (output: (string) => void, replacer: null | ((string) => string), message: string | string[], ...args: any[]): void => {
		if ('string' !== typeof message) {
			message.forEach(message => {
				this.multiLineOutput(output, replacer, message, ...args);
			});
			return;
		}

		this.splitMessage(message).forEach(message => output(this.getOutputString(replacer ? replacer(message) : message, ...args)));
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public log = (message: string | string[], ...args: any[]): void => this.multiLineOutput(info, null, message, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public info = (message: string | string[], ...args: any[]): void => this.multiLineOutput(info, message => `> ${message}`, message, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public debug = (message: string | string[], ...args: any[]): void => this.multiLineOutput(debug, null, message, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public error = (message: string | string[], ...args: any[]): void => this.multiLineOutput(error, null, message, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public warn = (message: string | string[], ...args: any[]): void => this.multiLineOutput(warning, null, message, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public displayCommand = (message: string | string[], ...args: any[]): void => this.multiLineOutput(info, message => `[command]${message}`, message, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public displayStdout = (message: string | string[]): void => this.multiLineOutput(info, message => `  >> ${message}`, message);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public displayStderr = (message: string | string[]): void => this.multiLineOutput(warning, message => `  >> ${message}`, message);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public startProcess = (message: string, ...args: any[]): void => {
		this.endProcess();
		startGroup(this.getOutputString(message, ...args));
		Logger.isRequiredEndGroup = true;
	};

	public endProcess = (): void => {
		if (Logger.isRequiredEndGroup) {
			endGroup();
			Logger.isRequiredEndGroup = false;
		}
	};

	public static resetForTesting = (): void => {
		Logger.isRequiredEndGroup = false;
	};
}
