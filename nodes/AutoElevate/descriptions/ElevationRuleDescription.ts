import type { INodeProperties } from 'n8n-workflow';
import { companyFilter, filters, returnAllAndLimit } from './shared';

const show = { resource: ['elevationRule'], operation: ['getAll'] };

export const elevationRuleOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['elevationRule'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of elevation rules',
				action: 'Get many elevation rules',
			},
		],
		default: 'getAll',
	},
];

export const elevationRuleFields: INodeProperties[] = [
	...returnAllAndLimit(show),
	filters(show, [companyFilter]),
];
