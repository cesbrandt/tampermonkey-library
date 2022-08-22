// ==UserScript==
// @name         JSON Tree Builder 0.3
// @version      0.3
// @updateURL    https://github.com/cesbrandt/tampermonkey-library/raw/main/JSON%20Tree%20Builder%200.3.user.js
// @include      /^https?:\/\/[^\.]*\.([^\.]*\.)?instructure\.com\/api\/v1.*$/
// @include      /^https?:\/\/[^\.]*\.sf-api\.com.*$/
// @include      /^https?:\/\/[^\.]*\.instructuremedia\.com\/api\/.*$/
// @grant        none
// ==/UserScript==

/**
 * @name              Function Extender
 * @description       Extends a function into subfunctions
 * @return function   Extended function
 */
let extend = (func, props) => {
	for(var prop in props) {
		if(props.hasOwnProperty(prop)) {
			func[prop] = props[prop];
		}
	}
	return func;
};

var module, window, define;
let _renderjson = (json, indent, dont_indent, show_level, options) => {
	var my_indent = dont_indent ? "" : indent;

	let disclosure = (open, placeholder, close, type, builder) => {
		var content, empty = span(type);
		let show = function() {
			if(!content) {
				append(empty.parentNode, content = prepend(builder(), A("", "disclosure " + options.hide, () => {
					content.style.display = "none";
					empty.style.display = "inline";
				})));
			}
			content.style.display = "inline";
			empty.style.display = "none";
		};
		append(empty, A("", "disclosure " + options.show, show), themetext(type + " syntax", open), A(placeholder, null, show), themetext(type + " syntax", close));

		var el = append(span(), text(my_indent.slice(0, -1)), empty);
		if(show_level > 0 && type != "string") {
			show();
		}
		return el;
	};

	if(json === null) {
		return themetext(null, my_indent, "keyword", "null");
	}
	if(json === void 0) {
		return themetext(null, my_indent, "keyword", "undefined");
	}

	if(typeof(json) == "string" && json.length > options.max_string_length) {
		return disclosure('"', json.substr(0, options.max_string_length) + " ...", '"', "string", () => {
			return append(span("string"), themetext(null, my_indent, "string", JSON.stringify(json)));
		});
	}

	if(typeof(json) != "object" || [Number, String, Boolean, Date].indexOf(json.constructor) >= 0) { // Strings, numbers and bools
		return themetext(null, my_indent, typeof(json), JSON.stringify(json));
	}

	if(json.constructor == Array) {
		if(json.length == 0) {
			return themetext(null, my_indent, "array syntax", "[]");
		}

		return disclosure("[", options.collapse_msg(json.length), "]", "array", () => {
			var as = append(span("array"), themetext("array syntax", "[", null, "\n"));
			for(var i = 0; i < json.length; i++) {
				append(as, _renderjson(options.replacer.call(json, i, json[i]), indent + "    ", false, show_level - 1, options), (i != json.length-1 ? themetext("syntax", ",") : []), text("\n"));
			}
			append(as, themetext(null, indent, "array syntax", "]"));
			return as;
		});
	}

	// object
	if(isempty(json, options.property_list)) {
		return themetext(null, my_indent, "object syntax", "{}");
	}

	return disclosure("{", options.collapse_msg(Object.keys(json).length), "}", "object", () => {
		var os = append(span("object"), themetext("object syntax", "{", null, "\n"));
		for(var k in json) {
			var last = k;
		}
		var keys = options.property_list || Object.keys(json);
		if(options.sort_objects) {
			keys = keys.sort();
		}
		for(var i in keys) {
			k = keys[i];
			if(!(k in json)) {
				continue;
			}
			append(os, themetext(null, indent + "    ", "key", '"' + k + '"', "object syntax", ': '), _renderjson(options.replacer.call(json, k, json[k]), indent + "    ", true, show_level - 1, options), (k != last ? themetext("syntax", ",") : []), text("\n"));
		}
		append(os, themetext(null, indent, "object syntax", "}"));
		return os;
	});
};
let themetext = (...arguments/* [class, text]+ */) => {
	var spans = [];
	while(arguments.length) {
		spans.push(append(span(Array.prototype.shift.call(arguments)), text(Array.prototype.shift.call(arguments))));
	}
	return spans;
};
let append = (...arguments/* el, ... */) => {
	var el = Array.prototype.shift.call(arguments);
	for(var a = 0; a < arguments.length; a++) {
		if(arguments[a].constructor == Array) {
			append.apply(this, [el].concat(arguments[a]));
		} else {
			el.appendChild(arguments[a]);
		}
	}
	return el;
};
let prepend = (el, child) => {
	el.insertBefore(child, el.firstChild);
	return el;
};
let isempty = (obj, pl) => {
	var keys = pl || Object.keys(obj);
	for(var i in keys) {
		if(Object.hasOwnProperty.call(obj, keys[i])) {
			return false;
		}
		return true;
	}
};
let text = (txt) => {
	return document.createTextNode(txt);
};
let div = () => {
	return document.createElement("div");
};
let span = (classname) => {
	var s = document.createElement("span");
	if(classname) {
		s.className = classname;
	}
	return s;
};
let A = (txt, classname, callback) => {
	var a = document.createElement("a");
	if(classname) {
		a.className = classname;
	}
	a.appendChild(text(txt));
	a.href = '#';
	a.onclick = (e) => {
		callback();
		if(e) {
			e.stopPropagation();
			return false;
		}
	}
	return a;
};

