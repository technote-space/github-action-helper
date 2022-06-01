import type { GitHub } from '@actions/github/lib/utils.js';
import type { RestEndpointMethods } from '@octokit/plugin-rest-endpoint-methods/dist-types/generated/method-types.js';

export type Octokit = InstanceType<typeof GitHub> & {
  rest: RestEndpointMethods;
};
