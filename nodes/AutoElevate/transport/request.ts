/**
 * HTTP transport for the AutoElevate Partner API (beta).
 *
 * Vendored rather than imported: verified community nodes cannot carry runtime dependencies.
 * The signing algorithm mirrors `@dszp/autoelevate-lib` `src/auth.ts`, which is the reference
 * implementation and has the offline test vectors. Keep the two in step.
 */
import { createHash, createHmac } from 'crypto';
import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	IPollFunctions,
	IWebhookFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export type AutoElevateCredentials = {
	scheme?: 'hmac' | 'bearer';
	token: string;
	hmacSecret?: string;
	baseUrl?: string;
	allowWrites?: boolean;
};

type Ctx =
	| IExecuteFunctions
	| ILoadOptionsFunctions
	| IHookFunctions
	| IWebhookFunctions
	| IPollFunctions;

export const DEFAULT_BASE_URL = 'https://partner-api.autoelevate.com';
export const API_PREFIX = '/api/v1';
export const MAX_PAGE_SIZE = 200;
const MAX_PAGES = 200;

export const ACKNOWLEDGMENT_HEADER = 'X-Acknowledgment';
export const ACKNOWLEDGMENT_VALUE = 'i-understand-this-is-beta-and-may-change';
const HMAC_SCHEME = 'AE-HMAC-SHA256';

/** Resolve the scheme; the token prefix the portal issues (`aeh_` / `aeb_`) must agree with it. */
export function resolveScheme(c: AutoElevateCredentials): 'hmac' | 'bearer' {
	const scheme = c.scheme ?? (c.hmacSecret ? 'hmac' : 'bearer');
	if (scheme === 'hmac' && !c.hmacSecret) {
		throw new Error(
			'HMAC scheme selected but the "HMAC Signing Key" field is empty. Paste the signing key shown when the key was created.',
		);
	}
	if (scheme === 'hmac' && c.token.startsWith('aeb_')) {
		throw new Error(
			'This is a Bearer (aeb_) token, which has no signing key. Set "Authentication" to Bearer.',
		);
	}
	if (scheme === 'bearer' && c.token.startsWith('aeh_')) {
		throw new Error(
			'This is an HMAC (aeh_) token. Set "Authentication" to HMAC and paste the signing key.',
		);
	}
	return scheme;
}

/**
 * `Authorization` header for one request. `target` is the request-target (path plus query string,
 * no host) — the server signs that, not the absolute URL (verified live 2026-09-08).
 */
export function buildAuthorization(
	c: AutoElevateCredentials,
	method: string,
	target: string,
	body = '',
	nowMs: () => number = Date.now,
): string {
	if (resolveScheme(c) === 'bearer') return `Bearer ${c.token}`;
	const ts = Math.floor(nowMs());
	const bodyHash = createHash('sha256').update(body, 'utf8').digest('hex');
	const toSign = [HMAC_SCHEME, method.toUpperCase(), target, bodyHash, String(ts)].join('\n');
	const sig = createHmac('sha256', c.hmacSecret as string)
		.update(toSign, 'utf8')
		.digest('hex');
	return `${HMAC_SCHEME} token=${c.token},bodyHash=${bodyHash},ts=${ts},sig=${sig}`;
}

/** Build the request-target with `undefined`/empty query values dropped. */
export function buildTarget(path: string, qs: IDataObject = {}): string {
	const params = new URLSearchParams();
	for (const [k, v] of Object.entries(qs)) {
		if (v === undefined || v === null || v === '') continue;
		params.set(k, String(v));
	}
	const q = params.toString();
	return `${API_PREFIX}${path}${q ? `?${q}` : ''}`;
}

export function normalizeBaseUrl(baseUrl?: string): string {
	const base = (baseUrl ?? '').trim().replace(/\/+$/, '') || DEFAULT_BASE_URL;
	if (!/^https:\/\//i.test(base)) {
		throw new Error(`"Base URL" must start with https://, got: ${base}`);
	}
	return base;
}

function hint(status: number, path: string): string {
	switch (status) {
		case 400:
			return 'Check the query parameters; the beta acknowledgment header is sent automatically.';
		case 401:
			return 'The key is missing, expired, revoked, or the credential uses the other authentication scheme.';
		case 403:
			return path.includes('/audit-logs')
				? 'The key lacks the auditLogView scope, or the tenant is not enrolled in the audit-log Early Access.'
				: 'The key lacks the scope this endpoint requires (see the README scope table).';
		case 409:
			return 'The request is not in a state that allows this transition (it must be PENDING).';
		case 429:
			return 'Rate limited: 100 requests per hour per method and route. Wait for the Retry-After period.';
		default:
			return '';
	}
}

async function getCredentials(ctx: Ctx): Promise<AutoElevateCredentials> {
	return (await ctx.getCredentials('autoElevateApi')) as AutoElevateCredentials;
}

