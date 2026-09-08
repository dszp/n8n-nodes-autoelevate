import type { INodeProperties } from 'n8n-workflow';
import { companyFilter, filters, idField, locationFilter, returnAllAndLimit } from './shared';

const show = { resource: ['computer'], operation: ['getAll'] };

export const computerOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['computer'] } },
		options: [
			{ name: 'Get', value: 'get', description: 'Retrieve a computer', action: 'Get a computer' },
			{
				name: 'Get Many',
				value: 'getAll',
				description:
					'Retrieve computers that checked in within the last 30 days (the active fleet)',
				action: 'Get many computers',
			},
		],
		default: 'getAll',
	},
];

export const computerFields: INodeProperties[] = [
	idField('computer', 'Computer ID', 'The computer identifier'),
	...returnAllAndLimit(show),
	filters(show, [companyFilter, locationFilter]),
];
