const api = typeof browser !== 'undefined' ? browser : chrome;

// Check if the body exists immediately
if (isWebpage_DataNodes()) {
	dataNodeBodyObserver();
} else if (isWebpage_FuckingFast()) {
	document.addEventListener('DOMContentLoaded', async (event) => {
		await onBodyAvailable();
	});
}

function isWebpage_DataNodes() {
	return location.host.includes('datanodes.to');
}

function isWebpage_FuckingFast() {
	return location.host.includes('fuckingfast.co');
}

async function dataNodeBodyObserver() {
	if (isFileCodeAvailable()) {
		await onBodyAvailable();
	} else if (!document.body) {
		// Observe the document element for the addition of the body node
		const observer = new MutationObserver(async (mutations, obs) => {
			if (isFileCodeAvailable()) {
				obs.disconnect();
				await onBodyAvailable();
			}
		});
		observer.observe(document.documentElement, {
			childList: true,
			subtree: true,
		});
	}

	function isFileCodeAvailable() {
		return document.body && document.body?.outerHTML?.includes('file-actions');
	}
}

function saveFileDetails() {
	console.log('[Content]:', document.body.outerHTML);

	if (isWebpage_DataNodes()) {
		forDataNode();
	} else if (isWebpage_FuckingFast()) {
		forFuckingFast();
	}

	function forDataNode() {
		const fileActions = document.body.querySelector('file-actions');
		console.log('[Content] fileActions:', fileActions);
		const fileId = fileActions.getAttribute('code');
		console.log('[Content] fileId:', fileId);

		const scanCard = document.body.querySelector('div#scanCard');
		console.log('[Content] scanCard:', scanCard, scanCard?.dataset);

		const fileName = scanCard?.dataset?.scanFile || fileActions.getAttribute('data-scan-file');
		console.log('[Content] fileName:', fileName);

		const fileSize = scanCard?.dataset?.scanSize || fileActions.getAttribute('data-scan-size');
		console.log('[Content] fileSize:', fileSize);

		const fileDetails = { fileId, fileName, fileSize };
		window.fileDetails = fileDetails;
	}

	function forFuckingFast() {
		const aLinkButton = document.body.querySelector('a.link-button');
		console.log('[Content] a.link-button:', aLinkButton);
		const fileId = aLinkButton.getAttribute('hx-post').split('/')?.at(2);
		console.log('[Content] fileId:', fileId);

		const spanTextXL = document.body.querySelector('span.text-xl');
		console.log('[Content] span.text-xl:', spanTextXL, spanTextXL?.innerHTML);
		const fileName = spanTextXL?.innerHTML;
		console.log('[Content] fileName:', fileName);

		const spanTextGray500 = document.body.querySelector('span.text-gray-500');
		console.log('[Content] span.text-gray-500:', spanTextGray500, spanTextGray500?.innerHTML);
		const fileSize = spanTextGray500?.innerHTML
			?.split(' | ')
			?.at(0)
			?.replace(/size: /gi, '');
		console.log('[Content] fileSize:', fileSize);

		const fileDetails = { fileId, fileName, fileSize };
		window.fileDetails = fileDetails;
	}
}

async function onBodyAvailable() {
	console.log('[Content] Body is now accessible!');
	saveFileDetails();
	await process();
}

async function process(force = false) {
	if (force) {
		console.log('[Content] Force-process execution triggered by manual popup UI request.');
	} else {
		console.log('[Content] Link Extractor Content Script Mounted.');
	}
	const currentUrl = window.location.href;
	const isDataNodes = isWebpage_DataNodes();
	const isFuckingFast = isWebpage_FuckingFast();

	try {
		const data = await api.storage.local.get(['settings']);
		const settings = data.settings || {};

		if (!force) {
			console.log(`[Content] Loaded Settings. Auto-process: ${settings.autoProcessDirect}`);
		}

		if ((isDataNodes || isFuckingFast) && (settings.autoProcessDirect || force)) {
			console.log(`[Content] Direct Hosting site detected: ${currentUrl}. Modifying Layout...`);
			renderDirectLandingUI(isFuckingFast ? 'fuckingfast' : 'datanodes', currentUrl);
		}
	} catch (err) {
		console.error('[Content] Failed to load settings:', err);
	}
}

