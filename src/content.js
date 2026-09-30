const api = typeof browser !== 'undefined' ? browser : chrome;

// Check if the body exists immediately
if (isWebpage_DataNodes() || isWebpage_FileKeeper()) {
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

function isWebpage_FileKeeper() {
	return location.host.includes('filekeeper.net');
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
	try {
		if (isWebpage_DataNodes() || isWebpage_FileKeeper()) {
			return forDataNode();
		} else if (isWebpage_FuckingFast()) {
			return forFuckingFast();
		}
	} catch (error) {
		console.error('[Content]:', error);
		return false;
	}

	function forDataNode() {
		const downloadForm = document.querySelector(`#downloadForm`);
		console.log(`[Content]`, `#downloadForm:`, downloadForm);

		const continueBtn = downloadForm?.querySelector(`button`);
		console.log(`[Content]`, `continueBtn:`, continueBtn, !!continueBtn);

		if (continueBtn) {
			console.log(`[Content]`, `continueBtn.disabled?:`, continueBtn.disabled);
			continueBtn.disabled = false;
			continueBtn.click();
			return false;
		}
		const fileActions = document.body.querySelector('file-actions');
		console.log('[Content] fileActions:', fileActions);
		const fileId = fileActions.getAttribute('code');
		console.log('[Content] fileId:', fileId);

		const fileLink = fileActions.getAttribute('link');
		console.log('[Content] fileLink:', fileLink);

		const scanCard = document.body.querySelector('div#scanCard');
		console.log('[Content] scanCard:', scanCard, scanCard?.dataset);

		const fileName =
			scanCard?.dataset?.scanFile || fileActions.getAttribute('data-scan-file') || fileLink.replace(/.*\//, '');
		console.log('[Content] fileName:', fileName);

		const fileSize =
			scanCard?.dataset?.scanSize ||
			fileActions.getAttribute('data-scan-size') ||
			document.querySelector(`div.container.contentWrap h4+div+div span:first-child`)?.textContent ||
			findByTagAndClassAndText(document, `p`, undefined, `File Size`, true)?.nextElementSibling?.textContent?.trim();
		console.log('[Content] fileSize:', fileSize);

		const downloadCountdown = document.body.querySelector('download-countdown, #download-countdown');
		console.log('[Content] downloadCountdown:', downloadCountdown);
		// downloadCountdown?.setAttribute('premium-method', 'false');
		// downloadCountdown?.setAttribute(':detect-adblock', 'false');
		// downloadCountdown?.setAttribute(':has-captcha', 'false');
		// downloadCountdown?.setAttribute(':has-countdown', 'false');
		// downloadCountdown?.removeAttribute('captcha-html');
		const rand = downloadCountdown.getAttribute('rand');
		console.log('[Content] rand:', rand);

		const dlToken = downloadCountdown.getAttribute('dl-token');
		console.log('[Content] dlToken:', dlToken);

		const fileDetails = { fileId, rand, dlToken, fileName, fileSize, rand };
		window.fileDetails = fileDetails;
		return true;
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
		return true;
	}
}

async function onBodyAvailable() {
	console.log('[Content] Body is now accessible!');
	const processFurther = saveFileDetails();
	if (processFurther) {
		await process();
	}
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
	const isFileKeeper = isWebpage_FileKeeper();

	try {
		const data = await api.storage.local.get(['settings']);
		const settings = data.settings || {};

		if (!force) {
			console.log(`[Content] Loaded Settings. Auto-process: ${settings.autoProcessDirect}`);
		}

		if ((isDataNodes || isFuckingFast || isFileKeeper) && (settings.autoProcessDirect || force)) {
			if (window.location.hash.includes('background-extract')) {
				console.log(`[Content] Background extraction tab detected. Skipping UI modification.`);
				return;
			}
			console.log(`[Content] Direct Hosting site detected: ${currentUrl}. Modifying Layout...`);
			const type = isFuckingFast ? 'fuckingfast' : isFileKeeper ? 'filekeeper' : 'datanodes';
			renderDirectLandingUI(type, currentUrl);
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
			if (href.includes('fuckingfast.co') || href.includes('datanodes.to') || href.includes('filekeeper.net')) {
				extracted.push(href);
			}
		}
		console.log(`[Content] Scrape complete. Identified ${extracted.length} target links.`);
		return Promise.resolve({ links: extracted });
	} else if (request.action === 'forceProcessDirect') {
		await process(true);
		return Promise.resolve({ success: true });
	} else if (request.action === 'cfTurnstileResponse') {
		return getCfTurnstileResponse();
	} else if (request.action === 'getExtractionData') {
		return getExtractionData(request.type, request.skipTurnstile);
	}
});

async function getExtractionData(type, skipTurnstile = false) {
	await waitForPredicate(
		() => window.fileDetails,
		{ type: 'FILE DETAILS', name: 'window.fileDetails' },
		{ checkIntervalInMs: 100, silentExit: true, timeoutInSeconds: 15 },
	);

	let cfTurnstileResponse = '';
	if (type === 'datanodes' || type === 'filekeeper') {
		const cookiesResp = (await api.runtime.sendMessage({ action: 'getCookies', type }))?.value || '';
		if (!cookiesResp.includes('dlpass=') && !skipTurnstile) {
			cfTurnstileResponse = (await getCfTurnstileResponse())?.value || '';
		}
	}

	return {
		fileDetails: window.fileDetails,
		cfTurnstileResponse: cfTurnstileResponse,
	};
}

async function getCfTurnstileResponse() {
	const getter_cfTurnstileScript = () => {
		const s = document.querySelector(`script[src*="turnstile"]`);
		console.log('[Content] CF Turnstile Script:', s);
		return s;
	};
	const getter_cfTurnstileResponse = () => {
		const r = getter_cfTurnstileScript() && document.querySelector(`input[name="cf-turnstile-response"]`)?.value;
		console.log('[Content] CF Turnstile Response:', r);
		return r;
	};

	const success = await waitForPredicate(
		getter_cfTurnstileResponse,
		{ type: 'CLOUDFRONT TURNSTILE', name: 'Response Value' },
		{ checkIntervalInMs: 10, silentExit: true, timeoutInSeconds: 10 },
	);
	if (success) {
		return { value: getter_cfTurnstileResponse() };
	} else {
		return { error: 'cfTurnstileResponse not found' };
	}
}

async function renderDirectLandingUI(type, url) {
	console.log('[Content] window.fileDetails:', window.fileDetails);

	const fileDetails = window.fileDetails;
	const fileId = fileDetails.fileId;
	let cfTurnstileResponse = '';

	showToast('Fetching Direct Download Link, Please Wait...');

	console.log(`[Content] Dispatching auto-process bypass for ID: ${fileId}, Type: ${type}`);

	try {
		const tokenCheck = await api.runtime.sendMessage({ action: 'checkCachedToken', type });
		const hasCachedToken = tokenCheck && tokenCheck.hasToken;

		const cookiesResp = (await api.runtime.sendMessage({ action: 'getCookies', type }))?.value || '';
		console.log(`[Content] Cookies:`, cookiesResp);

		if ((type === `datanodes` || type === `filekeeper`) && !cookiesResp?.includes('dlpass=') && !hasCachedToken) {
			cfTurnstileResponse = (await getCfTurnstileResponse())?.value;
		}

		const response = await api.runtime.sendMessage({
			action: 'processLink',
			type,
			url,
			...fileDetails,
			cfTurnstileResponse,
		});
		if (response && response.success) {
			console.log(`[Content] Auto-process successful. Output: ${response.url}`);
			const body = generateDownloadPageBody(fileDetails, response.url);
			replaceEntireDocument(body.outerHTML);
		} else {
			throw new Error(response ? response.error : 'Unknown background failure');
		}
	} catch (err) {
		console.error(`[Content] Auto-process failed. Context:`, err);
		const errorMsg = `Error generating link: ${err?.message}`;
		alert(errorMsg);
	} finally {
		removeToast();
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

/**
 * @typedef WaitForPredicateIntervalOptions
 * @property {number?} [timeoutInSeconds]
 * @property {number?} [checkIntervalInMs]
 * @property {boolean?} [silentExit]
 *
 * @param {function(): (any)} predicateFunction A function that returns any `truthy`/`falsy` value
 * @param {{type: string, name: string}} consoleInfo
 * @param {WaitForPredicateIntervalOptions?} [intervalOptions]
 * @returns
 */
async function waitForPredicate(
	predicateFunction,
	consoleInfo,
	{ timeoutInSeconds, checkIntervalInMs, silentExit } = {
		timeoutInSeconds: 1,
		checkIntervalInMs: 50,
		silentExit: true,
	},
) {
	timeoutInSeconds = timeoutInSeconds || 1;
	checkIntervalInMs = checkIntervalInMs || 50;
	silentExit = silentExit || true;

	const timeoutInMs = timeoutInSeconds * 1000;
	let isTimedOut = false;
	const timer = setTimeout(() => (isTimedOut = true), timeoutInMs);
	while (!(await predicateFunction()) && !isTimedOut) {
		console.log(`[${consoleInfo.type}] Waiting for ${consoleInfo.name}`, await predicateFunction());
		await waitForMs(checkIntervalInMs);
	}
	clearTimeout(timer);
	if (!(await predicateFunction())) {
		const error = `[${consoleInfo.type}] ${consoleInfo.name} did not appear within ${timeoutInSeconds} seconds`;
		if (!silentExit) {
			alert(error);
		}
		console.log(error, 'isTimedOut:', isTimedOut);
		return false;
	}
	isTimedOut = false;
	console.log(`[${consoleInfo.type}]`, `${consoleInfo.name} found:`, await predicateFunction());
	return true;
}

async function waitForMs(ms) {
	await new Promise((resolve, reject) => setTimeout(() => resolve(), ms));
}

function replaceEntireDocument(newHTMLString) {
	const newDoc = new DOMParser().parseFromString(newHTMLString, 'text/html');
	document.documentElement.replaceWith(document.adoptNode(newDoc.documentElement));
	document.body.setHTMLUnsafe(document.body.innerHTML.replace(/<br\s*\/?>/gi, '\n'));
}

function showToast(message) {
	const existing = document.getElementById('ext-status-toast');
	if (existing) existing.remove();

	const toast = document.createElement('div');
	toast.id = 'ext-status-toast';
	Object.assign(toast.style, {
		position: 'fixed',
		display: 'flex',
		flexDirection: 'row',
		justifyContent: 'center',
		alignItems: 'center',
		gap: '10px',
		top: '20px',
		left: '50%',
		transform: 'translateX(-50%)',
		backgroundColor: '#1f2937',
		color: '#ffffff',
		padding: '10px 10px 10px 5px',
		border: '1px solid #2ecc71',
		borderRadius: '6px',
		zIndex: '999999',
		fontSize: '14px',
		fontWeight: '500',
		boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
		fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
		transition: 'opacity 0.3s ease',
	});

	const extLogoUrl = api.runtime.getURL('assets/img/icon.svg');
	const extLogo = document.createElement('img');
	Object.assign(extLogo.style, {
		width: '30px',
		height: '30px',
	});
	extLogo.src = extLogoUrl;
	toast.appendChild(extLogo);

	const msg = document.createElement('span');
	msg.textContent = message;
	toast.appendChild(msg);

	const loadingSvg = document.createElement('svg');
	loadingSvg.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="30px" height="30px">
	<radialGradient id="a4" cx=".66" fx=".66" cy=".3125" fy=".3125" gradientTransform="scale(1.5)">
		<stop offset="0" stop-color="#2ECC71" stop-opacity="0"></stop>
		<stop offset=".3" stop-color="#2ECC71" stop-opacity=".3"></stop>
		<stop offset=".6" stop-color="#2ECC71" stop-opacity=".6"></stop>
		<stop offset=".8" stop-color="#2ECC71" stop-opacity=".9"></stop>
		<stop offset="1" stop-color="#2ECC71"></stop>
	</radialGradient>
	<circle transform-origin="center" fill="none" stroke="url(#a4)" stroke-width="15" stroke-linecap="round" stroke-dasharray="200 1000" stroke-dashoffset="0" cx="100" cy="100" r="70">
		<animateTransform type="rotate" attributeName="transform" calcMode="spline" dur="2" values="0;360" keyTimes="0;1" keySplines="0 0 1 1" repeatCount="indefinite"></animateTransform>
	</circle>
	<circle transform-origin="center" fill="none" opacity=".2" stroke="#2ECC71" stroke-width="15" stroke-linecap="round" cx="100" cy="100" r="70"></circle>
</svg>`;
	toast.appendChild(loadingSvg);

	document.body.appendChild(toast);
}

function removeToast() {
	const toast = document.getElementById('ext-status-toast');
	if (toast) toast.remove();
}

/**
 * @param {HTMLElement} root
 * @param {string} targetTagName
 * @param {string} targetClass
 * @param {string} targetText
 * @returns
 */
function findAllByTagAndClassAndText(root, targetTagName, targetClass, targetText, textCompareInclude = false) {
	// console.log(`findAllByTagAndClassAndText()`, root, targetTagName, targetClass, targetText, textCompareInclude);
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
		/**
		 * @param {HTMLElement} node
		 */
		acceptNode(node) {
			const isClassRegex = targetClass instanceof RegExp;
			const isTextRegex = targetText instanceof RegExp;
			const isOfType = targetTagName ? node.tagName === targetTagName.toUpperCase() : true;
			const hasClass = targetClass ? node.className.includes(targetClass) : true;
			const hasText = targetText
				? textCompareInclude
					? node.textContent.trim().toLowerCase().includes(targetText.toLowerCase())
					: node.textContent.trim().toLowerCase() === targetText.toLowerCase()
				: true;
			return isOfType && hasClass && hasText ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
		},
	});

	const matches = [];
	let currentNode;
	while ((currentNode = walker.nextNode())) {
		matches.push(currentNode);
	}
	return matches;
}

/**
 * @param {HTMLElement} root
 * @param {string} targetTagName
 * @param {string} targetClass
 * @param {string} targetText
 * @returns
 */
function findByTagAndClassAndText(root, targetTagName, targetClass, targetText, textCompareInclude = false) {
	return findAllByTagAndClassAndText(root, targetTagName, targetClass, targetText, textCompareInclude).at(0);
}
