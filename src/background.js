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
	if (message.action === 'processLink') {
		console.log(`[Background] Processing requested for: ${message.url} [Type: ${message.type}]`, message);

		try {
			const result = await api.storage.local.get(['settings']);
			const config = result.settings || DEFAULT_SETTINGS;

			let fileId = message.fileId;
			if (!fileId) throw new Error('No file ID found.');

			let directLink = '';
			if (message.type === 'fuckingfast') {
				console.log(`[Background] fuckingfast File ID: ${fileId}`);
				directLink = await handleFuckingFast(fileId, config.fuckingfast);
			} else if (message.type === 'datanodes') {
				console.log(`[Background] Datanodes File ID: ${fileId}`);
				directLink = await handleDataNodes(fileId, config.datanodes);
			}

			console.log(`[Background] Successful bypass. Yielding target: ${directLink}`);
			return Promise.resolve({ success: true, url: directLink });
		} catch (error) {
			console.error(`[Background] Bypass Failure: ${error.message}`);
			return Promise.resolve({ success: false, error: error.message });
		}

		// Keeps the message port open for async response
		return true;
	}
});

async function handleFuckingFast(fileId, config) {
	const target = config.targetUrl.replace('{fileId}', fileId);
	const headers = { ...config.headers, 'hx-current-url': `https://fuckingfast.co/${fileId}` };

	console.log(`[Background] FuckingFast API Target: ${target}`);
	console.log(`[Background] FuckingFast Headers:`, headers);

	const response = await fetch(target, {
		method: 'POST',
		headers: headers,
	});

	console.log(`[Background] FuckingFast Response Status: ${response.status}`);
	const redirectUrl = response.headers.get('hx-redirect');

	if (!redirectUrl) {
		console.error(`[Background] FuckingFast missing hx-redirect in response headers.`);
		throw new Error('hx-redirect header missing from response');
	}
	return redirectUrl;
}

async function handleDataNodes(fileId, config) {
	const formData = new FormData();
	formData.append('id', fileId);
	for (const [key, value] of Object.entries(config.formData)) {
		formData.append(key, value);
	}

	console.log(`[Background] Datanodes API Target: ${config.targetUrl}`);
	console.log(`[Background] Datanodes FormData configured for ID: ${fileId}`);

	const response = await fetch(config.targetUrl, {
		method: 'POST',
		body: formData,
	});

	console.log(`[Background] Datanodes Response Status: ${response.status}`);

	const text = await response.text();
	console.log(`[Background] Datanodes Raw Response Body:`, text);

	let json;
	try {
		json = JSON.parse(text);
	} catch (e) {
		throw new Error('Failed to parse DataNodes response as JSON');
	}

	if (!json.url) throw new Error('No download URL returned in JSON payload');

	return decodeURIComponent(json.url);
}
