import type {
	ICredentialsDecrypted,
	ICredentialTestFunctions,
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { auditLogFields, auditLogOperations } from './descriptions/AuditLogDescription';
import { companyFields, companyOperations } from './descriptions/CompanyDescription';
import { computerFields, computerOperations } from './descriptions/ComputerDescription';
import {
	elevatedSessionFields,
	elevatedSessionOperations,
} from './descriptions/ElevatedSessionDescription';
import {
	elevationEventFields,
	elevationEventOperations,
} from './descriptions/ElevationEventDescription';
import {
	elevationRequestFields,
	elevationRequestOperations,
} from './descriptions/ElevationRequestDescription';
import {
	elevationRuleFields,
	elevationRuleOperations,
} from './descriptions/ElevationRuleDescription';
import { locationFields, locationOperations } from './descriptions/LocationDescription';
import { usageOperations } from './descriptions/UsageDescription';
import {
	ACKNOWLEDGMENT_HEADER,
	ACKNOWLEDGMENT_VALUE,
	assertWritesAllowed,
	autoElevateApiRequest,
	autoElevateApiRequestAllCursor,
	autoElevateApiRequestAllItems,
	buildAuthorization,
	buildTarget,
	normalizeBaseUrl,
	type AutoElevateCredentials,
} from './transport/request';

/** Resource → list path, for the generic Get / Get Many handlers. */
const LIST_PATH: Record<string, string> = {
	company: '/companies',
	computer: '/computers',
	location: '/locations',
	elevationRequest: '/elevation-requests',
	elevationEvent: '/elevation-events',
	elevatedSession: '/elevated-sessions',
	elevationRule: '/elevation-rules',
	auditLog: '/audit-logs',
};

const ELEVATION_MODES = ['audit', 'live', 'policy', 'technicianBypass', 'unknown'] as const;

interface Company {
	id: string;
	name: string;
	managementSystemCompanyId: string | null;
}
interface Computer {
	companyId: string;
	elevationMode: string | null;
}

/**
 * Add an ISO-8601 UTC twin next to every epoch-millisecond timestamp. The API names all of its
 * time fields `…At` (createdAt, lastCheckedInAt, occurredAt, …), so the suffix is the contract;
 * the original number stays in place for arithmetic and the `…AtIso` column reads at a glance.
 */
function withIsoTimestamps(row: IDataObject): IDataObject {
	const out: IDataObject = { ...row };
	for (const [k, v] of Object.entries(row)) {
		if (k.endsWith('At') && typeof v === 'number' && Number.isFinite(v)) {
			out[`${k}Iso`] = new Date(v).toISOString();
		}
	}
	return out;
}

/** Turn the Filters collection into query parameters; dateTime fields become epoch milliseconds. */
function toQuery(this: IExecuteFunctions, filters: IDataObject, itemIndex: number): IDataObject {
	const qs: IDataObject = {};
	for (const [k, v] of Object.entries(filters)) {
		if (v === '' || v === undefined || v === null) continue;
		if (k === 'start' || k === 'end') {
			const ms = Date.parse(String(v));
			if (Number.isNaN(ms)) {
				throw new NodeOperationError(
					this.getNode(),
					`"${k === 'start' ? 'Start' : 'End'}" is not a date: ${String(v)}. Enter an ISO date or use an expression.`,
					{ itemIndex },
				);
			}
			qs[k] = ms;
		} else {
			qs[k] = v as string;
		}
	}
	return qs;
}

const RULE_LEVELS = new Set(['msp', 'company', 'location', 'computer']);
const DENIAL_REASON_MAX = 1000;

/**
 * Mirrors @dszp/autoelevate-lib validateApprovePayload/validateDenyPayload, and additionally
 * drops a Rule Level when Create Rule is off. Fails before spending a request.
 */
function validateWritePayload(
	this: IExecuteFunctions,
	op: 'approve' | 'deny',
	p: IDataObject,
	itemIndex: number,
): IDataObject {
	const body: IDataObject = {};
	for (const [k, v] of Object.entries(p))
		if (v !== '' && v !== undefined && v !== null) body[k] = v;
	if (body.createRule === true && !body.ruleLevel) {
		throw new NodeOperationError(this.getNode(), 'Set "Rule Level" when "Create Rule" is on.', {
			itemIndex,
		});
	}
	if (body.createRule !== true) delete body.ruleLevel; // a level without a rule is meaningless; do not send it
	if (body.ruleLevel !== undefined && !RULE_LEVELS.has(String(body.ruleLevel))) {
		throw new NodeOperationError(
			this.getNode(),
			`"Rule Level" must be one of msp, company, location, computer.`,
			{ itemIndex },
		);
	}
	if (op === 'approve') {
		const d = body.durationInMinutes;
		if (d !== undefined && (!Number.isInteger(d) || (d as number) <= 0)) {
			throw new NodeOperationError(
				this.getNode(),
				'"Duration (Minutes)" must be a whole number greater than 0.',
				{ itemIndex },
			);
		}
		const et = body.elevationType;
		if (et !== undefined && et !== 'admin' && et !== 'user') {
			throw new NodeOperationError(this.getNode(), '"Elevation Type" must be Admin or User.', {
				itemIndex,
			});
		}
	} else {
		// Counted in UTF-16 code units, not [...r].length (code points): matches a JavaScript
		// server-side validator and errs toward rejecting locally.
		const r = body.denialReason;
		if (typeof r === 'string' && r.length > DENIAL_REASON_MAX) {
			throw new NodeOperationError(
				this.getNode(),
				`"Denial Reason" must be at most ${DENIAL_REASON_MAX} characters.`,
				{ itemIndex },
			);
		}
	}
	return body;
}

export class AutoElevate implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AutoElevate',
		name: 'autoElevate',
		icon: { light: 'file:AutoElevate.svg', dark: 'file:AutoElevate.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description:
			'Read AutoElevate Partner API data (companies, computers, elevation activity, per-company agent counts) and, when the credential allows it, approve or deny elevation requests',
		defaults: { name: 'AutoElevate' },
		inputs: [NodeConnectionTypes.Main],
		// Get Agent Counts by Company emits company rows on the first output and, when enabled, one
		// MSP summary item on a second output, so neither downstream branch has to filter the other.
		outputs: `={{
			$parameter["resource"] === "usage" && $parameter["operation"] === "agentCountsByCompany" && $parameter["includeSummary"]
				? [{ type: "${NodeConnectionTypes.Main}", displayName: "Companies" }, { type: "${NodeConnectionTypes.Main}", displayName: "Summary" }]
				: [{ type: "${NodeConnectionTypes.Main}" }]
		}}`,
		usableAsTool: true,
		credentials: [{ name: 'autoElevateApi', required: true, testedBy: 'autoElevateApiTest' }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Audit Log', value: 'auditLog' },
					{ name: 'Company', value: 'company' },
					{ name: 'Computer', value: 'computer' },
					{ name: 'Elevated Session', value: 'elevatedSession' },
					{ name: 'Elevation Event', value: 'elevationEvent' },
					{ name: 'Elevation Request', value: 'elevationRequest' },
					{ name: 'Elevation Rule', value: 'elevationRule' },
					{ name: 'Location', value: 'location' },
					{ name: 'Usage', value: 'usage' },
				],
				default: 'usage',
			},
			...usageOperations,
			...companyOperations,
			...companyFields,
			...computerOperations,
			...computerFields,
			...locationOperations,
			...locationFields,
			...elevationRequestOperations,
			...elevationRequestFields,
			...elevationEventOperations,
			...elevationEventFields,
			...elevatedSessionOperations,
			...elevatedSessionFields,
			...elevationRuleOperations,
			...elevationRuleFields,
			...auditLogOperations,
			...auditLogFields,
		],
	};

	methods = {
		credentialTest: {
			/**
			 * Signs a real GET /usage. Done here rather than in the credential file because the HMAC
			 * scheme needs a computed header. Uses the platform `fetch` so no deprecated helper is
			 * involved; the test is one request and honours no proxy settings.
			 */
			async autoElevateApiTest(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const creds = credential.data as unknown as AutoElevateCredentials;
				try {
					const base = normalizeBaseUrl(creds.baseUrl);
					const target = buildTarget('/usage');
					const res = await fetch(`${base}${target}`, {
						method: 'GET',
						headers: {
							Accept: 'application/json',
							[ACKNOWLEDGMENT_HEADER]: ACKNOWLEDGMENT_VALUE,
							Authorization: buildAuthorization(creds, 'GET', target),
						},
					});
					if (res.ok) {
						const body = (await res.json()) as { partnerName?: string; totalActiveAgents?: number };
						return {
							status: 'OK',
							message: `Connected to ${body.partnerName ?? 'AutoElevate'} (${body.totalActiveAgents ?? '?'} active agents)`,
						};
					}
					const text = await res.text();
					let detail = text;
					try {
						detail = (JSON.parse(text) as { message?: string }).message ?? text;
					} catch {
						/* keep text */
					}
					const why =
						res.status === 401
							? 'Check the token, the signing key, and that "Authentication" matches the scheme the key was created with.'
							: res.status === 403
								? 'The key lacks the computerView scope needed for this test.'
								: '';
					return { status: 'Error', message: `HTTP ${res.status}: ${detail} ${why}`.trim() };
				} catch (error) {
					return { status: 'Error', message: (error as Error).message };
				}
			},
		},
		loadOptions: {
			async getCompanies(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const rows = (await autoElevateApiRequestAllItems.call(this, '/companies')) as Company[];
				return rows
					.map((c) => ({ name: c.name, value: c.id }))
					.sort((a, b) => a.name.localeCompare(b.name));
			},
			async getLocations(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const rows = (await autoElevateApiRequestAllItems.call(this, '/locations')) as Array<{
					id: string;
					name: string;
					companyName: string | null;
				}>;
				return rows
					.map((l) => ({
						name: l.companyName ? `${l.companyName} / ${l.name}` : l.name,
						value: l.id,
					}))
					.sort((a, b) => a.name.localeCompare(b.name));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const summaryData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let out: IDataObject[];

				if (resource === 'usage' && operation === 'get') {
					out = [(await autoElevateApiRequest.call(this, 'GET', '/usage')) as IDataObject];
				} else if (resource === 'usage' && operation === 'agentCountsByCompany') {
					const { companies, summary } = await agentCountsByCompany.call(this, i);
					out = companies;
					if (summary) {
						summaryData.push(
							...this.helpers.constructExecutionMetaData(
								this.helpers.returnJsonArray([withIsoTimestamps(summary)]),
								{
									itemData: { item: i },
								},
							),
						);
					}
				} else if (
					resource === 'elevationRequest' &&
					(operation === 'approve' || operation === 'deny')
				) {
					await assertWritesAllowed.call(this, i);
					const id = (this.getNodeParameter('id', i) as string).trim();
					if (!id) {
						throw new NodeOperationError(
							this.getNode(),
							'Enter an ID in the "Elevation Request ID" field.',
							{
								itemIndex: i,
							},
						);
					}
					const raw = this.getNodeParameter(
						operation === 'approve' ? 'approveOptions' : 'denyOptions',
						i,
						{},
					) as IDataObject;
					const body = validateWritePayload.call(this, operation, raw, i);
					out = [
						(await autoElevateApiRequest.call(
							this,
							'POST',
							`/elevation-requests/${encodeURIComponent(id)}/${operation}`,
							{},
							body,
						)) as IDataObject,
					];
				} else if (operation === 'get') {
					const id = this.getNodeParameter('id', i) as string;
					if (!id.trim()) {
						throw new NodeOperationError(this.getNode(), 'Enter an ID in the ID field.', {
							itemIndex: i,
						});
					}
					out = [
						(await autoElevateApiRequest.call(
							this,
							'GET',
							`${LIST_PATH[resource]}/${encodeURIComponent(id.trim())}`,
						)) as IDataObject,
					];
				} else if (operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i) as boolean;
					const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
					const qs = toQuery.call(this, this.getNodeParameter('filters', i, {}) as IDataObject, i);
					out = (
						resource === 'auditLog'
							? await autoElevateApiRequestAllCursor.call(this, LIST_PATH[resource], qs, limit)
							: await autoElevateApiRequestAllItems.call(this, LIST_PATH[resource], qs, limit)
					) as IDataObject[];
				} else {
					throw new NodeOperationError(
						this.getNode(),
						`The operation "${operation}" is not supported for resource "${resource}".`,
						{ itemIndex: i },
					);
				}

				returnData.push(
					...this.helpers.constructExecutionMetaData(
						this.helpers.returnJsonArray(out.map(withIsoTimestamps)),
						{
							itemData: { item: i },
						},
					),
				);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				// NodeApiError/NodeOperationError from the transport carry their own message and hint;
				// wrapping keeps the item index attached in every case.
				throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: i });
			}
		}

		const includeSummary =
			resource === 'usage' &&
			operation === 'agentCountsByCompany' &&
			(this.getNodeParameter('includeSummary', 0, true) as boolean);
		return includeSummary ? [returnData, summaryData] : [returnData];
	}
}

