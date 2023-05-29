import type { Octokit, components } from './types.js';
import crypto from 'crypto';
import ApiHelper from './api-helper.js';
import Command from './command.js';
import GitHelper from './git-helper.js';

if (typeof global.crypto !== 'object') {
  global.crypto = crypto;
}

if (typeof global.crypto.getRandomValues !== 'function') {
  global.crypto.getRandomValues = getRandomValues;
}

function getRandomValues(array) {
  return crypto.webcrypto.getRandomValues(array);
}

export * as Utils from './utils.js';
export * as ContextHelper from './context-helper.js';

export type { Octokit, components };
export { Command, ApiHelper, GitHelper };
