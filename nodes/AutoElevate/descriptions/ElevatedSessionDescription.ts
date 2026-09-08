import type { INodeProperties } from 'n8n-workflow';
import { companyFilter, filters, idField, returnAllAndLimit } from './shared';

const show = { resource: ['elevatedSession'], operation: ['getAll'] };

export const elevatedSessionOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['elevatedSession'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description: 'Retrieve an elevated session',
				action: 'Get an elevated session',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of elevated sessions',
				action: 'Get many elevated sessions',
			},
		],
		default: 'getAll',
	},
];

export const elevatedSessionFields: INodeProperties[] = [
	idField('elevatedSession', 'Elevated Session ID', 'The elevated session identifier'),
	...returnAllAndLimit(show),
	filters(show, [
		companyFilter,
		{
			displayName: 'Computer ID',
			name: 'computerId',
			type: 'string',
			default: '',
			placeholder: 'e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		},
		{
			displayName: 'Status',
			name: 'status',
			type: 'options',
			options: [
				{ name: 'Active', value: 'active', description: 'Sessions running now' },
				{
					name: 'Inactive',
					value: 'inactive',
					description: 'Sessions that ended (completed or expired)',
				},
			],
			default: 'active',
		},
	]),
];
