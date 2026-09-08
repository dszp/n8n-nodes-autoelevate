import type { INodeProperties } from 'n8n-workflow';
import { endFilter, filters, returnAllAndLimit, startFilter } from './shared';

const show = { resource: ['auditLog'], operation: ['getAll'] };

export const auditLogOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['auditLog'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description:
					'Retrieve audit log entries (user and setting changes). May require Early Access enrolment.',
				action: 'Get many audit log entries',
			},
		],
		default: 'getAll',
	},
];

export const auditLogFields: INodeProperties[] = [
	...returnAllAndLimit(show),
	filters(show, [
		{
			displayName: 'Action',
			name: 'action',
			type: 'options',
			options: [
				{ name: 'Created', value: 'created' },
				{ name: 'Deleted', value: 'deleted' },
				{ name: 'Updated', value: 'updated' },
			],
			default: 'updated',
		},
		endFilter,
		{
			displayName: 'Entity Type',
			name: 'entityType',
			type: 'options',
			options: [
				{ name: 'Settings', value: 'settings' },
				{ name: 'Users', value: 'users' },
			],
			default: 'users',
		},
		startFilter,
	]),
];
