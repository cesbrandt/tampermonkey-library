// ==UserScript==
// @name         Canvas Expand Edit Column
// @version      0.1
// @updateURL    https://github.com/cesbrandt/tampermonkey-library/raw/main/Canvas%20Expand%20Edit%20Column.user.js
// @include      /^https?:\/\/[^\.]*\.([^\.]*\.)?instructure\.com\/courses\/\d+[^\/]*\/assignments\/\d+[^\/]*\/edit.*$/
// @grant        none
// ==/UserScript==

(() => {
	var css = document.createElement('style');
	css.innerHTML = '.form-column-right { width: 760px !important; } .form-column-right > input, .form-column-right > textarea, .form-column-right > select { width: 100%; }';
	document.head.appendChild(css);
})();