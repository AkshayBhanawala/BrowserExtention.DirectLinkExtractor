const api = typeof browser !== 'undefined' ? browser : chrome;

const DEFAULT_SETTINGS = {
	autoProcessDirect: true,
	appendScrape: true,
	theme: 'dark',
	fuckingfast: {
		targetUrl: 'https://fuckingfast.co/f/{fileId}/go',
		headers: {
			'cache-control': 'no-cache',
			'hx-request': 'true',
			pragma: 'no-cache',
		},
	},
	datanodes: {
		targetUrl: 'https://datanodes.to/download',
		formData: {
			op: 'download2',
			referer: 'https://datanodes.to/download',
			method_free: '',
			method_premium: 'Premium Download >>',
			g_captch__a: '1',
		},
	},
	filekeeper: {
		targetUrl: 'https://filekeeper.net/download',
		formData: {
			op: 'download2',
			referer: 'https://filekeeper.net/download',
			rand: '',
			method_free: '',
			method_premium: 'Premium Download >>',
			down_direct: '1',
		},
	},
};

/**
 * Recursively merges `defaults` into `target`.
 * - Only fills in keys that are missing from `target`.
 * - If both values are plain objects, recurses into them.
 * - Never overwrites existing values in `target`.
 * @param {object} target  The existing settings (mutated in-place).
 * @param {object} defaults The default settings to backfill from.
 * @returns {object} The mutated `target`.
 */
function deepMerge(target, defaults) {
	for (const key of Object.keys(defaults)) {
		if (!(key in target)) {
			target[key] = defaults[key];
		} else if (
			typeof defaults[key] === 'object' &&
			defaults[key] !== null &&
			!Array.isArray(defaults[key]) &&
			typeof target[key] === 'object' &&
			target[key] !== null &&
			!Array.isArray(target[key])
		) {
			deepMerge(target[key], defaults[key]);
		}
	}
	return target;
}

async function getSettings() {
	const result = await api.storage.local.get(['settings']);
	const settings = deepMerge(result.settings || {}, DEFAULT_SETTINGS);
	return settings;
}

api.runtime.onInstalled.addListener(async () => {
	console.log('[Background] Extension Installed/Updated. Initializing Storage...');
	try {
		const result = await api.storage.local.get(['settings']);
		if (!result.settings) {
			await api.storage.local.set({ settings: DEFAULT_SETTINGS });
			console.log('[Background] Default configurations populated.');
		} else {
			const merged = deepMerge(Object.assign({}, result.settings), DEFAULT_SETTINGS);
			await api.storage.local.set({ settings: merged });
			console.log('[Background] Settings deep-merged with latest defaults.');
		}
	} catch (err) {
		console.error('[Background] Failed to initialize storage:', err);
	}
});

const hosterTurnstileTokens = {};

// Using `return true` and an async IIFE is the only 100% cross-browser
// compatible way to handle async sendResponse in Manifest V3.
api.runtime.onMessage.addListener(async (message, sender) => {
	console.log(`[Background] onMessageListener:`, `message:`, message, `sender:`, sender);

	if (message.action === 'checkCachedToken') {
		const cached = hosterTurnstileTokens[message.type];
		if (cached && Date.now() - cached.time < 150000) {
			// 2.5 mins
			return { hasToken: true };
		}
		return { hasToken: false };
	} else if (message.action === 'processLink') {
		console.log(`[Background] Processing requested for: ${message.url} [Type: ${message.type}]`);

		try {
			const config = await getSettings();

			let fileId = message.fileId;
			if (!fileId) throw new Error('No file ID found.');

			let cfTurnstileResponse = message.cfTurnstileResponse;
			if (cfTurnstileResponse) {
				hosterTurnstileTokens[message.type] = { token: cfTurnstileResponse, time: Date.now() };
			} else {
				const cached = hosterTurnstileTokens[message.type];
				if (cached && Date.now() - cached.time < 150000) {
					cfTurnstileResponse = cached.token;
					console.log(`[Background] Reusing cached Turnstile token for ${message.type}`);
				}
			}
			console.log(`[Background] cfTurnstileResponse: ${cfTurnstileResponse}`);

			let directLink = '';
			if (message.type === 'fuckingfast') {
				console.log(`[Background] [${message.type}] File ID: ${fileId}`);
				directLink = await handleFuckingFast({ type: message.type, fileId, cfTurnstileResponse }, config.fuckingfast);
			} else if (message.type === 'datanodes' || message.type === 'filekeeper') {
				const configKey = message.type;
				console.log(`[Background] [${configKey}] File ID: ${fileId}`);

				const rand = message.rand;
				console.log(`[Background] [${configKey}] rand: ${rand}`);

				const dlToken = message.dlToken;
				console.log(`[Background] [${configKey}] dlToken: ${dlToken}`);

				const maxRetryCount = 20;
				let retryCount = 0;
				while (retryCount < maxRetryCount) {
					try {
						directLink = await handleDataNodes(
							{ type: message.type, fileId, rand, dlToken, cfTurnstileResponse },
							config[configKey],
						);
						console.log(`[Background] [${configKey}] Direct Link:`, directLink);
						break;
					} catch (error) {
						console.log(`[Background] [${configKey}] error:`, error);
						if (error.message === `HTML`) {
							retryCount++;
							if (retryCount < maxRetryCount) {
								await waitForMs(1000);
								console.log(`[Background] [${configKey}] retryCount:`, retryCount);
								continue;
							}
						}
						throw error;
					}
				}
			}

			console.log(`[Background] Successful bypass. Yielding target: ${directLink}`);
			return Promise.resolve({ success: true, url: directLink });
		} catch (error) {
			console.error(`[Background] Bypass Failure: ${error.message}`);
			return Promise.resolve({ success: false, error: error.message });
		}

		// Keeps the message port open for async response
		return true;
	} else if (message.action === 'getCookies') {
		console.log(`[Background] GetCookies requested for: ${message.type}`);

		const domainMap = { fuckingfast: 'fuckingfast.co', datanodes: 'datanodes.to', filekeeper: 'filekeeper.net' };
		const domain = domainMap[message.type] || message.type;
		console.log(`[Background] domain: ${domain}`);

		const cookiesString = await getCookiesStringForTab(sender.tab);
		console.log(`[Background] cookiesString: ${cookiesString}`);

		return Promise.resolve({ success: true, value: cookiesString });

		// Keeps the message port open for async response
		return true;
	}
});

