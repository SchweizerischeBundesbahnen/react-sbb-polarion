/*
 * Universal self-healing Polarion-toolbar button injector — single source for all extensions
 * that inject a button into a native Polarion toolbar via `scriptInjection.*` configuration.
 *
 * Supported toolbars (the `target` config, see TARGETS below):
 *   - 'dleEditor' (default)      the document (DLE) editor toolbar, configured via
 *                                `scriptInjection.dleEditorHead`;
 *   - 'richPagePreview'          the Rich Page / Live Report toolbar in view mode (the one behind
 *                                the "Expand Tools" handle), configured via `scriptInjection.mainHead`.
 *
 * Polarion (GWT) re-renders the toolbar sub-tree on actions like Save, which wipes out a
 * one-time injected element. This engine injects idempotently and re-injects via a
 * MutationObserver whenever the toolbar is re-rendered and the button disappears. The Rich Page
 * toolbar additionally does not exist in the DOM at all until the user expands it — the same
 * observer picks it up the moment it is rendered.
 *
 * The toolbar selectors below are Polarion's own DOM and identical for every extension. Only the
 * button's title, icon and click action differ, and those come in via addButton(config).
 *
 * Usage — the extension appends this script with its config on data-* attributes and the engine
 * installs itself (see the self-install block at the end of the file). Equivalent explicit form:
 *   window.CommonDleToolbarStarter.addButton({ marker, title, iconUrl, onClick, permissionUrl });
 * For markup that cannot be the standard button (the labelled Live Report one), use the low-level
 *   window.CommonDleToolbarStarter.create({ markerId, html, target }).injectToolbar();
 *
 * Like BreadcrumbBridge, this runs outside the app's own bundle: the extension's dle-toolbar.js loads
 * it with a plain <script> into the Polarion document editor's iframe, from where it drives `top`. So
 * it is not part of dist/index.js — vite.toolbar.config.ts emits it separately as
 * dist/dle-toolbar-starter.js, which the consuming extension serves. Every extension reads the global
 * name `CommonDleToolbarStarter`, so that name is the contract. See "Shell scripts" in the README.
 *
 * NAMING — two kinds of identifier, on purpose:
 *   - This engine's own API and internals use `Common` / `common` (the global above, the
 *     `data-common-prev-*` attributes it writes on its own buttons).
 *   - Everything SHARED with the other extensions on the page keeps the `__generic*` /
 *     `generic-*` names it had in ch.sbb.polarion.extension.generic: the `top.__genericDleToolbar*`
 *     registries (order, observers, owners, seq, and the disabled-state click blocker),
 *     `top.__genericRpeAutoExpandObserver` and the `generic-dle-toolbar-styles` element id.
 *     Those are a wire format, not a name. An extension still loading generic's older engine
 *     coordinates through exactly those keys, and renaming them would silently split the registries -
 *     buttons from old and new extensions would stop ordering against each other and the styles would
 *     be injected twice. Do not "tidy" them; they stay until no extension ships generic's engine.
 */
import toolbarStyles from './dleToolbar.css?inline';

