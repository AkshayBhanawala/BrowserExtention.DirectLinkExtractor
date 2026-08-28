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
};

api.runtime.onInstalled.addListener(async () => {
	console.log('[Background] Extension Installed/Updated. Initializing Storage...');
	try {
		const result = await api.storage.local.get(['settings']);
		if (!result.settings) {
			await api.storage.local.set({ settings: DEFAULT_SETTINGS });
			console.log('[Background] Default configurations populated.');
		}
	} catch (err) {
		console.error('[Background] Failed to initialize storage:', err);
	}
});

// Using `return true` and an async IIFE is the only 100% cross-browser
// compatible way to handle async sendResponse in Manifest V3.
api.runtime.onMessage.addListener(async (message, sender) => {
	console.log(`[Background] onMessageListener:`, `message:`, message, `sender:`, sender);

	if (message.action === 'processLink') {
		console.log(`[Background] Processing requested for: ${message.url} [Type: ${message.type}]`);

		try {
			const result = await api.storage.local.get(['settings']);
			const config = result.settings || DEFAULT_SETTINGS;

			let fileId = message.fileId;
			if (!fileId) throw new Error('No file ID found.');

			const cfTurnstileResponse = message.cfTurnstileResponse;
			console.log(`[Background] cfTurnstileResponse: ${cfTurnstileResponse}`);

			let directLink = '';
			if (message.type === 'fuckingfast') {
				console.log(`[Background] fuckingfast File ID: ${fileId}`);

				directLink = await handleFuckingFast({ fileId, cfTurnstileResponse }, config.fuckingfast);
			} else if (message.type === 'datanodes') {
				console.log(`[Background] Datanodes File ID: ${fileId}`);

				const rand = message.rand;
				console.log(`[Background] Datanodes rand: ${rand}`);

				const dlToken = message.dlToken;
				console.log(`[Background] Datanodes dlToken: ${dlToken}`);

				let retryCount = 0;
				while (retryCount < 10) {
					try {
						directLink = await handleDataNodes({ fileId, rand, dlToken, cfTurnstileResponse }, config.datanodes);
						break;
					} catch (error) {
						if (error.message === `HTML`) {
							await waitForMs(500);
							retryCount++;
						} else {
							throw error;
						}
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

		const domain = message.type === `fuckingfast` ? `fuckingfast.co` : `datanodes.to`;
		console.log(`[Background] domain: ${domain}`);

		const cookiesString = await getCookiesStringForTab(sender.tab);
		console.log(`[Background] cookiesString: ${cookiesString}`);

		return Promise.resolve({ success: true, value: cookiesString });

		// Keeps the message port open for async response
		return true;
	}
});

async function handleFuckingFast({ fileId, cfTurnstileResponse }, config) {
	const target = config.targetUrl.replace('{fileId}', fileId);
	const headers = {
		...(config.headers || {}),
		'hx-current-url': `https://fuckingfast.co/${fileId}`,
	};

	const formData = new FormData();
	if (cfTurnstileResponse) {
		formData.append('cf-turnstile-response', cfTurnstileResponse);
	}

	console.log(`[Background] FuckingFast API Target: ${target}`);
	console.log(`[Background] FuckingFast Headers:`, headers);

	const response = await fetch(target, {
		method: 'POST',
		headers: headers,
		body: formData,
		credentials: `include`,
	});

	console.log(`[Background] FuckingFast Response Status: ${response.status}`);
	const redirectUrl = response.headers.get('hx-redirect');

	if (!redirectUrl) {
		console.error(`[Background] FuckingFast missing hx-redirect in response headers.`);
		throw new Error('hx-redirect header missing from response');
	}
	return redirectUrl;
}

async function handleDataNodes({ fileId, rand, dlToken, cfTurnstileResponse }, config) {
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

	console.log(`[Background] Datanodes API Target: ${config.targetUrl}`);
	console.log(`[Background] Datanodes FormData configured for ID: ${fileId}`);
	console.log(`[Background] Datanodes Headers:`, headers);

	const response = await fetch(config.targetUrl, {
		method: 'POST',
		body: formData,
		credentials: `include`,
	});

	console.log(`[Background] Datanodes Response Status: ${response.status}`);

	const text = await response.text();
	console.log(`[Background] Datanodes Raw Response Body:`, text);

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
	cookiesWithPartition = cookiesWithPartition.filter(e => e.expirationDate < Date.now() - 1000);
	console.log(`[getCookiesForTab()]`, `cookiesWithPartition:`, cookiesWithPartition);

	let cookiesWithoutPartition = await api.cookies.getAll({
		storeId: tabCookieStoreId,
		domain: tabURL.host,
	});
	cookiesWithoutPartition = cookiesWithoutPartition.filter(e => e.expirationDate < Date.now() - 1000);
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