/**
 * Promise-based HTTP request using fetch.
 * Manually retrieves and attaches cookies for the target URL since service
 * workers don't reliably include them on cross-origin requests.
 * When `redirect` is `'manual'`, uses `webRequest.onBeforeRedirect` to
 * intercept the 302 status and Location header before the browser follows
 * the redirect (fetch auto-follows redirects and cannot expose them).
 * @param {string} method  HTTP method (e.g. 'GET', 'POST')
 * @param {string} url
 * @param {Object<string, string>} headers
 * @param {FormData|null} formData
 * @param {{ redirect?: 'follow' | 'manual' }} [options]
 * @returns {Promise<{status: number, responseText: string, responseURL: string, getResponseHeader: (name: string) => string|null}>}
 */
async function httpRequest(method, url, headers = {}, formData = null, { redirect = 'follow' } = {}) {
	// Manually attach cookies — service workers cannot rely on
	// credentials:'include' for cross-origin website cookies.
	const requestHeaders = { ...headers };
	try {
		const cookies = await api.cookies.getAll({ url });
		const cookieString = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
		if (cookieString) {
			requestHeaders['Cookie'] = cookieString;
			console.log(`[httpRequest] Attached ${cookies.length} cookie(s) for ${url}`);
		}
	} catch (e) {
		console.warn(`[httpRequest] Failed to retrieve cookies for ${url}:`, e);
	}

	if (redirect === 'manual') {
		return new Promise((resolve, reject) => {
			let redirectCaptured = false;
			const controller = new AbortController();

			const onRedirect = (details) => {
				if (details.url !== url) return;
				redirectCaptured = true;
				api.webRequest.onBeforeRedirect.removeListener(onRedirect);
				controller.abort(); // Stop the request from following the redirect

				resolve({
					status: details.statusCode,
					responseText: '',
					responseURL: details.redirectUrl,
					getResponseHeader: (name) => {
						const header = (details.responseHeaders || []).find((h) => h.name.toLowerCase() === name.toLowerCase());
						return header?.value || null;
					},
				});
			};

			api.webRequest.onBeforeRedirect.addListener(onRedirect, { urls: ['<all_urls>'] }, ['responseHeaders']);

			// Fire the actual request — if a redirect happens,
			// onBeforeRedirect resolves the promise and aborts this fetch.
			fetch(url, {
				method,
				headers: new Headers(requestHeaders),
				body: formData,
				credentials: 'include',
				signal: controller.signal,
			})
				.then(async (response) => {
					// No redirect happened — return the normal response
					if (!redirectCaptured) {
						api.webRequest.onBeforeRedirect.removeListener(onRedirect);
						resolve({
							status: response.status,
							responseText: await response.text().catch(() => ''),
							responseURL: response.url,
							getResponseHeader: (name) => response.headers.get(name),
						});
					}
				})
				.catch((err) => {
					if (!redirectCaptured) {
						api.webRequest.onBeforeRedirect.removeListener(onRedirect);
						reject(err);
					}
				});
		});
	}

	const response = await fetch(url, {
		method,
		headers: new Headers(requestHeaders),
		body: formData,
		credentials: 'include',
	});

	return {
		status: response.status,
		responseText: await response.text().catch(() => ''),
		responseURL: response.url,
		getResponseHeader: (name) => response.headers.get(name),
	};
}

