import { ExecException } from 'child_process';

interface Global extends NodeJS.Global {
	mockSignale: {
		info: jest.Mock;
		log: jest.Mock;
		command: jest.Mock;
		warn: jest.Mock;
	};
	mockChildProcess: {
		exec: jest.Mock;
		stdout: string;
		stderr: string;
		error: ExecException | null;
	};
}

declare const global: Global;
export default global;
