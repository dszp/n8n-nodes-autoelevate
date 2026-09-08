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
	idField('elevationRequest', 'Elevation Request ID', 'The elevation request identifier'),
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
];
