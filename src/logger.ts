/* eslint-disable @typescript-eslint/no-explicit-any */
import { sprintf } from 'sprintf-js';
import { info, debug, error, warning, startGroup, endGroup } from '@actions/core';
import { split } from './utils';

export type Color = 'black' | 'red' | 'green' | 'yellow' | 'blue' | 'magenta' | 'cyan' | 'white';
export type Attribute = undefined | 'none' | 'bold' | 'underline' | 'italic';
const COLOR_MAP     = {
	'black': 0,
	'red': 1,
	'green': 2,
	'yellow': 3,
	'blue': 4,
	'magenta': 5,
	'cyan': 6,
	'white': 7,
};
const ATTRIBUTE_MAP = {
	'none': 0,
	'bold': 1,
	'underline': 4,
	'italic': 3,
};

/**
 * Logger
 */
export default class Logger {

	private readonly replacer: (string: string) => string;
	private static isRequiredEndGroup = false;

	/**
	 * @param {function|undefined} replacer replacer
	 * @param {boolean} notUseGroup not use group?
	 */
	constructor(replacer?: (string: string) => string, private notUseGroup = false) {
		this.replacer = replacer ? replacer : (text: string): string => text;
	}

	/**
	 * @param {string} message message
	 * @return {string[]} messages
	 */
	private splitMessage = (message: string): string[] => split(message.replace(/\r?\n$/, ''));

	/**
	 * @param {string} message message
	 * @param {any[]} args args
	 * @return {string} output string
	 */
	private getOutputString = (message: string, ...args: any[]): string => sprintf(this.replacer(message), ...args.map(arg => 'string' === typeof arg ? this.replacer(arg) : arg));

	/**
	 * @param {function} output output function
	 * @param {function|null} replacer replacer
	 * @param {string|string[]} message message
	 * @param {any[]} args args
	 */
	private multiLineOutput = (output: (string) => void, replacer: null | ((string: string) => string), message?: string | string[], ...args: any[]): void => {
		if (undefined === message || '' === message) {
			output('');
			return;
		}
		if ('string' !== typeof message) {
			message.forEach(message => {
				this.multiLineOutput(output, replacer, message, ...args);
			});
			return;
		}

		this.splitMessage(message).forEach(message => output(this.getOutputString(replacer ? replacer(message) : message, ...args)));
	};

	/**
	 * @param {string|string[]} message message
	 * @param {any[]} args args
	 * @return {void}
	 */
	public log = (message?: string | string[], ...args: any[]): void => this.multiLineOutput(info, null, message, ...args);

	/**
	 * @param {string|string[]} message message
	 * @param {any[]} args args
	 * @return {void}
	 */
	public info = (message: string | string[], ...args: any[]): void => this.multiLineOutput(info, message => `> ${message}`, message, ...args);

	/**
	 * @param {string|string[]} message message
	 * @param {any[]} args args
	 * @return {void}
	 */
	public debug = (message: string | string[], ...args: any[]): void => this.multiLineOutput(debug, null, message, ...args);

	/**
	 * @param {string|string[]} message message
	 * @param {any[]} args args
	 * @return {void}
	 */
	public error = (message: string | string[], ...args: any[]): void => this.multiLineOutput(error, null, message, ...args);

	/**
	 * @param {string|string[]} message message
	 * @param {any[]} args args
	 * @return {void}
	 */
	public warn = (message: string | string[], ...args: any[]): void => this.multiLineOutput(warning, null, message, ...args);

	/**
	 * @param {string|string[]} message message
	 * @param {any[]} args args
	 * @return {void}
	 */
	public displayCommand = (message: string | string[], ...args: any[]): void => this.multiLineOutput(info, message => `[command]${message}`, message, ...args);

	/**
	 * @param {string|string[]} message message
	 * @return {void}
	 */
	public displayStdout = (message: string | string[]): void => this.multiLineOutput(info, message => `  >> ${message}`, message);

	/**
	 * @param {string|string[]} message message
	 * @return {void}
	 */
	public displayStderr = (message: string | string[]): void => this.multiLineOutput(warning, message => `  >> ${message}`, message);

	/**
	 * @param {string} message message
	 * @param {any[]} args args
	 * @return {void}
	 */
	public startProcess = (message: string, ...args: any[]): void => {
		if (this.notUseGroup) {
			this.info(message, ...args);
			return;
		}
		this.endProcess();
		startGroup(this.getOutputString(message, ...args));
		Logger.isRequiredEndGroup = true;
	};

	/**
	 * @return {void}
	 */
	public endProcess = (): void => {
		if (this.notUseGroup) {
			return;
		}
		if (Logger.isRequiredEndGroup) {
			endGroup();
			Logger.isRequiredEndGroup = false;
		}
	};

	/**
	 * @param {string} string string
	 * @param {Color} color color
	 * @param {Color} backColor background color
	 * @param {Attribute} attribute attribute
	 * @return {string} color string
	 */
	public getColorString = (string: string, color: Color, backColor?: Color, attribute?: Attribute): string => sprintf('\x1b[3%d;4%d;%dm%s\x1b[0m', COLOR_MAP[color], COLOR_MAP[backColor ?? 'black'], ATTRIBUTE_MAP[attribute ?? 'none'], string);

	/**
	 * @param {string} string string
	 * @param {Color} color color
	 * @param {Color} backColor background color
	 * @param {Attribute} attribute attribute
	 * @return {string} color string
	 */
	public c = (string: string, color: Color, backColor?: Color, attribute?: Attribute): string => this.getColorString(string, color, backColor, attribute);

	/**
	 * @return {void}
	 */
	public static resetForTesting = (): void => {
		Logger.isRequiredEndGroup = false;
	};
}
