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

		function openRail(target) {
			rails.forEach(function (rail) {
				var isTarget = rail === target;
				rail.classList.toggle('is-open', isTarget);
				rail.classList.toggle('is-collapsed', !!target && !isTarget);
				var btn = rail.querySelector('[data-rail-toggle]');
				if (btn) {
					btn.setAttribute('aria-expanded', isTarget ? 'true' : 'false');
				}
			});
			grid.classList.toggle('has-open', !!target);
		}

		rails.forEach(function (rail) {
			var btn = rail.querySelector('[data-rail-toggle]');

			if (hoverCapable) {
				rail.addEventListener('mouseenter', function () { openRail(rail); });
			}
			if (btn) {
				btn.addEventListener('click', function () {
					openRail(rail.classList.contains('is-open') ? null : rail);
				});
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
			var target = grid.querySelector('.pm-rail--' + hashRail);
			if (target) {
				openRail(target);
				target.scrollIntoView({ block: 'center' });
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

	/* 4. Smooth-scroll for in-page anchors (header is absolute, so no offset needed). */
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

	/* 5. Forms: after a redirect with ?pm=…, scroll the notice into view and clean the URL. */
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
