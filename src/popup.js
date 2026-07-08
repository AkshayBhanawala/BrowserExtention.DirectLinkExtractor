const api = typeof browser !== 'undefined' ? browser : chrome;

let currentSettings = {};

function isWebpage_DataNodes(url = '') {
	return url.includes('datanodes.to');
}

function isWebpage_FuckingFast(url = '') {
	return url.includes('fuckingfast.co');
}

document.addEventListener('DOMContentLoaded', async () => {
	console.log('[Popup] Initializing Extension UI...');

	try {
		const data = await api.storage.local.get(['settings', 'popupInput', 'popupOutput']);
		currentSettings = data.settings || {};

		if (data.popupInput) document.getElementById('input-links').value = data.popupInput;
		if (data.popupOutput) {
			document.getElementById('output-links').value = data.popupOutput;
			document.getElementById('output-container').classList.remove('hidden');
		}

		// Initialize append scrape state (default to true if undefined)
		if (currentSettings.appendScrape === undefined) {
			currentSettings.appendScrape = true;
		}
		document.getElementById('cfg-append-scrape').checked = currentSettings.appendScrape;

		applyUiSettings();
		initEventHandlers();

		// Check if current tab is a target hosting site using Promises
		const tabs = await api.tabs.query({ active: true, currentWindow: true });
		if (tabs[0] && tabs[0].url) {
			const url = tabs[0].url;
			if (isWebpage_DataNodes(url) || isWebpage_FuckingFast(url)) {
				console.log(`[Popup] Target hosting site detected in active window: ${url}`);
				document.getElementById('direct-page-container').classList.remove('hidden');
				document.getElementById('standard-extractor-container').style.display = 'none';
			}
		}
		console.log('[Popup] UI Initialization complete.', currentSettings);
	} catch (err) {
		console.error('[Popup] Error during initialization:', err);
	}
});

function applyUiSettings() {
	document.documentElement.setAttribute('data-theme', currentSettings.theme || 'dark');
	document.getElementById('cfg-dark-theme').checked = currentSettings.theme === 'dark';
	document.getElementById('cfg-auto-direct').checked = currentSettings.autoProcessDirect;

	const engineConfig = {
		fuckingfast: currentSettings.fuckingfast,
		datanodes: currentSettings.datanodes,
	};
	document.getElementById('cfg-raw-json').value = JSON.stringify(engineConfig, null, 2);
}

