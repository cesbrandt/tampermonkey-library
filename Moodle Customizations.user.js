// ==UserScript==
// @name         Moodle Customizations
// @version      0.1
// @updateURL    https://github.com/cesbrandt/tampermonkey-library/raw/main/Moodle%20Customizations.user.js
// @match        https://exam.ecpi.net/*
// ==/UserScript==

let triggerEvent = (eventName, element) => {
	var event = document.createEvent('HTMLEvents');
	event.initEvent(eventName, false, true);
	element.dispatchEvent(event);
	return;
};

let buildVarObj = (str) => {
	var varObj = {};
	var vars = str.split('?');
	if(vars.length > 1) {
		vars = vars[1].split('&');
		for(var i in vars) {
			vars[i] = vars[i].split('=');
			varObj[vars[i][0]] = vars[i][1];
		}
	}
	return varObj;
};

let serialize = (obj, prefix) => {
	var pairs = [];
	for(var pair in obj) {
		if(obj.hasOwnProperty(pair)) {
			var key = prefix ? prefix + '[' + pair + ']' : pair;
			var value = obj[pair];
			pairs.push((value !== null && typeof value === 'object') ? serialize(value, key) : encodeURIComponent(key) + '=' + encodeURIComponent(value));
		}
	}

	return pairs.join('&');
};

let createModal = (modalContent) => {
	var modals = document.querySelectorAll('.cs-modal');
	if(modals.length > 0) {
		modals.forEach(modal => {
			modal.querySelector('.close').click();
		});
	}

	// Definitions
	let modal = document.createElement("div"),
		modalStyle = document.createElement("style"),
//		modalCSS = '.js-modal { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: rgba(0, 0, 0, .1); max-width: 650px; border-radius: 5px; } .js-modal img, .js-modal iframe, .js-modal video { max-width: 100%; } .js-modal-inner { position: relative; padding: 10px; } .js-modal-close { position: absolute; top: -10px; right: -10px; background-color: black; color: #eee; border-width: 0; font-size: 10px; height: 24px; width: 24px; border-radius: 100%; text-align: center; }',
		modalCSS = '.cs-modal { position: fixed; z-index: 9999999999; top: 0; right: 0; bottom: 0; left: 0; overflow: auto; background-color: rgba(41, 94, 168, 0.4); } .cs-modal .content { position: absolute; left: 50%; top: 50%; -webkit-transform: translate(-50%, -50%); trandsform: translate(-50%, -50%); background-color: #fefefe; padding: 15px; border: 1px solid #888888; } .cs-modal .close { color: #aaaaaa; float: right; font-size: 28px; font-weight: bold; text-decoration: none; } .cs-modal .close:hover, .cs-modal .close:focus { color: #000000; cursor: pointer; } .cs-modal .close::after { content: \'\'; clear: both; } .cs-modal .body { margin-top: 25px; } ',
//		modalClose = '<button class="js-modal-close" id="js_modal_close">X</button>',
		modalClose = '<span class="close">&times;</span>',
		theBody = document.getElementsByTagName('body')[0],
		theHead = document.getElementsByTagName('head')[0];

	// Add content and attributes to the modal
//	modal.setAttribute("class", "js-modal");
	modal.setAttribute('class', 'cs-modal');
//	modal.innerHTML = '<div class="js-modal-inner">' + modalContent + modalClose + '</div>';
	modal.innerHTML = '<div class="content">' + modalClose + '<div class="body">' + modalContent + '</div></div>';
	theBody.appendChild(modal);

//	modalClose = document.querySelector("#js_modal_close");
	modalClose = document.querySelector('.cs-modal .close');

	// Add the modal styles dynamically
	if(modalStyle.styleSheet) {
		modalStyle.styleSheet.cssText = modalCSS;
	} else {
		modalStyle.appendChild(document.createTextNode(modalCSS));
	}
	theHead.appendChild(modalStyle);

	// Close the modal on button-click
	if(modalClose) {
		modalClose.addEventListener('click', () => {
			modal.remove();
			modalStyle.remove();
		});
		modal.addEventListener('click', e => {
			if(e.target == modal) {
				modal.remove();
				modalStyle.remove();
			}
		});
	}
};

