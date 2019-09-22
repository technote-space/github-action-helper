import { Logger } from '../src';

export const testLogger = (): void => {
	beforeEach(() => {
		Logger.resetForTesting();
	});
};
