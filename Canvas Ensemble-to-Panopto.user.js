// ==UserScript==
// @name          Canvas Ensemble-to-Panopto
// @description   Yeah...
// @version       0.2
// @include       /^https?:\/\/[^\.]*\.([^\.]*\.)?instructure\.com\/accounts\/\d+.*$/
// ==/UserScript==

/**
 * Variable setup
 */
var url = window.location.href;
var leveledURL = url.split('/');
var view = url.match(/\.com\/?$/) ? 'dashboard' : leveledURL[3];
view = view.match(/^\?/) ? 'dashboard' : view;
var viewID = (view !== 'dashboard' && typeof leveledURL[4] !== 'undefined') ? leveledURL[4].split(/[\?#]/)[0] : null;
var subview = (viewID !== null && typeof leveledURL[5] !== 'undefined') ? leveledURL[5].split(/[\?#]/)[0] : null;
var subviewID = (subview !== null && typeof leveledURL[6] !== 'undefined') ? leveledURL[6].split(/[\?#]/)[0] : null;
var terview = (viewID !== null && typeof leveledURL[7] !== 'undefined') ? leveledURL[7].split(/[\?#]/)[0] : null;

/**
 * @name          Get Elements By Contains
 * @description   Retrieve nodelist by innerText
 * @return object
 */
Node.prototype.getElementsByContains = function(value, selector) {
	var dom = selector === undefined ? this.getElementsByTagName('*') : this.getElementsByTagName(selector);

	var match = new Array();
	Array.from(dom).forEach(ele => {
		if(typeof ele === 'object') {
			var regex = new RegExp(value, 'g');
			if(value !== undefined && ele.innerText.match(regex)) {
				match.push(ele);
			}
		}
	});

	return match;
};

/**
 * @name          Extend Arrays/Objects
 * @description   Extends two arrays/objects
 * @return array/object
 */
let extend = (one, two) => {
	var extended;
	if(Object.prototype.toString.call(one) == '[object Object]' || Object.prototype.toString.call(two) == '[object Object]') {
		extended = {};
		for(var key in one) {
			extended[key] = one[key];
		}
		for(key in two) {
			extended[key] = two[key];
		}
	} else {
		extended = one;
		var i = extended.length;
		for(var j in two) {
			extended[i++] = two[j];
		}
	}

	return extended;
};

/**
 * @name          Data-to-HTTP
 * @description   Converts an object to HTTP parameters
 * @return string
 */
let dataToHttp = obj => {
	var pairs = [];

	for(var prop in obj) {
		if(!obj.hasOwnProperty(prop)) {
			continue;
		}
		if(Object.prototype.toString.call(obj[prop]) == '[object Object]') {
			pairs.push(dataToHttp(obj[prop]));

			continue;
		}
		pairs.push(prop + '=' + obj[prop]);
	}

	return pairs.join('&');
};

/**
 * @name          Format Cookie Name
 * @description   Returns cookie name formatted for site
 * @return string
 */
let formatCookieName = name => {
	return url.match(/(?!\/\/)[a-zA-Z1-3]*(?=\.)/) + '_' + view + (viewID !== null ? '_' + viewID : '') + '_' + escape(name);
};

/**
 * @name          Get Cookie by Name
 * @description   Returns cookie value
 * @return string
 */
let getCookie = (name, format) => {
	let value = document.cookie.match('(^|[^;]+)\\s*' + (typeof format !== 'undefined' && format ? formatCookieName(name) : name) + '\\s*=\\s*([^;]+)');

	return value !== null && value !== '' ? decodeURIComponent(value.pop()) : null;
};

/**
 * @name          Is Object or Array Empty?
 * @description   Generic function for determing if a JavaScript object or array is empty
 * @return bool
 */
let isEmpty = obj => {
	if(Object.prototype.toString.call(obj) == '[object Array]') {
		return obj.length > 0 ? false : true;
	} else {
		for(var key in obj) {
			if(obj.hasOwnProperty(key)) {
				return false;
			}
		}

		return true;
	}
};

/**
 * @name          API Call
 * @description   Calls the Canvas API
 * @return undefined
 */
let callAPI = async (type, context, page, getVars, oncomplete, oncompleteInput, lastPage, firstCall, next) => {
	let validContext = Object.prototype.toString.call(context);
	var callURL = url.split('/' + view + '/')[0] + '/api/v1';

	if(validContext) {
		context.forEach(contextLevel => {
			callURL += '/' + contextLevel;
		});
	}

	var i, j;
	if(type == 'GET' && callURL.match(/progress/) === null) {
		let audit = callURL.match(/audit/) !== null ? true : false;
		getVars = getVars === null ? [{}] : getVars;
		oncompleteInput = oncompleteInput === null ? (output => console.log(output)) : oncompleteInput;
		firstCall = typeof firstCall != 'undefined' ? firstCall : [{}];

		var expandedVars = getVars.slice(0);
		page = typeof page === 'undefined' ? (audit ? 'first' : 1) : page;
		expandedVars[0].page = page;
		expandedVars[0].per_page = 100;

		var callsToMake = {callURL: callURL, data: extend({}, expandedVars[0])};

		if(page === 1 || audit || lastPage === -1) {
			callAJAX(type, callURL, expandedVars[0]).then(response => {
				var json = JSON.parse(response.data.replace('while(1);', ''));
				if(response.status != 200) {
					oncomplete({error: 'There was an error. Please try again.'});
				} else {
					json = audit ? json.events : json;

					let results = (firstCall.length == 1 && isEmpty(firstCall[0])) ? json : extend(firstCall, json);

					if(json.length === 100) {
						if(!audit) {
							page++;
							lastPage = -1;
							next = true;
						} else {
							page = response.headers.link.match(/\bpage=[^&]*(?=[^>]*>; rel="next")/)[0].split('=')[1];
							lastPage = null;
							next = false;
						}

						callAPI(type, context, page, getVars, oncomplete, oncompleteInput, lastPage, results, next);
					} else {
						oncomplete(results, oncompleteInput);
					}
				}
			});
		} else {
			var limit = 25;
			var k = 0;
			for(i = page + 1; i <= lastPage; k = 0) {
				var currentCallsToMake = i == page + 1 ? [JSON.parse(JSON.stringify(callsToMake))] : [];

				for(k; currentCallsToMake.length < limit; k++) {
					var newCTM = JSON.parse(JSON.stringify(callsToMake));
					newCTM.data.page = i++;
					currentCallsToMake.push(newCTM);

					if(i >= lastPage) {
						break;
					}
				}

				var currentCalls = currentCallsToMake.map(currentSettings => {
					return callAJAX(type, currentSettings.callURL, currentSettings.data);
				});

				await Promise.all(currentCalls).then(results => {
					for(j = 0; j < results.length; j++) {
						let json = JSON.parse(results[j].data.replace('while(1);', ''));
						if(Array.isArray(json)) {
							firstCall = extend(firstCall, json);
						}
					}
				});
			}
			oncomplete(firstCall, oncompleteInput);
		}
	} else {
		callAJAX(type, callURL, getVars).then(response => {
			oncomplete(JSON.parse(response.data.replace('while(1);', '')), oncompleteInput);
		});
	}

	return;
};

/**
 * @name          AJAX Call
 * @description   Calls the the specified URL with supplied data
 * @return obj    Full AJAX call is returned for processing elsewhere
 */
let callAJAX = async (type, callURL, data) => {
	var res;

	if(type == 'GET') {
		res = await fetch(callURL + '?' + dataToHttp(data), {
			headers: {
				'Content-Type': 'application/json;charset=utf-8',
				'X-CSRF-Token': getCookie('_csrf_token')
			}
		});
	} else {
		res = await fetch(callURL, {
			headers: {
				'Content-Type': 'application/json;charset=utf-8',
				'X-CSRF-Token': getCookie('_csrf_token')
			},
			method: type,
			body: JSON.stringify(data[0])
		});
	}

	var status = await res.status;
	var headers = {};

	for(let entry of res.headers.entries()) {
		headers[entry[0]] = entry[1];
	}

	var body = await res.text();

	return {
		status: status,
		headers: headers,
		data: body
	};
};

/**
 * @name               Create Modal Overlay
 * @description        Displays a modal overlay
 * @return undefined
 */
let createModalOverlay = () => {
	var modalOverlay = document.createElement('div');
	modalOverlay.id = 'modalOverlay';
	Object.assign(modalOverlay.style, {
		position: 'fixed',
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		background: 'rgba(52, 68, 79, 0.75) url("/dist/images/ajax-reload-animated-8255e06a8a.gif") 50% 50% no-repeat',
		zIndex: 1001
	});
	document.body.appendChild(modalOverlay);
};

/**
 * @name               Load API-based Modal
 * @description        Displays a "loading" image while the API call is executed before loading the modal
 * @return undefined
 */
let loadAPIModal = apiCall => {
	createModalOverlay();
	apiCall();
};

/**
 * @name               Generate Modal
 * @description        Creates a custom modal
 * @return undefined
 */
let generateModal = (title, content, footer, dimensions) => {
	if(document.querySelectorAll('#modalOverlay').length === 0) {
		createModalOverlay();
	}

	var modalOverlay = document.querySelector('#modalOverlay');
	modalOverlay.style.background = 'rgba(52, 68, 79, 0.75)';
	modalOverlay.addEventListener('click', e => {
		e.preventDefault();

		closeModal();
	});

	var modalContainer = document.createElement('div');
	modalContainer.id = 'modalContainer';
	Object.assign(modalContainer.style, {
		width: (!isEmpty(dimensions) && dimensions[0] !== undefined ? dimensions[0] : 'auto'),
		height: (!isEmpty(dimensions) && dimensions[1] !== undefined ? dimensions[1] : 'auto'),
		position: 'fixed',
		top: '50%',
		left: '50%',
		transform: 'translate(-50%, -50%)',
		display: 'block',
		outline: 0,
		border: 'none',
		boxShadow: '0 1px 4px 1px rgba(52,68,79,0.95)',
		borderRadius: '3px',
		backgroundColor: '#ffffff',
		color: '#222222',
		overflow: 'hidden',
		padding: 0,
		zIndex: 1002
	});
	modalContainer.innerHTML = '<div style="padding: 16px 40px; border-bottom: 1px solid #d6d6d6; background: #ffffff; position: relative;"><span class="ui-dialog-title" role="heading" style="display: block; font-size: 21px; margin: 0 16px 0 0; text-shadow: rgba(255, 255, 255, 0.75) 0 1px 1px;">' + title + '</span><a href="#" class="ui-dialog-titlebar-close ui-corner-all" role="button" tabindex="0" style="display: block; position: absolute; top: 50%; right: 12px; width: 20px; height: 20px; margin: -10px 0 0; padding: 1px;"><span class="ui-icon ui-icon-closethick" style="margin: 1px; background-attachment: scroll; background-clip: border-box; background-color: rgba(0, 0, 0, 0); background-image: url(\'https://du11hjcvx0uqb.cloudfront.net/dist/images/icon-x-black-163c6230a4.svg\'); background-origin: padding-box; background-position: 50% 50%; background-repeat: no-repeat; background-size: 10px;">close</span></a></div><div style="padding: 10px 40px 10px; max-height: ' + (!isEmpty(dimensions) && dimensions[1] !== undefined ? '100%' : '400px') + '; overflow-x: hidden; overflow-y: auto;"></div>';
	document.body.appendChild(modalContainer);

	if(typeof content !== 'undefined' && content !== null) {
		var contentEle = document.querySelector('#modalContainer > div:last-of-type');

		if(content instanceof Element) {
			contentEle.appendChild(content);
		} else {
			contentEle.innerHTML = content;
		}
	}

	if(typeof footer !== 'undefined' && footer !== null) {
		modalContainer = document.querySelector('#modalContainer');
		var modalFooter = document.createElement('div');
		Object.assign(modalFooter.style, {
			borderTop: '1px solid #d6d6d6',
			backgroundColor: '#f2f2f2',
			color: '#222222',
			borderWidth: '1px 0 0',
			margin: '.5em 0 0',
			padding: '12px',
			textAlign: 'right'
		});

		if(footer instanceof Element) {
			modalFooter.appendChild(footer);
		} else {
			modalFooter.innerHTML = footer;
		}
		modalContainer.appendChild(modalFooter);
	}

	document.querySelector('#modalContainer .ui-dialog-titlebar-close').addEventListener('click', e => {
		e.preventDefault();

		closeModal();
	});
};

/**
 * @name               Close Modal
 * @description        Closes a custom modal
 * @return undefined
 */
let closeModal = () => {
	removeElements(['#modalOverlay', '#modalContainer']);
};

/**
 * @name          Remove Elements
 * @description   Remove elements by selector
 * @return undefined
 */
let removeElements = selectors => {
	var sels = Array.isArray(selectors) ? selectors : [selectors];
	sels.forEach(sel => {
		var eles = document.querySelectorAll(sel);
		eles.forEach(ele => {
			ele.parentNode.removeChild(ele);
		});
	});
};

/**
 * @name          Escape RegEx String
 * @description   Escapes a string for use in RegExp
 * @return string
 */
let escapeRegExp = string => {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

let replacementLinks = [
	['videos.ecpi.net/app/plugin/embed.aspx?ID=-BzH_E-uJUi_fRS16jJzoA&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=6e1d5ea7-677f-492f-b1dc-aecc00c87f30'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=-PA6rJGZtk28AD142rQ0AA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=676dddd2-875c-49df-9823-aecc00cab406'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=-VE8o9seBU-dw0fEnvo38w&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=27e2469d-761d-456f-b4ec-aecc00ca0492'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=-x_l6g8mm0yxC_4LALc35A&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f77bd094-d8c7-43d1-86bf-aecc00ccf48e'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=_bxeE4zuZ02a6xX4L5bZPg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=cc4834a2-bf41-4b54-915d-aecc00ca0949'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=_kkZBdO4DUm4CwjI9Cla_Q&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=db57355f-55ff-4817-82ad-aecc00ca0ad8'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=_ruGkGeNlUS-gvpYxhQ4JQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ae958d91-6ec7-44b6-9220-aecc00cab329'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=_sq6K1AElkOak69GG3YgDw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c8d5092e-1722-4ea0-ab14-aecc00ccf154'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=0FcqiDvouUK5Vh_HBW4AMw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5d22b85b-e6a5-4480-a584-aecc00ca4bf8'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=0LuWRPZ8GkGkVbnUx2WKeg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7c4fd8a1-23bd-44e5-92b3-aecc00c877b8'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=176eK0YLVUu2ZBCUHUA6lA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=71e90d3a-4cb8-4e12-9b28-aecc00ca4bbb'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=1KwJdBzrY0qOEW8zvjKQrA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=23a1d7dd-20ff-4ea8-98cd-aecc00ccf4a1'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=1RX5PY-5JU-rEWVfkFbZgw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=dcb78f99-cd9f-4131-a774-aecc00cab2fa'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=1syE0yArQ0y0bYyyt-dsJA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0bdf69da-d8fe-4439-97a6-aecc00c82e33'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=1VnWFATaCUiXvcQ0xZb04w&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4aee58fb-7fcf-4baf-8b0c-aecc00cab39e'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=1ZfmkHQ48kWsmGhWaVnvag&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=04eda80a-7b77-450a-bb53-aecc00caf111'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=2cGc5VewfE-sFyJH-ZxYnA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2d6538f8-e098-45b9-8a73-aecc00c9976d'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=2fdc5946-4cd1-48bb-837e-cc500690183a&autoPlay=false&displayTitle=true&displaySharing=false&displayAnnotations=true&displayCaptionSearch=true&displayAttachments=true&audioPreviewImage=false&displayLinks=true&displayMetaData=true&displayDateProduced=true&displayEmbedCode=false&displayDownloadIcon=false&hideControls=true&showCaptions=false&width=720&height=405&isNewPluginEmbed=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=fb0262b7-64db-408d-b9d7-aecc00ca07d1'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=2FXc_tMYVEqfvPB3XtDCMw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8cdf4131-e56a-43ae-b096-aecc00cdc6ef'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=3CMWEzciLkGxRtc1ypwXXA&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=87189778-3a49-453e-9298-aecc00c8d4b9'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=3NZvCsscy0ixWWZU5NStuQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=808c7a1c-3f10-4673-a13d-aecc00cab5f2'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=3QbvCic48U2-Em9Teke3Vw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b996c28a-22b5-4d2f-bff5-aecc00cb5b74'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=43aFBQ_ccES3Hd5--a-06g&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=49098502-cc64-4dc6-8863-aecc00ca5ab2'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=4ajV_hc5zUmY_hq8mVOLug&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=11dbad5f-4fa1-4ab7-84ef-aecc00cdb7ec'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=4b5a7a0d-8698-4d4a-9dce-ea107f7d97a4&autoPlay=false&displayTitle=true&displaySharing=false&displayAnnotations=true&displayCaptionSearch=true&displayAttachments=true&audioPreviewImage=false&displayLinks=true&displayMetaData=true&displayDateProduced=true&displayEmbedCode=true&displayDownloadIcon=true&hideControls=true&showCaptions=false&width=320&height=180&isNewPluginEmbed=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b6145615-8cd2-4f68-a1a4-aecc00cdbf76'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=50q76r8zf0qgzH6dPtvrWA&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a9e1c05a-e279-4cdf-82fb-aecc00c8d43f'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=56e18d27-be90-4800-9617-3fd4576c3c28&autoPlay=false&displayTitle=true&displaySharing=false&displayAnnotations=true&displayCaptionSearch=true&displayAttachments=true&audioPreviewImage=false&displayLinks=true&displayMetaData=true&displayDateProduced=true&displayEmbedCode=false&displayDownloadIcon=false&hideControls=true&showCaptions=false&width=720&height=405&isNewPluginEmbed=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=07c98050-a4a7-4f9e-b1e8-aecc00ca0813'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=5AGTAz6oyki_u_d5COc91A&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=791ef5d5-5a75-4cff-8b22-aecc00ccf358'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=5i89qUrR5kmUL7p_kWTMpw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2113a1e4-6b65-47f6-bfd9-aecc00caf166'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=5OuY6tneY0W-ni-qI3a9dQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=9915e69b-df9e-40f5-953b-aecc00c8328b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=5xH28iwOXECZwOg0ab3z3A&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a99957ef-960e-4971-a3cc-aecc00cdb7d4'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=66fRr97rLUuu0yn5YQwNFg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=282ca6b8-f570-4e64-b106-aecc00ccf32e'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=6HZe_BQXtUyCOUo5ZuDwfw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=76abfe07-f873-460a-8ef2-aecc00c8d520'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=70nZBE6-BU6Htxu5QZUjyw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=1987a58d-6b5d-4f1c-85b4-aecc00cc0af9'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=73CagnIFB0--aypKdWnxtw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=70063d9d-c0d0-429f-ab37-aecc00c9a2b4'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=7hYKIQmfMUaYrovRyEGm3A&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=74fe0aa0-3fe7-43cf-ac4c-aecc00c9d1ab'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=7m_nMHDKDkG6ndkMYpbJJg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=bc813329-5eb0-40a6-a902-aecc00ccf3fc'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=7S_VD9Dl30ecFERMO-0KpQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ad03ec75-08f0-469a-8ce7-aecc00cab1f3'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=7UrYNXQsrEaCzEs8L4FRFw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=80ffa0a5-6550-48bd-9e4d-aecc00ccf37e'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=7UySifuZnkGb-r6uPdjL6w&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c3ad3659-852e-4477-a7a1-aecc00ca4c35'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=7WPvmtOGbUqrBSFklHPYlw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7e916a17-fe4c-4db1-85bc-aecc00cab45a'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=8KV38-MVS0KnRwXy3EOsxw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f0c9fe9a-1633-4eec-83d4-aecc00cab472'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=97wAZrxktUGeh4g4qF3FSA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=93cb2e3e-4c72-4bb5-8b8c-aecc00c830fc'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=9df54afa-cbc3-45a3-9474-23e34322076f&autoPlay=false&displayTitle=true&displaySharing=false&displayAnnotations=true&displayCaptionSearch=true&displayAttachments=true&audioPreviewImage=false&displayLinks=true&displayMetaData=true&displayDateProduced=true&displayEmbedCode=false&displayDownloadIcon=false&hideControls=true&showCaptions=false&width=720&height=405&isNewPluginEmbed=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=20e8ffeb-7296-4856-9bae-aecc00ca07e9'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=9JlVlEf-102JbLEaMGfq7g&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=3cb38883-11dc-445b-b8a0-aecc00ccf4cb'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=9QSTkw3uj0OYkJEaNR2FEA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=false&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=53f97d9a-e819-48b6-8e69-aecc00c9b797'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=9QSTkw3uj0OYkJEaNR2FEA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=53f97d9a-e819-48b6-8e69-aecc00c9b797'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=A_cMQZHBYkW_umOIWLmktA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=1cd21f9e-b54d-4021-a300-aecc00ccf20b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=a2EQY6lj90CP3GVsZGLBTw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=bc648527-de30-44e3-bac0-aecc00ca0a05'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=a6f18a28-4471-4f33-8214-310d07d497f4&autoPlay=false&displayTitle=true&displaySharing=false&displayAnnotations=true&displayCaptionSearch=true&displayAttachments=true&audioPreviewImage=false&displayLinks=true&displayMetaData=true&displayDateProduced=true&displayEmbedCode=false&displayDownloadIcon=false&hideControls=true&showCaptions=false&width=760&height=730&isNewPluginEmbed=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=be25ee49-1c39-4e82-968f-aecc00ca8486'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=aF2Ou-JFzE2KfxLkYm8Q1Q&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4491ede2-8318-44ca-8bbc-aecc00ca4c0b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=aHuXlSt_JU2DRpUXub3Wdw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4af8ff17-3157-49e4-a6f4-aecc00c82e46'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=ajsIJLJ-YkStmXKsTTMI5A&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=98916e7a-9600-4d56-8fcd-aecc00cdbab2'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=AKcChIT92E-JqfsYMYyqiQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=d08e7b22-5aa2-42a5-a850-aecc00ca047b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=alaevg9GSUOWb_uht8vhcQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ff06a018-e271-4ff1-ac51-aecc00ccf77c'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=ApIg7Ow5H0yxQvTFRl5K-g&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=3dc4b459-d1fa-4e0a-904d-aecc00c8d494'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=AVAovuuF_0C0YdMzbe1hyw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=79648004-4918-4aa1-bd77-aecc00c88286'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=AwfTGvzJ9kSFPkqXv2f_jw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4b674ae2-3f29-492b-9068-aecc00c8d4e3'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=aXHTYRYU2EWac5JfRcnbvA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7eb4be71-2b57-4e71-8b02-aecc00ccf138'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=ayoN47__gUyzG29SYjSEoQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=97f13e38-ce9b-44f9-9771-aecc00cab549'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=AzV0EiPIUkucWJyOVYCh1w&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=47003a21-d6a8-404f-a514-aecc00cab3b1'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=b0e12a8b-489a-46c0-8a15-bddf0483981c&autoPlay=false&displayTitle=true&displaySharing=false&displayAnnotations=true&displayCaptionSearch=true&displayAttachments=true&audioPreviewImage=false&displayLinks=true&displayMetaData=true&displayDateProduced=true&displayEmbedCode=false&displayDownloadIcon=false&hideControls=true&showCaptions=false&width=400&height=225&isNewPluginEmbed=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=886fda02-1a30-4d7b-bae8-aecc00ca076d'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=b2vvxP5I_UOAcJ_cE4sOqw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ceab8fc8-1b04-445b-af09-aecc00ca4c1d'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=BAgRGJeZO0yAP5R5Y4BEaQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4e9f79f8-3394-4e53-8f14-aecc00ca095c'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=BAhbwRxip0CyLCDdytsyoQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=07ece5bf-1eb8-4a93-870b-aecc00cab447'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=bALxxrL8_EKuiLF-_eNQ4g&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=6160b588-ecf4-4214-bfab-aecc00ccf3d2'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=bb6rfGi0jkOtIY9TkUdJzQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7029bc97-a2e6-4a36-a667-aecc00ccf3bb'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=bhn02ucs5EqzOkBSLAp9hg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b6fd40b9-73b5-4517-b34b-aecc00ca0973'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=blFSL0iQ9Uqg52_ILxyEMQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=3938416c-2c37-4b26-9897-aecc00ca7d35'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=bloMhPgyZk226jeXuY1tvQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=43f983d0-f42e-4f19-a327-aecc00c8d428'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=BRFNkEVLTEGPkBns-G8V-g&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4006c73b-38d7-427a-919c-aecc00c88400'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=BsSnZHRLt0uMEcICIWtClA&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=194f5ddb-2139-40c0-89ba-aecc00cab573'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=bv-UeGuf2US7WtY9NsbaaQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c1b858df-9453-4522-9e5f-aecc00c83253'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=cFWmYzgizUW2heohZWl2sA&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2773091b-60d3-41b0-8f7b-aecc00ca0bb0'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=cJhbJQQIrUWd8UjnfezXKg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=39cbde48-2ab4-4382-a77b-aecc00c8d452'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=cN1D3Ikq4kK1D0E7EqMy2w&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=78f2b98c-573a-4ffb-a0b8-aecc00ca9a62'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=cUIs7gxI7kqbo7JoSqOhng&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8359cefb-8131-432c-8f80-aecc00c9a3f8'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=cUmQHvrMbECcc18_YH0iSQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=1ba04839-e11b-4a4c-ab58-aecc00ccf317'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=czXFFe0gw0SLSwVFJu40gw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=6e4acf5e-9eff-4287-83ab-aecc00cab33c'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=d5bTuIKPFk-ITuY7GpiScg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7fcd6f20-a390-48a7-b5f9-aecc00ca6d94'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=d64eb331-3603-40ec-93c9-9e67e18e38d0&autoPlay=false&displayTitle=true&displaySharing=false&displayAnnotations=true&displayCaptionSearch=true&displayAttachments=true&audioPreviewImage=false&displayLinks=true&displayMetaData=true&displayDateProduced=true&displayEmbedCode=false&displayDownloadIcon=false&hideControls=true&showCaptions=false&width=720&height=405&isNewPluginEmbed=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0c578856-3707-4c51-88da-aecc00ca07fb'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=D8WxZmwXDE6Etjxs3124oQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=false&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b01b9b3b-80c3-4fce-a198-aecc00c9b61f'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=dab786be-f862-4060-9538-610ea5634f22&autoPlay=false&displayTitle=false&hideControls=false&showCaptions=false&width=480&height=360', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f6073b1c-5602-47c5-bc25-aecc00cd07cc'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Dbge6yFXVEa8XlluAV4qSg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ff4d9b10-a593-423b-bd90-aecc00c9b768'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Dca6y-NKx028NNIjvt5A7Q&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a926d143-e1ae-4408-918b-aecc00c9b2ec'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Dic9-vNcJ0KYUFAfALQHBQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=35f63ac1-9742-4b06-bbb7-aecc00c82ead'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=DPs_Sq9DF0KrOfQd_P786g&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=d7ad44d6-927c-4351-96cf-aecc00ca0426'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=e1ttMc5pDEyzlbCU2QecnQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=3b0fa314-8778-40e4-ba04-aecc00ccccb5'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=eFHvQT0w-EqX_UtvzcBFCg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=51b13796-674f-4a7c-950a-aecc00ccf11c'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=eGRMW0oxZkSVXTyvpT3ssw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=25c1d34a-496f-46b3-9670-aecc00caf13b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=ejBvo_a9Lkq1hOSJF2Zo1A&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a97ad321-3eca-44cf-ab60-aecc00c9975b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=emVn7iguLESo-JS_yOj5UA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b6f6537e-2354-419a-86b9-aecc00cab3c9'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=eQ3wHLtwRESv5Aaf3nz7rg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=32665b17-635d-4a3b-a001-aecc00ccf395'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=f1Q9M038zEChRaPxHrdNXA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=14bdd5ce-442a-4ad8-ac56-aecc00ca4be5'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=f23cim-7OUK5dfTKgjafag&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=fd872388-5f3a-457e-9859-aecc00cab3dc'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=f560c21b-8777-40c4-a522-1a07bd6e1976&autoPlay=false&displayTitle=true&displaySharing=false&displayAnnotations=true&displayCaptionSearch=true&displayAttachments=true&audioPreviewImage=false&displayLinks=true&displayMetaData=true&displayDateProduced=true&displayEmbedCode=false&displayDownloadIcon=false&hideControls=true&showCaptions=false&width=720&height=405&isNewPluginEmbed=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=cdf2fcc1-242b-4581-90e1-aecc00ca0826'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=f5quuNjKtkaLQwpegpD7bQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c2a473db-2ca0-4230-8155-aecc00ccf36b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=FcfGVkbCtE2cxPyTI6-v3Q&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=45cdfbbe-3504-4198-bf89-aecc00cab59e'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=fCj59WrwwE2VPyyMw2GZqA&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8ce1b72f-4615-4bbc-84d5-aecc00cdb4c6'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=FcNE1QIayUK5RDGvQn_gug&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=18c7ef25-4f85-4d05-94fd-aecc00ca5a4f'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=FHAnk6ezNUK3yOHayVsF4g&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b1aacd5c-2c05-427c-b91d-aecc00cab51f'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=FuIH3UxNskeKZBPAtuQiyA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=482b320a-a4af-4597-9154-aecc00ca4ba8'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=fUnNgdyx90SESzvL3wZIfA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=30885b25-ed6b-456c-bf4a-aecc00c9b640'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=fvF9ZDfHPUa2GjNQQFJtIg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=92e542c5-9263-41c9-8f41-aecc00ccf426'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=FW8KTQSFwkWineD-j9EZQg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5be922c9-0d86-421a-a9c1-aecc00ca9a0e'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=FWEs4-GAPEqf5XIlp7z7Ww&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=81717e9c-efc3-4a67-a5f4-aecc00ca7d4c'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=fxzvW4hPuEeyjGzDvw4z9Q&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5f098263-eeda-4eca-a658-aecc00ca5a9b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=gBKT54Olr0mCmB00afFwKw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=bd95b5d1-2d3e-4c7c-adae-aecc00ca4c5a'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Gfnq7Qs1t0K-cV4sksrsKg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4f0c4290-75b6-410d-a547-aecc00cdb4de'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=GFpb277ti0e0OeIKEDPMkA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c686bca2-768a-4fad-a77f-aecc00c83337'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=gJjwXjr7Wki1MfsdnXr7Zw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=88bf0a6d-a3d4-40ee-b52c-aecc00ca0932'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Gl0QDkP_6UOGoAVJe5MnAg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2693cbb8-ce48-4910-ba39-aecc00c832ff'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=GrfiNJmVH0yF1iQKpBt6Dw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e2375fdd-aaeb-4416-963d-aecc00ca9a9b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=GVo8bhFuQ0Sq9rEddyx1mA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=217441f2-3438-46da-9b81-aecc00ccf4b4'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=gVXDQog5GUSbUBWwNkPN6g&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=63faf276-3f19-4668-ad1d-aecc00c8d415'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=H_AVxKrDLEK23ZFVFRF-cg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=9f7ebe80-e121-4209-97d6-aecc00ccf252'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=HfKVlc0qGkabZXGsqkTYbA&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=1ef13085-1c0c-4963-815c-aecc00c8d47c'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=HR46HMQ4BUepzPgo80v2Kg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=29b4c16c-8999-4815-aefd-aecc00ccf1b7'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Hvu7yE_r-kivyPs-trrQCg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f6e5e6cf-7746-499f-b5e2-aecc00ca0450'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=hx7IzMZnG0yR5LBUQAelcg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7b4701e3-3345-4610-aa83-aecc00ca9a46'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=HYtYNTz9OEK4-6ahtDsr7Q&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=3cd7a657-1bac-43e0-8e29-aecc00ccf1ef'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=hzjwaCGqNkez2GI1Gifj6g&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=248bdf42-d969-40c0-9483-aecc00c8d4d1'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=i0k222Ky4kGrZsqwLBAQNw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=16cdc02f-fe95-4c97-89c8-aecc00cab609'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=iepE-JM2zUq5K8FqkVjDtg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2854a9c4-cf5e-4778-a681-aecc00ccf1d3'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=IG6Yxj1ob02ROJ40oGRygg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=02560c4a-8579-411c-9363-aecc00ccf751'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Ih5C_hSNi0WGCchsqY7FdA&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a64b2455-f126-4832-8121-aecc00cdb4b4'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Il4zkWdYVkaTvZfxHd6GBA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c300a0ca-dd44-4baa-933a-aecc00c8fb25'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Im4_6s2Du0-Qx1Sx7_90yA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c924983b-f296-449b-b13a-aecc00ccf18c'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=io2n9xn8QkOFvHwYNV7s1Q&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e93ba795-c681-41e4-9920-aecc00cb5bcd'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=iSVJ51BHCky8molj619N3g&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=1dcbf47e-dc33-4762-9501-aecc00ccf5ec'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=IUEKwPWRhkuBD2G9bWvyTA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4ecf2724-5d3c-4461-a0f2-aecc00ccf285'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=IYSkZSTsKUmtaQTq23RKLg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=579e88cd-bec1-4fa3-b530-aecc00c8d4f6'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=J6hufpno1UevCTr42cajpw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=097e8906-699b-4735-822a-aecc00ca4b7e'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=JIWdkIeEcEesO3L3o5JAMQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=fd8670de-eb91-455f-b0e4-aecc00cab5c8'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=k5vBkYtByUut8NVKpWokCg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7fa986f4-2cb8-4171-a032-aecc00c924db'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=K5ZmluFaXUqOJBjr1_1tIQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ef1e1bf5-a0b7-491e-9524-aecc00ca0b9d'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=KI4CLlv1_02_XrDYLW9AOA&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=9c094457-e390-4728-a5c0-aecc00c8d403'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=KJurbpKEg0a0Yl0ARw04Yg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c2aa5d83-1bd8-4fd3-ae71-aecc00cab353'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=KLihtGL9N0KCPxAoC5Gc_A&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e669fe02-cd7d-440d-bddb-aecc00ccf451'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Kq_d4E8Uf0-QVqgxpx785g&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ce0724e4-1c8b-48f8-9691-aecc00cdb793'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=kqXT-TaPO0yNSaLyosClNA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=01349d05-2bd5-4438-b03f-aecc00c832e2'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=KsHIdVPfpUOhoDKqxQ0lBw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=6d635d02-63b1-4353-941c-aecc00c8331f'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=kslHthmIekmsEkSTLM9OWw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=cddf97f8-5945-4249-b48c-aecc00cdbb30'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=KxnfoqMyOEeyJ0IJeN9u3w&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=596d257b-94ec-4f08-a9fe-aecc00cdba9a'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=L8AqpYbUQUykWyhzN_FjrQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=d52cba19-f67e-45d4-8258-aecc00c830e0'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=l9UjyLA0z0aq7aVc0msQvg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ba81c292-bb47-408e-bf0f-aecc00c8d562'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=LlKVDEGIbUSXr7sfdcrXmA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ef5eb879-a74b-43d5-ac0d-aecc00c82ec9'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Lmp5RZWZo0-CPkp8ia8_UQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=30d1a4cc-a5dd-43de-9587-aecc00cdb49c'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=luXSNbwnzUS5_UDUbs5xyw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7468d99f-1f6a-4e6f-b625-aecc00caf153'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=M_uCBGmajUeNUHtraFhxgg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b8056d39-0208-4d85-b8c8-aecc00ccf170'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=M7zmCSKsqUGlXlAWmQ3sSQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=149700e3-ec86-4851-b7ea-aecc00ca9a2a'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=M9cEZW3kuEO2Ak1VjD7gow&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=961e9559-dd8e-4854-b9a2-aecc00cab3f3'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=mfd_4aR6GkWN9IqV17d55w&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=de1a6943-608e-481a-a3da-aecc00ccf341'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=MLt2ioA8J06qLZqrIAbY_A&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b2594f22-eb2f-40b8-bbbd-aecc00ccf3ea'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=mMUk8A0DSEquf2DzKuZZ6A&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=53330e6a-921c-4044-a3e1-aecc00ca7d5f'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=mVbn59uO40-PsiElBzcRfA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=11537ee9-f8ba-4993-b59d-aecc00ca9a7e'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=N9-2nnrY5UOD2-8Ww6KTOQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=24ed21ce-c1b8-493e-b81c-aecc00ccf477'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=n9C8qv0wckqA6FbxJUKMnA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=fe072445-d329-496b-8128-aecc00c82e1b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=nACAHvON70qtCnqY2zYevw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e8e562a4-f481-4fe3-8248-aecc00c8326a'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=nAl9AA3qVk-zmiqf72Dq6Q&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e6973969-27db-4bc2-9442-aecc00c9b77b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Ne6Me9GLykSvYDxV9LZRgA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0306a71e-ed48-4e19-9410-aecc00c997af'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=NMpCF1G_nEmft9mw6_gp1g&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0ec394ea-dac9-4f44-8145-aecc00cab419'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=OAAYK3tRQkOuY1LeROT3sw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ea045295-59ad-4073-b1bd-aecc00c99dc5'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=oAdHIlY6jUyHca__k3tx-A&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ad1492f4-f9fc-49f2-aac4-aecc00cdbb1d'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=OcYQwZFnWUugVMVBE4DbQg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=44e33bcf-095b-45e4-9660-aecc00c83237'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Oeug54ZvR0iF27htSJkmJw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=9464fde8-60c3-4892-abe0-aecc00cdcac0'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Oo9X45JjMkGX1ra8_QrWug&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=af0c8067-52ca-4233-81cd-aecc00cab5b5'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=ouFp9alEdEKaDal4PdfILQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=560a44d3-6920-4d42-9aca-aecc00c8d54b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=p4EbuV3LZUG9mybEmGtrFw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a9b863e0-35c1-4803-a67c-aecc00cdba6b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=pA4E6bNVkkuCcsgxZ_Tt5w&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=d8158a5d-ae57-4152-948e-aecc00c832c3'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=pfuJ29CYRkW9umtAlzGjvA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=89b779e4-480f-4f3b-b162-aecc00cab38c'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=pQW7LQqM9k2x2WHLqBcb4g&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7f15a670-133f-4b53-8edc-aecc00c830a8'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=pRqWHGKYFUe_EvH44XxMlw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=71e9088c-7c49-4526-a75b-aecc00ca0439'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=pXMrqPbRVUulH_0SqKAhMQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=766f0084-7264-4d68-a0d3-aecc00c92a99'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Q7imOTvzRUerx-tvf2bqGw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=1d175b4d-6d22-4f3f-aa3e-aecc00cdbac4'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=qjk0BvgDQEe2QBR-jcIWKA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=22813549-1328-4686-96cc-aecc00caf129'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=QvYAA7szM0OW-sQ0TQ26mA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=6a15fe29-d5ce-44a8-acb3-aecc00ccf464'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=R_AGjijCbUm0TEEvYZwurg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=305971fd-5f3f-4036-ae85-aecc00ca7d76'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=r2trfdX0EU-WQjiOiSEmmA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c2fdd83f-c9c5-42f4-8023-aecc00ccf40f'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=r6AoT_VL4UegQsJOcoz3VQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2555e5c7-0857-4700-950b-aecc00cab55c'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=r752RoyvfUG0gTUFbVwUHQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a2b43ca2-5674-4e6f-8fdc-aecc00cab532'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=rgn8suU9b0ySZeqd27ugsw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e8866cc2-6150-4002-9dea-aecc00c8321a'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=rGoUNIrqIkeRVAQU8oQfNA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7022e0c5-fb21-4604-8962-aecc00ccf439'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=RoPdPOJV2EyjNdLf1Ifdxg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=270bfe37-ce22-472b-bc6a-aecc00c8d575'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=rpmHEjmkwEqmoCgD6fDisw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0b2100b7-1d88-441a-87f1-aecc00cdcaea'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=RqcJjGlkVEKwcCBBuV8EPQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=68d1d69f-fcb9-4fbb-b6ec-aecc00ca4e21'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=RTQHjo-YS0SmRlxicv4bDw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a5c983ba-bc53-4a9b-826c-aecc00cc7ce3'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=rXDfhPtnB0aGDLo_83bKSw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b19531b1-39f0-472c-ae7e-aecc00c996f4'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=S1EKI_7Ch02XpvY_Soa_3g&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=931a645d-32e2-41bd-a78b-aecc00ca5529'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=SdAGL7JptECRICoMdEIbCg&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=af4af0db-ba48-4031-b772-aecc00c9b5c1'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=SJkWCk0mc02VDVGTD0X04Q&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0ac05410-c878-4f94-ba09-aecc00cda1c3'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=SR3KLfQtQESAJ2Sh-TJvsg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5026a274-79f6-415f-b864-aecc00c8d50e'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=st3Xa8cT5k6YF2S8NjFAqw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=3b00a80b-a3bd-4617-bc25-aecc00cdcafd'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=sUSrkgOO_kq1AR_e0AivQg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=344357d5-306d-4d8d-b87a-aecc00ca0468'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=SY6b0CvOBkayPLhOHVXzMQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8bebbb7b-b833-4d05-8485-aecc00ca0911'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=SyZEvRBcvUu4xKDFt0W3kA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0d63cb15-daf9-4ca3-875a-aecc00ccf2f1'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=T9xiUlOLHEO7iXCO2OvxkQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=bcb105f2-135d-417e-902d-aecc00cab484'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=ta0GQz7wbk6NdNzdIS6BKA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=07bcbe65-e932-4232-ad8b-aecc00ca99f1'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=tAavJTInX0SqP587KfBTvA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=bbb39b56-9e0a-49fd-b615-aecc00ccf269'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=tEYIBpxA7EmfPAYmx9MVtQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=30cc18a1-ac44-4d85-91f5-aecc00ccf3a8'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=tMGYGYa5OEqGzUW8fX9WEA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7b025fd4-7c3a-45ca-a85d-aecc00ca9ab7'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=tn15MPJp00mM2-klaPJAUw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e210d3df-dfd7-4a89-9478-aecc00ca7cac'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=TnWwhDYh70WHVs69IQ-qqw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5e77b703-f7cc-4a56-bf2a-aecc00cab366'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=toHrlRNCNkOt6IdMd1scNA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=d6a8943d-6464-4482-849c-aecc00c830c4'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=TXRovd5UjEqyu0Z8yT_jfQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e930f00b-0955-4127-bf92-aecc00c8d538'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=tZf0y2pev0as0xEdVvQ49w&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=621ae069-c68c-41c8-9c5a-aecc00c9bcae'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=U2weVq1CQ0uM1PfDV6_Fhw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=bcd070d2-84d9-4e33-8f54-aecc00c996bb'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=UBVCchjH2UGGvN0utRUbTw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=13991645-98ee-4356-b89c-aecc00ccf2a1'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=UOfLvaAgXU6az6DD-1tlqA&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=96c42274-10c2-4447-afd0-aecc00cdb77b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=uw1OgmN6q02e7x92c6p9_g&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5aeff855-6885-4d5a-bf2c-aecc00cc0b1f'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=v25ul9x3i0-HISrxr5pRDw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=18569eba-51db-4b72-b6a9-aecc00ccf764'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=v6HfVDCQAkybkxvchiTw5Q&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=14faa79f-ac23-413a-8449-aecc00ca04a5'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=VIY48_OZHkKfQSn5c2GFKQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a75933be-2d2b-4773-9451-aecc00cab49c'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=vR7VAm14LkCSSwxeRvYLMw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=3b494f3b-69cf-40c3-af3b-aecc00ca4c47'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=W-RiJc9gmUaLbQ3DAw5aRQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=9a62fad2-8c77-42cd-8671-aecc00ca7ddd'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=w3Fpp8FKjEm1VivNgzyfrQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5f813aca-a491-44f3-be0e-aecc00c82ee5'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=w5NdCyiarESCybBUSOhCzQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4b2954d8-ca87-4b5e-8d14-aecc00ca865b'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=wLm8j0Czq0CVBwF1NwPGKQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4075e5fa-2443-49c6-842b-aecc00cc7cc6'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=WS6JCv9WvEaoCAvrbZqlbw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e697c0c0-50a5-4e59-b1d8-aecc00ca0bda'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=X1uCzXDlyE-9lbT0mqzY6A&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2b5aab77-62ad-47a8-b753-aecc00ccf304'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=x46kBRRxb0C_LkuCFY39_A&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=6b2b6bfe-5f74-4565-b183-aecc00c996e1'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=xacVbXOojkSOg1bX9xrcAw&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c49c8acc-f09d-4475-a5c6-aecc00ca5c04'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=xhALPLO2-UefnUDjFt73xA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e2a8bb03-af51-4892-b2d0-aecc00c99bcf'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=xjbmdJD7F0GPXjN_G9gr8w&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=606c3787-475a-463a-a00b-aecc00cab5df'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=Xlnt8jfV40Ky3VQRJr6PjA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ac61dfea-abb1-47ba-8c40-aecc00c92aae'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=xmEE_Pc0uk-PT1gQh-SyiQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=89f7434c-8390-4db9-b9a0-aecc00ccf223'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=XvQWU06Ku0KPwUqnwMmmBg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4a5b3d98-3342-463c-a4ba-aecc00c8d4a7'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=xWIPu0ahSky7Noy2RX8tMA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=56e8b2e9-3512-40ae-b905-aecc00ca4b95'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=xWyuStIx0kSx962Uap4bsg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2eee2bab-b5e5-47fb-beba-aecc00c8d465'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=y7-ucD5KkU-C6v6Ay6YnPA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=105955ef-cbfc-4864-a3f2-aecc00c832a7'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=ywzZfil7SUurAlhSYctjQQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a2f592b2-ea94-429a-9af2-aecc00ca7e0c'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=YXE6jHqXs0OurEKemr-YLw&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8e1d27e4-9294-46d2-b4c4-aecc00ccf2be'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=yyvJf3J4tka_GePrllbNgQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=fa71011d-6b6d-4029-9107-aecc00cab586'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=ZDN0-HzYCE-j5t2qAgrRgQ&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b4798175-0d96-43e6-a7cd-aecc00cab379'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=zIFtLBh_REmgsQWVbYVrGA&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&startTime=0&autoPlay=false&hideControls=true&showCaptions=true&displaySharing=false&displayAnnotations=true&displayAttachments=true&displayLinks=true&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=d43e8b3a-85d1-42d4-ba88-aecc00c997ec'],
	['videos.ecpi.net/app/plugin/embed.aspx?ID=zS5XmrSHJ0-d29TupJWuFg&isResponsive=true&isNewPluginEmbed=true&displayTitle=false&startTime=0&autoPlay=false&hideControls=true&showCaptions=false&displaySharing=false&displayAnnotations=false&displayAttachments=false&displayLinks=false&displayEmbedCode=false&displayDownloadIcon=false&displayMetaData=false&displayDateProduced=false&audioPreviewImage=false&displayCaptionSearch=false', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=84c140ec-922d-433f-a891-aecc00cdb7aa'],
	['videos.ecpi.net/app/plugin/embed.aspx?playlistEmbed=true&isResponsive=true&useIFrame=true&displayTitle=true&destinationID=-KQFlY3mKEW37DhIxKgRHQ&contentID=bon-Lp9cLUKDrI1ARA86Sw&pageIndex=1&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=1f3c3179-f49b-46e0-9ead-aecc00cda12c'],
	['videos.ecpi.net/app/plugin/embed.aspx?playlistEmbed=true&isResponsive=true&useIFrame=true&displayTitle=true&destinationID=lJxWbs0-PkyXYNvxqDtR6Q&contentID=-tkmGSr0F0aRf1yGK0RnGg&pageIndex=1&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=fa3697b0-e387-4f04-aa24-aecc00cda144'],
	['videos.ecpi.net/app/plugin/embed.aspx?playlistEmbed=true&isResponsive=true&useIFrame=true&displayTitle=true&destinationID=m1ZlD1pCdECzcIiXsfId7w&contentID=FE_r5xfnGUe6tZVzvGkegw&pageIndex=1&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=76363c1d-e3de-4d10-93fb-aecc00cda1b0'],
	['videos.ecpi.net/app/plugin/embed.aspx?playlistEmbed=true&isResponsive=true&useIFrame=true&displayTitle=true&destinationID=m1ZlD1pCdECzcIiXsfId7w&contentID=H789JpNwsUeu3HMHZz0j5A&pageIndex=1&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=27aab38b-7812-4cb7-b0a3-aecc00cda198'],
	['videos.ecpi.net/app/plugin/embed.aspx?playlistEmbed=true&isResponsive=true&useIFrame=true&displayTitle=true&destinationID=m1ZlD1pCdECzcIiXsfId7w&contentID=xtcx4smBrk2YhEcBMeOinA&pageIndex=1&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=558ef020-1a81-4f27-ab70-aecc00cda181'],
	['videos.ecpi.net/app/plugin/embed.aspx?playlistEmbed=true&isResponsive=true&useIFrame=true&displayTitle=true&destinationID=vwlXQFxZqUmGsz8fBCduCw&contentID=ZuznGuwYs02sUv5kLRfIqw&pageIndex=1&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0e334014-eb06-4387-81bd-aecc00cda15b'],
	['videos.ecpi.net/app/sites/index.aspx?isResponsive=true&viewPlaylist=true&destinationID=UF9tWmQ9jkWscEr1fPPtfg&contentID=F3E1y2Ayfk2EIh9s_1s2eA&pageIndex=1&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7c64d067-f093-4e83-a30d-aecc00c86798'],
	['videos.ecpi.net/app/sites/index.aspx?isResponsive=true&viewPlaylist=true&destinationID=UF9tWmQ9jkWscEr1fPPtfg&contentID=ih2qrTthPEyEqmghWpyCwA&pageIndex=2&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c498faf8-ef92-4ebb-a491-aecc00c86885'],
	['videos.ecpi.net/app/sites/index.aspx?isResponsive=true&viewPlaylist=true&destinationID=UF9tWmQ9jkWscEr1fPPtfg&contentID=KCXim9WhsUeiShlDxeWRdA&pageIndex=1&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=523763dd-41a1-445b-855f-aecc00c8681e'],
	['videos.ecpi.net/app/sites/index.aspx?isResponsive=true&viewPlaylist=true&destinationID=UF9tWmQ9jkWscEr1fPPtfg&contentID=KHy4mpLunU2-EIuhtXBHrw&pageIndex=2&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=77ed40e0-2fc1-4a9a-98bb-aecc00c86872'],
	['videos.ecpi.net/app/sites/index.aspx?isResponsive=true&viewPlaylist=true&destinationID=UF9tWmQ9jkWscEr1fPPtfg&contentID=mbhQBSxxVE65qLmNvJ9H8Q&pageIndex=2&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f360886e-f1e7-4025-80b4-aecc00c8689d'],
	['videos.ecpi.net/app/sites/index.aspx?isResponsive=true&viewPlaylist=true&destinationID=UF9tWmQ9jkWscEr1fPPtfg&contentID=OXise5lkqkygDPxNx8ZQMQ&pageIndex=2&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ee0e2c97-a9b5-4705-b670-aecc00c8685b'],
	['videos.ecpi.net/app/sites/index.aspx?isResponsive=true&viewPlaylist=true&destinationID=UF9tWmQ9jkWscEr1fPPtfg&contentID=RjcG-MzjlE-R9IPtHkVvNw&pageIndex=2&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e1fb4096-98e0-44bc-92c4-aecc00c86848'],
	['videos.ecpi.net/app/sites/index.aspx?isResponsive=true&viewPlaylist=true&destinationID=UF9tWmQ9jkWscEr1fPPtfg&contentID=vOGzExbXkUSnukT-OGVwTg&pageIndex=2&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4a06a12f-767f-461e-88bb-aecc00c8691b'],
	['videos.ecpi.net/app/sites/index.aspx?isResponsive=true&viewPlaylist=true&destinationID=UF9tWmQ9jkWscEr1fPPtfg&contentID=wGmX4wvPy0CiMXkWrdZ-jA&pageIndex=1&pageSize=10', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f6bbf049-f983-4c35-96d1-aecc00c86743'],
	['videos.ecpi.net/hapi/v1/contents/2a6b0fb5-c8cd-4c31-b561-406af8b5fa96/plugin?displayTitle=true&startTime=0&autoPlay=&hideControls=false&showCaptions=&displaySharing=&displayAnnotations=&displayAxdxs=&displayAttachments=&displayLinks=&displayEmbedCode=true&displayDownloadIcon=&displayMetaData=true&displayCredits=true&audioPreviewImage=&displayCaptionSearch=&embedAsThumbnail=&displayViewersReport=', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=23d98a08-e376-4a5e-9839-aecc00cc7b0d'],
	['videos.ecpi.net/hapi/v1/contents/3028f16a-e5fb-4e4c-b8f1-e0a4d0489fb0/preview', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c6cf0995-16bf-4b0d-886e-aecc00cd178c'],
	['videos.ecpi.net/hapi/v1/contents/d0ce72a5-730d-4250-998a-d2974200b402/launch?playlistId', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=9e0d0960-d40b-469b-ac8a-aecc00cca944'],
	['videos.ecpi.net/hapi/v1/contents/f79eb61e-2de5-47ef-bbee-c3e65b5a30ae/preview', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b28419c1-ef25-4dba-ae40-aecc00cd1779'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/a2LDe3p9/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e19ef806-1916-4753-b944-aecc00c9c8c4'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/a2XHt46D/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=bd0133de-9eb6-447b-82e3-aecc00c9c1c3'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/a3EQx5d4/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=76f49f7a-7721-4501-9f5a-aecc00c9c623'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/a4C2HnZj/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=aa479d8d-69ea-49c4-a8ee-aecc00c9c595'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/a4Z7LcQj/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=94f811ef-90d5-4bef-8329-aecc00c9c689'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/a7R6HmPn/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7ac2653c-aef6-40d2-98f2-aecc00c9c3c7'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/a9A3WgRq/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f59fb9a3-9756-4c26-8375-aecc00c9c56c'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/a9ZAg63G/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b6334848-4c80-4f3e-bb07-aecc00cb408a'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Ab35Njr4/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4fd9bee9-9ae7-4d8b-8937-aecc00cd00c0'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Ad52Trt3/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=abcb82b7-e041-485a-9d3a-aecc00cd0978'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Af8x4L3P/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b6fca541-9b0e-467c-804b-aecc00cd09e8'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Ai6p3E2C/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5f25aa41-1d26-4a79-a59f-aecc00cd08ea'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Aj8c4MZt/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=d45dfe76-ec1f-4434-990c-aecc00cd0aa4'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Ar78TbRy/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=88c83650-b276-4b75-aaa3-aecc00cd4005'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/b3T2Ngk9/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0da4b628-2d03-4743-8fd9-aecc00cd40a9'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/b4B3Sng2/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=83d0bfbb-4941-4205-ab3a-aecc00cd09be'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/b4C7SsEc/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=d0ed8c5a-736f-4079-b8db-aecc00cd407f'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/b4MYc35S/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7c0b80d4-5814-42b1-b28d-aecc00c9c1b0'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/b6L7WaXi/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=d01c3315-fbff-4fe0-9edb-aecc00c9c2e5'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/b7L3QrGd/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a3cadebf-a39b-4b3d-b7d9-aecc00c9c52b'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/b9T6GeSw/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=afdb1894-2a99-46b4-a062-aecc00c9c638'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Bc45WdPz/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=70e4ac07-e6c7-48b8-8e8c-aecc00c9c675'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Bj2x5QAd/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5109ef3a-b5a3-4aa0-bdcc-aecc00cd4096'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/By9j7WMn/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5043263c-5a7c-4ea9-8b57-aecc00c9c08c'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/c3QNm5o4/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=39b2f788-6f2b-43e7-8e7e-aecc00c9c64c'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/c5GRa93A/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=15cd1225-195f-4620-8c2a-aecc00c93711'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/c6T9Cys5/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=048f36fe-47ef-42ca-b35c-aecc00c9c5a9'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/c7ARa9o5/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=715a10d2-9501-48d1-b85c-aecc00cd3fdd'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/c7G6AiKk/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8e00b445-3f44-4de3-b305-aecc00cb5f78'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/c9BFm25T/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=838b50c7-b1d3-4f22-b0e6-aecc00c9c660'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Ck72Rgn9/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=146d1714-c7ed-4585-8e84-aecc00cd00d2'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Cz5w9EQa/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e97a5451-80ac-4ea6-937e-aecc00c9c10a'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/De97ZrLn/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=dcdf138a-e24a-4ea5-bf91-aecc00c9c173'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Di82HpQy/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ed472745-0600-47e9-93a1-aecc00cb59b7'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Dp4m9J8F/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=826ceff8-38d5-429f-bf00-aecc00cd406c'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Dw5m6P3B/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=76b78ef8-39b1-48b7-ad49-aecc00c9c4a8'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/e7JQb39S/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ff109932-1ac3-460e-8ca3-aecc00cd0a4f'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/e9ZXi6s2/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b96b722d-7256-4355-a0d8-aecc00c9c556'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Eq42RoHr/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f96639fd-6f5e-4d63-b43d-aecc00c9c69d'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Eq74Axg9/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ee7a571f-c8c4-4d41-a806-aecc00c9c404'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Er4t5S3N/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0c925f2d-c542-43e4-a4f3-aecc00cd4042'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Ew23PbLk/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c4cc2e5e-1e5a-40d1-94f7-aecc00cd40d3'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/f2BAc3a4/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e91a8e3e-8312-46bd-9e2b-aecc00c9c322'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/f4YMx83F/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f8cd958a-e9a4-44cc-a387-aecc00c9c77c'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/f5LFe9x7/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2b609efd-ca01-4318-9183-aecc00c9c0e0'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/f9LMb63Y/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=19f62afa-d356-404f-b666-aecc00c9c3ed'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Fk9x7Q8R/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=6c2c5268-1923-44c3-b68a-aecc00cb5975'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Fz29Xqs7/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=1a810739-0315-4efa-86dc-aecc00cd08c0'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/g3P2Xyp6/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=3d7043c8-3965-484d-9cf0-aecc00cd08d3'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/g3P4Tzj2/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0d9a3b36-5200-4949-abdf-aecc00cd093a'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/g4G6EaMs/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=99c12947-de43-434f-88e2-aecc00c9c7b8'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/g5APc2n4/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=49fe31cc-3c6c-4b00-bf63-aecc00c9c1da'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/g5HTt79R/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=fa99c4e3-8344-48fe-8926-aecc00c9c6b1'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Ge98Ffk6/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=31135bb2-a44a-48b9-b99c-aecc00c9362b'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Gz84DnYe/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=d1009707-d7ec-43a8-9002-aecc00c9c2a9'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Hb24Kcy5/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=d9a5b87e-f669-4de5-94a7-aecc00c9c186'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Hb7k2Z3S/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f26c7814-b72c-4ef7-9c63-aecc00cd3fb3'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Hd7o8PLs/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e263001f-c3aa-4149-9c04-aecc00c9c199'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Hf6g4E8Y/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8805747f-a644-4f12-9f31-aecc00c9c7a1'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Hk6a7Y3C/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ee0a0b44-61de-4d40-9958-aecc00c9c454'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/i3M7PgAq/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=47395e03-9179-46dd-a3dc-aecc00cd3ff0'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/i5H9JmXt/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c9584949-c219-4622-857e-aecc00c9c335'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/i8R5Zdc7/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b3e0eced-f531-4262-a178-aecc00cd0a3d'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/i9W3Rkx2/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ffab7e66-9414-49b8-a9f7-aecc00c9c791'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/j2APg79L/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=38007f26-f1c0-469f-823f-aecc00cd0960'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/j2H5Lsy8/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=6f8275e2-69c6-4ccc-8225-aecc00c9c754'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/j5CLs83Y/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=3af9d146-8c78-4b51-ac76-aecc00c9c23d'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/j8Q4Lkr3/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0bab17f4-7e8e-45b6-abd7-aecc00cd00ea'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Ji25Hcz6/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c9fec56e-62d2-48ac-8bcc-aecc00c9c6c5'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/k4F5RiXm/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0f32ca42-ad08-431e-a1f8-aecc00cd0a79'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/k4W8Bow2/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b8321306-27d4-4cd4-8eb0-aecc00c9c22a'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/k5TNp84X/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=6376685f-846e-4551-83a0-aecc00c9c502'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Kf9a6W5B/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=558d85fc-63cf-4b8b-b550-aecc00c9c0f3'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Kq68CdAm/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a2080f80-aa67-470a-9d15-aecc00c9c832'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Le5k4F8M/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=caa15a4d-933c-4859-b852-aecc00c9c11d'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Lm96AiPx/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=9cba0661-4e5c-4111-a9f0-aecc00cd0910'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Lp89Zzs3/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=51f72ef0-edf8-4bb0-bd80-aecc00c9c46b'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Ls75Jef3/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0ea574cc-c6dc-4679-9a90-aecc00c9bf64'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Lz24Yrw8/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c3ca6dc1-e6dd-4ae8-9b8e-aecc00c9c200'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/m3Y8Jga4/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f708c7b0-53aa-4589-9272-aecc00c9c147'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/m8SRi3o7/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b73e7caf-cea0-4c28-876b-aecc00cd4059'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Mf2g5FWi/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e72e21cf-1ac5-4c38-ab2b-aecc00c9c899'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Mi9k3J6Q/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b2ed3c0f-5bc2-4ad4-9743-aecc00c9c27e'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Mj8d3Q2G/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c4684325-c6b2-4754-bbe5-aecc00c9c5e7'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Mo7x2Y8N/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=52e71e07-e248-4ab8-87ea-aecc00c9c808'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Mo85RnFs/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=bb9c01ed-18dd-46d1-a63d-aecc00c9c887'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Mr85YcTf/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=1e638ba3-d46b-48a5-8d51-aecc00cced53'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/n2T3LxBz/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=e04d4bf4-2289-4d79-b8ff-aecc00c9c217'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/n5X9Pkg3/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=41417ecd-c7d1-4657-9f83-aecc00c93753'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/n6YNs42G/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f2ccb539-c07c-4ec8-9bbd-aecc00c9c39d'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/n7BPa23G/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=95e86c56-2732-42f8-a059-aecc00cb3a3a'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/n9W7DgMk/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8cc6729d-5a6d-4372-8a1c-aecc00c9c543'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Na5j8TQy/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=62490bb4-dbcd-4328-9750-aecc00c9c740'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Nj9a5T8C/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c28b7b9b-a501-49b1-bee7-aecc00cd3fa0'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/No3t8R7F/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8fb14c59-077b-49fe-b64f-aecc00c9bf31'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Nt6k2ZFz/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8887233d-aa79-4068-84e3-aecc00c9bfa6'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Nz95Zom6/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=42c592eb-8c92-46b5-acda-aecc00c9c5fb'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/o2YSg9w7/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=3ab70c4d-7259-4259-95e3-aecc00c9c2bb'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/o3TAs9r7/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f798b60f-75a4-4a27-a0b4-aecc00c9c717'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/o4NDt6a8/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a4f3cc0a-26ce-4a47-ad04-aecc00c9c3da'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Office365_for_students/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b57bdd91-45f4-4fa4-9404-aecc00cb5be0'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/p4R2JoZd/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=853488d1-dfcb-4db4-8709-aecc00c9c15c'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/p5NDe74J/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=6a23c323-9d4a-497e-b58c-aecc00c9bfe8'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Pd23NtGe/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=62c52c86-b2f6-4ac6-9d44-aecc00c9c024'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Pd4p9ERi/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=07c7e5d7-386f-4c36-ac50-aecc00c9c845'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Pe8p4X2H/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=72b751b1-dbae-4792-9d34-aecc00c9c703'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Pg8s3R2G/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ef2cf8f1-447d-4c95-ac84-aecc00c9c8ee'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Pm53YpFy/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2fde3efb-9060-42fb-adb5-aecc00cd0a2a'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Pn3a5TZs/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b953ab65-c2e4-4ac2-a60b-aecc00c9c85c'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/q3JGt4j7/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7580ad64-8b6f-4272-9f2d-aecc00c9c373'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/q4K7AdZe/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=d5197471-85ef-4c88-90ad-aecc00c9c267'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/q6L8DkWi/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=3b959926-d91b-4a2e-8cc2-aecc00c9bfbd'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/q7S5Hop4/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=40e589de-9586-42a6-b213-aecc00c9c42e'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/q9G3LsTr/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=512a08bd-89be-407c-814e-aecc00c9bf48'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Qk67Fxj2/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=7e67f3c0-f5e4-4aa3-942a-aecc00c9c1ed'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Qo29SxPg/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=fd2260b0-9ee1-45a0-b8e0-aecc00c9bf1e'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Qp7n2KXk/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5c0cb388-2f18-4a83-a530-aecc00c9c134'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Qt3x4W2A/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=eca04384-54d9-44bd-b791-aecc00c9c5be'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Qy8i2Y6R/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0db26ce4-c914-4829-802c-aecc00c9c4c0'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/r2RLz68S/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=1f000717-c3bc-45bc-84db-aecc00c9c441'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/r2WKm3y9/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=68a7b06d-eca6-4ac6-a906-aecc00cd08ad'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/r6B4EeSk/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=216aceb5-7401-4474-ac77-aecc00c9c6ee'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/r6BDc34C/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=78087a2b-8e69-4dd2-ba7c-aecc00c9c254'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/r6X9NzTn/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b240c825-6e04-4788-948c-aecc00c9c38a'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Rg79XjGk/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0eca5d42-e1ba-4524-bdd0-aecc00cd094d'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Rm2a7L3J/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=edf444ec-44f2-4e3b-a027-aecc00c9c580'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Ro4c7CKp/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=611247c0-5677-417c-a9cf-aecc00c9c60f'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Ro6w8H2E/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=27441336-773b-43f7-95b8-aecc00c9c0c9'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Rs35MwWn/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2a723d4b-8465-4860-b178-aecc00cd3fca'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/s3P7Htk9/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c0095e70-24d3-4f30-939c-aecc00c9c360'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/s6BAo2d5/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=621a5a19-316d-40ed-8775-aecc00cb5ab8'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/s6GQz8i4/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a12d6550-f040-483f-8661-aecc00cd098a'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/s8K2Hcm5/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=648af9c8-9cb1-49c1-9c1f-aecc00cb5b0d'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/s8Q3Gcm9/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=fbf1f2df-8a99-4acf-880d-aecc00c9c8b1'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Sc98NmQy/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8b141f5f-0ef3-4e67-a332-aecc00c9c03c'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/St4p8HTz/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c86a141a-b1b3-43e5-9b66-aecc00c9c7de'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Sx84CaFo/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=423e67dc-8596-40bf-866f-aecc00c9c86f'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/t2HMj68X/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=cbb7163f-53dc-4cfe-ac7c-aecc00cd09fb'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/t2YGi5p3/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=539c5090-914a-4524-8609-aecc00c9c0b6'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/t2Z8Xyf9/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=66db9c8e-eb44-4f3c-a780-aecc00c9bf93'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Tk7g6ZEn/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=ee4cf7db-d31e-4563-a9b5-aecc00c9c81b'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Tx9b5P8B/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0679e96f-4734-4c5e-8319-aecc00cd0a67'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Tz68ZdGq/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4f2b2a2b-9422-4769-9d76-aecc00c9c2f8'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/w2KHd56B/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f856f410-9df3-4e10-8a94-aecc00c9c348'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/w4C7FpRr/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=17b43a98-f29e-4a0e-8370-aecc00c9c7f5'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/w5HWo24D/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0dbed531-4426-4ac6-b88d-aecc00cd09d5'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/w6KMf8y7/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=9b93e2f4-e1de-4ec5-b3f9-aecc00c9c8db'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/w8XLk3a4/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0df8e151-9ff8-4906-8134-aecc00c9bfd0'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/w9Z7HtWc/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4fc24a6d-57c0-4541-ba8f-aecc00c9c496'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/w9ZPd57L/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=a172bbfa-f4fd-4e4c-890f-aecc00c9c09e'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Wa2k4K3E/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=b42a94d5-29c2-4c33-9ed0-aecc00cb5938'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Wb78Sce2/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=07621291-e803-453c-ae50-aecc00cd402f'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/We7p4Z3X/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5c711c54-b33a-4fac-97ac-aecc00c9bf7c'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Wp83Tia4/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=4e70eab6-c280-4f39-bf64-aecc00cd0923'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Wt54Lgm9/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=68467f59-4286-48f8-b4dc-aecc00c9c6da'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/x3E7Laq6/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=400a40b1-a059-46f3-98b9-aecc00cd40c0'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/x4TNz92J/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2201a17e-13ec-4cae-98f5-aecc00c9c4ea'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/x8Z5Cwd3/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=1274868e-8f3b-449b-a440-aecc00c9c7cb'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Xa43YrWs/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=cc3297ba-8721-4ba2-912a-aecc00c9c47e'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Xa4d5C6N/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8f025fc0-a6c9-48c4-860c-aecc00c9c3b0'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/XenDeskTopandSubmittingAssignments/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0ed2d4cc-538b-41af-a9cb-aecc00cdd03a'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Xk25Pnd7/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f6cbf466-b1f1-4722-9340-aecc00c9c291'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Xk39Gda5/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=89a98b18-bcc9-45a6-b71c-aecc00c9c517'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Xz45GgHn/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=c94c5c59-7990-4b14-8228-aecc00cd0a91'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/y4J6Ask8/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=fa35f07a-28b9-4550-b2a9-aecc00cd0a12'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/y4RNb69Q/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f7ad957e-a500-4aa6-b383-aecc00c9c00d'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/y6N3EqKc/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=73fbc95a-4caf-4700-9926-aecc00c9c04f'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/y7E2HzZd/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=9407019d-0250-4c2c-9e7b-aecc00c9bffa'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/y7Y4Xzg9/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=0cb94025-2c4a-4411-8864-aecc00cd09a2'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Ym36Nxw8/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=59ce7e5a-d1ae-43f7-b155-aecc00cd401c'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/z3EWm96Z/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=5ad2bc1e-e4f5-4e33-9278-aecc00c9c079'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/z3L9KqXp/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f48740bb-5eb4-4f2a-9486-aecc00c9c30b'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/z3SHe65T/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=310970dd-8735-440d-95b4-aecc00c9c5d2'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/z3XMa7j2/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=2b266d3b-e10e-4fd4-811e-aecc00c9c061'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/z8WNn2e5/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=1afa3b4a-1109-481b-bc06-aecc00c9c417'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/z9Q6Xco3/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=6f0232e1-eea9-427c-85b9-aecc00c9c72c'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Zd4k6B3K/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=f53efce9-caf4-4413-85a2-aecc00cb5acb'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Zg3o9F7H/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=88ec1fa8-7c13-452d-8c82-aecc00c9c4d7'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Zg9o8M6C/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=804416e5-945d-4c44-ae25-aecc00c9c900'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Zp84WiNs/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=8ae37915-958d-40b9-b34b-aecc00c9c768'],
	['videos.ecpi.net/hapi/v1/contents/permalinks/Zq7s9Y8X/view', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=59c515c8-4b00-4434-b967-aecc00cb40a1'],
	['videos.ecpi.net/settings/lti/video/launch/75117672-8511-4da0-b258-374f8bd08c68?autoPlay=false&displayTitle=true&displaySharing=false&displayAnnotations=true&displayCaptionSearch=true&displayAttachments=true&audioPreviewImage=false&displayLinks=true&displayMetaData=true&displayEmbedCode=true&displayDownloadIcon=false&displayViewersReport=true&embedAsThumbnail=false&startTime=0&displayCredits=true&showCaptions=false&hideControls=true&width=848&height=480', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=af816e70-cbfe-4eb3-a938-aecc00ca0719'],
	['videos.ecpi.net/settings/lti/video/launch/75117672-8511-4da0-b258-374f8bd08c68?autoPlay=false&displayTitle=true&displaySharing=false&displayAnnotations=true&displayCaptionSearch=true&displayAttachments=true&audioPreviewImage=true&displayLinks=true&displayMetaData=true&displayEmbedCode=false&displayDownloadIcon=false&displayViewersReport=true&embedAsThumbnail=false&startTime=0&displayCredits=true&showCaptions=false&hideControls=true&width=848&height=477', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&id=af816e70-cbfe-4eb3-a938-aecc00ca0719'],
	['videos.ecpi.net/Watch/a2LDe3p9', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=e19ef806-1916-4753-b944-aecc00c9c8c4'],
	['videos.ecpi.net/Watch/a5Q3Fyz9', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=4dd32516-0813-489a-9146-aecc00cd0776'],
	['videos.ecpi.net/Watch/a9ZAg63G', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=b6334848-4c80-4f3e-bb07-aecc00cb408a'],
	['videos.ecpi.net/Watch/AcademicContinuity', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=af816e70-cbfe-4eb3-a938-aecc00ca0719'],
	['videos.ecpi.net/Watch/Ar78TbRy', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=88c83650-b276-4b75-aaa3-aecc00cd4005'],
	['videos.ecpi.net/Watch/b3T2Ngk9', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=0da4b628-2d03-4743-8fd9-aecc00cd40a9'],
	['videos.ecpi.net/Watch/b4C7SsEc', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=d0ed8c5a-736f-4079-b8db-aecc00cd407f'],
	['videos.ecpi.net/Watch/b9QPn73K', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=ff4d9b10-a593-423b-bd90-aecc00c9b768'],
	['videos.ecpi.net/Watch/Bj2x5QAd', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=5109ef3a-b5a3-4aa0-bdcc-aecc00cd4096'],
	['videos.ecpi.net/Watch/Bk7q9X2P', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=b996c28a-22b5-4d2f-bff5-aecc00cb5b74'],
	['videos.ecpi.net/Watch/c3G5QnDi', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=23d98a08-e376-4a5e-9839-aecc00cc7b0d'],
	['videos.ecpi.net/Watch/c5GRa93A', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=15cd1225-195f-4620-8c2a-aecc00c93711'],
	['videos.ecpi.net/Watch/c7ARa9o5', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=715a10d2-9501-48d1-b85c-aecc00cd3fdd'],
	['videos.ecpi.net/Watch/d5SPi23L', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=5f098263-eeda-4eca-a658-aecc00ca5a9b'],
	['videos.ecpi.net/Watch/Di6s7M9E', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=77ed40e0-2fc1-4a9a-98bb-aecc00c86872'],
	['videos.ecpi.net/Watch/Di82HpQy', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=ed472745-0600-47e9-93a1-aecc00cb59b7'],
	['videos.ecpi.net/Watch/Dp4m9J8F', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=826ceff8-38d5-429f-bf00-aecc00cd406c'],
	['videos.ecpi.net/Watch/Er4t5S3N', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=0c925f2d-c542-43e4-a4f3-aecc00cd4042'],
	['videos.ecpi.net/Watch/Ew23PbLk', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=c4cc2e5e-1e5a-40d1-94f7-aecc00cd40d3'],
	['videos.ecpi.net/Watch/f8LSn3b6', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=c49c8acc-f09d-4475-a5c6-aecc00ca5c04'],
	['videos.ecpi.net/Watch/Fk9x7Q8R', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=6c2c5268-1923-44c3-b68a-aecc00cb5975'],
	['videos.ecpi.net/Watch/g5YZp79A', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=4a06a12f-767f-461e-88bb-aecc00c8691b'],
	['videos.ecpi.net/Watch/Gc6e3JQx', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=3b00a80b-a3bd-4617-bc25-aecc00cdcafd'],
	['videos.ecpi.net/Watch/Ge98Ffk6', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=31135bb2-a44a-48b9-b99c-aecc00c9362b'],
	['videos.ecpi.net/Watch/Hb7k2Z3S', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=f26c7814-b72c-4ef7-9c63-aecc00cd3fb3'],
	['videos.ecpi.net/Watch/i2K8Lmb9', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=4006c73b-38d7-427a-919c-aecc00c88400'],
	['videos.ecpi.net/Watch/i3M7PgAq', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=47395e03-9179-46dd-a3dc-aecc00cd3ff0'],
	['videos.ecpi.net/Watch/Kb3t4G6B', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=53f97d9a-e819-48b6-8e69-aecc00c9b797'],
	['videos.ecpi.net/Watch/LiveChat', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=e93ba795-c681-41e4-9920-aecc00cb5bcd'],
	['videos.ecpi.net/Watch/m8SRi3o7', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=b73e7caf-cea0-4c28-876b-aecc00cd4059'],
	['videos.ecpi.net/Watch/Mw29Etp7', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=6e9427f3-04da-4f76-9d21-aecc00cd0460'],
	['videos.ecpi.net/Watch/n4A5Lor7', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=03c2e300-a461-4aa5-9866-aecc00cd044d'],
	['videos.ecpi.net/Watch/n7BPa23G', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=95e86c56-2732-42f8-a059-aecc00cb3a3a'],
	['videos.ecpi.net/Watch/Nj9a5T8C', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=c28b7b9b-a501-49b1-bee7-aecc00cd3fa0'],
	['videos.ecpi.net/Watch/Nw9o8AXb', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=98916e7a-9600-4d56-8fcd-aecc00cdbab2'],
	['videos.ecpi.net/Watch/o5SEn48N', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=9a2dad1f-4e31-44cc-8d8d-aecc00cd0435'],
	['videos.ecpi.net/Watch/Office365_for_students', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=b57bdd91-45f4-4fa4-9404-aecc00cb5be0'],
	['videos.ecpi.net/Watch/q4J2LkQx', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=e697c0c0-50a5-4e59-b1d8-aecc00ca0bda'],
	['videos.ecpi.net/Watch/Rs35MwWn', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=2a723d4b-8465-4860-b178-aecc00cd3fca'],
	['videos.ecpi.net/Watch/s6BAo2d5', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=621a5a19-316d-40ed-8775-aecc00cb5ab8'],
	['videos.ecpi.net/Watch/s6LRi5r7', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=dec735a3-ec90-4054-883c-aecc00cd040f'],
	['videos.ecpi.net/Watch/s8K2Hcm5', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=648af9c8-9cb1-49c1-9c1f-aecc00cb5b0d'],
	['videos.ecpi.net/Watch/s8Q3Gcm9', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=fbf1f2df-8a99-4acf-880d-aecc00c9c8b1'],
	['videos.ecpi.net/Watch/t6JWw58K', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=ef1e1bf5-a0b7-491e-9524-aecc00ca0b9d'],
	['videos.ecpi.net/Watch/w3Q4Jqc2', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=eff871b3-5d72-48f8-ab58-aecc00cd0423'],
	['videos.ecpi.net/Watch/w8GHj57F', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=596d257b-94ec-4f08-a9fe-aecc00cdba9a'],
	['videos.ecpi.net/Watch/w9RNz3q7', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=a9b863e0-35c1-4803-a67c-aecc00cdba6b'],
	['videos.ecpi.net/Watch/Wa2k4K3E', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=b42a94d5-29c2-4c33-9ed0-aecc00cb5938'],
	['videos.ecpi.net/Watch/Wb78Sce2', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=07621291-e803-453c-ae50-aecc00cd402f'],
	['videos.ecpi.net/Watch/Wo4f2KJq', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=49098502-cc64-4dc6-8863-aecc00ca5ab2'],
	['videos.ecpi.net/Watch/x3E7Laq6', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=400a40b1-a059-46f3-98b9-aecc00cd40c0'],
	['videos.ecpi.net/Watch/x5Y8Fqo2', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=e6973969-27db-4bc2-9442-aecc00c9b77b'],
	['videos.ecpi.net/Watch/x8J5WwAe', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=2773091b-60d3-41b0-8f7b-aecc00ca0bb0'],
	['videos.ecpi.net/Watch/x9JXr7w8', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=db57355f-55ff-4817-82ad-aecc00ca0ad8'],
	['videos.ecpi.net/Watch/XenDeskTopandSubmittingAssignments', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=0ed2d4cc-538b-41af-a9cb-aecc00cdd03a'],
	['videos.ecpi.net/Watch/Xk4g3KJx', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=bc648527-de30-44e3-bac0-aecc00ca0a05'],
	['videos.ecpi.net/Watch/y5BAq4d9', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=18c7ef25-4f85-4d05-94fd-aecc00ca5a4f'],
	['videos.ecpi.net/Watch/Ym36Nxw8', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=59ce7e5a-d1ae-43f7-b155-aecc00cd401c'],
	['videos.ecpi.net/Watch/Yx89Bkt7', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=ad1492f4-f9fc-49f2-aac4-aecc00cdbb1d'],
	['videos.ecpi.net/Watch/z9JDj84P', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=1d175b4d-6d22-4f3f-aa3e-aecc00cdbac4'],
	['videos.ecpi.net/Watch/Zd4k6B3K', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=f53efce9-caf4-4413-85a2-aecc00cb5acb'],
	['videos.ecpi.net/Watch/Zq7s9Y8X', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=59c515c8-4b00-4434-b967-aecc00cb40a1'],
	['videos.ecpi.net/Watch/Zs68Acp9', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Viewer.aspx?id=cddf97f8-5945-4249-b48c-aecc00cdbb30'],
	['videos.ecpi.net/app/plugin/embed.aspx?DestinationID=9_2pQKPF2E6m9-akAy51DQ&playlistEmbed=true&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&useIFrame=true&displayShowcase=true&embedIdentifier=b9c0d401-d7ee-472c-949f-44db30b3a87c&displayEmbedCode=false&displayStatistics=false&displayVideoDuration=true&displayCredits=false&showCaptions=true&displayDateProduced=false&hideControls=true&audioPreviewImage=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&pid=48189e14-603d-43a2-8e91-aedd012f7c51'],
	['videos.ecpi.net/app/plugin/embed.aspx?DestinationID=h3hzEtgM5UG48_odzGYExw&playlistEmbed=true&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&useIFrame=true&displayShowcase=true&displayCategoryList=true&categoryOrientation=horizontal&embedIdentifier=6255f3b2-bbe5-490b-b25e-c4660b051b56&displayEmbedCode=false&displayStatistics=false&displayVideoDuration=true&displayAnnotations=false&displayCredits=false&showCaptions=true&displayDateProduced=false&displayCaptionSearch=false&hideControls=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&pid=c6492709-9359-43ee-b8b3-aedd012f70df'],
	['videos.ecpi.net/app/plugin/embed.aspx?DestinationID=nPGOgvBMk0m5bP_MwIOYYQ&playlistEmbed=true&isResponsive=true&useIFrame=true&displayTitle=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&pid=1bc0d6eb-2382-44e7-9c49-aedd012f7b4e'],
	['videos.ecpi.net/app/plugin/embed.aspx?DestinationID=OhsZJmXsKkeh3lAnnz4TuQ&playlistEmbed=true&isResponsive=true&useIFrame=true&displayTitle=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&pid=968d11ab-9af3-403c-85fd-aedd012f7d47'],
	['videos.ecpi.net/app/plugin/embed.aspx?DestinationID=SNWd4W2CKkClgAOcRg8Gpw&playlistEmbed=true&isResponsive=true&isNewPluginEmbed=true&displayTitle=true&useIFrame=true&displayShowcase=true&embedIdentifier=a12d0d42-0b6c-4713-b982-115670944af7&displayEmbedCode=false&displayStatistics=false&displayVideoDuration=true&displayCredits=false&showCaptions=true&displayDateProduced=false&hideControls=true&audioPreviewImage=true', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&pid=0ded6cd8-7d1e-4f3c-8851-aedd012f7ef6'],
	['videos.ecpi.net/Playlist/201806GeneralVideosPlaylist', 'https://ecpi.hosted.panopto.com/Panopto/Pages/Embed.aspx?autoplay=false&offerviewer=true&showtitle=true&showbrand=true&captions=false&interactivity=all&pid=d8b0ea4b-a3bf-4769-88e3-aedd012f633b']
];


/**
 * @name          Replace Links
 * @description   Replaces old links to new
 * @return string/null
 */
let replaceLinks = body => {
	if(body == null) {
		return body;
	}

	var newBody = body;
	replacementLinks.forEach(links => {
		newBody = newBody.replace(new RegExp(links[0], 'g'), links[1]);
	});

	return newBody;
};

let courseCall = 0;
let calls = [];

/**
 * @name          Ensemble-to-Panopto
 * @description   Replaces Ensemble links with Panopto links
 * @return undefined
 */
let ensembleToPanopto = () => {
	if(/^https?:\/\/ecpi\.([^\.]*\.)?instructure\.com\/accounts\/\d+$/.test(url.split('?')[0])) {
		replacementLinks.forEach((links, i) => {
			replacementLinks[i][0] = '(https?:\/\/)?' + links[0].replaceAll('\\', '\\\\').replaceAll('.', '\\.').replaceAll('?', '\\?').replaceAll('&', '&(amp;)?').replaceAll('/', '\\/');
		});

		var lead = document.querySelector('#content').getElementsByContains('Hide courses without students', 'span')[0];
		console.log(lead);
		var i = 0;
		var wait = setInterval(() => {
			var addCourseBtn = lead.getElementsByContains('Course', 'button');
			console.log(addCourseBtn);
			if(addCourseBtn.length > 0) {
				var newBtn = document.createElement('button');
				newBtn.classList.add('Button', 'Button--warning');
				newBtn.type = 'button';
				newBtn.role = 'button';
				newBtn.tabindex = 0;
				newBtn.style.marginLeft = lead.querySelector('label:first-of-type').parentNode.style.paddingRight;
				newBtn.innerHTML = '<i class="icon-progress"></i>&nbsp;Ensemble-to-Panopto';
				newBtn.addEventListener('click', () => {
					console.log('Running Ensemble-to-Panopto!');

					var activityUpdates = [];

					callAPI('GET', ['accounts', 1, 'courses'], 1, [{}], courses => {
						var toUpdateCourses = courses.filter(course => {
							return /^(WORKING|QUICKFIX|PILOT|MASTER)\b/.test(course.name.trim());
						});
						var liveToUpdateCourse = courses.filter(course => {
							return /^2022(07|08|09|10|11|12)/.test(course.name.trim());
						});
						console.log(toUpdateCourses, liveToUpdateCourse);

						var updateCourses = toUpdateCourses.concat(liveToUpdateCourse).sort((a, b) => {
							if(a.id > b.id) {
								return 1;
							}
							return -1;
						});
						console.log(updateCourses);

						updateCourses.forEach((shell, j) => {
							calls[j] = setInterval(() => {
								if(j == 0 || courseCall == updateCourses[j - 1].id) {
									setTimeout(() => {
										clearInterval(calls[j]);

										console.log('Starting ' + shell.id + ' (' + (j + 1) + '/' + updateCourses.length + ')');

										callAPI('GET', ['courses', shell.id, 'pages'], 1, [{}], pages => {
											var pageCall = 0;
											var pageCalls = [];

											pages.forEach((page, k) => {
												pageCalls[k] = setInterval(() => {
													if(k == 0 || pageCall == pages[k - 1].page_id) {
														setTimeout(() => {
															clearInterval(pageCalls[k]);

															callAPI('GET', ['courses', shell.id, 'pages', page.page_id], 1, [{}], wiki => {
																var newBody = replaceLinks(wiki.body);

																if(wiki.body != newBody) {
																	activityUpdates.push([shell.id, 'pages', page.page_id, newBody]);
																}

																pageCall = page.page_id;
															});
														}, 100);
													}
												}, 200);
											});

											var wait2 = setInterval(() => {
												if(pages.length == 0 || pageCall == pages[pages.length - 1].page_id) {
													clearInterval(wait2);

													callAPI('GET', ['courses', shell.id, 'discussion_topics'], 1, [{}], discussion_topics => {
														discussion_topics.forEach(discussion_topic => {
															var newMessage = replaceLinks(discussion_topic.message);

															if(discussion_topic.message != newMessage) {
																activityUpdates.push([shell.id, 'discussion_topics', discussion_topic.id, newMessage]);
															}
														});

														callAPI('GET', ['courses', shell.id, 'quizzes'], 1, [{}], quizzes => {
															quizzes.forEach(quiz => {
																var newDescription = replaceLinks(quiz.description);

																if(quiz.description != newDescription) {
																	activityUpdates.push([shell.id, 'quizzes', quiz.id, newDescription]);
																}
															});

															callAPI('GET', ['courses', shell.id, 'assignments'], 1, [{}], assignments => {
																assignments.forEach(assignment => {
																	var newDescription = replaceLinks(assignment.description);

																	if(assignment.description != newDescription) {
																		activityUpdates.push([shell.id, 'assignments', assignment.id, newDescription]);
																	}
																});

																callAPI('GET', ['courses', shell.id, 'modules'], 1, [{
																	include: ['items']
																}], modules => {
																	modules.forEach(module => {
																		if(module.items != undefined) {
																			module.items.forEach(item => {
																				if(['ExternalTool', 'ExternalUrl', 'SubHeader'].includes(item.type)) {
																					var newTitle = replaceLinks(item.title);
																					var newURL = item.external_url != undefined ? replaceLinks(item.external_url) : null;

																					if(item.title != newTitle || (newURL != null && item.external_url != newURL)) {
																						activityUpdates.push([shell.id, 'modules/' + module.id + '/items', item.id, (item.title != newTitle ? newTitle : item.title), (newURL != null ? (item.external_url != newURL ? newURL : item.external_url) : null)]);
																					}
																				}
																			});
																		}
																	});

																	courseCall = shell.id;

																	console.log('Ending ' + shell.id + ' (' + (j + 1) + '/' + updateCourses.length + ')');
																});
															});
														});
													});
												}
											}, 250);
										});
									}, 500);
								}
							}, 1000);
						});

						var wait = setInterval(() => {
							if(courseCall == updateCourses[updateCourses.length - 1].id) {
								clearInterval(wait);

								console.log(activityUpdates);

								activityUpdates.forEach((activity, j) => {
									setTimeout(() => {
										var data;
										switch(activity[1]) {
											case 'pages':
												data = {
													wiki_page: {
														body: activity[3]
													}
												};
												break;
											case 'discussion_topics':
												data = {
													message: activity[3]
												};
												break;
											case 'quizzes':
												data = {
													quiz: {
														description: activity[3]
													}
												};
												break;
											case 'assignments':
												data = {
													assignment: {
														description: activity[3]
													}
												};
												break;
											default:
												data = activity[4] != null ? {
													module_item: {
														title: activity[3],
														external_url: activity[4]
													}
												} : {
													module_item: {
														title: activity[3]
													}
												};
										}
										callAPI('PUT', ['courses', activity[0], activity[1], activity[2]], 1, [data], updated => {
											console.log([activity[0], activity[1], activity[2], updated.title != undefined ? updated.title : updated.name]);
										});
									}, 500 * j);
								});
							}
						}, 250);
/*						updateCourses.forEach((shell, i) => {
							setTimeout(() => {
								calls++;
								callAPI('GET', ['courses', shell.id, 'pages'], 1, [{}], pages => {
									calls--;

									pages.forEach((page, j) => {
										setTimeout(() => {
											calls++;
											callAPI('GET', ['courses', shell.id, 'pages', page.page_id], 1, [{}], wiki => {
												calls--;

												var newBody = replaceLinks(wiki.body);
//												console.log(wiki.body, newBody);

												if(wiki.body != newBody) {
													activityUpdates.push([shell.id, 'pages', page.page_id, newBody]);
												}

												calls++;
												callAPI('GET', ['courses', shell.id, 'discussion_topics'], 1, [{}], discussion_topics => {
													calls--;

													discussion_topics.forEach(discussion_topic => {
														var newMessage = replaceLinks(discussion_topic.message);

														if(discussion_topic.message != newMessage) {
															activityUpdates.push([shell.id, 'discussion_topics', discussion_topic.id, newMessage]);
														}
													});

													calls++;
													callAPI('GET', ['courses', shell.id, 'quizzes'], 1, [{}], quizzes => {
														calls--;

														quizzes.forEach(quiz => {
															var newDescription = replaceLinks(quiz.description);

															if(quiz.description != newDescription) {
																activityUpdates.push([shell.id, 'quizzes', quiz.id, newDescription]);
															}
														});

														calls++;
														callAPI('GET', ['courses', shell.id, 'assignments'], 1, [{}], assignments => {
															calls--;

															assignments.forEach(assignment => {
																var newDescription = replaceLinks(assignment.description);

																if(assignment.description != newDescription) {
																	activityUpdates.push([shell.id, 'assignments', assignment.id, newDescription]);
																}
															});

															calls++;
															callAPI('GET', ['courses', shell.id, 'modules'], 1, [{
																include: ['items']
															}], modules => {
																calls--;

																modules.forEach(module => {
																	if(module.items != undefined) {
																		module.items.forEach(item => {
																			if(['ExternalTool', 'ExternalUrl', 'SubHeader'].includes(item.type)) {
																				var newTitle = replaceLinks(item.title);
																				var newURL = item.external_url != undefined ? replaceLinks(item.external_url) : null;

																				if(item.title != newTitle || (newURL != null && item.external_url != newURL)) {
																					activityUpdates.push([shell.id, 'modules/' + module.id + '/items', item.id, (item.title != newTitle ? newTitle : item.title), (newURL != null ? (item.external_url != newURL ? newURL : item.external_url) : null)]);
																				}
																			}
																		});
																	}
																});

																if(i == updateCourses.length - 1) {
																	var wait = setInterval(() => {
																		if(calls == 0) {
																			clearInterval(wait);

																			if(!called) {
																				called = true;

																				console.log(activityUpdates);

																				activityUpdates.forEach((activity, j) => {
																					setTimeout(() => {
																						var data;
																						switch(activity[1]) {
																							case 'pages':
																								data = {
																									wiki_page: {
																										body: activity[3]
																									}
																								};
																								break;
																							case 'discussion_topics':
																								data = {
																									message: activity[3]
																								};
																								break;
																							case 'quizzes':
																								data = {
																									quiz: {
																										description: activity[3]
																									}
																								};
																								break;
																							case 'assignments':
																								data = {
																									assignment: {
																										description: activity[3]
																									}
																								};
																								break;
																							default:
																								data = activity[4] != null ? {
																									module_item: {
																										title: activity[3],
																										external_url: activity[4]
																									}
																								} : {
																									module_item: {
																										title: activity[3]
																									}
																								};
																						}
																						callAPI('PUT', ['courses', activity[0], activity[1], activity[2]], 1, [data], updated => {
																							console.log([activity[0], activity[1], activity[2], updated.title != undefined ? updated.title : updated.name]);
																						});
																					}, 500 * j);
																				});
																			}
																		}
																	}, 250);
																}
															});
														});
													});
												});
											});
										}, 250 * j);
									});
								});
							}, 10000 * i);
						});*/
					});
				});
				addCourseBtn[0].parentNode.appendChild(newBtn);

				clearInterval(wait);
			} else if(i >= 30) {
				clearInterval(wait);
			}
			i++;
		}, 500);
	}
};

(() => {
	setTimeout(() => {
		ensembleToPanopto();
	}, 5000);
})();