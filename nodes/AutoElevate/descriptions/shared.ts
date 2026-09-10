import type { INodeProperties } from 'n8n-workflow';

type Show = { resource: string[]; operation: string[] };

/** Standard Return All + Limit pair for every Get Many operation. */
export function returnAllAndLimit(show: Show): INodeProperties[] {
	return [
		{
			displayName: 'Return All',
			name: 'returnAll',
			type: 'boolean',
			default: false,
			description: 'Whether to return all results or only up to a given limit',
			displayOptions: { show },
		},
		{
			displayName: 'Limit',
			name: 'limit',
			type: 'number',
			default: 50,
			typeOptions: { minValue: 1 },
			description: 'Max number of results to return',
			displayOptions: { show: { ...show, returnAll: [false] } },
		},
	];
}

/** A required record-ID field for Get (and, when passed, other) operations. */
export function idField(
	resource: string,
	label: string,
	hintText: string,
	operations: string[] = ['get'],
): INodeProperties {
	return {
		displayName: label,
		name: 'id',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890',
		description: hintText,
		displayOptions: { show: { resource: [resource], operation: operations } },
	};
}

/** Company chooser backed by loadOptions. */
export const companyFilter: INodeProperties = {
	displayName: 'Company Name or ID',
	name: 'companyId',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getCompanies' },
	default: '',
	description:
		'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
};

/** Location chooser backed by loadOptions (all locations; the name includes the company). */
export const locationFilter: INodeProperties = {
	displayName: 'Location Name or ID',
	name: 'locationId',
	type: 'options',
	typeOptions: { loadOptionsMethod: 'getLocations' },
	default: '',
	description:
		'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
};

export const startFilter: INodeProperties = {
	displayName: 'Start',
	name: 'start',
	type: 'dateTime',
	default: '',
	description:
		'Inclusive start of the window. When omitted the API applies its own default lower bound.',
};

export const endFilter: INodeProperties = {
	displayName: 'End',
	name: 'end',
	type: 'dateTime',
	default: '',
	description:
		'Inclusive end of the window. When omitted the API applies its own default upper bound.',
};

/** An Additional Fields collection for a Get Many operation. Options are sorted by display name here. */
export function filters(show: Show, options: INodeProperties[]): INodeProperties {
	return {
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show },
		options: [...options].sort((a, b) => a.displayName.localeCompare(b.displayName)),
	};
}
