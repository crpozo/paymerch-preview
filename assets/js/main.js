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
	var liveRates = null;   // shared by both calculators once fetched

	function toNumber(str) {
		var clean = String(str).replace(/[^0-9.]/g, '');
		var parts = clean.split('.');
		if (parts.length > 2) { clean = parts.shift() + '.' + parts.join(''); }
		var n = parseFloat(clean);
		return isFinite(n) ? n : 0;
	}
	function fmtRate(r) {
		if (r >= 100) { return money.format(r); }
		if (r >= 1) { return r.toFixed(4).replace(/0+$/, '').replace(/\.$/, '.00'); }
		return r.toPrecision(4);
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
	function fetchLiveRates(url, done) {
		if (!url || !window.fetch || liveRates) { if (liveRates) { done(liveRates); } return; }
		fetch(url).then(function (r) { return r.json(); }).then(function (data) {
			if (data && data.rates) { liveRates = data.rates; done(liveRates); }
		}).catch(function () { /* keep server-side rates */ });
	}

	document.querySelectorAll('[data-calc]').forEach(function (calc) {
		var data = JSON.parse(calc.getAttribute('data-currencies') || '{}');
		if (!data.currencies || !data.currencies.length) { return; }

		var byCode = {};
		data.currencies.forEach(function (c) { byCode[c.code] = c; });
		var feeUSD = parseFloat(calc.getAttribute('data-fee')) || 0;
		var send = calc.querySelector('[data-calc-send]');
		var receive = calc.querySelector('[data-calc-receive]');
		var rateText = calc.querySelector('[data-calc-rate]');
		var feeTexts = calc.querySelectorAll('[data-calc-fee]');
		var picker = calc.querySelector('[data-picker]');
		var search = picker.querySelector('[data-picker-search]');
		var list = picker.querySelector('[data-picker-list]');
		var empty = picker.querySelector('[data-picker-empty]');
		var scroller = list.parentNode;
		var MAX_SEND = 999999.99;
		var state = { send: data.send, receive: data.receive };
		var side = null;
		var trigger = null;
		var options = [];   // visible option elements in order
		var active = -1;

		function rate() { return byCode[state.receive].rate / byCode[state.send].rate; }
		function feeInSend() { return feeUSD * byCode[state.send].rate; }
		/* Shrink long numbers so they never collide with the currency pill. */
		function fit(input) {
			input.style.setProperty('--amt-fit', Math.min(1, 8.6 / Math.max(input.value.length, 1)).toFixed(3));
		}
		function fromSend() {
			var s = Math.min(toNumber(send.value), MAX_SEND);
			receive.value = money.format(Math.max(0, s - feeInSend()) * rate());
			fit(send); fit(receive);
		}
		function fromReceive() {
			var r = toNumber(receive.value);
			var s = r > 0 ? r / rate() + feeInSend() : 0;
			send.value = money.format(Math.min(s, MAX_SEND));
			fit(send); fit(receive);
		}
		function paint() {
			rateText.textContent = '1 ' + state.send + ' = ' + fmtRate(rate()) + ' ' + state.receive;
			var f = feeInSend();
			feeTexts.forEach(function (el) {
				var usd = state.send === 'USD';
				el.textContent = (usd ? '$' : '') + money.format(f) + (!usd && el.getAttribute('data-calc-fee') !== 'short' ? ' ' + state.send : '');
			});
			['send', 'receive'].forEach(function (which) {
				var c = byCode[state[which]];
				var btn = calc.querySelector('[data-picker-open="' + which + '"]');
				btn.querySelector('[data-pill-flag]').src = c.flag;
				btn.querySelector('[data-pill-code]').textContent = c.code;
			});
			fromSend();
		}

		function setActive(i) {
			active = i;
			options.forEach(function (li, k) { li.classList.toggle('is-active', k === i); });
			if (i < 0 || !options[i]) { search.removeAttribute('aria-activedescendant'); return; }
			search.setAttribute('aria-activedescendant', options[i].id);
			var top = options[i].offsetTop - list.offsetTop;
			var bottom = top + options[i].offsetHeight;
			if (top < scroller.scrollTop) { scroller.scrollTop = top; }
			else if (bottom > scroller.scrollTop + scroller.clientHeight) { scroller.scrollTop = bottom - scroller.clientHeight; }
		}
		function option(c) {
			var li = document.createElement('li');
			li.id = picker.id + '-' + c.code;
			li.className = 'pm-picker__opt';
			li.setAttribute('role', 'option');
			var selected = c.code === state[side];
			li.setAttribute('aria-selected', selected ? 'true' : 'false');
			var img = document.createElement('img');
			img.src = c.flag; img.alt = ''; img.width = 80; img.height = 60; img.loading = 'lazy';
			var code = document.createElement('span'); code.className = 'pm-picker__code'; code.textContent = c.code;
			var name = document.createElement('span'); name.className = 'pm-picker__name'; name.textContent = c.name;
			li.appendChild(img); li.appendChild(code); li.appendChild(name);
			if (selected) { li.appendChild(checkIcon()); }
			li.addEventListener('click', function () { choose(c.code); });
			li.addEventListener('mousemove', function () { var k = options.indexOf(li); if (k !== active) { setActive(k); } });
			return li;
		}
		function heading(text) {
			var li = document.createElement('li');
			li.className = 'pm-picker__group';
			li.setAttribute('role', 'presentation');
			li.textContent = text;
			return li;
		}
		function render() {
			var q = search.value.trim().toLowerCase();
			var match = function (c) { return !q || (c.code + ' ' + c.name + ' ' + c.country).toLowerCase().indexOf(q) > -1; };
			list.textContent = '';
			options = [];
			var popular = data.popular.map(function (code) { return byCode[code]; }).filter(function (c) { return c && match(c); });
			var all = data.currencies.filter(match);
			if (!q && popular.length) {
				list.appendChild(heading(list.getAttribute('data-popular')));
				popular.forEach(function (c) { var li = option(c); options.push(li); list.appendChild(li); });
				list.appendChild(heading(list.getAttribute('data-all')));
			}
			all.forEach(function (c) { var li = option(c); options.push(li); list.appendChild(li); });
			empty.hidden = options.length > 0;
			var selectedIndex = 0;
			options.some(function (li, k) { if (li.getAttribute('aria-selected') === 'true') { selectedIndex = k; return true; } return false; });
			scroller.scrollTop = 0;
			setActive(options.length ? (q ? 0 : selectedIndex) : -1);
		}
		function openPicker(which, btn) {
			if (side) { closePicker(false); }
			side = which; trigger = btn;
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
			if (which === 'send' && code === state.receive) { state.receive = state.send; }
			else if (which === 'receive' && code === state.send) { state.send = state.receive; }
			state[which] = code;
			paint();
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
			if (!options.length) { return; }
			if (e.key === 'ArrowDown') { e.preventDefault(); setActive((active + 1) % options.length); }
			else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((active - 1 + options.length) % options.length); }
			else if (e.key === 'Enter' && active > -1) { e.preventDefault(); options[active].click(); }
		});

		send.addEventListener('input', fromSend);
		receive.addEventListener('input', fromReceive);
		[send, receive].forEach(function (el) {
			el.addEventListener('focus', function () { el.select(); });
			el.addEventListener('blur', function () { el.value = money.format(toNumber(el.value)); fit(el); });
			el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { el.blur(); } });
		});
		fit(send); fit(receive);

		/* Refresh with live mid-market rates when the feed is reachable. */
		fetchLiveRates(data.feed, function (rates) {
			var changed = false;
			data.currencies.forEach(function (c) {
				if (rates[c.code] > 0 && !c.locked) { c.rate = rates[c.code]; changed = true; }
			});
			if (changed) { paint(); }
		});
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
