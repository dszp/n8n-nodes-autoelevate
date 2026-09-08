import type { INodeProperties } from 'n8n-workflow';
import { companyFilter, endFilter, filters, returnAllAndLimit, startFilter } from './shared';

const show = { resource: ['elevationEvent'], operation: ['getAll'] };

export const elevationEventOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['elevationEvent'] } },
		options: [
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Retrieve a list of elevation events',
				action: 'Get many elevation events',
			},
		],
		default: 'getAll',
	},
];

export const elevationEventFields: INodeProperties[] = [
	...returnAllAndLimit(show),
	filters(show, [companyFilter, endFilter, startFilter]),
];
