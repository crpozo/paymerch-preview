/* Paymerch theme — front-end behaviour (no dependencies). */
(function () {
	'use strict';

	var root = document.documentElement;

	/* 1. Fluid scale: 1rem = viewport width / 192 (scrollbar excluded). */
	function setViewportVar() {
		root.style.setProperty('--vw', root.clientWidth + 'px');
	}
	setViewportVar();
	window.addEventListener('resize', setViewportVar);
	window.addEventListener('orientationchange', setViewportVar);

	/* 2. Mobile navigation toggle. */
	var toggle = document.querySelector('.pm-nav-toggle');
	var nav = document.getElementById('pm-nav');
	if (toggle && nav) {
		toggle.addEventListener('click', function () {
			var open = root.classList.toggle('pm-nav-open');
			toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
		});
		nav.addEventListener('click', function (e) {
			if (e.target.closest('a')) {
				root.classList.remove('pm-nav-open');
				toggle.setAttribute('aria-expanded', 'false');
			}
		});
	}

	/* 3. Local Rails: expand one corridor card, collapse the other. */
	var grid = document.querySelector('[data-rails]');
	if (grid) {
		var rails = Array.prototype.slice.call(grid.querySelectorAll('[data-rail]'));
		var hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

		var openRail = function (target) {
			rails.forEach(function (rail) {
				var isTarget = rail === target;
				rail.classList.toggle('is-open', isTarget);
				rail.classList.toggle('is-collapsed', !!target && !isTarget);
				var btn = rail.querySelector('[data-rail-toggle]');
				if (btn) { btn.setAttribute('aria-expanded', isTarget ? 'true' : 'false'); }
			});
			grid.classList.toggle('has-open', !!target);
		};

		rails.forEach(function (rail) {
			var btn = rail.querySelector('[data-rail-toggle]');
			if (hoverCapable) {
				rail.addEventListener('mouseenter', function () { openRail(rail); });
			}
			if (btn) {
				btn.addEventListener('click', function () { openRail(rail.classList.contains('is-open') ? null : rail); });
				btn.addEventListener('focus', function () { openRail(rail); });
			}
		});
		if (hoverCapable) {
			grid.addEventListener('mouseleave', function () { openRail(null); });
		}
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') { openRail(null); }
		});

		/* Deep link: /#rail-mexico or /#rail-colombia opens that corridor card. */
		var hashRail = (window.location.hash.match(/^#rail-([a-z]+)$/) || [])[1];
		if (hashRail) {
			var railTarget = grid.querySelector('.pm-rail--' + hashRail);
			if (railTarget) {
				openRail(railTarget);
				railTarget.scrollIntoView({ block: 'center' });
			}
		}

		/* Accordion inside each card. */
		grid.querySelectorAll('[data-acc]').forEach(function (accBtn) {
			accBtn.addEventListener('click', function (e) {
				e.stopPropagation();
				var item = accBtn.closest('.pm-acc__item');
				var list = accBtn.closest('.pm-acc');
				var wasOpen = item.classList.contains('is-open');
				list.querySelectorAll('.pm-acc__item').forEach(function (li) {
					li.classList.remove('is-open');
					li.querySelector('[data-acc]').setAttribute('aria-expanded', 'false');
				});
				if (!wasOpen) {
					item.classList.add('is-open');
					accBtn.setAttribute('aria-expanded', 'true');
				}
			});
		});
	}

	/* 4. Smooth-scroll for in-page anchors. */
	document.addEventListener('click', function (e) {
		var link = e.target.closest('a[href*="#"]');
		if (!link) { return; }
		var url = new URL(link.href, window.location.href);
		if (url.pathname !== window.location.pathname || url.hash.length < 2) { return; }
		var target = document.getElementById(url.hash.slice(1));
		if (!target) { return; }
		e.preventDefault();
		target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		history.pushState(null, '', url.hash);
	});

	/* 5. Transfer calculator + Wise-style currency picker inside the phone screens. */
	var money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	var SVG_NS = 'http://www.w3.org/2000/svg';

	function toNumber(str) {
		var clean = String(str).replace(/[^0-9.]/g, '');
		var parts = clean.split('.');
		if (parts.length > 2) { clean = parts.shift() + '.' + parts.join(''); }
		var n = parseFloat(clean);
		return isFinite(n) ? n : 0;
	}
	function byCode(list, code) {
		for (var i = 0; i < list.length; i++) {
			if (list[i].code === code) { return list[i]; }
		}
		return null;
	}
	function checkIcon() {
		var svg = document.createElementNS(SVG_NS, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		svg.setAttribute('class', 'pm-picker__check');
		var path = document.createElementNS(SVG_NS, 'path');
		path.setAttribute('d', 'M5 12.5l4.5 4.5L19 7.5');
		path.setAttribute('fill', 'none');
		path.setAttribute('stroke', 'currentColor');
		path.setAttribute('stroke-width', '2.2');
		path.setAttribute('stroke-linecap', 'round');
		path.setAttribute('stroke-linejoin', 'round');
		svg.appendChild(path);
		return svg;
	}

	document.querySelectorAll('[data-calc]').forEach(function (calc) {
		var data = JSON.parse(calc.getAttribute('data-currencies') || '{}');
		if (!data.send || !data.receive || !data.receive.length) { return; }

		var fee = parseFloat(calc.getAttribute('data-fee')) || 0;
		var send = calc.querySelector('[data-calc-send]');
		var receive = calc.querySelector('[data-calc-receive]');
		var rateText = calc.querySelector('[data-calc-rate]');
		var picker = calc.querySelector('[data-picker]');
		var search = picker.querySelector('[data-picker-search]');
		var list = picker.querySelector('[data-picker-list]');
		var empty = picker.querySelector('[data-picker-empty]');
		var group = picker.querySelector('[data-picker-group]');
		var MAX_SEND = 999999.99;
		var state = { send: data.send[0].code, receive: data.receive[0].code };
		var side = null;
		var trigger = null;
		var visible = [];
		var active = -1;

		function rate() {
			var c = byCode(data.receive, state.receive);
			return c ? c.rate : 0;
		}
		/* Shrink long numbers so they never collide with the currency pill. */
		function fit(input) {
			input.style.setProperty('--amt-fit', Math.min(1, 8.6 / Math.max(input.value.length, 1)).toFixed(3));
		}
		function fromSend() {
			var s = Math.min(toNumber(send.value), MAX_SEND);
			receive.value = money.format(Math.max(0, s - fee) * rate());
			fit(send); fit(receive);
		}
		function fromReceive() {
			var r = toNumber(receive.value);
			var s = r > 0 && rate() > 0 ? r / rate() + fee : 0;
			send.value = money.format(Math.min(s, MAX_SEND));
			fit(send); fit(receive);
		}

		function updatePill(which) {
			var c = byCode(data[which], state[which]);
			var btn = calc.querySelector('[data-picker-open="' + which + '"]');
			if (!c || !btn) { return; }
			btn.querySelector('[data-pill-flag]').src = c.flag;
			btn.querySelector('[data-pill-code]').textContent = c.code;
		}
		function setActive(i) {
			var items = list.children;
			active = i;
			for (var k = 0; k < items.length; k++) { items[k].classList.toggle('is-active', k === i); }
			if (i < 0 || !items[i]) {
				search.removeAttribute('aria-activedescendant');
				return;
			}
			search.setAttribute('aria-activedescendant', items[i].id);
			var top = items[i].offsetTop;
			var bottom = top + items[i].offsetHeight;
			if (top < list.scrollTop) { list.scrollTop = top; }
			else if (bottom > list.scrollTop + list.clientHeight) { list.scrollTop = bottom - list.clientHeight; }
		}
		function render() {
			var q = search.value.trim().toLowerCase();
			var selected = 0;
			visible = data[side].filter(function (c) {
				return !q || (c.code + ' ' + c.name + ' ' + c.country).toLowerCase().indexOf(q) > -1;
			});
			list.textContent = '';
			visible.forEach(function (c, i) {
				var isSelected = c.code === state[side];
				if (isSelected) { selected = i; }
				var li = document.createElement('li');
				li.id = picker.id + '-' + c.code;
				li.className = 'pm-picker__opt';
				li.setAttribute('role', 'option');
				li.setAttribute('aria-selected', isSelected ? 'true' : 'false');
				var img = document.createElement('img');
				img.src = c.flag;
				img.alt = '';
				img.width = 40;
				img.height = 40;
				var code = document.createElement('span');
				code.className = 'pm-picker__code';
				code.textContent = c.code;
				var name = document.createElement('span');
				name.className = 'pm-picker__name';
				name.textContent = c.name;
				li.appendChild(img);
				li.appendChild(code);
				li.appendChild(name);
				if (isSelected) { li.appendChild(checkIcon()); }
				li.addEventListener('click', function () { choose(c.code); });
				li.addEventListener('mouseenter', function () { setActive(i); });
				list.appendChild(li);
			});
			empty.hidden = visible.length > 0;
			setActive(visible.length ? (q ? 0 : selected) : -1);
		}
		function openPicker(which, btn) {
			if (side) { closePicker(false); }
			side = which;
			trigger = btn;
			group.textContent = group.getAttribute(which === 'send' ? 'data-send' : 'data-receive');
			search.value = '';
			picker.hidden = false;
			calc.classList.add('is-picking');
			btn.setAttribute('aria-expanded', 'true');
			render();
			search.focus({ preventScroll: true });
		}
		function closePicker(restoreFocus) {
			if (!side) { return; }
			picker.hidden = true;
			calc.classList.remove('is-picking');
			trigger.setAttribute('aria-expanded', 'false');
			if (restoreFocus !== false) { trigger.focus({ preventScroll: true }); }
			side = null;
		}
		function choose(code) {
			var which = side;
			state[which] = code;
			updatePill(which);
			if (which === 'receive') {
				var c = byCode(data.receive, code);
				rateText.textContent = '1 USD = ' + money.format(c.rate) + ' ' + c.code;
				fromSend();
			}
			closePicker();
		}

		calc.querySelectorAll('[data-picker-open]').forEach(function (btn) {
			btn.addEventListener('click', function (e) {
				e.stopPropagation();
				var which = btn.getAttribute('data-picker-open');
				if (side === which) { closePicker(); } else { openPicker(which, btn); }
			});
		});
		picker.querySelector('[data-picker-close]').addEventListener('click', function () { closePicker(); });
		picker.addEventListener('click', function (e) { e.stopPropagation(); });
		document.addEventListener('click', function () { closePicker(false); });
		picker.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') { e.stopPropagation(); closePicker(); }
		});
		search.addEventListener('input', render);
		search.addEventListener('keydown', function (e) {
			if (!visible.length) { return; }
			if (e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % visible.length); }
			else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((active - 1 + visible.length) % visible.length); }
			else if (e.key === 'Enter' && active > -1) { e.preventDefault(); choose(visible[active].code); }
		});

		send.addEventListener('input', fromSend);
		receive.addEventListener('input', fromReceive);
		[send, receive].forEach(function (el) {
			el.addEventListener('focus', function () { el.select(); });
			el.addEventListener('blur', function () { el.value = money.format(toNumber(el.value)); fit(el); });
			el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { el.blur(); } });
		});
		fit(send);
		fit(receive);
	});

	/* 6. Legal pages: collapse the "On this page" index on small screens. */
	var toc = document.querySelector('.pm-legal__toc');
	if (toc && window.matchMedia('(max-width: 900px)').matches) { toc.open = false; }

	/* 7. Forms: after a redirect with ?pm=…, scroll the notice into view and clean the URL. */
	var notice = document.querySelector('.pm-form__notice');
	if (notice) {
		notice.scrollIntoView({ block: 'center' });
		if (window.history.replaceState) {
			var clean = new URL(window.location.href);
			clean.searchParams.delete('pm');
			history.replaceState(null, '', clean.pathname + clean.search + clean.hash);
		}
	}
})();