/** Writes are opt-in per credential. Enforced here, not in the UI, so a tool call cannot bypass it. */
export async function assertWritesAllowed(this: Ctx, itemIndex: number): Promise<void> {
	const creds = await getCredentials(this);
	if (creds.allowWrites !== true) {
		throw new NodeOperationError(
			this.getNode(),
			'This credential does not allow write operations. Turn on "Allow Write Operations" in the AutoElevate API credential (and make sure the key has the requestEdit scope) to approve or deny elevation requests.',
			{ itemIndex },
		);
	}
}

export async function autoElevateApiRequest<T = IDataObject>(
	this: Ctx,
	method: IHttpRequestMethods,
	path: string,
	qs: IDataObject = {},
	body?: unknown,
): Promise<T> {
	const creds = await getCredentials(this);
	const base = normalizeBaseUrl(creds.baseUrl);
	const target = buildTarget(path, qs);
	// Serialise once: the HMAC bodyHash and the bytes on the wire must be the same string.
	const bodyText = body === undefined ? undefined : JSON.stringify(body ?? {});
	const headers: Record<string, string> = {
		Accept: 'application/json',
		[ACKNOWLEDGMENT_HEADER]: ACKNOWLEDGMENT_VALUE,
		Authorization: buildAuthorization(creds, method, target, bodyText ?? ''),
	};
	if (bodyText !== undefined) headers['Content-Type'] = 'application/json';
	const options: IHttpRequestOptions = {
		method,
		url: `${base}${target}`,
		headers,
		body: bodyText,
		// json:false so n8n neither re-serialises the string body nor pre-parses the response.
		json: false,
	};
	try {
		const raw = (await this.helpers.httpRequest(options)) as string;
		return (raw ? JSON.parse(raw) : {}) as T;
	} catch (error) {
		const e = error as {
			httpCode?: string;
			statusCode?: number;
			message?: string;
			response?: { headers?: Record<string, string> };
		};
		const status = Number(e.httpCode ?? e.statusCode ?? 0);
		const h = hint(status, path);
		const retryAfter = e.response?.headers?.['retry-after'];
		throw new NodeApiError(this.getNode(), error as JsonObject, {
			message: `AutoElevate ${method} ${target} returned ${status || 'no status'}`,
			description: [h, retryAfter ? `Retry-After: ${retryAfter}s` : ''].filter(Boolean).join(' '),
		});
	}
}

interface OffsetPage<T> {
	items: T[];
	totalCount: number;
}

/**
 * Walk an offset-paginated list at the API's maximum page size. Stops on a short page and checks
 * the rows collected against the first page's `totalCount` (the API reports 0 once `skip` passes
 * the end, so only the first page's total is trusted). `limit` caps the walk for "Return All = off".
 */
export async function autoElevateApiRequestAllItems<T = IDataObject>(
	this: Ctx,
	path: string,
	qs: IDataObject = {},
	limit?: number,
): Promise<T[]> {
	const out: T[] = [];
	let expected: number | undefined;
	for (let page = 0; page < MAX_PAGES; page++) {
		const remaining =
			limit === undefined ? MAX_PAGE_SIZE : Math.min(MAX_PAGE_SIZE, limit - out.length);
		if (remaining <= 0) return out;
		const res = (await autoElevateApiRequest.call(this, 'GET', path, {
			...qs,
			take: remaining,
			skip: out.length,
		})) as OffsetPage<T>;
		expected ??= res.totalCount;
		out.push(...res.items);
		if (limit !== undefined && out.length >= limit) return out.slice(0, limit);
		if (res.items.length < remaining || out.length >= expected) {
			if (out.length !== expected) {
				throw new NodeOperationError(
					this.getNode(),
					`AutoElevate ${path}: walked ${out.length} rows but the first page reported ${expected}. The collection changed mid-walk or the server mis-paginated; run the node again rather than trust a short list.`,
				);
			}
			return out;
		}
	}
	throw new NodeOperationError(
		this.getNode(),
		`AutoElevate ${path}: exceeded ${MAX_PAGES} pages; stopping rather than spending the hourly request budget.`,
	);
}

interface CursorPage<T> {
	items: T[];
	nextCursor: string | null;
	hasMore: boolean;
	totalCount: number;
}

/** Walk the cursor-paginated audit log. */
export async function autoElevateApiRequestAllCursor<T = IDataObject>(
	this: Ctx,
	path: string,
	qs: IDataObject = {},
	limit?: number,
): Promise<T[]> {
	const out: T[] = [];
	let cursor: string | undefined;
	for (let page = 0; page < MAX_PAGES; page++) {
		const remaining =
			limit === undefined ? MAX_PAGE_SIZE : Math.min(MAX_PAGE_SIZE, limit - out.length);
		if (remaining <= 0) return out;
		const res = (await autoElevateApiRequest.call(this, 'GET', path, {
			...qs,
			take: remaining,
			cursor,
		})) as CursorPage<T>;
		out.push(...res.items);
		if (limit !== undefined && out.length >= limit) return out.slice(0, limit);
		if (!res.hasMore || res.nextCursor === null) return out;
		cursor = res.nextCursor;
	}
	throw new NodeOperationError(
		this.getNode(),
		`AutoElevate ${path}: exceeded ${MAX_PAGES} pages; stopping rather than spending the hourly request budget.`,
	);
}
