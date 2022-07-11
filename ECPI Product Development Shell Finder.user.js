// ==UserScript==
// @name         ECPI Product Development Shell Finder
// @include      /^https?:\/\/ecpi\.([^\.]*\.)?instructure\.com\/accounts\/\d+[^\/]*$/
// @version      0.2
// @require       https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js
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
 * @name               Is Object or Array Empty?
 * @description        Generic function for determing if a JavaScript object or array is empty
 * @return undefined
 */
function isEmpty(obj) {
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
}

	/**
	 * @name          Extend Arrays/Objects
	 * @description   Extends two arrays/objects
	 * @return array/object
	 */
	function extend(one, two) {
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
	}

	/**
	 * @name          Data-to-HTTP
	 * @description   Converts an object to HTTP parameters
	 * @return string
	 */
	function dataToHttp(obj) {
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
	}

	/**
	 * @name          Format Cookie Name
	 * @description   Returns cookie name formatted for site
	 * @return string
	 */
	function formatCookieName(name) {
		return url.match(/(?!\/\/)[a-zA-Z1-3]*(?=\.)/) + '_' + view + (viewID !== null ? '_' + viewID : '') + '_' + escape(name);
	}

	/**
	 * @name          Get Cookie by Name
	 * @description   Returns cookie value
	 * @return string
	 */
	function getCookie(name, format) {
		let value = document.cookie.match('(^|[^;]+)\\s*' + (typeof format !== 'undefined' && format ? formatCookieName(name) : name) + '\\s*=\\s*([^;]+)');
		return value !== null && value !== '' ? decodeURIComponent(value.pop()) : null;
	}

/**
 * @name          API Call
 * @description   Calls the Canvas API
 * @return undefined
 */
