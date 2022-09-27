// ==UserScript==
// @name          Canvas External Tools Customizations
// @version       0.1
// @updateURL     https://github.com/cesbrandt/tampermonkey-library/raw/main/Canvas%20External%20Tools%20Customizations.user.js
// @include       /^https?:\/\/[^\.]*\.([^\.]*\.)?instructure\.com\/courses\/\d+\/settings\/configurations*$/
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
//	var callURL = url.match(/^.*(?:instructure\.com)/)[0] + '/api/v1';
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

let fixDeleteReload = () => {
	setInterval(() => {
		var delBtn = document.querySelector('[role="dialog"] .fQfxa_dqAF.fQfxa_dRSL');
		if(delBtn !== null) {
			delBtn.parentNode.addEventListener('click', () => {
				setTimeout(() => {
					window.location = window.location.href;
				}, 500);
			});
		}
	}, 500);
};

let updateMoodlePairing = () => {
	var updateBtn = document.createElement('button');
	updateBtn.classList.add('Button', 'Button--warning');
	updateBtn.type = 'button';
	updateBtn.role = 'button';
	Object.assign(updateBtn.style, {
		margin: '8px'
	});
	updateBtn.innerHTML = '<i class="icon-progress"></i>&nbsp;Update Moodle Pairing';

	var updateForm = document.createElement('div');
	updateForm.id = 'updateForm';
	updateForm.innerHTML = '<label for="oldMoodle"><strong>Old Moodle</strong></label><label for="newMoodle"><strong>New Moodle</strong></label>';

	var formStyles = {
		display: 'block',
		height: '150px',
		width: '400px',
		resize: 'none'
	};
	var oldMoodle = document.createElement('textarea');
	oldMoodle.id = 'oldMoodle';
	Object.assign(oldMoodle.style, formStyles);
	var newMoodle = document.createElement('textarea');
	newMoodle.id = 'newMoodle';
	Object.assign(newMoodle.style, formStyles);
	updateForm.querySelector('[for="oldMoodle"]').appendChild(oldMoodle);
	updateForm.querySelector('[for="newMoodle"]').appendChild(newMoodle);

	var submitBtn = document.createElement('button');
	submitBtn.classList.add('btn', 'btn-primary');
	submitBtn.type = 'button';
	submitBtn.innerText = 'Update';
	submitBtn.addEventListener('click', () => {
		var canvasTools = [];
		var canvasAssignments = [];
		callAPI('GET', ['courses', viewID, 'external_tools'], 1, [{}], (tools) => {
			tools.forEach((tool) => {
				if((new RegExp('.*exam\.ecpi\.net\/enrol\/lti\/tool\.php.*')).test(tool.url)) {
					canvasTools.push([tool.id, tool.url]);
				}
			});

			callAPI('GET', ['courses', viewID, 'assignments'], 1, [{}], (assignments) => {
				assignments.forEach((assignment) => {
					if(assignment.external_tool_tag_attributes != undefined) {
						var tool = assignment.external_tool_tag_attributes;
						if((new RegExp('.*exam\.ecpi\.net\/enrol\/lti\/tool\.php.*')).test(tool.url)) {
							canvasAssignments.push([tool.content_id, assignment.id]);
						}
					}
				});

				var oldMoodleTools = oldMoodle.value.split(/\r?\n/);
				for(var i = 0; i < oldMoodleTools.length; i++) {
					if(oldMoodleTools[i] == '') {
						oldMoodleTools.splice(i, 1);
					} else {
						oldMoodleTools[i] = oldMoodleTools[i].split(/\t+/);
					}
				}

				var newMoodleTools = newMoodle.value.split(/\r?\n/);
				for(i = 0; i < newMoodleTools.length; i++) {
					if(newMoodleTools[i] == '') {
						newMoodleTools.splice(i, 1);
					} else {
						newMoodleTools[i] = newMoodleTools[i].split(/\t+/);
					}
				}

				console.log(oldMoodleTools, newMoodleTools, canvasTools, canvasAssignments);

				canvasTools.forEach((canvasTool, i) => {
					setTimeout(() => {
						oldMoodleTools.forEach((oldMoodleTool, j) => {
							if(canvasTool[1] == oldMoodleTool[2]) {
								callAPI('PUT', ['courses', viewID, 'external_tools', canvasTool[0]], 1, [{
									'name': newMoodleTools[j][0],
									'consumer_key': newMoodleTools[j][0],
									'shared_secret': newMoodleTools[j][1],
									'url': newMoodleTools[j][2],
									'privacy_level': 'public',
									'domain': null
								}], (tool) => {
									canvasAssignments.forEach(canvasAssignment => {
										if(canvasAssignment[0] == canvasTool[0]) {
											callAPI('PUT', ['courses', viewID, 'assignments', canvasAssignment[1]], 1, [{
												'assignment': {
													'external_tool_tag_attributes': {
														'content_id': canvasTool[0],
														'url': newMoodleTools[j][2],
														'new_tab': true
													}
												}
											}], assignment => {
												return;
											});
										}
									});
								});
							}
						});
					}, 2500 * i);
				});

				closeModal();
			});
		});
	});

	updateBtn.addEventListener('click', () => {
		generateModal('Update Moodle Pairing', updateForm, submitBtn);
	});

	var wait = setInterval(() => {
		var appBtn = document.querySelector('#external_tools header button');
		if(appBtn !== null) {
			clearInterval(wait);

			appBtn.parentNode.parentNode.appendChild(updateBtn);
		}
	}, 250);
};

(() => {
	fixDeleteReload();
	updateMoodlePairing();
})();