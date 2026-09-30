const api = typeof browser !== 'undefined' ? browser : chrome;

let currentSettings = {};

function isWebpage_DataNodes(url = '') {
	return url.includes('datanodes.to');
}

function isWebpage_FuckingFast(url = '') {
	return url.includes('fuckingfast.co');
}

function isWebpage_FileKeeper(url = '') {
	return url.includes('filekeeper.net');
}

document.addEventListener('DOMContentLoaded', async () => {
	console.log('[Popup] Initializing Extension UI...');

	try {
		const data = await api.storage.local.get(['settings', 'popupInput', 'popupOutput']);
		currentSettings = data.settings || {};

		if (data.popupInput) {
			document.getElementById('input-links').value = data.popupInput;
			updateInputCount();
		}
		if (data.popupOutput) {
			try {
				const parsedOutputs = JSON.parse(data.popupOutput);
				for (const item of parsedOutputs) {
					addOutputItem(item.url, item.success, item.error);
				}
				if (parsedOutputs.length > 0) {
					document.getElementById('output-container').classList.remove('hidden');
				}
			} catch (e) {
				const lines = data.popupOutput.split('\n').filter((l) => l.trim());
				for (const l of lines) {
					if (l.startsWith('[FAILED]') || l.startsWith('[SKIPPED]')) {
						let cleanUrl = l.replace('[FAILED] ', '').replace('[SKIPPED] ', '');
						cleanUrl = cleanUrl.split(' -> ')[0].trim();
						addOutputItem(cleanUrl, false, 'Failed (Legacy state)');
					} else {
						addOutputItem(l, true);
					}
				}
				if (lines.length > 0) {
					document.getElementById('output-container').classList.remove('hidden');
				}
			}
		}

		if (data.autoStartBatch) {
			await api.storage.local.remove('autoStartBatch');
			setTimeout(() => {
				document.getElementById('btn-process').click();
			}, 500);
		}

		// Initialize append scrape state (default to true if undefined)
		if (currentSettings.appendScrape === undefined) {
			currentSettings.appendScrape = true;
		}
		document.getElementById('cfg-append-scrape').checked = currentSettings.appendScrape;

		applyUiSettings();
		initEventHandlers();

		if (window.location.hash === '#panel-settings') {
			document.getElementById('tab-settings').click();
		}

		// Check if current tab is a target hosting site using Promises
		const tabs = await api.tabs.query({ active: true, currentWindow: true });
		if (tabs[0] && tabs[0].url) {
			const url = tabs[0].url;
			if (isWebpage_DataNodes(url) || isWebpage_FuckingFast(url) || isWebpage_FileKeeper(url)) {
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
		updateInputCount();
		await api.storage.local.set({ popupInput: e.target.value });
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
		updateInputCount();
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
				updateInputCount();
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

	let stopRequested = false;
	document.getElementById('btn-stop-process').addEventListener('click', () => {
		stopRequested = true;
		document.getElementById('btn-stop-process').innerText = 'Stopping...';
	});

	document.getElementById('btn-process').addEventListener('click', async (e) => {
		try {
			const rawInput = document.getElementById('input-links').value;
			const lines = rawInput
				.split('\n')
				.map((l) => l.trim())
				.filter((l) => l);

			console.log(`[Popup] Starting batch processing for ${lines.length} URLs...`);
			if (lines.length === 0) return;

			const tab = await new Promise((resolve) => api.tabs.getCurrent(resolve));
			if (!tab) {
				console.log('[Popup] Running in popup. Opening as a tab to prevent closing during processing.');
				await api.storage.local.set({ popupInput: rawInput, autoStartBatch: true });
				await api.tabs.create({ url: api.runtime.getURL('popup.html') });
				window.close();
				return;
			}

			e.target.disabled = true;
			e.target.classList.add('hidden');
			document.getElementById('btn-stop-process').classList.remove('hidden');
			document.getElementById('btn-stop-process').innerText = 'Stop Processing';
			stopRequested = false;

			const statusEl = document.getElementById('processing-status');
			statusEl.classList.remove('hidden');
			const statusTextEl = document.getElementById('processing-status-text');
			const originalStatusText = statusTextEl.innerText;

			document.getElementById('output-container').classList.remove('hidden');

			const tabs = await api.tabs.query({ active: true, currentWindow: true });

			for (let [i, url] of lines.entries()) {
				if (stopRequested) {
					console.log('[Popup] User stopped the batch process.');
					statusTextEl.innerText = 'Processing stopped.';
					break;
				}
				let type = '';
				let fileId = null;
				if (url.includes('fuckingfast.co')) {
					type = 'fuckingfast';
					const match = url.match(/fuckingfast\.co\/([a-zA-Z0-9]+)/);
					if (match) fileId = match[1];
				} else if (url.includes('datanodes.to')) {
					type = 'datanodes';
					const match = url.match(/datanodes\.to\/([a-zA-Z0-9]+)/);
					if (match) fileId = match[1];
				} else if (url.includes('filekeeper.net')) {
					type = 'filekeeper';
					const match = url.match(/filekeeper\.net\/([a-zA-Z0-9]+)/);
					if (match) fileId = match[1];
				}

				statusTextEl.innerText = `Processing File ID: ${fileId} (${i + 1})`;

				if (type) {
					console.log(`[Popup] Getting extraction data for: ${url}`);
					let extractionData = null;
					let extractionError = null;

					const tokenCheck = await api.runtime.sendMessage({ action: 'checkCachedToken', type });
					const hasCachedToken = tokenCheck && tokenCheck.hasToken;

					try {
						extractionData = await new Promise((resolve, reject) => {
							const processUrl = new URL(url);
							processUrl.hash = 'background-extract';
							api.tabs.create({ url: processUrl.toString(), active: !hasCachedToken }, (extractionTab) => {
								const tabId = extractionTab.id;
								let isResolved = false;

								const cleanup = () => {
									if (isResolved) return;
									isResolved = true;
									api.tabs.remove(tabId).catch(() => {});
									if (tab && tab.id) {
										api.tabs.update(tab.id, { active: true }).catch(() => {});
									}
								};

								const attempt = () => {
									if (isResolved) return;
									api.tabs
										.sendMessage(tabId, { action: 'getExtractionData', type, skipTurnstile: hasCachedToken })
										.then((response) => {
											console.log(`[Popup] getExtractionData:`, response);
											if (response && response.fileDetails) {
												cleanup();
												resolve(response);
											} else if (response && response.error) {
												cleanup();
												reject(new Error(response.error));
											}
										})
										.catch((e) => {
											// Content script might not be injected yet, retry
											setTimeout(attempt, 500);
										});
								};

								// Start trying to communicate with the content script
								setTimeout(attempt, 500); // Give the tab a moment to load

								// 15 seconds absolute timeout
								setTimeout(() => {
									if (!isResolved) {
										cleanup();
										reject(new Error('Timeout waiting for extraction data'));
									}
								}, 15000);
							});
						});
					} catch (e) {
						extractionError = e.message;
					}

					if (extractionError) {
						console.error(`[Popup] Extraction Error: ${extractionError}`);
						addOutputItem(url, false, extractionError, true);
						removeFromInput(url);
						saveOutputsToStorage();
						continue;
					}

					console.log(`[Popup] Dispatching API request to background for: ${url}`);
					const res = await api.runtime.sendMessage({
						action: 'processLink',
						type,
						fileId,
						url,
						cfTurnstileResponse: extractionData.cfTurnstileResponse,
						...extractionData.fileDetails,
					});
					if (res.success) {
						console.log(`[Popup] Successfully bypassed link. Output: ${res.url}`);
						addOutputItem(res.url, true, '', true);
						removeFromInput(url);
						saveOutputsToStorage();
					} else {
						console.error(`[Popup] Bypassing failed for ${url}. Error: ${res.error}`);
						addOutputItem(url, false, res.error, true);
						removeFromInput(url);
						saveOutputsToStorage();
					}
				} else {
					console.warn(`[Popup] Skipped unsupported URL format: ${url}`);
					addOutputItem(url, false, 'Unsupported Context Format', true);
					removeFromInput(url);
					saveOutputsToStorage();
				}
			}

			console.log('[Popup] Batch processing complete.');

			statusEl.classList.add('hidden');
			statusTextEl.innerText = originalStatusText;

			document.getElementById('btn-process').disabled = false;
			document.getElementById('btn-process').classList.remove('hidden');
			document.getElementById('btn-stop-process').classList.add('hidden');

			if (document.getElementById('output-list').children.length > 0) {
				document.getElementById('output-container').classList.remove('hidden');
			} else {
				document.getElementById('output-container').classList.add('hidden');
			}

			const copyAllBtn = document.getElementById('btn-copy-all');
			if (copyAllBtn) {
				copyAllBtn.scrollIntoView({
					behavior: 'smooth',
				});
				copyAllBtn.focus();
			}
		} catch (error) {
			console.error(`[Popup] Exception occurred while processing Error:`, error);
		} finally {
			e.target.disabled = false;
		}
	});

	document.getElementById('btn-copy-all').addEventListener('click', async (e) => {
		console.log('[Popup] Copying all results to clipboard.');
		const orgText = e.target.innerText;

		const links = [];
		document.querySelectorAll('#output-list .output-item-success .output-item-text').forEach((span) => {
			links.push(span.innerText);
		});

		if (links.length > 0) {
			await navigator.clipboard.writeText(links.join('\n'));
		}

		e.target.innerText = 'Copied!';
		e.target.disabled = true;
		setTimeout(() => {
			e.target.innerText = orgText;
			e.target.disabled = false;
		}, 1500);
	});

	document.getElementById('btn-clear-output').addEventListener('click', async () => {
		console.log('[Popup] Clearing output list.');
		document.getElementById('output-list').innerHTML = '';
		document.getElementById('output-container').classList.add('hidden');
		await api.storage.local.remove('popupOutput');
	});

	document.getElementById('btn-export').addEventListener('click', () => {
		console.log('[Popup] Exporting configuration to JSON.');
		const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(currentSettings, null, 2));
		const dlAnchor = document.createElement('a');
		dlAnchor.setAttribute('href', dataStr);
		dlAnchor.setAttribute('download', 'DirectLinkExtractor.settings.json');
		dlAnchor.click();
	});

	document.getElementById('btn-import-trigger').addEventListener('click', async () => {
		const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
		const tab = await new Promise((resolve) => api.tabs.getCurrent(resolve));

		// Firefox kills the popup when a file picker opens, Chrome does not.
		if (isFirefox && !tab) {
			console.log('[Popup] Running in Firefox popup. Opening as a tab for file import.');
			await api.tabs.create({ url: api.runtime.getURL('popup.html#panel-settings') });
			window.close();
			return;
		}

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

function updateInputCount() {
	const rawInput = document.getElementById('input-links').value;
	const lines = rawInput
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l);
	document.getElementById('input-count').innerText = lines.length;
}

function switchTab(e, panelId) {
	document.querySelectorAll('.nav-tabs button').forEach((b) => b.classList.remove('active'));
	document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active-panel'));

	e.target.classList.add('active');
	document.getElementById(panelId).classList.add('active-panel');
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

function removeFromInput(url) {
	const inputLinks = document.getElementById('input-links');
	let currentVals = inputLinks.value
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l);
	currentVals = currentVals.filter((l) => l !== url);
	inputLinks.value = currentVals.join('\n');
	updateInputCount();
	api.storage.local.set({ popupInput: inputLinks.value });
}

function addOutputItem(url, isSuccess, errorMsg = '', shouldScroll = false) {
	const outputList = document.getElementById('output-list');
	const itemDiv = document.createElement('div');
	itemDiv.classList.add('output-item');
	itemDiv.classList.add(isSuccess ? 'output-item-success' : 'output-item-error');

	const linkSpan = document.createElement('span');
	linkSpan.classList.add('output-item-text');
	linkSpan.innerText = isSuccess ? url : `Failed: ${url} ${errorMsg ? `(${errorMsg})` : ''}`;

	const btn = document.createElement('button');
	btn.className = 'secondary-btn';
	btn.style.padding = '4px 8px';
	btn.style.whiteSpace = 'nowrap';

	if (isSuccess) {
		btn.innerText = 'Copy';
		btn.onclick = () => {
			navigator.clipboard.writeText(url);
			btn.innerText = 'Copied!';
			setTimeout(() => (btn.innerText = 'Copy'), 1500);
		};
	} else {
		btn.innerText = 'Retry';
		btn.onclick = () => {
			btn.disabled = true;
			btn.innerText = 'Link queued for processing';

			const inputLinks = document.getElementById('input-links');
			const currentVals = inputLinks.value
				.split('\n')
				.map((l) => l.trim())
				.filter((l) => l);
			if (!currentVals.includes(url)) {
				currentVals.push(url);
				inputLinks.value = currentVals.join('\n');
				updateInputCount();
				api.storage.local.set({ popupInput: inputLinks.value });
			}

			setTimeout(() => {
				itemDiv.remove();
				saveOutputsToStorage();
			}, 2000);
		};
	}

	itemDiv.appendChild(linkSpan);
	itemDiv.appendChild(btn);
	outputList.appendChild(itemDiv);

	if (shouldScroll) {
		itemDiv.scrollIntoView({
			behavior: 'smooth',
			block: 'center',
			inline: 'center',
		});
	}
}

function saveOutputsToStorage() {
	const outputList = document.getElementById('output-list');
	const items = [];
	for (let item of outputList.children) {
		const isSuccess = item.classList.contains('output-item-success');
		const textEl = item.querySelector('.output-item-text');
		if (!textEl) continue;
		const text = textEl.innerText;
		if (isSuccess) {
			items.push({ url: text, success: true });
		} else {
			const match = text.match(/^Failed: (.*?)(?: \((.*)\))?$/);
			if (match) {
				items.push({ url: match[1], success: false, error: match[2] || '' });
			} else {
				items.push({ url: text, success: false, error: '' });
			}
		}
	}
	api.storage.local.set({ popupOutput: JSON.stringify(items) });
}
