import type { INodeProperties } from 'n8n-workflow';
import {
	companyFilter,
	endFilter,
	filters,
	idField,
	returnAllAndLimit,
	startFilter,
} from './shared';

const show = { resource: ['elevationRequest'], operation: ['getAll'] };

export const elevationRequestOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['elevationRequest'] } },
		options: [
			{
				name: 'Approve',
				value: 'approve',
				description:
					'Approve a pending elevation request. Requires a credential with write operations allowed.',
				action: 'Approve an elevation request',
			},
			{
				name: 'Deny',
				value: 'deny',
				description:
					'Deny a pending elevation request. Requires a credential with write operations allowed.',
				action: 'Deny an elevation request',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve an elevation request',
				action: 'Get an elevation request',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of elevation requests',
				action: 'Get many elevation requests',
			},
		],
		default: 'getAll',
	},
];

export const elevationRequestFields: INodeProperties[] = [
	idField('elevationRequest', 'Elevation Request ID', 'The elevation request identifier', [
		'get',
		'approve',
		'deny',
	]),
	...returnAllAndLimit(show),
	filters(show, [
		{
			displayName: 'Approval State',
			name: 'approvalState',
			type: 'options',
			options: [
				{ name: 'Approved', value: 'APPROVED' },
				{ name: 'Denied', value: 'DENIED' },
				{ name: 'Pending', value: 'PENDING' },
				{ name: 'Withdrawn', value: 'WITHDRAWN' },
			],
			default: 'PENDING',
		},
		companyFilter,
		endFilter,
		startFilter,
	]),
	{
		displayName:
			'Changes the request on the endpoint. The credential must have "Allow Write Operations" on and the key must carry the requestEdit scope.',
		name: 'writeNotice',
		type: 'notice',
		default: '',
		displayOptions: { show: { resource: ['elevationRequest'], operation: ['approve', 'deny'] } },
	},
	{
		displayName: 'Approve Options',
		name: 'approveOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['elevationRequest'], operation: ['approve'] } },
		options: [
			{
				displayName: 'Create Rule',
				name: 'createRule',
				type: 'boolean',
				default: false,
				description:
					'Whether to also create an auto-approval rule from this request. Requires Rule Level.',
			},
			{
				displayName: 'Duration (Minutes)',
				name: 'durationInMinutes',
				type: 'number',
				default: 60,
				typeOptions: { minValue: 1 },
				description:
					'Session length for elevated-session requests. Ignored for other request types.',
			},
			{
				displayName: 'Elevation Type',
				name: 'elevationType',
				type: 'options',
				options: [
					{ name: 'Admin', value: 'admin' },
					{ name: 'User', value: 'user' },
				],
				default: 'admin',
				description:
					"Overrides the elevation level recorded on the request. Defaults to the request's own.",
			},
			{
				displayName: 'Rule Level',
				name: 'ruleLevel',
				type: 'options',
				options: [
					{ name: 'Company', value: 'company' },
					{ name: 'Computer', value: 'computer' },
					{ name: 'Location', value: 'location' },
					{ name: 'MSP (All Companies)', value: 'msp' },
				],
				default: 'computer',
				description: 'Scope of the rule created when Create Rule is on',
			},
		],
	},
	{
		displayName: 'Deny Options',
		name: 'denyOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['elevationRequest'], operation: ['deny'] } },
		options: [
			{
				displayName: 'Create Rule',
				name: 'createRule',
				type: 'boolean',
				default: false,
				description: 'Whether to also create a denial rule from this request. Requires Rule Level.',
			},
			{
				displayName: 'Denial Reason',
				name: 'denialReason',
				type: 'string',
				typeOptions: { rows: 3 },
				default: '',
				placeholder: 'e.g. Not on the approved software list',
				description: 'Plain text shown to the end user with the denial. Maximum 1000 characters.',
			},
			{
				displayName: 'Rule Level',
				name: 'ruleLevel',
				type: 'options',
				options: [
					{ name: 'Company', value: 'company' },
					{ name: 'Computer', value: 'computer' },
					{ name: 'Location', value: 'location' },
					{ name: 'MSP (All Companies)', value: 'msp' },
				],
				default: 'computer',
				description: 'Scope of the rule created when Create Rule is on',
			},
		],
	},
];
