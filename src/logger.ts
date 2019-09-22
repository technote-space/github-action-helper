import { EOL } from 'os';
import { sprintf } from 'sprintf-js';

/**
 * Logger
 */
export class Logger {

	private readonly replacer: (string) => string;
	private static isRequiredEndGroup = false;

	/**
	 * @param {function|undefined} replacer replacer
	 */
	constructor(replacer?: (string) => string) {
		this.replacer = replacer ? replacer : (text: string): string => text;
	}

	/**
	 * @param {string} message message
	 * @return {string[]} message
	 */
	private splitMessage = (message: string): string[] => message.replace(/\r?\n$/, '').split(/\r?\n/);

	/**
	 * @param {string} message message
	 * @param {any[]} args args
	 */
	public log = (message: string, ...args: any[]): void => { // eslint-disable-line @typescript-eslint/no-explicit-any
		process.stdout.write(sprintf(this.replacer(message), ...args.map(arg => 'string' === typeof arg ? this.replacer(arg) : arg)) + EOL);
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private multiLineOutput = (replacer: (string) => string, message: string | string[], ...args: any[]): void => {
		if ('string' !== typeof message) {
			message.forEach(message => {
				this.multiLineOutput(replacer, message, ...args);
			});
			return;
		}

		this.splitMessage(message).forEach(message => this.log(replacer(message), ...args));
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public info = (message: string | string[], ...args: any[]): void => this.multiLineOutput(message => `> ${message}`, message, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public debug = (message: string | string[], ...args: any[]): void => this.multiLineOutput(message => `##[debug]${message}`, message, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public error = (message: string | string[], ...args: any[]): void => this.multiLineOutput(message => `##[error]${message}`, message, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public warn = (message: string | string[], ...args: any[]): void => this.multiLineOutput(message => `##[warning]${message}`, message, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public displayCommand = (message: string | string[], ...args: any[]): void => this.multiLineOutput(message => `[command]${message}`, message, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public displayStdout = (message: string | string[]): void => this.multiLineOutput(message => `  >> ${message}`, message);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public displayStderr = (message: string | string[]): void => this.multiLineOutput(message => `##[warning]  >> ${message}`, message);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public startProcess = (message: string, ...args: any[]): void => {
		this.endProcess();
		this.log(`##[group]${message}`, ...args);
		Logger.isRequiredEndGroup = true;
	};

	public endProcess = (): void => {
		if (Logger.isRequiredEndGroup) {
			this.log('##[endgroup]');
			Logger.isRequiredEndGroup = false;
		}
	};

	public static resetForTesting = (): void => {
		Logger.isRequiredEndGroup = false;
	};
}