function initEventHandlers() {
	document.getElementById('tab-extractor').addEventListener('click', (e) => switchTab(e, 'panel-extractor'));
	document.getElementById('tab-settings').addEventListener('click', (e) => switchTab(e, 'panel-settings'));

	document.getElementById('input-links').addEventListener('input', async (e) => {
		await api.storage.local.set({ popupInput: e.target.value });
	});
	document.getElementById('output-links').addEventListener('input', async (e) => {
		await api.storage.local.set({ popupOutput: e.target.value });
	});

	document.getElementById('cfg-auto-direct').addEventListener('change', async (e) => {
		console.log(`[Popup] Auto-direct setting changed to: ${e.target.checked}`);
		currentSettings.autoProcessDirect = e.target.checked;
		await saveSettings();
	});

	document.getElementById('cfg-append-scrape').addEventListener('change', async (e) => {
		console.log(`[Popup] Append scrape links setting changed to: ${e.target.checked}`);
		currentSettings.appendScrape = e.target.checked;
		await saveSettings();
	});

	document.getElementById('cfg-dark-theme').addEventListener('change', async (e) => {
		console.log(`[Popup] Theme changed. Dark mode: ${e.target.checked}`);
		currentSettings.theme = e.target.checked ? 'dark' : 'light';
		document.documentElement.setAttribute('data-theme', currentSettings.theme);
		await saveSettings();
	});

	document.getElementById('cfg-raw-json').addEventListener('change', async (e) => {
		console.log('[Popup] Validating manual JSON configuration update...');
		try {
			const parsed = JSON.parse(e.target.value);
			if (parsed.fuckingfast && parsed.datanodes) {
				currentSettings.fuckingfast = parsed.fuckingfast;
				currentSettings.datanodes = parsed.datanodes;
				await saveSettings();
				flashStatus('settings-status', 'Settings Compiled Successfully!');
				console.log('[Popup] Engine configuration updated via JSON editor.');
			} else {
				alert("Invalid format: Must include both 'fuckingfast' and 'datanodes' definitions.");
			}
		} catch (err) {
			console.error('[Popup] JSON Syntax Error:', err);
			alert('JSON Syntax Evaluation Failure. Check structure blocks.');
		}
	});

	document.getElementById('btn-clear').addEventListener('click', async () => {
		console.log('[Popup] Clearing input and output links...');
		document.getElementById('input-links').value = '';
		document.getElementById('output-links').value = '';
		document.getElementById('output-container').classList.add('hidden');
		await api.storage.local.set({ popupInput: '', popupOutput: '' });
	});

	document.getElementById('btn-process-current').addEventListener('click', async () => {
		console.log('[Popup] Transmitting page rendering task directly to active content script framework...');

		try {
			const tabs = await api.tabs.query({ active: true, currentWindow: true });
			if (!tabs[0] || !tabs[0].url) return;

			console.log('[Popup] Contacting tab:', tabs[0]);
			const response = await api.tabs.sendMessage(tabs[0].id, { action: 'forceProcessDirect', url: tabs[0].url });

			if (response && response.success) {
				console.log('[Popup] Layout alteration accepted by page. Terminating runtime popup.');
				window.close();
			}
		} catch (err) {
			console.error('[Popup] Content Script Execution failed:', err);
			alert('Connection lost with the page script. Please refresh the website and try again.');
		}
	});

	document.getElementById('btn-scrape').addEventListener('click', async () => {
		console.log('[Popup] Initiating page link scrape...');
		try {
			const tabs = await api.tabs.query({ active: true, currentWindow: true });
			if (!tabs[0]) return;

			console.log(`[Popup] Sending scrape trigger to tab ID: ${tabs[0].id}`);

			const response = await api.tabs.sendMessage(tabs[0].id, { action: 'scrapeLinks' });
			console.log(`[Popup] Response:`, response);

			if (response && response.links && response.links.length > 0) {
				console.log(`[Popup] Received ${response.links.length} links from page.`);
				const inputTx = document.getElementById('input-links');
				let finalLinks = [];

				if (currentSettings.appendScrape) {
					console.log('[Popup] Appending mode is ON. Merging with existing links.');
					const distinct = new Set([...inputTx.value.split('\n'), ...response.links]);
					finalLinks = Array.from(distinct)
						.map((l) => l.trim())
						.filter((l) => l);
				} else {
					console.log('[Popup] Appending mode is OFF. Replacing existing links.');
					const distinct = new Set([...response.links]);
					finalLinks = Array.from(distinct)
						.map((l) => l.trim())
						.filter((l) => l);
				}

				const joined = finalLinks.join('\n');
				inputTx.value = joined;
				await api.storage.local.set({ popupInput: joined });
			} else {
				console.log('[Popup] No target links found by content script.');
				alert('No links matching targeted platforms were found on this page.');
			}
		} catch (err) {
			console.error('[Popup] Scrape Error (Content script might not be loaded):', err);
			alert('Could not connect to the page. Please refresh the website and try again.');
		}
	});

	document.getElementById('btn-process').addEventListener('click', async () => {
		const rawInput = document.getElementById('input-links').value;
		const lines = rawInput
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l);

		console.log(`[Popup] Starting batch processing for ${lines.length} URLs...`);
		if (lines.length === 0) return;

		const statusEl = document.getElementById('processing-status');
		statusEl.classList.remove('hidden');

		const outputs = [];
		for (let url of lines) {
			let type = '';
			let id = null;
			if (url.includes('fuckingfast.co')) {
				type = 'fuckingfast';
			} else if (url.includes('datanodes.to')) {
				type = 'datanodes';
				const match = url.match(/datanodes\.to\/([a-zA-Z0-9]+)/);
				if (match) id = match[1];
			}

			if (type) {
				console.log(`[Popup] Dispatching API request to background for: ${url}`);
				const res = await dispatchBypassRequest({ action: 'processLink', type, url, id });
				if (res.success) {
					console.log(`[Popup] Successfully bypassed link. Output: ${res.url}`);
					outputs.push(res.url);
				} else {
					console.error(`[Popup] Bypassing failed for ${url}. Error: ${res.error}`);
					outputs.push(`[FAILED] ${url} -> ${res.error}`);
				}
			} else {
				console.warn(`[Popup] Skipped unsupported URL format: ${url}`);
				outputs.push(`[SKIPPED] Unsupported Context Format: ${url}`);
			}
		}

		console.log('[Popup] Batch processing complete.');
		statusEl.classList.add('hidden');
		const outValue = outputs.join('\n');
		document.getElementById('output-links').value = outValue;

		if (outputs.length > 0) {
			document.getElementById('output-container').classList.remove('hidden');
		} else {
			document.getElementById('output-container').classList.add('hidden');
		}

		await api.storage.local.set({ popupOutput: outValue });
	});

	document.getElementById('btn-copy').addEventListener('click', () => {
		console.log('[Popup] Copying results to clipboard.');
		const outputTx = document.getElementById('output-links');
		outputTx.select();
		document.execCommand('copy');
		alert('Direct Links copied to clipboard.');
	});

	document.getElementById('btn-export').addEventListener('click', () => {
		console.log('[Popup] Exporting configuration to JSON.');
		const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentSettings, null, 2));
		const dlAnchor = document.createElement('a');
		dlAnchor.setAttribute('href', dataStr);
		dlAnchor.setAttribute('download', 'DirectLinkExtractor.settings.json');
		dlAnchor.click();
	});

	document.getElementById('btn-import-trigger').addEventListener('click', () => {
		document.getElementById('file-import').click();
	});

	document.getElementById('file-import').addEventListener('change', (e) => {
		console.log('[Popup] Reading imported JSON configuration...');
		const file = e.target.files[0];
		if (!file) return;
		const reader = new FileReader();
		reader.onload = (event) => {
			try {
				const imported = JSON.parse(event.target.result);
				if (imported.fuckingfast && imported.datanodes) {
					currentSettings = imported;
					saveSettings();
					applyUiSettings();
					flashStatus('settings-status', 'Configurations Successfully Migrated!');
					console.log('[Popup] Configuration successfully imported.');
				} else {
					console.error('[Popup] Import failed: Invalid layout structure.');
					alert('Invalid layout structure parameters observed.');
				}
			} catch (err) {
				console.error('[Popup] Import failed: JSON Parsing error.', err);
				alert('Corrupted settings profiles detected.');
			}
		};
		reader.readAsText(file);
	});
}

function switchTab(e, panelId) {
	document.querySelectorAll('.nav-tabs button').forEach((b) => b.classList.remove('active'));
	document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active-panel'));

	e.target.classList.add('active');
	document.getElementById(panelId).classList.add('active-panel');
}

async function dispatchBypassRequest(payload) {
	return await api.runtime.sendMessage(payload);
}

async function saveSettings() {
	await api.storage.local.set({ settings: currentSettings });
	console.log('[Popup] Settings saved to local storage.');
}

function flashStatus(elementId, msg) {
	const el = document.getElementById(elementId);
	el.innerText = msg;
	el.classList.remove('hidden');
	setTimeout(() => el.classList.add('hidden'), 2000);
}
