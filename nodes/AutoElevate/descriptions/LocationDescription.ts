import type { INodeProperties } from 'n8n-workflow';
import { companyFilter, filters, idField, returnAllAndLimit } from './shared';

const show = { resource: ['location'], operation: ['getAll'] };

export const locationOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['location'] } },
		options: [
			{ name: 'Get', value: 'get', description: 'Retrieve a location', action: 'Get a location' },
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of locations',
				action: 'Get many locations',
			},
		],
		default: 'getAll',
	},
];

export const locationFields: INodeProperties[] = [
	idField('location', 'Location ID', 'The location identifier'),
	...returnAllAndLimit(show),
	filters(show, [companyFilter]),
];