/*function callAPI(type, context, page, getVars, oncomplete, oncompleteInput, lastPage, firstCall, next) {
						console.log('1');
	var validContext = Object.prototype.toString.call(context);
	var callURL = url.match(/^.*(?:instructure\.com)/)[0] + '/api/v1';
	if(validContext) {
		context.forEach(function(contextLevel) {
			callURL += '/' + contextLevel;
		});
	}
	var i;
	if(type == 'GET') {
						console.log('2a');
		var audit = callURL.match(/audit/) !== null ? true : false;
		getVars = getVars === null ? [{}] : getVars;
		oncompleteInput = oncompleteInput === null ? function(output) { console.log(output); } : oncompleteInput;
		firstCall = typeof firstCall != 'undefined' ? firstCall : [{}];
		var expandedVars = getVars.slice(0);
		page = typeof page === 'undefined' ? (audit ? 'first' : 1) : page;
		expandedVars[0].page = page;
		expandedVars[0].per_page = 100;
		var compiledJSON = [];
		var callsToMake = [{callURL: callURL, data: $.extend(true, {}, expandedVars[0])}];
		if(page === 1 || audit || lastPage === -1) {
						console.log('2a1');
			$.when(callAJAX(type, callURL, expandedVars[0])).then(function(json, status, xhr) {
						console.log('2a1.');
				if(!audit && typeof next === 'undefined') {
						console.log('2a1a');
					if(xhr.getResponseHeader('Link') !== null) {
						console.log('2a1a1');
						var lastPage = xhr.getResponseHeader('Link').match(/\bpage=(\d+\b)(?=[^>]*>; rel="last")/);
						lastPage = lastPage === null ? -1 : parseInt(lastPage[1]);
						console.log('Last Page: ', lastPage);
						if(page < lastPage) {
						console.log('2a1a1a');
							callAPI(type, context, (page + 1), getVars, oncomplete, oncompleteInput, lastPage, json);
						} else if(lastPage === -1 && json.length === 100) {
						console.log('2a1a1b');
							callAPI(type, context, (page + 1), getVars, oncomplete, oncompleteInput, lastPage, json, true);
						} else {
						console.log('2a1a1c');
							oncomplete(json, oncompleteInput);
						}
					} else {
						console.log('2a1a2');
						oncomplete(json, oncompleteInput);
					}
				} else {
						console.log('2a1b');
					if(xhr.status != 200) {
						console.log('2a1b1');
						oncomplete({error: 'There was an error. Please try again.'});
					} else {
						console.log('2a1b2');
						var json = audit ? json.events : json;
						var results = (firstCall.length == 1 && isEmpty(firstCall[0])) ? json : $.merge(firstCall, json);
						if(json.length === 100) {
						console.log('2a1b2a');
							if(!audit) {
						console.log('2a1b2a1');
								page++;
								lastPage = -1;
								next = true;
							} else {
						console.log('2a1b2a2');
								page = xhr.getResponseHeader('link').match(/\bpage=[^&]*(?=[^>]*>; rel="next")/)[0].split('=')[1];
								lastPage = null;
								next = false;
							}
							callAPI(type, context, page, getVars, oncomplete, oncompleteInput, lastPage, results, next);
						} else {
						console.log('2a1b2b');
							oncomplete(results, oncompleteInput);
						}
					}
				}
			});
		} else {
						console.log('2a2');
			for(i = (page + 1), j = (callsToMake.length - 1); i <= lastPage; i++) {
				$.merge(callsToMake, [$.extend(true, {}, callsToMake[j])]);
				callsToMake[j].data.page = i;
			}
			var allCalls = callsToMake.map((currentSettings) => {
				return callAJAX(type, currentSettings.callURL, currentSettings.data);
			});
			$.when.apply($, allCalls).then(function() {
				$.each(arguments, function(index, value) {
					if($.isArray(value[0])) {
						$.merge(firstCall, value[0]);
					}
				});
				oncomplete(firstCall, oncompleteInput);
			});
		}
	} else {
						console.log('2b');
		callAJAX(type, callURL, getVars);
		oncomplete();
	}
	return;
}*/
	async function callAPI(type, context, page, getVars, oncomplete, oncompleteInput, lastPage, firstCall, next) {
		let validContext = Object.prototype.toString.call(context);
//		var callURL = url.match(/^.*(?:instructure\.com)/)[0] + '/api/v1';
		var callURL = url.split('/' + view + '/')[0] + '/api/v1';
		if(validContext) {
			context.forEach(function(contextLevel) {
				callURL += '/' + contextLevel;
			});
		}
		var i, j;
		if(type == 'GET' && callURL.match(/progress/) === null) {
			let audit = callURL.match(/audit/) !== null ? true : false;
			getVars = getVars === null ? [{}] : getVars;
			oncompleteInput = oncompleteInput === null ? ((output) => console.log(output)) : oncompleteInput;
			firstCall = typeof firstCall != 'undefined' ? firstCall : [{}];
			var expandedVars = getVars.slice(0);
			page = typeof page === 'undefined' ? (audit ? 'first' : 1) : page;
			expandedVars[0].page = page;
			expandedVars[0].per_page = 100;
			var callsToMake = {callURL: callURL, data: extend({}, expandedVars[0])};
			if(page === 1 || audit || lastPage === -1) {
				callAJAX(type, callURL, expandedVars[0]).then(function(response) {
					var json = JSON.parse(response.data.replace('while(1);', ''));
/*					if(!audit && typeof next === 'undefined') {
						if(typeof response.headers.link !== 'undefined') {
							var lastPage = response.headers.link.match(/\bpage=(\d+\b)(?=[^>]*>; rel="last")/);
							lastPage = lastPage === null ? -1 : parseInt(lastPage[1]);
							if(page < lastPage) {
								callAPI(type, context, (page + 1), getVars, oncomplete, oncompleteInput, lastPage, json);
							} else if(lastPage === -1 && response.data.length === 100) {
								callAPI(type, context, (page + 1), getVars, oncomplete, oncompleteInput, lastPage, json, true);
							} else {
								oncomplete(json, oncompleteInput);
							}
						} else {
							oncomplete(json, oncompleteInput);
						}
					} else {*/
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
//					}
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
					await Promise.all(currentCalls).then(function(results) {
						for(j = 0; j < results.length; j++) {
							let json = JSON.parse(results[j].data.replace('while(1);', ''));
							if(Array.isArray(json)) {
								firstCall = extend(firstCall, json);
							}
						}
					});
				}
				oncomplete(firstCall, oncompleteInput);

/*				for(i = (page + 1), j = (callsToMake.length - 1); i <= lastPage; i++) {
					var newCTM = JSON.parse(JSON.stringify(callsToMake[j]));
					newCTM.data.page = i;
					callsToMake.push(newCTM);
				}
				var allCalls = callsToMake.map(currentSettings => {
					return callAJAX(type, currentSettings.callURL, currentSettings.data);
				});
				Promise.all(allCalls).then(function(results) {
					for(i = 0; i < results.length; i++) {
						let json = JSON.parse(results[i].data.replace('while(1);', ''));
						if(Array.isArray(json)) {
							firstCall = extend(firstCall, json);
						}
					}
					oncomplete(firstCall, oncompleteInput);
				});*/
			}
		} else {
			callAJAX(type, callURL, getVars).then(function(response) {
				oncomplete(JSON.parse(response.data.replace('while(1);', '')), oncompleteInput);
			});
		}
		return;
	}

/**
 * @name          AJAX Call
 * @description   Calls the the specified URL with supplied data
 * @return obj    Full AJAX call is returned for processing elsewhere
 */
/*function callAJAX(type, callURL, data) {
	return $.ajax({
		type: type,
		url: callURL,
		data: data
	});
}*/
	async function callAJAX(type, callURL, data) {
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
		return { status: status, headers: headers, data: body };
	}

/**
 * @name               Create Modal Overlay
 * @description        Displays a modal overlay
 * @return undefined
 */
function createModalOverlay() {
	$('body').append($('<div></div>').attr('id', 'modalOverlay').css({
		position: 'fixed',
		top: 0,
		right: 0,
		bottom: 0,
		left: 0,
		background: 'rgba(52, 68, 79, 0.75) url("/dist/images/ajax-reload-animated-8255e06a8a.gif") 50% 50% no-repeat',
		zIndex: 1001
	}));
}

/**
 * @name               Load API-based Modal
 * @description        Displays a "loading" image while the API call is executed before loading the modal
 * @return undefined
 */
function loadAPIModal(apiCall) {
	createModalOverlay();
	apiCall();
}

/**
 * @name               Generate Modal
 * @description        Creates a custom modal
 * @return undefined
 */
function generateModal(title, content, footer, dimensions) {
	if($('#modalOverlay').length === 0) {
		createModalOverlay();
	}
	$('#modalOverlay').css({
		background: 'rgba(52, 68, 79, 0.75)'
	}).on('click', function(e) {
		e.preventDefault();
		closeModal();
	});
	$('body').append($('<div></div>').attr('id', 'modalContainer').css({
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
	}).html('<div style="padding: 16px 40px; border-bottom: 1px solid #d6d6d6; background: #ffffff; position: relative;"><span class="ui-dialog-title" role="heading" style="display: block; font-size: 21px; margin: 0 16px 0 0; text-shadow: rgba(255, 255, 255, 0.75) 0 1px 1px;">' + title + '</span><a href="#" class="ui-dialog-titlebar-close ui-corner-all" role="button" tabindex="0" style="display: block; position: absolute; top: 50%; right: 12px; width: 20px; height: 20px; margin: -10px 0 0; padding: 1px;"><span class="ui-icon ui-icon-closethick" style="margin: 1px; background-attachment: scroll; background-clip: border-box; background-color: rgba(0, 0, 0, 0); background-image: url(\'https://du11hjcvx0uqb.cloudfront.net/dist/images/icon-x-black-163c6230a4.svg\'); background-origin: padding-box; background-position: 50% 50%; background-repeat: no-repeat; background-size: 10px;">close</span></a></div><div style="padding: 10px 40px 10px; max-height: ' + (!isEmpty(dimensions) && dimensions[1] !== undefined ? '100%' : '400px') + '; overflow-x: hidden; overflow-y: auto;"></div>'));
//		$('body > div > div').last().append((content.jquery !== undefined ? content : $(content)));
	if(typeof content !== 'undefined' && content !== null) {
		$('#modalContainer > div').last().append((content.jquery !== undefined ? content : $(content)));
	}
	if(typeof footer !== 'undefined' && footer !== null) {
		$('#modalContainer').append($('<div />').css({
			borderTop: '1px solid #d6d6d6',
			backgroundColor: '#f2f2f2',
			color: '#222222',
			borderWidth: '1px 0 0',
			margin: '.5em 0 0',
			padding: '12px',
			textAlign: 'right'
		}).append(footer.jquery !== undefined ? footer : $(footer)));
	}
	$('#modalContainer .ui-dialog-titlebar-close').on('click', function(e) {
		e.preventDefault();
		closeModal();
	});
}

/**
 * @name               Close Modal
 * @description        Closes a custom modal
 * @return undefined
 */
function closeModal() {
	$('#modalOverlay').remove();
	$('#modalContainer').remove();
}

/**
 * @name   Prop-based Sorting (jQuery Extension)
 * @description   Calls $.sort() with prop values
 * @return sorted value
 */
Array.prototype.propSort = function(prop, sortFunc) {
	if(typeof prop === 'undefined') {
		if(isFunc(sortFunc)) {
			return this.sort(sortFunc);
		}
		return this.sort();
	}
	return this.sort(function(x, y) {
		var xSort = [];
		var ySort = [];
		x[prop].toString().toUpperCase().replace(/(\d+)|(\D+)/g, function($0, $1, $2) {
			xSort.push([$1 || Infinity, $2 || '']);
		});
		y[prop].toString().toUpperCase().replace(/(\d+)|(\D+)/g, function($0, $1, $2) {
			ySort.push([$1 || Infinity, $2 || '']);
		});
		while(xSort.length && ySort.length) {
			var xSortVal = xSort.shift();
			var ySortVal = ySort.shift();
			var comparison = xSortVal[0] - ySortVal[0] || xSortVal[1].localeCompare(ySortVal[1]);
			if(comparison) {
				return comparison;
			}
		}
		return xSort.length - ySort.length;
	});
};

/**
 * @name               Is It a Function?
 * @description        Generic function for determing if a JavaScript variable is a function
 * @return undefined
 */
function isFunc(func) {
	return {}.toString.call(func) === '[object Function]';
}

/**
 * @name          Load PD Finder
 * @description   Adds a button to the "Courses" list for locating PD shells
 * @return undefined
 */
function loadPDFinder() {
	if(/^https?:\/\/ecpi\.([^\.]*\.)?instructure\.com\/accounts\/\d+$/.test(url.split('?')[0])) {
		var lead = '#content span:contains("Hide courses without students")';
		var i = 0;
		var wait = setInterval(function() {
			if($(lead + ' button:contains("Course")').length > 0) {
				$(lead + ' button:contains("Course")').parent().append($('<button />').addClass('Button Button--success').attr({type: 'button', role: 'button', tabindex: 0}).css({marginLeft: $(lead + ' label').first().parent().css('paddingRight')}).html('<i class="icon-add"></i>&nbsp;Find QF Shells').on('click', findQFShells));
				$(lead + ' button:contains("Course")').parent().append($('<button />').addClass('Button Button--success').attr({type: 'button', role: 'button', tabindex: 0}).css({marginLeft: $(lead + ' label').first().parent().css('paddingRight')}).html('<i class="icon-add"></i>&nbsp;Find WRK Shells').on('click', findWRKShells));
				clearInterval(wait);
			} else if(i >= 30) {
				clearInterval(wait);
			}
			i++;
		}, 500);
	}
}

/**
 * @name         Find PD Shells
 * @description   Locates QUICKFIX shells
 * @return undefined
 */
function findQFShells() {
	findPDShells('QF');
}
function findWRKShells() {
	findPDShells('WRK');
}
function findPDShells(shellType) {
	loadAPIModal(function() {
		callAPI('GET', ['accounts', 1, 'courses'], 1, [{}], function(courses) {
			var nameRegex = shellType == 'QF' ? /^(\s*)QUICKFIX/ : /^(\s*)WORKING/;
			courses = $.grep(courses, function(course) {
				return !/^\s*?\d{4,}\w?/.test(course.name) && !/(OLD|OBSOLETE|Faculty Training|DO NOT USE)/.test(course.name) && nameRegex.test(course.name);
			});
			var goh = $.grep(courses, function(course) {
				return /\bGOH\b/.test(course.name);
			}).propSort('course_code');
			var ol = $.grep(courses, function(course) {
				return /\bOL\b/.test(course.name);
			}).propSort('course_code');
			var og = $.grep(courses, function(course) {
				return /\bOG\b/.test(course.name);
			}).propSort('course_code');
			var hyb = $.grep(courses, function(course) {
				return /\bHYB\b/.test(course.name);
			}).propSort('course_code');
			var de = $.grep(courses, function(course) {
				return /\bDE\d+?\b/.test(course.name);
			}).propSort('course_code');
			var ce = $.grep(courses, function(course) {
				return /\bCE\b/.test(course.name);
			}).propSort('course_code');
//			var mm = $.grep(courses, function(course) {
//				return /\b(MM|CUR101)\b/.test(course.name);
//			}).propSort('course_code');
			var results = '';
//			for(var i = 0; i < courses.length; i++) {
//				results += courses[i].name + "\thttps://ecpi.instructure.com/courses/" + course[i]s.id + "\n";
//			}
			var i;
			var started = false;
//			if(mm.length > 0) {
//				started = true;
//				results += 'MM\n';
//				for(i = 0; i < mm.length; i++) {
//					results += mm[i].name + "\thttps://ecpi.instructure.com/courses/" + mm[i].id + "\n";
//				}
//			}
			if(ce.length > 0) {
				results += (started ? "\n" : '') + "CE\n";
				started = true;
				for(i = 0; i < ce.length; i++) {
					results += ce[i].name + "\thttps://ecpi.instructure.com/courses/" + ce[i].id + "\n";
				}
			}
			if(de.length > 0) {
				results += (started ? "\n" : '') + "DE\n";
				started = true;
				for(i = 0; i < de.length; i++) {
					results += de[i].name + "\thttps://ecpi.instructure.com/courses/" + de[i].id + "\n";
				}
			}
			if(goh.length > 0) {
				results += (started ? "\n" : '') + "GOH\n";
				started = true;
				for(i = 0; i < goh.length; i++) {
					results += goh[i].name + "\thttps://ecpi.instructure.com/courses/" + goh[i].id + "\n";
				}
			}
			if(hyb.length > 0) {
				results += (started ? "\n" : '') + "HYB\n";
				started = true;
				for(i = 0; i < hyb.length; i++) {
					results += hyb[i].name + "\thttps://ecpi.instructure.com/courses/" + hyb[i].id + "\n";
				}
			}
			if(og.length > 0) {
				results += (started ? "\n" : '') + "OG\n";
				started = true;
				for(i = 0; i < og.length; i++) {
					results += og[i].name + "\thttps://ecpi.instructure.com/courses/" + og[i].id + "\n";
				}
			}
			if(ol.length > 0) {
				results += (started ? "\n" : '') + "OL\n";
				started = true;
				for(i = 0; i < ol.length; i++) {
					results += ol[i].name + "\thttps://ecpi.instructure.com/courses/" + ol[i].id + "\n";
				}
			}
			generateModal('List of ' + (shellType == 'QF' ? 'QUICKFIX' : 'WORKING') + ' Shells', '<textarea style="width: auto; margin: 0;" rows="18" cols="100">' + results + '</textarea>');
		});
	});
}

window.onload = function() {
	var css = document.createElement('style');
	css.innerHTML = '#wrapper { max-width: none; }';
	var head = document.head || document.querySelector('head') || document.getElementsByTagName('head')[0];
	head.appendChild(css);

	window.$ = window.jQuery = jQuery.noConflict(true);
	loadPDFinder();
};
