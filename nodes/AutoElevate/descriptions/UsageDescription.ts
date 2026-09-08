import type { INodeProperties } from 'n8n-workflow';

export const usageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['usage'] } },
		options: [
			{
				name: 'Get',
				value: 'get',
				description:
					'Retrieve the MSP-wide usage snapshot (active agents seen in the last 30 days)',
				action: 'Get usage',
			},
			{
				name: 'Get Agent Counts by Company',
				value: 'agentCountsByCompany',
				description:
					'Count active computers per company for billing, with the MSP total from the usage snapshot as a cross-check. Walks all companies and computers.',
				action: 'Get agent counts by company',
			},
		],
		default: 'get',
	},
	{
		displayName: 'Include MSP Summary Item',
		name: 'includeSummary',
		type: 'boolean',
		default: true,
		description:
			'Whether to append one item with the MSP totals (usage snapshot vs. computers walked) after the per-company items.',
		displayOptions: { show: { resource: ['usage'], operation: ['agentCountsByCompany'] } },
	},
];
