<?php
// AUTO-EXTRACTED from themes_config.php - do not edit.
if (!function_exists('penumbra_get_themes')) {
function penumbra_get_themes() {
    static $themes = null;
    if ($themes !== null) {
        return $themes;
    }

    $themes = array();

    // ---- Default Light ------------------------------------------------------
    $themes['theme-default'] = array(
        'id' => 'theme-default', 'label' => 'Default Light', 'isDark' => false,
        'aliases' => array('light', 'default-light'),
        'vars' => array(
            'bg-body' => '#f8fafc', 'bg-surface' => '#ffffff', 'bg-surface-alt' => '#f8f9fa',
            'text-main' => '#222222', 'text-muted' => '#666666', 'border-color' => '#dee2e6',
            'brand-primary' => '#336699', 'brand-secondary' => '#4a7cb8',
        ),
        'xlsx' => array('headerBg' => '#336699', 'headerGradient' => 'linear-gradient(to top, #4a7cb8, #336699, #2a5588)', 'headerFont' => '#FFFFFF', 'oddBg' => '#FFFFFF', 'evenBg' => '#F2F2F2', 'dataFont' => '#000000', 'borderColor' => '#DDDDDD', 'groupHeaderBg' => '#eeeeee', 'groupHeaderFont' => '#333333', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#f9f9f9', 'blockBorder' => '#ddd', 'titleColor' => '#074586', 'titleExtra' => '', 'tsColor' => '#555', 'pillBg' => '#ffffff', 'pillBorder' => '#cbd5e1', 'pillLabel' => '#64748b', 'pillValue' => '#0ea5e9'),
        'print' => array('headerBg' => '#336699', 'footerBg' => '#e0eaf1'),
        'emailGroup' => array('border' => '#e5e7eb', 'headerBg' => '#fafbfc', 'nameColor' => '#1a1a2e', 'countBg' => '#555555', 'countColor' => '#fff', 'aggLabel' => '#717171', 'aggValue' => '#333'),
        'nestedHeader' => array('bg' => '#e8eef4', 'text' => '#333333', 'border' => '#aaaaaa', 'border_top' => '#aaaaaa', 'header_bg' => '#f5f5f5', 'header_text' => '#000000'),
    );

    // ---- Cyanotype (id stays theme-dark-blue) ---------------------------------
    $themes['theme-dark-blue'] = array(
        'id' => 'theme-dark-blue', 'label' => 'Cyanotype', 'isDark' => true,
        'aliases' => array('cyanotype', 'dark-blue'),
        'vars' => array(
            'bg-body' => '#070e22', 'bg-surface' => '#10204a', 'bg-surface-alt' => '#070e22',
            'text-main' => '#e0e9f8', 'text-muted' => '#a6b8d6', 'border-color' => '#2a4a80',
            'brand-primary' => '#2a6fd6', 'brand-secondary' => '#3d86e6',
        ),
        'xlsx' => array('headerBg' => '#1D59B8', 'headerGradient' => 'linear-gradient(to top, #1d59b8, #2468cc)', 'headerFont' => '#FFFFFF', 'oddBg' => '#070E22', 'evenBg' => '#0D1A39', 'dataFont' => '#E0E9F8', 'borderColor' => '#2a4a80', 'groupHeaderBg' => '#172a58', 'groupHeaderFont' => '#E0E9F8', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#10204a', 'blockBorder' => '#2a4a80', 'titleColor' => '#b4e2ff', 'titleExtra' => '', 'tsColor' => '#a6b8d6', 'pillBg' => '#070e22', 'pillBorder' => '#2a4a80', 'pillLabel' => '#a6b8d6', 'pillValue' => '#8ecbff'),
        'print' => array('headerBg' => '#1d59b8', 'footerBg' => '#10204a'),
        'emailGroup' => array('border' => '#2a4a80', 'headerBg' => '#10204a', 'nameColor' => '#e0e9f8', 'countBg' => '#1d59b8', 'countColor' => '#ffffff', 'aggLabel' => '#a6b8d6', 'aggValue' => '#e0e9f8'),
        'nestedHeader' => array('bg' => '#142552', 'text' => '#e0e9f8', 'border' => '#2a4a80', 'border_top' => '#2a4a80', 'header_bg' => '#172a58', 'header_text' => '#e0e9f8'),
    );

    // ---- Graphite & Brass (replaced Charcoal & Gold, 2026-11-07) -------------
    // Same pairing (dark neutral + warm metal): the greys lean blue and the
    // yellow gold drops to antique brass. The header row inverts - graphite with
    // brass text and rule; only the sorted column is brass-filled. The old id and
    // its aliases stay as aliases so saved preferences and ?theme= links resolve.
    $themes['theme-graphite-brass'] = array(
        'id' => 'theme-graphite-brass', 'label' => 'Graphite & Brass', 'isDark' => true,
        'aliases' => array('graphite', 'brass', 'charcoal', 'charcoal-gold', 'theme-charcoal-gold'),
        'vars' => array(
            'bg-body' => '#14171c', 'bg-surface' => '#1e2228', 'bg-surface-alt' => '#191c21',
            'text-main' => '#e8e2d4', 'text-muted' => '#a39d90', 'border-color' => '#353b44',
            'brand-primary' => '#b9924a', 'brand-secondary' => '#d4b36a', 'brand-text' => '#d9bc74',
            'on-brand' => '#14171c', 'pivot-header-font' => '#14171c',
            'table-header-bg' => 'linear-gradient(180deg, #262b33, #1e2228)', 'table-header-text' => '#d9bc74',
            'table-header-sorted-bg' => 'linear-gradient(to top, #d4b36a, #b9924a)',
        ),
        'xlsx' => array('headerBg' => '#262B33', 'headerGradient' => 'linear-gradient(180deg, #262b33, #1e2228)', 'headerFont' => '#D9BC74', 'oddBg' => '#14171C', 'evenBg' => '#1E2228', 'dataFont' => '#E8E2D4', 'borderColor' => '#353b44', 'groupHeaderBg' => '#2A303A', 'groupHeaderFont' => '#E8E2D4', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#1e2228', 'blockBorder' => '#353b44', 'titleColor' => '#d9bc74', 'titleExtra' => 'letter-spacing: 0.3px;', 'tsColor' => '#a39d90', 'pillBg' => '#14171c', 'pillBorder' => '#353b44', 'pillLabel' => '#a39d90', 'pillValue' => '#d4b36a'),
        'print' => array('headerBg' => '#b9924a', 'footerBg' => '#1e2228'),
        'emailGroup' => array('border' => '#353b44', 'headerBg' => '#1e2228', 'nameColor' => '#e8e2d4', 'countBg' => '#b9924a', 'countColor' => '#14171c', 'aggLabel' => '#a39d90', 'aggValue' => '#e8e2d4'),
        'nestedHeader' => array('bg' => '#1e2228', 'text' => '#e8e2d4', 'border' => '#353b44', 'border_top' => '#b9924a', 'header_bg' => '#262b33', 'header_text' => '#d9bc74'),
    );

    // ---- Folio (id stays theme-light-sepia) -----------------------------------
    $themes['theme-light-sepia'] = array(
        'id' => 'theme-light-sepia', 'label' => 'Folio', 'isDark' => false,
        'aliases' => array('sepia', 'folio', 'light-sepia'),
        'vars' => array(
            'bg-body' => '#f4f1ea', 'bg-surface' => '#f9f6f0', 'bg-surface-alt' => '#f4f1ea',
            'text-main' => '#5b4636', 'text-muted' => '#7a5f47', 'border-color' => '#dcd5c9',
            'brand-primary' => '#a4886d', 'brand-secondary' => '#c0a68d', 'pivot-header-font' => '#f4f1ea',
        ),
        'xlsx' => array('headerBg' => '#6A4E38', 'headerGradient' => 'linear-gradient(to top, #7a5e46, #6a4e38, #5b4636)', 'headerFont' => '#F4F1EA', 'oddBg' => '#F4F1EA', 'evenBg' => '#E9E2D7', 'dataFont' => '#5B4636', 'borderColor' => '#dcd5c9', 'groupHeaderBg' => '#e4dfd6', 'groupHeaderFont' => '#5B4636', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#fdfaf5', 'blockBorder' => '#e9e2d7', 'titleColor' => '#5b4636', 'titleExtra' => 'letter-spacing: 1.5px; font-style: italic; font-weight: 400;', 'tsColor' => '#a4886d', 'pillBg' => '#ffffff', 'pillBorder' => '#dcd5c9', 'pillLabel' => '#a4886d', 'pillValue' => '#8c6e54'),
        'print' => array('headerBg' => '#6a4e38', 'footerBg' => '#e9e2d7'),
        'emailGroup' => array('border' => '#dcd5c9', 'headerBg' => '#f0ebe3', 'nameColor' => '#5b4636', 'countBg' => '#7d6753', 'countColor' => '#f4f1ea', 'aggLabel' => '#70655a', 'aggValue' => '#5b4636'),
        'nestedHeader' => array('bg' => '#e6dfd5', 'text' => '#5b4636', 'border' => '#d0c5b6', 'border_top' => '#a4886d', 'header_bg' => '#d8d0c5', 'header_text' => '#5b4636'),
    );

    // ---- Wolfpack Red (light) ----------------------------------------------
    $themes['theme-wolfpack'] = array(
        'id' => 'theme-wolfpack', 'label' => 'Wolfpack Red', 'isDark' => false,
        'aliases' => array('red', 'wolfpack-red'),
        'vars' => array(
            'bg-body' => '#f5f5f5', 'bg-surface' => '#ffffff', 'bg-surface-alt' => '#fcf0f0',
            'text-main' => '#222222', 'text-muted' => '#666666', 'border-color' => '#cccccc',
            'brand-primary' => '#990000', 'brand-secondary' => '#cc0000',
        ),
        'xlsx' => array('headerBg' => '#990000', 'headerGradient' => 'linear-gradient(to top, #cc0000, #990000, #770000)', 'headerFont' => '#FFFFFF', 'oddBg' => '#FFFFFF', 'evenBg' => '#F5F5F5', 'dataFont' => '#222222', 'borderColor' => '#cccccc', 'groupHeaderBg' => '#eeeeee', 'groupHeaderFont' => '#333333', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#ffffff', 'blockBorder' => '#f0f0f0', 'titleColor' => '#990000', 'titleExtra' => 'text-transform: uppercase;', 'tsColor' => '#555', 'pillBg' => '#ffffff', 'pillBorder' => '#e0acac', 'pillLabel' => '#64748b', 'pillValue' => '#cc0000'),
        'print' => array('headerBg' => '#990000', 'footerBg' => '#EAEAEA'),
        'emailGroup' => array('border' => '#e0e0e0', 'headerBg' => '#fafafa', 'nameColor' => '#1a1a2e', 'countBg' => '#990000', 'countColor' => '#fff', 'aggLabel' => '#717171', 'aggValue' => '#333'),
        'nestedHeader' => array('bg' => '#f5f5f5', 'text' => '#222222', 'border' => '#dddddd', 'border_top' => '#cc0000', 'header_bg' => '#e0e0e0', 'header_text' => '#222222'),
    );

    // ---- Wolfpack Dark ------------------------------------------------------
    $themes['theme-wolfpack-dark'] = array(
        'id' => 'theme-wolfpack-dark', 'label' => 'Wolfpack Dark', 'isDark' => true,
        'aliases' => array(),
        'vars' => array(
            'bg-body' => '#1a1a1a', 'bg-surface' => '#2c2c2c', 'bg-surface-alt' => '#222222',
            'text-main' => '#e0e0e0', 'text-muted' => '#aaaaaa', 'border-color' => '#555555',
            'brand-primary' => '#cc0000', 'brand-secondary' => '#ff3333',
        ),
        'xlsx' => array('headerBg' => '#990000', 'headerGradient' => 'linear-gradient(to top, #ff3333, #cc0000, #990000)', 'headerFont' => '#FFFFFF', 'oddBg' => '#1A1A1A', 'evenBg' => '#2C2C2C', 'dataFont' => '#E0E0E0', 'borderColor' => '#444444', 'groupHeaderBg' => '#333333', 'groupHeaderFont' => '#E0E0E0', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#1a1a1a', 'blockBorder' => '#444', 'titleColor' => '#cc0000', 'titleExtra' => 'text-transform: uppercase;', 'tsColor' => '#999', 'pillBg' => '#2c2c2c', 'pillBorder' => '#444', 'pillLabel' => '#888', 'pillValue' => '#ffb3b3'),
        'print' => array('headerBg' => '#cc0000', 'footerBg' => '#333333'),
        'emailGroup' => array('border' => '#444', 'headerBg' => '#2a2a2a', 'nameColor' => '#e0e0e0', 'countBg' => '#990000', 'countColor' => '#fff', 'aggLabel' => '#959595', 'aggValue' => '#e0e0e0'),
        'nestedHeader' => array('bg' => '#2a2a2a', 'text' => '#ffffff', 'border' => '#444444', 'border_top' => '#cc0000', 'header_bg' => '#333333', 'header_text' => '#ffffff'),
    );

    // ======================================================================
    // NEW THEMES (added 2026-06). Each is one self-contained entry; the CSS
    // body.theme-* { --vars } block lives in css/main.css.
    // ======================================================================

    // ---- Midnight (OLED black, dark) ----------------------------------------
    $themes['theme-midnight'] = array(
        'id' => 'theme-midnight', 'label' => 'Midnight (OLED)', 'isDark' => true,
        'aliases' => array('oled'),
        'vars' => array(
            'bg-body' => '#000000', 'bg-surface' => '#0c0c16', 'bg-surface-alt' => '#08080f',
            'text-main' => '#e9e9f5', 'text-muted' => '#9494b2', 'border-color' => '#2a2a4a',
            'brand-primary' => '#818cf8', 'brand-secondary' => '#a5b4fc',
        ),
        'xlsx' => array('headerBg' => '#4F46E5', 'headerGradient' => 'linear-gradient(to top, #6366f1, #4f46e5, #3730a3)', 'headerFont' => '#FFFFFF', 'oddBg' => '#000000', 'evenBg' => '#0C0C16', 'dataFont' => '#E9E9F5', 'borderColor' => '#2a2a4a', 'groupHeaderBg' => '#14142a', 'groupHeaderFont' => '#E9E9F5', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#0c0c16', 'blockBorder' => '#2a2a4a', 'titleColor' => '#a5b4fc', 'titleExtra' => '', 'tsColor' => '#9494b2', 'pillBg' => '#000000', 'pillBorder' => '#2a2a4a', 'pillLabel' => '#7a7a98', 'pillValue' => '#a5b4fc'),
        'print' => array('headerBg' => '#4f46e5', 'footerBg' => '#0c0c16'),
        'emailGroup' => array('border' => '#2a2a4a', 'headerBg' => '#0c0c16', 'nameColor' => '#e9e9f5', 'countBg' => '#4f46e5', 'countColor' => '#fff', 'aggLabel' => '#7a7a98', 'aggValue' => '#e9e9f5'),
        'nestedHeader' => array('bg' => '#0c0c16', 'text' => '#e9e9f5', 'border' => '#2a2a4a', 'border_top' => '#818cf8', 'header_bg' => '#14142a', 'header_text' => '#e9e9f5'),
        'cssVars' => array('accent-danger' => '#fb7185', 'on-brand' => '#000000', 'table-header-bg' => 'linear-gradient(to top, #5b5eee, #4f46e5, #3730a3)','table-header-text' => '#ffffff', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #a5b4fc, #818cf8)', 'table-header-sorted-text' => '#1e1b4b', 'table-footer-bg' => '#0c0c16', 'table-footer-border' => '#6366f1', 'table-footer-text' => '#e9e9f5', 'zebra-light' => '#000000', 'zebra-dark' => '#0c0c18', 'table-link-color' => '#a5b4fc', 'header-card-bg' => 'linear-gradient(135deg, #000000, #0c0c1c)', 'header-card-border' => '#2a2a4a', 'header-card-accent' => '#818cf8', 'title-color' => '#a5b4fc', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#1c1a3a'),
    );

    // ---- Monochrome (greyscale, light) --------------------------------------
    // Pure greyscale: no hue anywhere. The "brand" is near-black (#2b2b2b), so
    // --on-brand stays the default white (like Forest / Wolfpack) and the theme
    // does NOT belong in main.css's light-brand #pnbStatusBar avatar list. The
    // default wolf watermark is a black logo at 8% on a light page, so it reads
    // as grey with no override needed. All text pairs meet WCAG 2.1 AA.
    $themes['theme-monochrome'] = array(
        'id' => 'theme-monochrome', 'label' => 'Monochrome', 'isDark' => false,
        'aliases' => array('mono', 'grayscale', 'greyscale', 'bw'),
        'vars' => array(
            'bg-body' => '#f2f2f2', 'bg-surface' => '#ffffff', 'bg-surface-alt' => '#e8e8e8',
            'text-main' => '#1a1a1a', 'text-muted' => '#5c5c5c', 'border-color' => '#c8c8c8',
            'brand-primary' => '#2b2b2b', 'brand-secondary' => '#5a5a5a',
        ),
        'xlsx' => array('headerBg' => '#2B2B2B', 'headerGradient' => 'linear-gradient(to top, #5a5a5a, #3a3a3a, #232323)', 'headerFont' => '#FFFFFF', 'oddBg' => '#FFFFFF', 'evenBg' => '#EFEFEF', 'dataFont' => '#1A1A1A', 'borderColor' => '#c8c8c8', 'groupHeaderBg' => '#e8e8e8', 'groupHeaderFont' => '#1a1a1a', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#f5f5f5', 'blockBorder' => '#c8c8c8', 'titleColor' => '#1a1a1a', 'titleExtra' => '', 'tsColor' => '#5c5c5c', 'pillBg' => '#ffffff', 'pillBorder' => '#c8c8c8', 'pillLabel' => '#5c5c5c', 'pillValue' => '#2b2b2b'),
        'print' => array('headerBg' => '#2b2b2b', 'footerBg' => '#e8e8e8'),
        'emailGroup' => array('border' => '#c8c8c8', 'headerBg' => '#f2f2f2', 'nameColor' => '#1a1a1a', 'countBg' => '#2b2b2b', 'countColor' => '#ffffff', 'aggLabel' => '#6a6a6a', 'aggValue' => '#1a1a1a'),
        'nestedHeader' => array('bg' => '#e8e8e8', 'text' => '#1a1a1a', 'border' => '#c8c8c8', 'border_top' => '#2b2b2b', 'header_bg' => '#dcdcdc', 'header_text' => '#1a1a1a'),
        'cssVars' => array('accent-danger' => '#8b1a1a', 'brand-text' => '#2b2b2b', 'table-header-bg' => 'linear-gradient(to top, #5a5a5a, #3a3a3a, #232323)','table-header-text' => '#ffffff', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #707070, #5a5a5a, #454545)', 'table-header-sorted-text' => '#ffffff', 'table-footer-bg' => '#e8e8e8', 'table-footer-border' => '#2b2b2b', 'table-footer-text' => '#1a1a1a', 'zebra-light' => '#ffffff', 'zebra-dark' => '#efefef', 'table-link-color' => '#2b2b2b', 'header-card-bg' => 'linear-gradient(145deg, #ffffff, #e9e9e9)', 'header-card-border' => '#c8c8c8', 'header-card-accent' => '#2b2b2b', 'title-color' => '#1a1a1a', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#e3e3e3'),
    );

    // ---- Golden Hour (id stays theme-solarized-light) -----------------------
    $themes['theme-solarized-light'] = array(
        'id' => 'theme-solarized-light', 'label' => 'Golden Hour', 'isDark' => false,
        'aliases' => array('solarized-light', 'golden-hour', 'golden'),
        'vars' => array(
            'bg-body' => '#f7efdc', 'bg-surface' => '#fffaf0', 'bg-surface-alt' => '#efe4ca',
            'text-main' => '#23393a', 'text-muted' => '#55604f', 'border-color' => '#dccdaa',
            'brand-primary' => '#1f6b66', 'brand-secondary' => '#185a56',
        ),
        'xlsx' => array('headerBg' => '#1F6B66', 'headerGradient' => 'linear-gradient(to top, #185a56, #1f6b66)', 'headerFont' => '#FFFFFF', 'oddBg' => '#FFFAF0', 'evenBg' => '#F7EFDC', 'dataFont' => '#23393A', 'borderColor' => '#dccdaa', 'groupHeaderBg' => '#efe4ca', 'groupHeaderFont' => '#23393a', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#fffaf0', 'blockBorder' => '#dccdaa', 'titleColor' => '#1c4f4a', 'titleExtra' => '', 'tsColor' => '#55604f', 'pillBg' => '#f7efdc', 'pillBorder' => '#dccdaa', 'pillLabel' => '#55604f', 'pillValue' => '#1c5f5a'),
        'print' => array('headerBg' => '#1f6b66', 'footerBg' => '#efe4ca'),
        'emailGroup' => array('border' => '#dccdaa', 'headerBg' => '#f5ead2', 'nameColor' => '#23393a', 'countBg' => '#1f6b66', 'countColor' => '#ffffff', 'aggLabel' => '#55604f', 'aggValue' => '#23393a'),
        'nestedHeader' => array('bg' => '#efe4ca', 'text' => '#23393a', 'border' => '#dccdaa', 'border_top' => '#1f6b66', 'header_bg' => '#e8dab9', 'header_text' => '#23393a'),
        'cssVars' => array('accent-danger' => '#b3261e', 'on-brand' => '#ffffff', 'brand-text' => '#1c5f5a', 'table-header-bg' => 'linear-gradient(to top, #185a56, #1f6b66)','table-header-text' => '#ffffff', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #ecbf63, #e6b450)', 'table-header-sorted-text' => '#2a1e05', 'table-footer-bg' => '#efe4ca', 'table-footer-border' => '#1f6b66', 'table-footer-text' => '#23393a', 'zebra-light' => '#fffaf0', 'zebra-dark' => '#f7efdc', 'table-link-color' => '#17706a', 'header-card-bg' => 'linear-gradient(100deg, #f1e5c9, #e9d7ae)', 'header-card-border' => '#dccdaa', 'header-card-accent' => '#1f6b66', 'title-color' => '#1c4f4a', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#f0e4c8'),
    );

    // ---- Eclipse (id stays theme-solarized-dark) ------------------------------
    $themes['theme-solarized-dark'] = array(
        'id' => 'theme-solarized-dark', 'label' => 'Eclipse', 'isDark' => true,
        'aliases' => array('solarized', 'solarized-dark', 'eclipse'),
        'vars' => array(
            'bg-body' => '#061219', 'bg-surface' => '#0f242d', 'bg-surface-alt' => '#0a1b23',
            'text-main' => '#ece6d6', 'text-muted' => '#a9b3b0', 'border-color' => '#2a414a',
            'brand-primary' => '#e0ae5a', 'brand-secondary' => '#f0c987',
        ),
        'xlsx' => array('headerBg' => '#C99A4B', 'headerGradient' => 'linear-gradient(to top, #c99a4b, #deb066)', 'headerFont' => '#1A1104', 'oddBg' => '#061219', 'evenBg' => '#0C1E26', 'dataFont' => '#ECE6D6', 'borderColor' => '#2a414a', 'groupHeaderBg' => '#0f242d', 'groupHeaderFont' => '#ECE6D6', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#0f242d', 'blockBorder' => '#2a414a', 'titleColor' => '#f4e2b6', 'titleExtra' => '', 'tsColor' => '#a9b3b0', 'pillBg' => '#061219', 'pillBorder' => '#2a414a', 'pillLabel' => '#a9b3b0', 'pillValue' => '#efc987'),
        'print' => array('headerBg' => '#1f3a45', 'footerBg' => '#0f242d'),
        'emailGroup' => array('border' => '#2a414a', 'headerBg' => '#0f242d', 'nameColor' => '#ece6d6', 'countBg' => '#e0ae5a', 'countColor' => '#1a1104', 'aggLabel' => '#a9b3b0', 'aggValue' => '#ece6d6'),
        'nestedHeader' => array('bg' => '#0f242d', 'text' => '#ece6d6', 'border' => '#2a414a', 'border_top' => '#e0ae5a', 'header_bg' => '#14303a', 'header_text' => '#ece6d6'),
        'cssVars' => array('accent-danger' => '#f58f8b', 'on-brand' => '#1a1104', 'brand-text' => '#efc987', 'table-header-bg' => 'linear-gradient(to top, #c99a4b, #deb066)','table-header-text' => '#1a1104', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #f6ecd2, #efe0b8)', 'table-header-sorted-text' => '#1a1104', 'table-footer-bg' => '#0f242d', 'table-footer-border' => '#e0ae5a', 'table-footer-text' => '#ece6d6', 'zebra-light' => '#061219', 'zebra-dark' => '#0c1e26', 'table-link-color' => '#efc987', 'header-card-bg' => 'linear-gradient(90deg, #04101a 30%, #0a2029 75%, #10303a)', 'header-card-border' => '#2a414a', 'header-card-accent' => '#e0ae5a', 'title-color' => '#f4e2b6', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#1a333d'),
    );

    // ---- Forest (green, light) ----------------------------------------------
    // Bamboo-grove pass (2026-11-07): mint -> culm green. Brand #2f5a26 (8.1:1 as
    // text on white, so no brand-text), header #4a7a3a -> #2f5a26 (white 5.1:1 on
    // the light stop), title #2f5a26, muted #4a5c4e (5.5:1 on bg-surface-alt).
    // Whole Grove (2026-11-09): deeper page and table colours; the art is in main.css
    // HDRMIX "whole grove". The zebra rows stay opaque for the frozen columns. Muted text
    // is 4.5:1 on the darkest stalk, because some page text sits right on the grove.
    $themes['theme-forest'] = array(
        'id' => 'theme-forest', 'label' => 'Zen Forest', 'isDark' => false,
        'aliases' => array('zen', 'zen-forest'),
        'vars' => array(
            'bg-body' => '#dae6cf', 'bg-surface' => '#f3f8ef', 'bg-surface-alt' => '#d6e6cf',
            'text-main' => '#14241a', 'text-muted' => '#2e4035', 'border-color' => '#9dba92',
            'brand-primary' => '#2f5a26', 'brand-secondary' => '#4a7a3a',
        ),
        'xlsx' => array('headerBg' => '#2F5A26', 'headerGradient' => 'linear-gradient(to top, #4a7a3a, #2f5a26)', 'headerFont' => '#FFFFFF', 'oddBg' => '#F6FAF3', 'evenBg' => '#E6EFDF', 'dataFont' => '#17271C', 'borderColor' => '#b7cdaf', 'groupHeaderBg' => '#d6e6cf', 'groupHeaderFont' => '#2f5a26', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#eef5ea', 'blockBorder' => '#b7cdaf', 'titleColor' => '#2f5a26', 'titleExtra' => '', 'tsColor' => '#4a5c4e', 'pillBg' => '#f8fbf6', 'pillBorder' => '#b7cdaf', 'pillLabel' => '#4a5c4e', 'pillValue' => '#2f5a26'),
        'print' => array('headerBg' => '#2f5a26', 'footerBg' => '#d6e6cf'),
        'emailGroup' => array('border' => '#b7cdaf', 'headerBg' => '#e6f0df', 'nameColor' => '#17271c', 'countBg' => '#2f5a26', 'countColor' => '#ffffff', 'aggLabel' => '#5b6d61', 'aggValue' => '#2f5a26'),
        'nestedHeader' => array('bg' => '#d6e6cf', 'text' => '#17271c', 'border' => '#b7cdaf', 'border_top' => '#2f5a26', 'header_bg' => '#cfe1c8', 'header_text' => '#17271c'),
        'cssVars' => array('accent-danger' => '#a3473a', 'accent-success' => '#276f2b', 'table-header-bg' => '#2f5a26', 'table-header-text' => '#ffffff', 'table-header-sorted-bg' => '#cfe39a', 'table-header-sorted-text' => '#1d3016', 'table-footer-bg' => '#d6e6cf', 'table-footer-border' => '#2f5a26', 'table-footer-text' => '#17271c', 'zebra-light' => '#f3f8ef', 'zebra-dark' => '#e1ecd9', 'table-link-color' => '#2f5a26', 'header-card-bg' => 'linear-gradient(145deg, #eef5e8, #d6e4cb)', 'header-card-border' => '#9dba92', 'header-card-accent' => '#4a7a3a', 'title-color' => '#1f4119', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#cfe4c7'),
    );

    // (The High Contrast theme was REMOVED 2026-08-24 — it existed for
    // accessibility optics only: every remaining theme meets WCAG 2.1 AA
    // contrast on its own, and users needing true high contrast are served by
    // OS forced-colors / browser tooling, which overrides page CSS wholesale.)

    // ---- Neon Pulse (cyberpunk, dark) ---------------------------------------
    $themes['theme-neon-pulse'] = array(
        'id' => 'theme-neon-pulse', 'label' => 'Neon Pulse', 'isDark' => true,
        'aliases' => array('neon'),
        'vars' => array(
            'bg-body' => '#0a0118', 'bg-surface' => '#150a2e', 'bg-surface-alt' => '#0d0420',
            'text-main' => '#ece3ff', 'text-muted' => '#a08fce', 'border-color' => '#38215f',
            'brand-primary' => '#ff2bd6', 'brand-secondary' => '#21f3ff',
        ),
        'xlsx' => array('headerBg' => '#FF2BD6', 'headerGradient' => 'linear-gradient(to top, #ff5ce0, #ff2bd6, #c000a0)', 'headerFont' => '#FFFFFF', 'oddBg' => '#0A0118', 'evenBg' => '#150A2E', 'dataFont' => '#ECE3FF', 'borderColor' => '#38215f', 'groupHeaderBg' => '#1b0d38', 'groupHeaderFont' => '#ECE3FF', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#150a2e', 'blockBorder' => '#38215f', 'titleColor' => '#ff2bd6', 'titleExtra' => '', 'tsColor' => '#a08fce', 'pillBg' => '#0a0118', 'pillBorder' => '#38215f', 'pillLabel' => '#8a78b8', 'pillValue' => '#21f3ff'),
        'print' => array('headerBg' => '#ff2bd6', 'footerBg' => '#150a2e'),
        'emailGroup' => array('border' => '#38215f', 'headerBg' => '#150a2e', 'nameColor' => '#ece3ff', 'countBg' => '#ff2bd6', 'countColor' => '#0a0118', 'aggLabel' => '#8a78b8', 'aggValue' => '#ece3ff'),
        'nestedHeader' => array('bg' => '#150a2e', 'text' => '#ece3ff', 'border' => '#38215f', 'border_top' => '#ff2bd6', 'header_bg' => '#1b0d38', 'header_text' => '#ece3ff'),
        'cssVars' => array('accent-danger' => '#ff5c5c', 'on-brand' => '#000000', 'table-header-bg' => 'linear-gradient(to top, #ff5ce0, #ff2bd6, #e600bf)','table-header-text' => '#000000', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #21f3ff, #10e0ee, #00c9d8)', 'table-header-sorted-text' => '#000000', 'table-footer-bg' => '#150a2e', 'table-footer-border' => '#ff2bd6', 'table-footer-text' => '#ece3ff', 'zebra-light' => '#0a0118', 'zebra-dark' => '#150a2e', 'table-link-color' => '#21f3ff', 'header-card-bg' => 'linear-gradient(135deg, #0a0118, #150a2e)', 'header-card-border' => '#38215f', 'header-card-accent' => '#ff2bd6', 'title-color' => '#21f3ff', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#3d0d40'),
    );

    // ---- Tangerine (orange, light) ------------------------------------------
    // Faint Branch (2026-11-08): cream and char with one bright orange sorted column.
    // Header card art: main.css HDRMIX "faint branch".
    $themes['theme-tangerine'] = array(
        'id' => 'theme-tangerine', 'label' => 'Burnt Tangerine', 'isDark' => false,
        'aliases' => array('orange', 'sunset', 'burnt'),
        'vars' => array(
            'bg-body' => '#fbf1e4', 'bg-surface' => '#fffaf3', 'bg-surface-alt' => '#f6e6d1',
            'text-main' => '#2f1a0e', 'text-muted' => '#6e4a30', 'border-color' => '#ecd6ba',
            'brand-primary' => '#b4470a', 'brand-secondary' => '#96390a',
        ),
        'xlsx' => array('headerBg' => '#3A1606', 'headerGradient' => 'linear-gradient(to top, #2b1004, #3a1606)', 'headerFont' => '#FFE9CF', 'oddBg' => '#FFFAF3', 'evenBg' => '#F9EDDC', 'dataFont' => '#2F1A0E', 'borderColor' => '#ecd6ba', 'groupHeaderBg' => '#f6e6d1', 'groupHeaderFont' => '#3a1606', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#fff5e6', 'blockBorder' => '#ecd6ba', 'titleColor' => '#3a1606', 'titleExtra' => '', 'tsColor' => '#6e4a30', 'pillBg' => '#fffaf3', 'pillBorder' => '#ecd6ba', 'pillLabel' => '#6e4a30', 'pillValue' => '#a13f08'),
        'print' => array('headerBg' => '#3a1606', 'footerBg' => '#f6e6d1'),
        'emailGroup' => array('border' => '#ecd6ba', 'headerBg' => '#fbf1e4', 'nameColor' => '#2f1a0e', 'countBg' => '#b4470a', 'countColor' => '#ffffff', 'aggLabel' => '#6e4a30', 'aggValue' => '#3a1606'),
        'nestedHeader' => array('bg' => '#f6e6d1', 'text' => '#2f1a0e', 'border' => '#ecd6ba', 'border_top' => '#b4470a', 'header_bg' => '#efdcc2', 'header_text' => '#2f1a0e'),
        'cssVars' => array('accent-danger' => '#b91c1c', 'on-brand' => '#ffffff', 'brand-text' => '#a13f08', 'table-header-bg' => 'linear-gradient(to top, #2b1004, #3a1606)','table-header-text' => '#ffe9cf', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #f6913a, #f2811f)', 'table-header-sorted-text' => '#1f0b02', 'table-footer-bg' => '#f6e6d1', 'table-footer-border' => '#b4470a', 'table-footer-text' => '#2f1a0e', 'zebra-light' => '#fffaf3', 'zebra-dark' => '#f9eddc', 'table-link-color' => '#a13f08', 'header-card-bg' => '#fff5e6', 'header-card-border' => '#ecd6ba', 'header-card-accent' => '#3a1606', 'title-color' => '#3a1606', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#f7e2c8'),
    );

    // ---- Amethyst (purple, dark) --------------------------------------------
    $themes['theme-amethyst'] = array(
        'id' => 'theme-amethyst', 'label' => 'Amethyst', 'isDark' => true,
        'aliases' => array('purple'),
        'vars' => array(
            'bg-body' => '#140a22', 'bg-surface' => '#1f1133', 'bg-surface-alt' => '#170c28',
            'text-main' => '#ece3f7', 'text-muted' => '#a593c4', 'border-color' => '#3a2458',
            'brand-primary' => '#a855f7', 'brand-secondary' => '#c084fc',
        ),
        'xlsx' => array('headerBg' => '#7E22CE', 'headerGradient' => 'linear-gradient(to top, #a855f7, #7e22ce, #6b21a8)', 'headerFont' => '#FFFFFF', 'oddBg' => '#140A22', 'evenBg' => '#1F1133', 'dataFont' => '#ECE3F7', 'borderColor' => '#3a2458', 'groupHeaderBg' => '#261640', 'groupHeaderFont' => '#ECE3F7', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#1f1133', 'blockBorder' => '#3a2458', 'titleColor' => '#c084fc', 'titleExtra' => '', 'tsColor' => '#a593c4', 'pillBg' => '#140a22', 'pillBorder' => '#3a2458', 'pillLabel' => '#8c79ad', 'pillValue' => '#c084fc'),
        'print' => array('headerBg' => '#7e22ce', 'footerBg' => '#1f1133'),
        'emailGroup' => array('border' => '#3a2458', 'headerBg' => '#1f1133', 'nameColor' => '#ece3f7', 'countBg' => '#7e22ce', 'countColor' => '#ffffff', 'aggLabel' => '#8c79ad', 'aggValue' => '#ece3f7'),
        'nestedHeader' => array('bg' => '#1f1133', 'text' => '#ece3f7', 'border' => '#3a2458', 'border_top' => '#a855f7', 'header_bg' => '#261640', 'header_text' => '#ece3f7'),
        'cssVars' => array('accent-danger' => '#fb7185', 'on-brand' => '#000000', 'brand-text' => '#aa5af7', 'table-header-bg' => 'linear-gradient(to top, #9a3ff0, #7e22ce, #6b21a8)','table-header-text' => '#ffffff', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #d8b4fe, #c084fc)', 'table-header-sorted-text' => '#2e1065', 'table-footer-bg' => '#1f1133', 'table-footer-border' => '#a855f7', 'table-footer-text' => '#ece3f7', 'zebra-light' => '#140a22', 'zebra-dark' => '#1f1133', 'table-link-color' => '#c084fc', 'header-card-bg' => 'linear-gradient(135deg, #140a22, #1f1133)', 'header-card-border' => '#3a2458', 'header-card-accent' => '#a855f7', 'title-color' => '#c084fc', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#3a2466'),
    );

    // ---- Gruvbox (dark, warm retro) -----------------------------------------
    // Supergraphic redo (2026-11-08): chocolate surfaces + cream text, with a
    // burnt-orange table header, harvest-gold links and a gold title.
    // Header/badge use DARK text on the bright orange, so no table-header/
    // badge overrides are needed. Like every dark theme with a
    // dark 'on-brand', it IS listed in the css/main.css .sp-btn-primary
    // fill+text force (".is-dark button" clobbers both halves of that pairing).
    $themes['theme-gruvbox'] = array(
        'id' => 'theme-gruvbox', 'label' => 'Retro Groove', 'isDark' => true,
        'aliases' => array('retro', 'warm', 'groove', 'retro-groove'),
        'vars' => array(
            'bg-body' => '#241710', 'bg-surface' => '#38261a', 'bg-surface-alt' => '#2e1f15',
            'text-main' => '#f3e3c3', 'text-muted' => '#c9b08b', 'border-color' => '#57402c',
            'brand-primary' => '#ef8a23', 'brand-secondary' => '#f6c94f',
        ),
        'xlsx' => array('headerBg' => '#E5622A', 'headerGradient' => 'linear-gradient(to top, #e5622a, #d4551f)', 'headerFont' => '#1E0F07', 'oddBg' => '#241710', 'evenBg' => '#2E1F15', 'dataFont' => '#F3E3C3', 'borderColor' => '#57402c', 'groupHeaderBg' => '#2e1f15', 'groupHeaderFont' => '#f6c94f', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#241710', 'blockBorder' => '#57402c', 'titleColor' => '#f7c64d', 'titleExtra' => '', 'tsColor' => '#c9b08b', 'pillBg' => '#38261a', 'pillBorder' => '#57402c', 'pillLabel' => '#c9b08b', 'pillValue' => '#f6c94f'),
        'print' => array('headerBg' => '#e5622a', 'footerBg' => '#38261a'),
        'emailGroup' => array('border' => '#57402c', 'headerBg' => '#38261a', 'nameColor' => '#f3e3c3', 'countBg' => '#ef8a23', 'countColor' => '#231409', 'aggLabel' => '#c9b08b', 'aggValue' => '#f6c94f'),
        'nestedHeader' => array('bg' => '#38261a', 'text' => '#f3e3c3', 'border' => '#57402c', 'border_top' => '#ef8a23', 'header_bg' => '#2e1f15', 'header_text' => '#f3e3c3'),
        'cssVars' => array('accent-danger' => '#fc9080', 'on-brand' => '#231409', 'table-header-bg' => 'linear-gradient(to top, #e5622a, #d4551f)','table-header-text' => '#1e0f07', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #f6c94f, #f2b632)', 'table-header-sorted-text' => '#231409', 'table-footer-bg' => '#38261a', 'table-footer-border' => '#ef8a23', 'table-footer-text' => '#f3e3c3', 'zebra-light' => '#241710', 'zebra-dark' => '#2e1f15', 'table-link-color' => '#f6c94f', 'header-card-bg' => 'linear-gradient(140deg, #38261a, #2a1b12)', 'header-card-border' => '#57402c', 'header-card-accent' => '#ef8a23', 'title-color' => '#f7c64d', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#4a3424'),
    );

    // ---- Amber Terminal (dark, monospace) -----------------------------------
    // First font-carrying theme: 'report-font' in vars drives the on-screen
    // font via var(--report-font, ...) across css/main.css; xlsx.fontName
    // carries the monospace font into Excel exports. Warm amber-on-brown CRT.
    $themes['theme-terminal'] = array(
        'id' => 'theme-terminal', 'label' => 'Amber Terminal', 'isDark' => true,
        'aliases' => array('crt', 'amber', 'amber-terminal'),
        'vars' => array(
            'bg-body' => '#1c1611', 'bg-surface' => '#271f17', 'bg-surface-alt' => '#201813',
            'text-main' => '#e8c88a', 'text-muted' => '#a8865a', 'border-color' => '#4a3a28',
            'brand-primary' => '#ff9e1b', 'brand-secondary' => '#ffc24d',
            'report-font' => "Consolas, 'Courier New', monospace",
        ),
        'xlsx' => array('headerBg' => '#2B2013', 'headerGradient' => 'linear-gradient(to top, #3a2a1a, #2b2013)', 'headerFont' => '#FFB84D', 'oddBg' => '#1C1611', 'evenBg' => '#241C14', 'dataFont' => '#E8C88A', 'borderColor' => '#4a3a28', 'groupHeaderBg' => '#2e2417', 'groupHeaderFont' => '#ffc24d', 'fontName' => 'Consolas', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#1c1611', 'blockBorder' => '#4a3a28', 'titleColor' => '#ffc24d', 'titleExtra' => '', 'tsColor' => '#a8865a', 'pillBg' => '#271f17', 'pillBorder' => '#4a3a28', 'pillLabel' => '#a8865a', 'pillValue' => '#ffc24d'),
        'print' => array('headerBg' => '#2b2013', 'footerBg' => '#271f17'),
        'emailGroup' => array('border' => '#4a3a28', 'headerBg' => '#271f17', 'nameColor' => '#e8c88a', 'countBg' => '#b06a12', 'countColor' => '#100a05', 'aggLabel' => '#9d876c', 'aggValue' => '#ffc24d'),
        'nestedHeader' => array('bg' => '#271f17', 'text' => '#e8c88a', 'border' => '#4a3a28', 'border_top' => '#ff9e1b', 'header_bg' => '#2e2417', 'header_text' => '#e8c88a'),
        'cssVars' => array('accent-danger' => '#ff6b57', 'on-brand' => '#1c1611', 'table-header-bg' => 'linear-gradient(to top, #3a2a1a, #2b2013)','table-header-text' => '#ffb84d', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #ffc24d, #ff9e1b)', 'table-header-sorted-text' => '#2b2013', 'table-footer-bg' => '#271f17', 'table-footer-border' => '#ff9e1b', 'table-footer-text' => '#e8c88a', 'zebra-light' => '#1c1611', 'zebra-dark' => '#241c14', 'table-link-color' => '#ffc24d', 'header-card-bg' => 'linear-gradient(135deg, #1c1611, #271f17)', 'header-card-border' => '#4a3a28', 'header-card-accent' => '#ff9e1b', 'title-color' => '#ffc24d', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#332715'),
    );

    // ---- Matrix (dark, monospace) -------------------------------------------
    // Phosphor green-on-black digital-rain homage. Like Amber Terminal it is a
    // font-carrying theme (report-font monospace) with a bright LIGHT brand
    // (#00ff41), so button text rides 'on-brand' (dark) and it shares the
    // terminal-style main.css contrast fixes (.sp-btn-primary fill force,
    // autocomplete/pcs active-item text). Header watermark: img/matrix-rain.svg
    // (registered in the css/main.css dark-theme watermark block).
    $themes['theme-matrix'] = array(
        'id' => 'theme-matrix', 'label' => 'Matrix', 'isDark' => true,
        'aliases' => array('matrix', 'digital-rain', 'code-rain'),
        'vars' => array(
            'bg-body' => '#061206', 'bg-surface' => '#0b1f0c', 'bg-surface-alt' => '#081808',
            'text-main' => '#58f570', 'text-muted' => '#3da24c', 'border-color' => '#1e4a20',
            'brand-primary' => '#00ff41', 'brand-secondary' => '#8affab',
            'report-font' => "Consolas, 'Courier New', monospace",
        ),
        'xlsx' => array('headerBg' => '#0D2B12', 'headerGradient' => 'linear-gradient(to top, #14401c, #0d2b12)', 'headerFont' => '#00FF41', 'oddBg' => '#061206', 'evenBg' => '#0A1C0B', 'dataFont' => '#58F570', 'borderColor' => '#1e4a20', 'groupHeaderBg' => '#0d2610', 'groupHeaderFont' => '#8affab', 'fontName' => 'Consolas', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#061206', 'blockBorder' => '#1e4a20', 'titleColor' => '#00ff41', 'titleExtra' => '', 'tsColor' => '#3da24c', 'pillBg' => '#0b1f0c', 'pillBorder' => '#1e4a20', 'pillLabel' => '#3da24c', 'pillValue' => '#8affab'),
        'print' => array('headerBg' => '#0d2b12', 'footerBg' => '#0b1f0c'),
        'emailGroup' => array('border' => '#1e4a20', 'headerBg' => '#0b1f0c', 'nameColor' => '#58f570', 'countBg' => '#00ff41', 'countColor' => '#061206', 'aggLabel' => '#3da24c', 'aggValue' => '#8affab'),
        'nestedHeader' => array('bg' => '#0b1f0c', 'text' => '#58f570', 'border' => '#1e4a20', 'border_top' => '#00ff41', 'header_bg' => '#0d2610', 'header_text' => '#58f570'),
        'cssVars' => array('accent-danger' => '#ff5c5c', 'on-brand' => '#061206', 'table-header-bg' => 'linear-gradient(to top, #14401c, #0d2b12)','table-header-text' => '#00ff41', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #00ff41, #00d936)', 'table-header-sorted-text' => '#020a04', 'table-footer-bg' => '#0b1f0c', 'table-footer-border' => '#00ff41', 'table-footer-text' => '#58f570', 'zebra-light' => '#061206', 'zebra-dark' => '#0a1c0b', 'table-link-color' => '#8affab', 'header-card-bg' => 'linear-gradient(135deg, #061206, #0b1f0c)', 'header-card-border' => '#1e4a20', 'header-card-accent' => '#00ff41', 'title-color' => '#00ff41', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#113417'),
    );

    // ---- Hello Kitty (pink, light) ------------------------------------------
    $themes['theme-hello-kitty'] = array(
        'id' => 'theme-hello-kitty', 'label' => 'Hello Kitty', 'isDark' => false,
        'aliases' => array('kitty', 'pink'),
        'vars' => array(
            'bg-body' => '#fff5f8', 'bg-surface' => '#ffffff', 'bg-surface-alt' => '#ffe6ef',
            'text-main' => '#6b3a4b', 'text-muted' => '#885e6c', 'border-color' => '#ffc9dd',
            'brand-primary' => '#ff5fa2', 'brand-secondary' => '#ff8fbf',
        ),
        'xlsx' => array('headerBg' => '#AD1457', 'headerGradient' => 'linear-gradient(to top, #c2185b, #ad1457, #880e4f)', 'headerFont' => '#FFFFFF', 'oddBg' => '#FFF5F8', 'evenBg' => '#FFE6EF', 'dataFont' => '#6B3A4B', 'borderColor' => '#ffc9dd', 'groupHeaderBg' => '#ffd6e6', 'groupHeaderFont' => '#99304f', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#fffafb', 'blockBorder' => '#ffc9dd', 'titleColor' => '#e63e87', 'titleExtra' => '', 'tsColor' => '#b07a8c', 'pillBg' => '#ffffff', 'pillBorder' => '#ffc9dd', 'pillLabel' => '#b07a8c', 'pillValue' => '#ff5fa2'),
        'print' => array('headerBg' => '#ad1457', 'footerBg' => '#ffd6e6'),
        'emailGroup' => array('border' => '#ffc9dd', 'headerBg' => '#fff0f5', 'nameColor' => '#6b3a4b', 'countBg' => '#c2487b', 'countColor' => '#ffffff', 'aggLabel' => '#876570', 'aggValue' => '#99304f'),
        'nestedHeader' => array('bg' => '#ffe6ef', 'text' => '#6b3a4b', 'border' => '#ffb3cf', 'border_top' => '#ff5fa2', 'header_bg' => '#ffd9e7', 'header_text' => '#6b3a4b'),
        'cssVars' => array('accent-danger' => '#c62828', 'on-brand' => '#000000', 'brand-text' => '#cf0057', 'table-header-bg' => 'linear-gradient(to top, #c2185b, #ad1457, #880e4f)','table-header-text' => '#ffffff', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #ff8fbf, #ff5fa2)', 'table-header-sorted-text' => '#4a0a2a', 'table-footer-bg' => '#ffd6e6', 'table-footer-border' => '#ff5fa2', 'table-footer-text' => '#6b3a4b', 'zebra-light' => '#fff5f8', 'zebra-dark' => '#ffe6ef', 'table-link-color' => '#1e6fa8', 'header-card-bg' => 'linear-gradient(145deg, #ffffff, #ffe6ef)', 'header-card-border' => '#ffc9dd', 'header-card-accent' => '#ff5fa2', 'title-color' => '#e63e87', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#ffe2ee'),
    );

    // ---- Blueprint (cyanotype drafting sheet, dark-ish mid tone) -------------
    // Prussian-blue paper with white ink: the only mid-tone page in the set.
    // The brand is chalk yellow, so --on-brand is DARK (buttons read dark on
    // chalk); css/main.css re-pairs .sp-btn-primary and the status-bar avatar
    // for it at the end of the file (the two listed exceptions for a light
    // brand on a dark theme). Added 2026-11-06.
    $themes['theme-blueprint'] = array(
        'id' => 'theme-blueprint', 'label' => 'Blueprint', 'isDark' => true,
        'aliases' => array('drafting'),
        'vars' => array(
            'bg-body' => '#0f3058', 'bg-surface' => '#12365f', 'bg-surface-alt' => '#0d2a4d',
            'text-main' => '#f3f7fb', 'text-muted' => '#b9cbe0', 'border-color' => '#3f5f86',
            'brand-primary' => '#f5e6a3', 'brand-secondary' => '#fff3c4',
        ),
        'xlsx' => array('headerBg' => '#163F6E', 'headerGradient' => 'linear-gradient(to top, #1a4a7e, #163f6e, #12365f)', 'headerFont' => '#F3F7FB', 'oddBg' => '#12365F', 'evenBg' => '#10325A', 'dataFont' => '#F3F7FB', 'borderColor' => '#3f5f86', 'groupHeaderBg' => '#0d2a4d', 'groupHeaderFont' => '#F5E6A3', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#12365f', 'blockBorder' => '#3f5f86', 'titleColor' => '#f3f7fb', 'titleExtra' => '', 'tsColor' => '#b9cbe0', 'pillBg' => '#0f3058', 'pillBorder' => '#3f5f86', 'pillLabel' => '#b9cbe0', 'pillValue' => '#f5e6a3'),
        'print' => array('headerBg' => '#163f6e', 'footerBg' => '#12365f'),
        'emailGroup' => array('border' => '#3f5f86', 'headerBg' => '#12365f', 'nameColor' => '#f3f7fb', 'countBg' => '#f5e6a3', 'countColor' => '#12365f', 'aggLabel' => '#b9cbe0', 'aggValue' => '#f3f7fb'),
        'nestedHeader' => array('bg' => '#12365f', 'text' => '#f3f7fb', 'border' => '#3f5f86', 'border_top' => '#f5e6a3', 'header_bg' => '#0d2a4d', 'header_text' => '#f3f7fb'),
        'cssVars' => array('accent-danger' => '#f4b4a6', 'accent-success' => '#a8e6c3', 'on-brand' => '#12365f', 'brand-text' => '#bfe3ff', 'table-header-bg' => 'linear-gradient(to top, #1a4a7e, #163f6e, #12365f)','table-header-text' => '#f3f7fb', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #fff3c4, #f5e6a3)', 'table-header-sorted-text' => '#0f2a47', 'table-footer-bg' => '#0d2a4d', 'table-footer-border' => '#f5e6a3', 'table-footer-text' => '#f3f7fb', 'zebra-light' => '#12365f', 'zebra-dark' => '#10325a', 'table-link-color' => '#bfe3ff', 'header-card-bg' => 'linear-gradient(135deg, #12365f, #0f3058)', 'header-card-border' => '#6f8db0', 'header-card-accent' => '#f5e6a3', 'title-color' => '#f3f7fb', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#1a4a7e'),
    );

    // ---- Harbor (coastal, light) --------------------------------------------
    // The cool light theme: fog grey-blue page, white surfaces, navy headers,
    // a brass accent and dusty teal links. Added 2026-11-06.
    $themes['theme-harbor'] = array(
        'id' => 'theme-harbor', 'label' => 'Harbor', 'isDark' => false,
        'aliases' => array('harbour', 'coastal', 'nautical'),
        'vars' => array(
            'bg-body' => '#eef2f5', 'bg-surface' => '#ffffff', 'bg-surface-alt' => '#f6f8fa',
            'text-main' => '#2b3a48', 'text-muted' => '#5b6b7a', 'border-color' => '#cfd8e0',
            'brand-primary' => '#1f3550', 'brand-secondary' => '#2e4a6b',
        ),
        'xlsx' => array('headerBg' => '#1F3550', 'headerGradient' => 'linear-gradient(to top, #2e4a6b, #1f3550, #162838)', 'headerFont' => '#FFFFFF', 'oddBg' => '#FFFFFF', 'evenBg' => '#F6F8FA', 'dataFont' => '#2B3A48', 'borderColor' => '#cfd8e0', 'groupHeaderBg' => '#e6ecf1', 'groupHeaderFont' => '#1f3550', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#f6f8fa', 'blockBorder' => '#cfd8e0', 'titleColor' => '#1f3550', 'titleExtra' => '', 'tsColor' => '#5b6b7a', 'pillBg' => '#ffffff', 'pillBorder' => '#cfd8e0', 'pillLabel' => '#5b6b7a', 'pillValue' => '#2a6f7c'),
        'print' => array('headerBg' => '#1f3550', 'footerBg' => '#e6ecf1'),
        'emailGroup' => array('border' => '#cfd8e0', 'headerBg' => '#f6f8fa', 'nameColor' => '#2b3a48', 'countBg' => '#1f3550', 'countColor' => '#ffffff', 'aggLabel' => '#5b6b7a', 'aggValue' => '#1f3550'),
        'nestedHeader' => array('bg' => '#f6f8fa', 'text' => '#2b3a48', 'border' => '#cfd8e0', 'border_top' => '#b08d57', 'header_bg' => '#e6ecf1', 'header_text' => '#2b3a48'),
        'cssVars' => array('accent-danger' => '#a8453a', 'accent-success' => '#276f50', 'brand-text' => '#2a6f7c', 'table-header-bg' => 'linear-gradient(to top, #2e4a6b, #1f3550, #162838)','table-header-text' => '#ffffff', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #d4b36a, #b9924a)', 'table-header-sorted-text' => '#162838', 'table-footer-bg' => '#e6ecf1', 'table-footer-border' => '#1f3550', 'table-footer-text' => '#2b3a48', 'zebra-light' => '#ffffff', 'zebra-dark' => '#f6f8fa', 'table-link-color' => '#2a6f7c', 'header-card-bg' => 'linear-gradient(145deg, #ffffff, #f3f6f9)', 'header-card-border' => '#cfd8e0', 'header-card-accent' => '#b08d57', 'title-color' => '#1f3550', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#e6ecf1'),
    );

    // ---- Ember (warm, dark) -------------------------------------------------
    // Charcoal with warm browns and cream text; the brand is a burnt orange
    // that carries white (5.2:1), its hover a deeper one. Added 2026-11-06.
    // (2026-11-12) 'on-brand' says so: the rules whose fallback is not white (the
    // header text's cream, 3.8:1 on the orange) read it on every brand fill.
    $themes['theme-ember'] = array(
        'id' => 'theme-ember', 'label' => 'Ember', 'isDark' => true,
        'aliases' => array('coals', 'campfire'),
        'vars' => array(
            'bg-body' => '#17120f', 'bg-surface' => '#221a15', 'bg-surface-alt' => '#1b1511',
            'text-main' => '#e7d4bf', 'text-muted' => '#b89a7c', 'border-color' => '#4a3426',
            'brand-primary' => '#c2410c', 'brand-secondary' => '#a8360a',
        ),
        'xlsx' => array('headerBg' => '#3B2518', 'headerGradient' => 'linear-gradient(to top, #4a2e1d, #3b2518, #2d1b11)', 'headerFont' => '#F3D9B1', 'oddBg' => '#221A15', 'evenBg' => '#1D1612', 'dataFont' => '#E7D4BF', 'borderColor' => '#4a3426', 'groupHeaderBg' => '#2a1f18', 'groupHeaderFont' => '#F0C38E', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#221a15', 'blockBorder' => '#4a3426', 'titleColor' => '#f3d9b1', 'titleExtra' => '', 'tsColor' => '#b89a7c', 'pillBg' => '#17120f', 'pillBorder' => '#4a3426', 'pillLabel' => '#b89a7c', 'pillValue' => '#f0c38e'),
        'print' => array('headerBg' => '#3b2518', 'footerBg' => '#221a15'),
        'emailGroup' => array('border' => '#4a3426', 'headerBg' => '#221a15', 'nameColor' => '#e7d4bf', 'countBg' => '#c2410c', 'countColor' => '#ffffff', 'aggLabel' => '#b89a7c', 'aggValue' => '#f0c38e'),
        'nestedHeader' => array('bg' => '#221a15', 'text' => '#e7d4bf', 'border' => '#4a3426', 'border_top' => '#c2410c', 'header_bg' => '#2a1f18', 'header_text' => '#e7d4bf'),
        'cssVars' => array('accent-danger' => '#f08c6e', 'accent-success' => '#9fcf8a', 'on-brand' => '#ffffff', 'brand-text' => '#f0c38e', 'table-header-bg' => 'linear-gradient(to top, #4a2e1d, #3b2518, #2d1b11)','table-header-text' => '#f3d9b1', 'table-header-sorted-bg' => 'linear-gradient(to bottom, #c2410c, #a8360a)', 'table-header-sorted-text' => '#ffffff', 'table-footer-bg' => '#2a1f18', 'table-footer-border' => '#c2410c', 'table-footer-text' => '#e7d4bf', 'zebra-light' => '#221a15', 'zebra-dark' => '#1d1612', 'table-link-color' => '#f0c38e', 'header-card-bg' => 'linear-gradient(180deg, #221a15, #1b1511)', 'header-card-border' => '#4a3426', 'header-card-accent' => '#c2410c', 'title-color' => '#f3d9b1', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#33261c'),
    );

    // ---- Easy Read (RETIRED -> density setting) -----------------------------
    // Kept as a legacy data row ONLY so server-side lookups for old saved
    // reports whose state still carries theme=theme-easy-read render exactly as
    // before. Excluded from the picker, the JS active-id list, and dark
    // detection. Has no nestedHeader (the original $theme_map had no easy-read).
    $themes['theme-easy-read'] = array(
        'id' => 'theme-easy-read', 'label' => 'Easy Read', 'isDark' => false, 'legacy' => true,
        'aliases' => array(),
        'vars' => array(),
        'xlsx' => array('headerBg' => '#336699', 'headerGradient' => 'linear-gradient(to top, #4a7cb8, #336699, #2a5588)', 'headerFont' => '#FFFFFF', 'oddBg' => '#FFFFFF', 'evenBg' => '#F2F2F2', 'dataFont' => '#000000', 'borderColor' => '#DDDDDD', 'groupHeaderBg' => '#eeeeee', 'groupHeaderFont' => '#333333', 'fontName' => 'Verdana', 'fontSize' => 12),
        'emailHeader' => array('blockBg' => '#f9f9f9', 'blockBorder' => '#ddd', 'titleColor' => '#074586', 'titleExtra' => '', 'tsColor' => '#555', 'pillBg' => '#ffffff', 'pillBorder' => '#cbd5e1', 'pillLabel' => '#64748b', 'pillValue' => '#0ea5e9'),
        'print' => array('headerBg' => '#336699', 'footerBg' => '#e0eaf1'),
        'emailGroup' => array('border' => '#e5e7eb', 'headerBg' => '#fafbfc', 'nameColor' => '#1a1a2e', 'countBg' => '#555555', 'countColor' => '#fff', 'aggLabel' => '#717171', 'aggValue' => '#333'),
    );

    return $themes;
}
}

if (!function_exists('penumbra_get_active_theme_ids')) {
function penumbra_get_active_theme_ids() {
    $ids = array();
    foreach (penumbra_get_themes() as $id => $t) {
        if (isset($t['legacy']) && $t['legacy']) {
            continue;
        }
        $ids[] = $id;
    }
    return $ids;
}
}

if (!function_exists('penumbra_build_theme_styles')) {
function penumbra_build_theme_styles() {
    $out = array();
    foreach (penumbra_get_themes() as $id => $t) {
        if (isset($t['xlsx'])) {
            $out[$id] = $t['xlsx'];
        }
    }
    return $out;
}
}

if (!function_exists('penumbra_build_email_header_themes')) {
function penumbra_build_email_header_themes() {
    $out = array();
    foreach (penumbra_get_themes() as $id => $t) {
        if (isset($t['emailHeader'])) {
            $out[$id] = $t['emailHeader'];
        }
    }
    return $out;
}
}

if (!function_exists('penumbra_build_theme_map')) {
function penumbra_build_theme_map() {
    $out = array();
    foreach (penumbra_get_themes() as $id => $t) {
        if (isset($t['nestedHeader'])) {
            $out[$id] = $t['nestedHeader'];
        }
    }
    return $out;
}
}

if (!function_exists('penumbra_hex_to_argb')) {
function penumbra_hex_to_argb($hex) {
    $h = ltrim($hex, '#');
    return 'FF' . strtoupper($h);
}
}

if (!function_exists('penumbra_build_js_payload')) {
function penumbra_build_js_payload() {
    $payload = array();
    foreach (penumbra_get_themes() as $id => $t) {
        $entry = array(
            'id'     => $t['id'],
            'label'  => $t['label'],
            'isDark' => $t['isDark'] ? true : false,
        );
        if (isset($t['legacy']) && $t['legacy']) {
            $entry['legacy'] = true;
        }
        // Flag registry-CSS themes so the body can carry a 'registry-theme'
        // marker class (set by applyTheme) -- lets light AND dark new themes
        // share component rules (links/buttons) without per-theme CSS.
        if (!empty($t['cssVars'])) {
            $entry['modern'] = true;
        }
        $entry['vars'] = isset($t['vars']) ? $t['vars'] : array();

        // emailHeader for getEmailHeaderTheme(): server row + headerBg/dataFont
        // pulled from the xlsx row (that is how the old JS object was shaped).
        $eh = isset($t['emailHeader']) ? $t['emailHeader'] : array();
        if (isset($t['xlsx']['headerBg'])) {
            $eh['headerBg'] = $t['xlsx']['headerBg'];
        }
        if (isset($t['xlsx']['dataFont'])) {
            $eh['dataFont'] = $t['xlsx']['dataFont'];
        }
        $entry['emailHeader'] = $eh;

        $entry['print'] = isset($t['print']) ? $t['print'] : array();
        $entry['emailGroup'] = isset($t['emailGroup']) ? $t['emailGroup'] : array();

        // excel: ARGB derived from the xlsx row (subset of fields the JS uses).
        if (isset($t['xlsx'])) {
            $x = $t['xlsx'];
            $entry['excel'] = array(
                'headerBg'        => penumbra_hex_to_argb($x['headerBg']),
                'headerFont'      => penumbra_hex_to_argb($x['headerFont']),
                'oddBg'           => penumbra_hex_to_argb($x['oddBg']),
                'evenBg'          => penumbra_hex_to_argb($x['evenBg']),
                'dataFont'        => penumbra_hex_to_argb($x['dataFont']),
                'groupHeaderBg'   => penumbra_hex_to_argb($x['groupHeaderBg']),
                'groupHeaderFont' => penumbra_hex_to_argb($x['groupHeaderFont']),
            );
        }

        $payload[$id] = $entry;
    }
    return $payload;
}
}

if (!function_exists('penumbra_build_alias_map')) {
function penumbra_build_alias_map() {
    $out = array();
    foreach (penumbra_get_themes() as $id => $t) {
        if (isset($t['legacy']) && $t['legacy']) {
            continue;
        }
        if (isset($t['aliases']) && is_array($t['aliases'])) {
            foreach ($t['aliases'] as $alias) {
                $out[$alias] = $id;
            }
        }
    }
    return $out;
}
}

if (!function_exists('penumbra_emit_themes_js')) {
function penumbra_emit_themes_js() {
    $payload = penumbra_build_js_payload();
    $ids     = penumbra_get_active_theme_ids();
    $aliases = penumbra_build_alias_map();
    echo 'window.PENUMBRA_THEMES = ' . json_encode($payload) . ';';
    echo 'window.PENUMBRA_THEME_IDS = ' . json_encode($ids) . ';';
    echo 'window.PENUMBRA_THEME_ALIASES = ' . json_encode($aliases) . ';';
    echo 'window.PENUMBRA_LANDING_DEFAULT_THEME = ' . json_encode(PENUMBRA_LANDING_DEFAULT_THEME) . ';';
    // 'random' ("Surprise Me" in the pickers) is a stored preference, never a
    // rendered theme. Every reader turns it into one real theme id here, the same
    // one for the whole page load. Picks work like a shuffled playlist: every theme
    // shows once before any repeats, across all reports in this browser, and a new
    // cycle never opens on the theme that closed the last one. The list holds what
    // has been SHOWN, so an added theme just joins and a retired one is ignored.
    // The guard matters: a page can emit this twice.
    echo <<<'JS'

if (!window.penumbraResolveTheme) (function () {
    var pick = null, KEY = 'penumbra_random_theme_seen';
    window.penumbraResolveTheme = function (t) {
        if (t !== 'random') return t;
        if (pick) return pick;
        var ids = window.PENUMBRA_THEME_IDS || [], seen = [];
        var now = document.body && document.body.getAttribute('data-theme');
        try { seen = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) {}
        if (!Array.isArray(seen)) seen = [];
        var last = seen[seen.length - 1];
        function allowed(id) { return id !== last && id !== now; }
        var pool = ids.filter(function (id) { return seen.indexOf(id) === -1 && allowed(id); });
        if (!pool.length) { seen = []; pool = ids.filter(allowed); }   // cycle done: start the next
        if (!pool.length) pool = ids;
        pick = pool[Math.floor(Math.random() * pool.length)] || 'theme-default';
        seen.push(pick);
        try { localStorage.setItem(KEY, JSON.stringify(seen)); } catch (e) {}
        return pick;
    };
})();

JS;
}
}

if (!function_exists('penumbra_render_theme_options')) {
function penumbra_render_theme_options($selectedId, $includeReportDefault, $includeRandom = false) {
    $html = '';
    if ($includeReportDefault) {
        $sel = ($selectedId === 'report-default') ? ' selected' : '';
        $html .= '<option value="report-default"' . $sel . '>Report Default</option>' . "\n";
    }
    foreach (penumbra_get_themes() as $id => $t) {
        if (isset($t['legacy']) && $t['legacy']) {
            continue;
        }
        $sel = ($selectedId === $id) ? ' selected' : '';
        $html .= '<option value="' . htmlspecialchars($id, ENT_QUOTES) . '"' . $sel . '>'
               . htmlspecialchars($t['label'], ENT_QUOTES) . '</option>' . "\n";
    }
    if ($includeRandom) {
        $html .= '<option value="random" title="Picks a different theme every time the page loads">Surprise Me</option>' . "\n";
    }
    return $html;
}
}

if (!function_exists('penumbra_emit_theme_css')) {
function penumbra_emit_theme_css() {
    $out = '';
    foreach (penumbra_get_themes() as $id => $t) {
        if (empty($t['cssVars'])) {
            continue;
        }
        $decls = array();
        $vars = isset($t['vars']) ? $t['vars'] : array();
        foreach ($vars as $name => $val) {
            $decls[] = '--' . $name . ': ' . $val;
        }
        foreach ($t['cssVars'] as $name => $val) {
            $decls[] = '--' . $name . ': ' . $val;
        }
        $out .= 'body.' . $id . ' { ' . implode('; ', $decls) . '; }' . "\n";
    }
    echo '<style id="penumbra-theme-vars">' . "\n" . $out . '</style>' . "\n";
}
}