async function handleFuckingFast({ type, fileId, cfTurnstileResponse }, config) {
	const target = config.targetUrl.replace('{fileId}', fileId);
	const headers = {
		...(config.headers || {}),
		'hx-current-url': `https://fuckingfast.co/${fileId}`,
	};

	const formData = new FormData();
	if (cfTurnstileResponse) {
		formData.append('cf-turnstile-response', cfTurnstileResponse);
	}

	console.log(`[Background] [${type}] API Target: ${target}`);
	console.log(`[Background] [${type}] Headers:`, headers);

	const response = await httpRequest('POST', target, headers, formData);

	console.log(`[Background] [${type}] Response Status: ${response.status}`);
	const redirectUrl = response.getResponseHeader('hx-redirect');

	if (!redirectUrl) {
		console.error(`[Background] [${type}] missing hx-redirect in response headers.`);
		throw new Error('hx-redirect header missing from response');
	}
	return redirectUrl;
}

async function handleDataNodes({ type, fileId, rand, dlToken, cfTurnstileResponse }, config) {
	const headers = { ...(config.headers || {}) };

	const formData = new FormData();
	formData.append('id', fileId);
	formData.append('rand', rand);
	formData.append('dl_token', dlToken);
	if (cfTurnstileResponse) {
		formData.append('cf-turnstile-response', cfTurnstileResponse);
	}
	for (const [key, value] of Object.entries(config.formData)) {
		formData.append(key, value);
	}

	console.log(`[Background] [${type}] API Target: ${config.targetUrl}`);
	console.log(`[Background] [${type}] FormData configured for ID: ${fileId}`);
	console.log(`[Background] [${type}] Headers:`, headers);

	const response = await httpRequest('POST', config.targetUrl, headers, formData, {
		redirect: type === 'filekeeper' ? 'manual' : 'follow',
	});

	console.log(`[Background] [${type}] Response Status: ${response.status}`);

	if (response.status === 302 && response.responseURL) {
		console.log(`[Background] [${type}] Response URL:`, response.responseURL);
		return decodeURIComponent(response.responseURL);
	}

	const text = response.responseText;
	console.log(`[Background] [${type}] Raw Response Body:`, `${text.trim().slice(0, 6)}...`);

	if (text.includes('<html>')) {
		throw new Error('HTML');
	}

	let json;
	try {
		json = JSON.parse(text);
	} catch (e) {
		throw new Error('Failed to parse DataNodes response as JSON');
	}

	if (!json.url) throw new Error('No download URL returned in JSON payload');

	return decodeURIComponent(json.url);
}

async function waitForMs(ms) {
	await new Promise((resolve, reject) => setTimeout(() => resolve(), ms));
}

/**
 * @param {chrome.tabs.Tab | browser.tabs.Tab} tab
 */
async function getCookiesStringForTab(tab) {
	const cookies = await getCookiesForTab(tab);
	return getCookiesString(cookies);
}

/**
 * @param {chrome.tabs.Tab | browser.tabs.Tab} tab
 * @returns {Promise<chrome.cookies.Cookie[] | browser.cookies.Cookie[]>}
 */
async function getCookiesForTab(tab, withPartitionCondition = true) {
	if (!tab) {
		return undefined;
	}
	console.log(`[getCookiesForTab()]`, `tab:`, tab);

	const tabURL = new URL(tab.url);
	console.log(`[getCookiesForTab()]`, `tabURL:`, tabURL);

	const allCookieStores = await api.cookies.getAllCookieStores();
	console.log(`[getCookiesForTab()]`, `allCookieStores:`, allCookieStores);

	const tabCookieStoreId = allCookieStores.find((e) => e.tabIds.find((t) => t === tab.id))?.id;
	console.log(`[getCookiesForTab()]`, `tabCookieStoreId:`, tabCookieStoreId);

	let cookiesWithPartition = await api.cookies.getAll({
		storeId: tabCookieStoreId,
		domain: tabURL.host,
		partitionKey: { topLevelSite: tabURL.origin },
	});
	cookiesWithPartition = cookiesWithPartition.filter((e) => e.expirationDate < Date.now() - 1000);
	console.log(`[getCookiesForTab()]`, `cookiesWithPartition:`, cookiesWithPartition);

	let cookiesWithoutPartition = await api.cookies.getAll({
		storeId: tabCookieStoreId,
		domain: tabURL.host,
	});
	cookiesWithoutPartition = cookiesWithoutPartition.filter((e) => e.expirationDate < Date.now() - 1000);
	console.log(`[getCookiesForTab()]`, `cookiesWithoutPartition:`, cookiesWithoutPartition);

	const allCookies = [...cookiesWithPartition, ...cookiesWithoutPartition];
	console.log(`[getCookiesForTab()]`, `allCookies:`, allCookies);
	return allCookies;
}

/**
 * @param {chrome.cookies.Cookie[] | browser.cookies.Cookie[]} cookies
 */
function getCookiesString(cookies = []) {
	return cookies?.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}
