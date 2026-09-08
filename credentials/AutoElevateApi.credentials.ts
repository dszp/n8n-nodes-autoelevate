import type { ICredentialType, Icon, INodeProperties } from 'n8n-workflow';

/**
 * Partner API key for a service user. No `authenticate` block: HMAC needs a per-request signature
 * that the declarative injector cannot compute, so the node's transport builds the header itself
 * for both schemes, and the node tests the credential through `testedBy`.
 */
export class AutoElevateApi implements ICredentialType {
	name = 'autoElevateApi';

	displayName = 'AutoElevate API';

	icon: Icon = {
		light: 'file:../nodes/AutoElevate/AutoElevate.svg',
		dark: 'file:../nodes/AutoElevate/AutoElevate.dark.svg',
	};

	documentationUrl = 'https://github.com/dszp/n8n-nodes-autoelevate?tab=readme-ov-file#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'Authentication',
			name: 'scheme',
			type: 'options',
			options: [
				{
					name: 'HMAC (AE-HMAC-SHA256)',
					value: 'hmac',
					description: 'Signed requests. The key shows a token and a separate signing key.',
				},
				{
					name: 'Bearer (AE-BEARER)',
					value: 'bearer',
					description: 'A single token sent as-is',
				},
			],
			default: 'hmac',
			description: 'The scheme chosen when the API key was created in the AutoElevate admin portal',
		},
		{
			displayName: 'API Token',
			name: 'token',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'The token shown once at key creation (aeh_… for HMAC, aeb_… for Bearer)',
		},
		{
			displayName: 'HMAC Signing Key',
			name: 'hmacSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			displayOptions: { show: { scheme: ['hmac'] } },
			description: 'The signing key shown once at key creation, exactly as displayed',
		},
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://partner-api.autoelevate.com',
			description:
				'Leave at the default unless AutoElevate gives you another endpoint. Must be HTTPS.',
		},
	];
}