/**
 * Per-company active-agent counts. Walks /companies and /computers once each (200 rows per page),
 * buckets in memory, and reads /usage for the MSP total. Mirrors `gatherAgentCounts` in
 * `@dszp/autoelevate-lib`, flattened so each company is one table row.
 */
async function agentCountsByCompany(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<{ companies: IDataObject[]; summary?: IDataObject }> {
	const includeSummary = this.getNodeParameter('includeSummary', itemIndex, true) as boolean;
	const [usage, companies, computers] = await Promise.all([
		autoElevateApiRequest.call(this, 'GET', '/usage') as Promise<{
			partnerId: string;
			partnerName: string;
			totalActiveAgents: number;
		}>,
		autoElevateApiRequestAllItems.call(this, '/companies') as Promise<Company[]>,
		autoElevateApiRequestAllItems.call(this, '/computers') as Promise<Computer[]>,
	]);

	type Row = {
		companyId: string;
		companyName: string | null;
		managementSystemCompanyId: string | null;
		activeAgents: number;
		modes: Record<string, number>;
	};
	const emptyModes = () =>
		Object.fromEntries(ELEVATION_MODES.map((m) => [m, 0])) as Record<string, number>;
	const rows = new Map<string, Row>();
	for (const c of companies) {
		rows.set(c.id, {
			companyId: c.id,
			companyName: c.name,
			managementSystemCompanyId: c.managementSystemCompanyId,
			activeAgents: 0,
			modes: emptyModes(),
		});
	}
	for (const m of computers) {
		let row = rows.get(m.companyId);
		if (!row) {
			row = {
				companyId: m.companyId,
				companyName: null,
				managementSystemCompanyId: null,
				activeAgents: 0,
				modes: emptyModes(),
			};
			rows.set(m.companyId, row);
		}
		row.activeAgents++;
		row.modes[m.elevationMode ?? 'unknown']++;
	}
	const sorted = [...rows.values()].sort((a, b) =>
		String(a.companyName ?? '\uffff').localeCompare(String(b.companyName ?? '\uffff')),
	);
	const flat: IDataObject[] = sorted.map((r) => ({
		companyId: r.companyId,
		companyName: r.companyName,
		managementSystemCompanyId: r.managementSystemCompanyId,
		activeAgents: r.activeAgents,
		agentsAudit: r.modes.audit,
		agentsLive: r.modes.live,
		agentsPolicy: r.modes.policy,
		agentsTechnicianBypass: r.modes.technicianBypass,
		agentsUnknownMode: r.modes.unknown,
	}));
	const summary: IDataObject | undefined = includeSummary
		? {
				partnerId: usage.partnerId,
				partnerName: usage.partnerName,
				activeAgentsFromUsage: usage.totalActiveAgents,
				activeAgentsFromComputers: computers.length,
				agree: usage.totalActiveAgents === computers.length,
				companies: companies.length,
				gatheredAt: Date.now(),
			}
		: undefined;
	return { companies: flat, summary };
}