let renderjson = extend((json) => {
	return renderjson.init(typeof json == 'string' ? JSON.parse(json) : json);
}, {
	options: {},
	init: (json) => {
		renderjson.set_icons('expand', 'collapse');
		renderjson.set_show_by_default(true);
		renderjson.set_sort_objects(false);
		renderjson.set_max_string_length("none");
		renderjson.set_replacer(void 0);
		renderjson.set_property_list(void 0);
		renderjson.set_collapse_msg((len) => {
			return "..." + len + " item" + (len == 1 ? "" : "s") + "...";
		});

		renderjson.options.replacer = typeof(renderjson.options.replacer) == "function" ? renderjson.options.replacer : function(k,v) {
			return v;
		};
		var pre = append(document.createElement("pre"), _renderjson(json, "", false, renderjson.options.show_to_level, renderjson.options));
		pre.className = "renderjson";
		return pre;
	},
	set_icons: (show, hide) => {
		renderjson.options.show = show;
		renderjson.options.hide = hide;
	},
	set_show_to_level: (level) => {
		renderjson.options.show_to_level = typeof level == "string" && level.toLowerCase() === "all" ? Number.MAX_VALUE : level;
	},
	set_max_string_length: (length) => {
		renderjson.options.max_string_length = typeof length == "string" && length.toLowerCase() === "none" ? Number.MAX_VALUE : length;
	},
	set_sort_objects: (sort_bool) => {
		renderjson.options.sort_objects = sort_bool;
	},
	set_replacer: (replacer) => {
		renderjson.options.replacer = replacer;
	},
	set_collapse_msg: (collapse_msg) => {
		renderjson.options.collapse_msg = collapse_msg;
	},
	set_property_list: (prop_list) => {
		renderjson.options.property_list = prop_list;
	},
	// Backwards compatiblity. Use set_show_to_level() for new code.
	set_show_by_default: (show) => {
		renderjson.options.show_to_level = show ? Number.MAX_VALUE : 0;
	}
});

let prettyPrint = (json, indentation) => {
	return JSON.stringify(JSON.parse(json.replace('while(1);', '')), null, indentation);
};

(() => {
	'use strict';

	if(define) {
		define({renderjson:renderjson});
	} else {
		(module || {}).exports = (window || {}).renderjson = renderjson;
	}

	let head = document.head || document.getElementsByTagName('head')[0];
	let style = document.createElement('style');
//	style.innerHTML = '.renderjson a { text-decoration: none; } .renderjson .disclosure { color: crimson; font-size: 150%; } .renderjson .syntax { color: grey; } .renderjson .string { color: darkred; } .renderjson .number { color: darkcyan; } .renderjson .boolean { color: blueviolet; } .renderjson .key { color: darkblue; } .renderjson .keyword { color: blue; } .renderjson .object.syntax { color: lightseagreen; } .renderjson .array.syntax  { color: orange; }';
	style.innerHTML = 'body { background-color: #212121; } .renderjson a { color: #999999; text-decoration: none; } .renderjson .disclosure { display: inline-block; margin: .4em .8em; position: relative; } .renderjson .disclosure::before { position: absolute; content: \'\'; width: 0; height: 0; border: .4em solid transparent; border-left-color: #999999; transform-origin: 25% 25%; top: -.4em; } .renderjson .disclosure.collapse::before { transform: rotate(90deg); top: 0; } .renderjson .syntax { color: grey; } .renderjson .string { color: #c3e88d; } .renderjson .number { color: #ff5370; } .renderjson .boolean { color: #348aa7; } .renderjson .key { color: #c792ea; } .renderjson .keyword { color: #f78c6c; } .renderjson .object.syntax { color: #00bb00; } .renderjson .array.syntax  { color: #36827f; }';
	head.appendChild(style);

	let body = document.body || document.getElementsByTagName('body')[0];
	let json = renderjson(JSON.parse(body.innerText.trim().replace('while(1);', '')));
	body.innerHTML = '';
	body.appendChild(json);
})();
