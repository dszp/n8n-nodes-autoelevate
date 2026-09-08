import type { INodeProperties } from 'n8n-workflow';
import { idField, returnAllAndLimit } from './shared';

const show = { resource: ['company'], operation: ['getAll'] };

export const companyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['company'] } },
		options: [
			{ name: 'Get', value: 'get', description: 'Retrieve a company', action: 'Get a company' },
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of companies',
				action: 'Get many companies',
			},
		],
		default: 'getAll',
	},
];

export const companyFields: INodeProperties[] = [
	idField('company', 'Company ID', 'The company identifier'),
	...returnAllAndLimit(show),
];