// SysRole Block Configuration
let addSysRoleBtn = () => {
	var defaultSysRole = document.createElement('input');
	defaultSysRole.setAttribute('class', 'btn btn-warning');
	defaultSysRole.value = 'Set Default "SysRole"';
	defaultSysRole.type = 'button';
	defaultSysRole.style.marginLeft = '10px';
	defaultSysRole.addEventListener('click', (e) => {
		e.preventDefault();

		document.querySelector('#id_config_title').value = 'SysRole';
		document.querySelector('#id_config_context').value = 'system';
		document.querySelector('#id_config_display').value = 'highest';
		document.querySelector('#id_bui_pagetypepattern').value = '*';
		document.querySelector('#id_bui_defaultregion').value = 'side-pre';
		document.querySelector('#id_bui_defaultweight').value = 2;
		document.querySelector('#id_bui_visible').value = 1;
		document.querySelector('#id_bui_region').value = 'side-pre';
		document.querySelector('#id_bui_weight').value = 2;

		var attoEditors = document.querySelectorAll('.editor_atto_wrap');
		if(attoEditors.length > 0) {
			attoEditors.forEach((atto) => {
				var toggle = atto.querySelector('.editor_atto_toolbar button[title="HTML"]');
				var rce = atto.querySelector('[id^="id_config_text_"][id$="table"]');
				var vis = rce.style.display != 'none';
				if(vis) {
					toggle.click();
				}
				var cm = atto.querySelector('.CodeMirror').CodeMirror;
				var val = cm.getTextArea().getAttribute('id').split('_')[3] == 1 ? 'qb_import' : '';
				cm.setValue(val);
				if(vis) {
					toggle.click();
				}
			});
		} else {
			document.querySelector('#id_config_text_all').value = '';
			document.querySelector('#id_config_text_1').value = 'qb_import';
			document.querySelector('#id_config_text_3').value = '';
			document.querySelector('#id_config_text_4').value = '';
			document.querySelector('#id_config_text_5').value = '';
			document.querySelector('#id_config_text_9').value = '';
			if(typeof tinyMCE !== 'undefined') {
				tinyMCE.editors.forEach((editor) => {
					editor.setContent(document.querySelector('#' + editor.id).value);
				});
			}
		}

		document.querySelector('#id_submitbutton').click();
	});
	document.querySelector('#region-main [role="main"] .mform .collapsible-actions').appendChild(defaultSysRole);

	return;
};

// Module List Inline Edit Links
let moduleInlineEdit = () => {
	var style = document.createElement('style');
	style.innerHTML = '.topics .actions .dropdown a[id^="dropdown-"], .topics .actions .dropdown-menu .menu-action-text, #categoryquestions .editmenu .dropdown a[id^="action-menu-toggle-"], #categoryquestions .editmenu .dropdown-menu .menu-action-text { display: none; } .topics .actions .menubar, #categoryquestions .editmenu .dropdown-menu { position: absolute; right: 0; width: 100%; } .topics .actions .dropdown { width: 100%; } .topics .actions .dropdown-menu { right: 0; left: auto; } .topics .actions .dropdown-menu, .topics .actions .dropdown-menu .dropdown-item, #categoryquestions .editmenu .dropdown-menu .dropdown-item { display: inline-block; width: unset; padding: 0; pointer-events: auto; top: -3px; } .topics .actions .dropdown-menu .dropdown-item { padding: .25rem; } .topics .actions .action-menu { width: 100%; position: absolute; right: 0; } .topics .actions { width: 100%; flex-direction: row-reverse; pointer-events: none; }';
	document.head.appendChild(style);
	document.getElementById('page-content').removeChild(document.getElementById('block-region-side-post'));

	return;
};

// Show all Enrollments
let showAllEnrollments = () => {
	GETS.perpage = 5000;
	window.location = window.location.protocol + '//' + window.location.hostname + window.location.pathname + '?' + serialize(GETS);

	return;
};