(function () {
    function injectStyles(id, href) {
        if (!top.document.getElementById(id)) {
            const link = top.document.createElement("link");
            link.id = id;
            link.rel = "stylesheet";
            link.type = "text/css";
            link.href = href;
            top.document.head.appendChild(link);
        }
    }

    // Inject the shared toolbar-button styles into the top frame, where the buttons are injected.
    // The element id is shared with generic's older engine on purpose (see NAMING above), so whichever
    // engine runs first wins and the rules are never injected twice.
    // The CSS is bundled into this script (see dleToolbar.css) rather than fetched: the engine used
    // to derive a stylesheet URL by rewriting its own script src, which tied it to being served from
    // one fixed path. Bundling removes that second served asset and the path coupling with it.
    // Idempotent via the fixed id.
    function injectOwnStyles() {
        if (top.document.getElementById('generic-dle-toolbar-styles')) {
            return;
        }
        const style = top.document.createElement('style');
        style.id = 'generic-dle-toolbar-styles';
        style.textContent = toolbarStyles;
        top.document.head.appendChild(style);
    }

    function injectScript(id, src, type = "text/javascript") {
        if (!top.document.getElementById(id)) {
            const script = top.document.createElement("script");
            script.id = id;
            script.setAttribute("src", src);
            script.setAttribute("type", type);
            top.document.head.appendChild(script);
        }
    }

    // Capture-phase click swallower for the disabled state: pointer-events: none already blocks the
    // mouse; this additionally stops a keyboard- or script-triggered click from reaching the
    // button's baked-in onclick. Module-level (stateless) so a single shared reference add/removes
    // consistently on ANY element — including a stale panel's button kept across an SPA navigation,
    // whose listener a later enable must be able to clear regardless of which starter instance runs.
    // Shared across engine loads on purpose, like the registries above (see NAMING). A disabled button
    // gets this as a capture-phase listener, and whoever re-enables it must be able to take it off -
    // including a SECOND load of this engine in the same page, which an administrator produces by
    // configuring the same injector twice (say Administration > Properties and polarion.properties).
    // A per-load function would be a different identity there, so removeEventListener would miss it and
    // the button would keep swallowing clicks while looking, and hovering, perfectly enabled.
    const blockClick = top.__genericDleToolbarBlockClick || (top.__genericDleToolbarBlockClick = function (event) {
        event.stopPropagation();
        event.preventDefault();
    });

    // Toggle the disabled look/behavior on an injected container and its inner interactive elements:
    // the dleToolBarDisabled class fades it and makes the container non-hit-testable to the mouse
    // (pointer-events: none), so a mouse click can't reach the button; the capture-phase blocker
    // covers keyboard- and script-triggered clicks (which bypass pointer-events); aria-disabled +
    // tabindex=-1 on inner [role=button]/button/a announce the disabled state to assistive tech and
    // drop it from the tab order. So the click is stopped regardless of the onclick baked into the
    // button markup.
    function applyDisabled(container, disabled) {
        if (!container) {
            return;
        }
        container.removeEventListener('click', blockClick, true);
        const interactive = container.querySelectorAll('[role="button"], button, a');
        if (disabled) {
            container.classList.add('dleToolBarDisabled');
            container.setAttribute('aria-disabled', 'true');
            container.addEventListener('click', blockClick, true);
            interactive.forEach(el => {
                // Remember the element's own aria-disabled / tabindex (if any) so re-enabling
                // restores the markup's values instead of clobbering them.
                if (!('commonPrevAriaDisabled' in el.dataset)) {
                    el.dataset.commonPrevAriaDisabled = el.getAttribute('aria-disabled') || '';
                }
                if (!('commonPrevTabindex' in el.dataset)) {
                    el.dataset.commonPrevTabindex = el.getAttribute('tabindex') || '';
                }
                el.setAttribute('aria-disabled', 'true');
                el.setAttribute('tabindex', '-1');
            });
        } else {
            container.classList.remove('dleToolBarDisabled');
            container.removeAttribute('aria-disabled');
            interactive.forEach(el => {
                restoreAttr(el, 'aria-disabled', 'commonPrevAriaDisabled');
                restoreAttr(el, 'tabindex', 'commonPrevTabindex');
            });
        }
    }

    // Restore an attribute the engine overrode from its saved-original data attribute: put back the
    // original value, or remove the attribute if it had none originally. No-op if nothing was saved.
    // savedKey is the dataset key of the marker, i.e. data-common-prev-tabindex is 'commonPrevTabindex'.
    function restoreAttr(el, attr, savedKey) {
        if (!(savedKey in el.dataset)) {
            return;
        }
        const prev = el.dataset[savedKey];
        delete el.dataset[savedKey];
        if (prev === '') {
            el.removeAttribute(attr);
        } else {
            el.setAttribute(attr, prev);
        }
    }

    // GWT shows/hides widgets with inline styles; a widget is effectively hidden when it or any
    // ancestor carries inline display:none / visibility:hidden (e.g. a stale Rich Page panel kept
    // in the DOM during an SPA transition).
    function isInlineVisible(el) {
        for (let node = el; node?.style; node = node.parentElement) {
            if (node.style.display === 'none' || node.style.visibility === 'hidden') {
                return false;
            }
        }
        return true;
    }

    // Polarion toolbar DOM per supported target — same for all extensions.
    //   rowSelector          the toolbar <tr> buttons are injected into;
    //   findRow              alternative to rowSelector: resolves the row with target-specific
    //                        logic (used when a plain selector cannot express the constraints);
    //   stableAncestorSelector  ancestor that survives the toolbar re-render — observer anchor.
    //
    // There is one placement: inside the toolbar row. The former "above the editing area" mode (a
    // floating .dleToolBarContainer anchored to the rich-text area) is gone, along with the
    // `alternate` flag that chose between the two.
    const TARGETS = {
        dleEditor: {
            rowSelector: 'div.polarion-content-container div.polarion-Container div.polarion-dle-Container > div.polarion-dle-Wrapper > div.polarion-dle-RpcPanel > div.polarion-dle-MainDockPanel div.polarion-rte-ToolbarPanelWrapper table.polarion-dle-ToolbarPanel tr',
            stableAncestorSelector: 'div.polarion-content-container div.polarion-Container div.polarion-dle-Container'
        },
        richPagePreview: {
            // Only the preview (view) mode of a Rich Page — never the page's edit-mode toolbar.
            // The view marker and the toolbar row are resolved within the SAME visible panel, so a
            // stale panel kept in the DOM during an SPA transition can neither satisfy the guard
            // for another panel's toolbar nor receive the button itself.
            findRow: function (doc) {
                for (const panel of doc.querySelectorAll('div.polarion-rpe-MainPanel')) {
                    if (isInlineVisible(panel) && panel.querySelector('div.polarion-rpe-view')) {
                        const row = panel.querySelector('table.polarion-dle-ToolbarPanel tr');
                        if (row) {
                            return row;
                        }
                    }
                }
                return null;
            },
            stableAncestorSelector: 'div.polarion-content-container'
        }
    };

    // The "Expand Tools" handle of a collapsed Rich Page toolbar (see autoExpandRichPageTools).
    const EXPAND_TOOLS_SELECTOR = 'div.polarion-rpe-expandTools';

    // Derive a button's left-to-right order from the DOM position of its extension's own inject
    // script, rather than from config.order.
    //
    // Why: several extensions each configure a single-tag injector (…/<ext>/js/dle-toolbar.js or
    // live-reports.js) in the SAME scriptInjection property, in a deliberate order. Each injector
    // then ASYNCHRONOUSLY loads its own starter.js, whose stub captures a sequence number when it
    // finally runs — inside starter.js's onload. Those onloads fire in network-race order, so the
    // captured config.order does NOT reflect the configured order (the buttons visibly reshuffle
    // between reloads). Polarion, by contrast, inserts the injector <script> tags into the page in
    // scriptInjection order and they stay put, so their DOM position IS a stable, deterministic
    // reflection of the configured order. This runs in the same document as those scripts (the DLE
    // editor iframe for dleEditor, the top page for richPagePreview), so it can read them directly.
    //
    // markerId convention: it starts with the extension's web-context segment (e.g. the button
    // 'pdf-exporter-toolbar-injected' belongs to '/polarion/pdf-exporter/...'). Falls back to the
    // caller-supplied order when no matching inject script is found (e.g. a bespoke create() caller).
    const INJECT_SCRIPT_RE = /\/js\/(?:dle-toolbar|starter|live-reports)\.js/;
    const EXT_CONTEXT_RE = /\/polarion\/([^/]+)\/(?:ui\/[^/]+\/)?js\//;

    function domOrder(markerId, fallback) {
        // Collect the distinct extension web-context segments from the inject scripts, in DOM order
        // (which Polarion keeps equal to the configured order). The engine script itself
        // (…/js/dle-toolbar-starter.js) is excluded by INJECT_SCRIPT_RE.
        const seen = new Set(), contexts = [];
        for (const script of document.querySelectorAll('script[src]')) {
            const src = script.getAttribute('src'); // the [src] selector guarantees a string
            if (!INJECT_SCRIPT_RE.test(src)) {
                continue;
            }
            const match = EXT_CONTEXT_RE.exec(src);
            const ctx = match?.[1];
            if (ctx && !seen.has(ctx)) {
                seen.add(ctx);
                contexts.push(ctx);
            }
        }
        // markerId starts with its extension context; pick the longest matching prefix so a more
        // specific context wins (e.g. a hypothetical 'pdf-exporter-rp' over 'pdf-exporter').
        let bestIndex = -1, bestLength = -1;
        for (let i = 0; i < contexts.length; i++) {
            if (markerId.indexOf(contexts[i]) === 0 && contexts[i].length > bestLength) {
                bestIndex = i;
                bestLength = contexts[i].length;
            }
        }
        return bestIndex >= 0 ? bestIndex : fallback;
    }

    // Registry of live observers keyed by markerId, kept on the top window (and under its original
    // `__generic*` name, see NAMING above) so it survives this
    // script being re-loaded each time the DLE editor is (re-)opened in Polarion's GWT SPA.
    // Re-using the key lets us disconnect the previous observer instead of accumulating them.
    const observerRegistry = top.__genericDleToolbarObservers || (top.__genericDleToolbarObservers = {});

    // Escape a value destined for a double-quoted HTML attribute. The button config comes from the
    // extension's own script tag, not from user data, but titles and icon paths still go through
    // this so a stray quote cannot break out of the attribute.
    function escapeAttr(value) {
        return String(value == null ? '' : value)
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;');
    }

    // The standard document-editor toolbar button, identical for every extension: Polarion's own
    // group separator (padding, splitter, padding) followed by an icon-only button. Extensions used
    // to carry a copy of this markup each; they now pass just the title, icon and click action.
    function buildButtonHtml(config) {
        return `
        <table class="dleToolBarTable">
            <tr class="dleToolBarRow">
                <td><div class="gwt-Label polarion-dle-toolbar-Padding"></div></td>
                <td><img src="/polarion/ria/images/toolbar_splitter_gray.gif" class="gwt-Image polarion-dle-ToolbarPanel-separator"></td>
                <td><div class="gwt-Label polarion-dle-toolbar-Padding"></div></td>
                <td class="dleToolBarTableCell" title="${escapeAttr(config.title)}">
                    <div class="dleToolBarSingleButton dleToolBarButton" role="button" tabindex="0" onclick="${escapeAttr(config.onClick)}">
                        <img class="polarion-MenuButton-Icon" src="${escapeAttr(config.iconUrl)}" alt="${escapeAttr(config.title)}" style="margin: 0">
                    </div>
                </td>
            </tr>
        </table>`;
    }

    // Polarion's own project-id charset: letters, digits, underscore, dot, hyphen. Anything else in
    // the hash segment is not a project id, so it is rejected rather than passed on to the server.
    const PROJECT_ID_PATTERN = /^[\w.-]+$/;

    // The current project id, parsed from Polarion's location hash (…#/project/<id>/…). Read from the
    // top frame, since this runs in the editor iframe. Null when there is no project scope, in which
    // case only global roles apply. Every exporter duplicated this; it lives here now.
    // The hash is user-controlled, so the parsed segment is validated before it reaches a request URL.
    function currentProjectId() {
        try {
            const hash = top?.location?.hash || window.location.hash || '';
            const match = /project\/([^/]+)\//.exec(decodeURI(hash));
            const projectId = match ? match[1] : null;
            return projectId && PROJECT_ID_PATTERN.test(projectId) ? projectId : null;
        } catch {
            return null;
        }
    }

    // Append the current project to a permission endpoint, so the check is scoped the same way the
    // server scopes it.
    function withProjectId(permissionUrl) {
        const projectId = currentProjectId();
        return projectId ? `${permissionUrl}?projectId=${encodeURIComponent(projectId)}` : permissionUrl;
    }

    window.CommonDleToolbarStarter = {
        injectStyles: injectStyles,
        injectScript: injectScript,
        injectOwnStyles: injectOwnStyles,
        buildButtonHtml: buildButtonHtml,

        /**
         * Low-level entry point: inject caller-supplied markup into a Polarion toolbar row. Most
         * callers want addButton() instead, which builds the standard icon button for them; use this
         * only when the markup has to differ (e.g. the labelled Live Report button).
         *
         * @param config {{ markerId: string, html: string, target: string|undefined, order: number|undefined, permissionCheckUrl: string|undefined, permissionCheck: function|undefined }}
         *   markerId      unique id set on the injected element; also the idempotency/dedup key.
         *   html          markup injected into the toolbar row.
         *   target        which Polarion toolbar to inject into: 'dleEditor' (default) or
         *                 'richPagePreview' (works for the Live Report toolbar too). The
         *                 'richPagePreview' target injects only while the page is in view mode.
         *   permissionCheckUrl  optional: a URL the engine GETs to decide if the button is enabled.
         *                 Expected JSON response { permitted: boolean }; permitted !== true (or a
         *                 non-OK status / error) disables the button (fail-closed). Works for both
         *                 targets (Live Doc and Live Report).
         *   permissionCheck     optional: a function returning boolean|Promise<boolean>, used
         *                 instead of permissionCheckUrl when given (e.g. to run the extension's own
         *                 REST wrapper). While either check is pending the button is shown disabled.
         *
         *   SECURITY: html is written via innerHTML into the top Polarion frame, so it MUST be
         *   static, trusted markup. Never interpolate user-controlled data (document fields,
         *   work-item attributes, ...) into it without sanitizing it first.
         *
         * @returns {{ injectToolbar: function, setDisabled: function, destroy: function }}
         *   injectToolbar(params)  params.disabled → inject disabled. The latest params are re-used
         *                          by the self-healing re-inject, so the disabled state survives
         *                          toolbar re-renders.
         *   setDisabled(bool)      toggle the disabled state on the live button and for future
         *                          re-injects (call it when an async permission result arrives).
         */
        create: function (config) {
            const target = TARGETS[config.target || 'dleEditor'];
            if (!target) {
                throw new Error(`CommonDleToolbarStarter: unknown target '${config.target}'.`);
            }

            // Stable left-to-right order across re-renders. Re-injection inserts before the first
            // already-present button with a *higher* order. The order is derived from the DOM
            // position of the extension's own inject script (deterministic, = configured order),
            // falling back to config.order when that can't be resolved (see domOrder). Buttons with
            // distinct orders keep their position regardless of which extension's observer re-fires
            // first; buttons sharing an order tie-break by observer-fire order.
            const fallbackOrder = (typeof config.order === 'number') ? config.order : 0;
            const myOrder = domOrder(config.markerId, fallbackOrder);
            const orderByMarker = top.__genericDleToolbarOrder || (top.__genericDleToolbarOrder = {});
            orderByMarker[config.markerId] = myOrder;

            // Optional engine-driven global permission check: permissionCheck (a function returning
            // boolean|Promise<boolean>) takes precedence over permissionCheckUrl (GET → JSON
            // { permitted: boolean }). Resolves to whether the button is permitted (enabled).
            const hasPermissionCheck = !!(config.permissionCheck || config.permissionCheckUrl);
            let permissionCheckStarted = false;

            function runPermissionCheck() {
                if (config.permissionCheck) {
                    return Promise.resolve().then(config.permissionCheck);
                }
                // Wrap fetch in a promise so even a synchronous throw (e.g. fetch unavailable) turns
                // into a rejection handled by the caller's .catch → fail-closed.
                return Promise.resolve()
                    .then(() => fetch(config.permissionCheckUrl, { credentials: 'same-origin' }))
                    .then(response => response.ok ? response.json() : { permitted: false })
                    .then(data => !!data?.permitted);
            }

            // Idempotent: only inject if the toolbar exists and our button isn't already there.
            function inject(params) {
                if (top.document.getElementById(config.markerId)) {
                    return; // already present
                }
                const toolbarParent = target.findRow
                    ? target.findRow(top.document)
                    : top.document.querySelector(target.rowSelector);
                if (!toolbarParent) {
                    return; // toolbar not rendered (yet), or guarded off (e.g. edit mode)
                }
                const toolbarContainer = top.document.createElement('td');
                toolbarContainer.id = config.markerId;
                // Polarion's own toolbar cells carry vertical-align: middle inline — match them
                // so injected buttons line up with the native ones.
                toolbarContainer.style.verticalAlign = 'middle';
                toolbarContainer.innerHTML = config.html;
                applyDisabled(toolbarContainer, params?.disabled);
                const spacer = toolbarParent.querySelector('td[width="100%"]');
                if (!spacer) {
                    // Polarion DOM changed (e.g. after an upgrade) — fall back to appending at the
                    // end of the row, but warn so the mislayout is diagnosable.
                    console.warn(`CommonDleToolbarStarter: reference cell td[width="100%"] not found for '${config.markerId}'; appending button at the end of the toolbar row.`);
                }
                // Keep a stable order: insert before the first already-present button whose order
                // is higher than ours, otherwise before the spacer cell.
                let reference = spacer;
                for (const cell of toolbarParent.children) {
                    const cellOrder = orderByMarker[cell.id];
                    if (cellOrder !== undefined && cellOrder > myOrder) {
                        reference = cell;
                        break;
                    }
                }
                if (reference) {
                    reference.before(toolbarContainer);
                } else {
                    toolbarParent.append(toolbarContainer);
                }
            }

            let observerSetUp = false;
            let destroyed = false;
            // The observer re-injects with the params of the latest injectToolbar() call.
            let lastParams;

            // Claim ownership of this markerId. If a newer starter is created for the same markerId
            // (e.g. two create() calls in one context), the older one becomes "superseded" and its
            // async callbacks (a late permission result) must not touch the shared button — the newer
            // owner is the source of truth. Prevents a stale instance from overwriting current state.
            const instanceToken = {};
            const ownerRegistry = top.__genericDleToolbarOwners || (top.__genericDleToolbarOwners = {});
            ownerRegistry[config.markerId] = instanceToken;
            const isCurrentOwner = () => ownerRegistry[config.markerId] === instanceToken;

            // Toggle the button's disabled state on the live element and for future (re-)injects.
            function setDisabled(disabled) {
                if (!isCurrentOwner()) {
                    return; // a newer starter instance owns this markerId — don't fight it
                }
                lastParams = { ...lastParams, disabled: disabled };
                applyDisabled(top.document.getElementById(config.markerId), disabled);
            }

            return {
                injectToolbar: function (params) {
                    // When a permission check is configured, inject disabled first (no
                    // enabled→disabled flicker) and resolve the real state asynchronously.
                    if (hasPermissionCheck && !permissionCheckStarted) {
                        params = { ...params, disabled: true };
                    }
                    // Merge onto the previous params (don't replace) so a disabled state set via
                    // setDisabled() or the pending permission check isn't dropped by a later
                    // injectToolbar() that omits `disabled`. Self-heal re-injects with the merged set.
                    lastParams = { ...lastParams, ...params };
                    inject(lastParams);

                    // Kick off the global permission check once; on error keep it disabled
                    // (fail-closed — a check that can't confirm access denies it).
                    if (hasPermissionCheck && !permissionCheckStarted) {
                        permissionCheckStarted = true;
                        runPermissionCheck()
                            .then(permitted => { if (!destroyed) setDisabled(!permitted); })
                            .catch(() => { if (!destroyed) setDisabled(true); });
                    }

                    // Set up the self-healing observer once per starter instance.
                    if (observerSetUp) {
                        return;
                    }
                    const anchor = top.document.querySelector(target.stableAncestorSelector) || top.document.body;
                    if (!anchor) {
                        return;
                    }
                    observerSetUp = true;
                    let scheduled = false;
                    const observer = new MutationObserver(function () {
                        // Cheap fast-path: button still present (or a re-inject already queued) → do nothing.
                        if (top.document.getElementById(config.markerId) || scheduled) {
                            return;
                        }
                        scheduled = true;
                        // Coalesce the burst of mutations during a re-render into a single re-inject.
                        requestAnimationFrame(function () {
                            scheduled = false;
                            inject(lastParams);
                        });
                    });
                    // Disconnect any observer left over from a previous editor open for this markerId
                    // so observers don't accumulate across editor open/close cycles.
                    if (observerRegistry[config.markerId]) {
                        observerRegistry[config.markerId].disconnect();
                    }
                    observerRegistry[config.markerId] = observer;
                    observer.observe(anchor, { childList: true, subtree: true });
                },

                setDisabled: setDisabled,

                // Stop self-healing and release the observer (for callers that have a teardown hook).
                destroy: function () {
                    // Mark destroyed so a still-pending permission check doesn't apply its result
                    // (setDisabled) after teardown.
                    destroyed = true;
                    if (observerRegistry[config.markerId]) {
                        observerRegistry[config.markerId].disconnect();
                        delete observerRegistry[config.markerId];
                    }
                    // Clear the disabled state (and its capture-phase click blocker) from our
                    // element so a torn-down button left in the DOM doesn't keep swallowing clicks.
                    applyDisabled(top.document.getElementById(config.markerId), false);
                    observerSetUp = false;
                }
            };
        },

        /**
         * The one call an extension needs for a document-editor toolbar button. Builds the standard
         * markup, resolves the permission endpoint and injects, self-healing included.
         *
         * @param config {{ marker: string, title: string, iconUrl: string, onClick: string, permissionUrl: string|undefined, order: number|undefined }}
         *   marker        the extension's web-context segment, e.g. 'pdf-exporter'. The injected
         *                 element's id becomes `<marker>-toolbar-injected`, which is also what
         *                 button ordering keys off, so it must match the extension's own context.
         *   title         tooltip and image alt text.
         *   iconUrl       the button icon.
         *   onClick       JavaScript for the button's onclick attribute. Trusted, static code only.
         *   permissionUrl optional endpoint returning { permitted: boolean }; the current project is
         *                 appended automatically. The button shows disabled until it answers, and
         *                 stays disabled if it cannot (fail-closed).
         * @returns the same handle as create().
         */
        addButton: function (config) {
            const starter = this.create({
                markerId: `${config.marker}-toolbar-injected`,
                html: buildButtonHtml(config),
                order: config.order,
                permissionCheckUrl: config.permissionUrl ? withProjectId(config.permissionUrl) : undefined
            });
            starter.injectToolbar();
            return starter;
        },

        /**
         * Keep the Rich Page (Live Report) tools toolbar always expanded. Polarion renders it
         * collapsed behind an "Expand Tools" handle on every page open and does not persist the
         * expanded state, so this clicks the handle whenever it (re-)appears — on the initial page
         * load and on SPA navigation between pages.
         *
         * Idempotent across callers: a single shared observer per top window (several extensions
         * calling this results in one observer). There is no opposite-direction fighting to worry
         * about — Polarion offers no collapse control once the toolbar is expanded.
         */
        autoExpandRichPageTools: function () {
            if (top.__genericRpeAutoExpandObserver) {
                return;
            }
            function expand() {
                // Several handles can coexist during an SPA transition (a stale, inline-hidden
                // Rich Page panel next to the active one) — click only the visible one.
                for (const handle of top.document.querySelectorAll(EXPAND_TOOLS_SELECTOR)) {
                    if (isInlineVisible(handle)) {
                        handle.click();
                    }
                }
            }
            let scheduled = false;
            const observer = new MutationObserver(function () {
                if (scheduled) {
                    return;
                }
                scheduled = true;
                // Coalesce the burst of mutations during a page render into a single check.
                requestAnimationFrame(function () {
                    scheduled = false;
                    expand();
                });
            });
            top.__genericRpeAutoExpandObserver = observer;
            // A head-injected script can run before <body> exists — defer until it does.
            function start() {
                observer.observe(top.document.body, { childList: true, subtree: true });
                expand();
            }
            if (top.document.body) {
                start();
            } else {
                top.document.addEventListener('DOMContentLoaded', start, { once: true });
            }
        }
    };

    // Ship the shared toolbar-button styles the moment the engine loads (currentScript is still
    // available here), so consumers don't each carry their own copy of the CSS.
    injectOwnStyles();

    // Self-install from the script tag that loaded us, so an extension's injector is just "append
    // this script with my config on it" — no onload handler, no queue, no per-extension bootstrap:
    //
    //   const s = document.createElement('script');
    //   s.src = '…/dle-toolbar-starter.js';
    //   s.dataset.marker = 'pdf-exporter';
    //   s.dataset.title = 'Export to PDF';
    //   s.dataset.icon = '…/actionPdfExport16.svg';
    //   s.dataset.onclick = "import('…/export-popup.js').then(m => m.openExportPopup())";
    //   s.dataset.permissionUrl = '/polarion/pdf-exporter/rest/internal/permissions/export';
    //   document.head.appendChild(s);
    //
    // document.currentScript is only readable while this script executes, which is exactly now.
    // Without data-marker nothing happens, so the engine stays usable as a plain API too (the Live
    // Report injector loads it and calls create() itself).
    const self = document.currentScript;
    if (self?.dataset.marker) {
        window.CommonDleToolbarStarter.addButton({
            marker: self.dataset.marker,
            title: self.dataset.title,
            iconUrl: self.dataset.icon,
            onClick: self.dataset.onclick,
            permissionUrl: self.dataset.permissionUrl
        });
    }
})();