api.runtime.onMessage.addListener(async (request, sender) => {
	if (request.action === 'scrapeLinks') {
		console.log('[Content] Scrape command received from popup UI.');
		const anchors = document.getElementsByTagName('a');
		const extracted = [];
		for (let a of anchors) {
			const href = a.href;
			if (href.includes('fuckingfast.co') || href.includes('datanodes.to')) {
				extracted.push(href);
			}
		}
		console.log(`[Content] Scrape complete. Identified ${extracted.length} target links.`);
		return Promise.resolve({ links: extracted });
	} else if (request.action === 'forceProcessDirect') {
		await process(true);
		return Promise.resolve({ success: true });
	}
});

async function renderDirectLandingUI(type, url) {
	console.log('[Content] window.fileDetails:', window.fileDetails);

	const fileDetails = window.fileDetails;
	const fileId = fileDetails.fileId;

	console.log(`[Content] Dispatching auto-process bypass for ID: ${fileId}, Type: ${type}`);

	try {
		const response = await api.runtime.sendMessage({ action: 'processLink', type, fileId, url });
		if (response && response.success) {
			console.log(`[Content] Auto-process successful. Output: ${response.url}`);
			const body = generateDownloadPageBody(fileDetails, response.url);
			document.querySelectorAll('style, script').forEach((e) => e.remove());
			document.body.replaceWith(body);
		} else {
			throw new Error(response ? response.error : 'Unknown background failure');
		}
	} catch (err) {
		console.error(`[Content] Auto-process failed. Context:`, err);
		const errorMsg = `Error generating link: ${err?.message}`;
		alert(errorMsg);
	}
}

function generateDownloadPageBody(fileDetails, directLinkUrl) {
	const body = document.createElement('body');
	const container = document.createElement('div');

	const style = document.createElement('style');
	style.innerText = `
		*, :before, :after {
			box-sizing: border-box;
		}

		body {
			margin: 0px;
			padding: 0px;
			background: #111827;
			color: #ffffff;
			font-family: sans-serif;
			display: flex;
			justify-content: center;
			max-height: 100vh;
			text-align: center;
			padding-top: 100px;
		}

		blockquote, dl, dd, h1, h2, h3, h4, h5, h6, hr, figure, p, pre {
			margin: revert;
			font: revert;
			font-weight: 100;
		}

		.ext-info {
			display: flex;
			justify-content: center;
			align-items: center;
			gap: 10px;
			margin-bottom: 100px;
		}

		.ext-logo {
			width: 100px;
		}

		.ext-name {
			opacity: 0.8;
			font-size: 40px;
			margin: 0;
		}

		.file-id {
			opacity: 0.5;
			font-family: monospace;
		}

		.file-name {
		}

		.file-size {
			opacity: 0.65;
		}

		.download-btn {
			display: inline-block;
			padding: 20px 40px;
			margin-top: 50px;
			background: #2563eb;
			color: #ffffff;
			font-size: 2rem;
			font-weight: bold;
			text-decoration: none;
			border-radius: 8px;
			box-shadow: 0 4px 14px #2563eb66;
			transition: transform 0.2s;
		}
	`;
	container.appendChild(style);

	const extInfo = document.createElement('div');
	extInfo.classList.add('ext-info');

	const extLogoUrl = api.runtime.getURL('assets/img/icon.svg');
	const extLogo = document.createElement('img');
	extLogo.classList.add('ext-logo');
	extLogo.src = extLogoUrl;
	extInfo.appendChild(extLogo);

	const extName = document.createElement('h1');
	extName.classList.add('ext-name');
	extName.innerText = 'Direct Link Extractor [Browser Extension]';
	extInfo.appendChild(extName);

	container.appendChild(extInfo);

	const fileId = document.createElement('h2');
	fileId.classList.add('file-id');
	fileId.innerText = 'File ID: ' + fileDetails.fileId;
	container.appendChild(fileId);

	const fileName = document.createElement('h2');
	fileName.classList.add('file-name');
	fileName.innerText = fileDetails.fileName;
	container.appendChild(fileName);

	const fileSize = document.createElement('h3');
	fileSize.classList.add('file-size');
	fileSize.innerText = fileDetails.fileSize;
	container.appendChild(fileSize);

	const downloadBtn = document.createElement('a');
	downloadBtn.classList.add('download-btn');
	downloadBtn.href = directLinkUrl;
	downloadBtn.innerText = 'Download Now';
	downloadBtn.onmouseover = () => (downloadBtn.style.transform = 'scale(1.05)');
	downloadBtn.onmouseout = () => (downloadBtn.style.transform = 'scale(1)');
	container.appendChild(downloadBtn);

	body.appendChild(container);

	return body;
}