// Delete all Enrollments
let deleteAllEnrollments = () => {
	var userList = document.querySelectorAll('.userlist .no-overflow tr[id^="user-index-participants-"]:not(.emptyrow)');
	if(userList.length > 0) {
		var hasStudent = false;
		userList.forEach((user) => {
			var eMail = user.querySelector('.c2').innerText.trim();
			if(!eMail.endsWith('@ecpi.edu') && !eMail.endsWith('@example.com') && !eMail.endsWith('@chefva.com') && !eMail.endsWith('@mttsvc.com')) {
				hasStudent = true;
			}
		});

		if(!hasStudent) {
			var delAll = document.createElement('input');
			delAll.setAttribute('class', 'btn btn-danger my-1');
			delAll.value = 'Delete All Enrollments';
			delAll.type = 'button';
			document.querySelectorAll('#region-main [role="main"] .justify-content-end').forEach((float) => {
				var newBtn = delAll.cloneNode();
				newBtn.addEventListener('click', () => {
					userList.forEach((user) => {
						user.querySelectorAll('[id$=_c7] .unenrollink').forEach((btn) => {
							btn.click();
						});
						setTimeout(() => {
							document.querySelectorAll('#page-course-view-topics .modal.show .modal-footer > button.btn.btn-primary').forEach((btn) => {
								btn.click();
							});
							setTimeout(() => {
								window.location = window.location.href;
							}, 2500);
						}, 5000);
					});
				});
				var sinBtn = document.createElement('div');
				sinBtn.setAttribute('class', 'singlebutton');
				sinBtn.appendChild(newBtn);
				float.appendChild(sinBtn);
			});
		}
	}

	return;
};

// LTI Providers Title Input and Top "Add" Button
let ltiList = () => {
	// Create top "Add" button
	var top = document.querySelector('[role="main"] .helplink');
	var addBtn = document.querySelector('.singlebutton').cloneNode(true);
	addBtn.querySelector('form').style.display = 'inline-block';

	// Add config export button
	var cfgBtn = document.createElement('input');
	cfgBtn.setAttribute('class', 'btn btn-warning');
	cfgBtn.value = 'Export Config';
	cfgBtn.addEventListener('click', () => {
		var list = '';
		document.querySelectorAll('tr[id^="enrol_lti_manage_table_r"]:not(.emptyrow)').forEach((lti) => {
			var data = lti.querySelectorAll('input.copy_box');
			list += data[0].value + "\t" + data[2].value + "\t" + data[3].value + "\n";
			createModal('<textarea readonly="readonly" style="width: 1000px; height: 250px;" onfocus="this.select();">' + list + '</textarea>');
			document.querySelector('.cs-modal textarea').focus();
		});
	});
	addBtn.appendChild(cfgBtn);
	top.parentNode.insertBefore(addBtn, top.nextSibling);

	// Convert LTI titles to input fields
	document.querySelectorAll('[id^="enrol_lti_manage_table_r"]:not(.emptyrow) td.c0').forEach((title) => {
		title.innerHTML = '<div><input type="text" class="copy_box" value="' + title.innerText.trim() + '" readonly="readonly" /></div>';
	});
	return;
};

// Import Settings
let importSettings = () => {
	if(document.querySelector('#id_setting_root_blocks') !== null) {
		['id_setting_root_permissions', 'id_setting_root_files', 'id_setting_root_filters', 'id_setting_root_calendarevents', 'id_setting_root_groups', 'id_setting_root_competencies', 'id_setting_root_legacyfiles'].forEach(id => {
			document.querySelector('#' + id).checked = false;
		});

		['id_setting_root_activities', 'id_setting_root_blocks', 'id_setting_root_questionbank', 'id_setting_root_customfield', 'id_setting_root_contentbankcontent'].forEach(id => {
			document.querySelector('#' + id).checked = true;
		});
	}
};

/**
 * Variable setup
 */
var url = window.location.href;
var path = window.location.pathname;
var GETS = buildVarObj(window.location.search);

window.onload = () => {
	'use strict';

	console.log(GETS);

	if('bui_editid' in GETS && 'id' in GETS && GETS.bui_editid != undefined && GETS.id != undefined) {
		// SysRole Block Configuration
		addSysRoleBtn();
	} else {
		switch(path) {
			case '/course/view.php':
				// Module List Inline Edit Links
				moduleInlineEdit();
				break;
			case '/user/index.php':
				if(GETS.perpage == undefined) {
					// Show all Enrollments
					showAllEnrollments();
				} else {
					// Delete all Enrollments
					deleteAllEnrollments();
				}
				break;
			case '/enrol/lti/index.php':
				ltiList();
				break;
			case '/backup/import.php':
				importSettings();
				break;
		}
	}
};