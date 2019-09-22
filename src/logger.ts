import { Signale } from 'signale';
import types from 'signale/types';

/**
 * Logger
 */
export class Logger {

	private readonly signale: Signale;
	private readonly replacer: (string) => string;
	private static isRequiredEndGroup = false;

	/**
	 * @param {function|undefined} replacer replacer
	 * @param {object|undefined} signaleSettings signale settings
	 */
	constructor(replacer?: (string) => string, signaleSettings?: object) {
		this.signale = new Signale(Object.assign({}, {
			types: {
				info: {
					color: 'cyan',
				},
			},
		}, signaleSettings));

		this.replacer = replacer ? replacer : (text: string): string => text;

		Object.keys(types).forEach(type => {
			if (!this[type]) {
				this[type] = this.signale[type];
			}
		});
	}

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private output = (type: 'log' | 'info' | 'warn', message: string, ...args: any[]): void => {
		this.signale[type](this.replacer(message), ...args.map(arg => 'string' === typeof arg ? this.replacer(arg) : arg));
	};

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public info = (message: string, ...args: any[]): void => this.output('info', message, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public displayCommand = (message: string, ...args: any[]): void => this.output('log', `[command]${message}`, ...args);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public displayStdout = (message: string): void => message.replace(/\r?\n$/, '').split(/\r?\n/).forEach(line => this.output('log', `  >> ${line}`));

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public displayStderr = (message: string): void => message.replace(/\r?\n$/, '').split(/\r?\n/).forEach(line => this.output('warn', `  >> ${line}`));

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public startProcess = (message: string, ...args: any[]): void => {
		this.endProcess();
		this.output('log', `##[group]${message}`, ...args);
		Logger.isRequiredEndGroup = true;
	};

	public endProcess = (): void => {
		if (Logger.isRequiredEndGroup) {
			this.output('log', '##[endgroup]');
			Logger.isRequiredEndGroup = false;
		}
	};

	public static resetForTesting = (): void => {
		Logger.isRequiredEndGroup = false;
	};
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LoggerFunction = (...message: any[]) => void;
type DefaultLogger =
	| 'await'
	| 'complete'
	| 'debug'
	| 'error'
	| 'fatal'
	| 'fav'
	| 'info'
	| 'log'
	| 'note'
	| 'pause'
	| 'pending'
	| 'star'
	| 'start'
	| 'success'
	| 'wait'
	| 'warn'
	| 'watch'

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Logger extends Record<DefaultLogger, LoggerFunction> {
}
