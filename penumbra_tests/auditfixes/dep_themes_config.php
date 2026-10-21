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

    // ---- Dark Blue ----------------------------------------------------------
    $themes['theme-dark-blue'] = array(
        'id' => 'theme-dark-blue', 'label' => 'Dark Blue', 'isDark' => true,
        'aliases' => array(),
        'vars' => array(
            'bg-body' => '#0d1117', 'bg-surface' => '#161b22', 'bg-surface-alt' => '#0d1117',
            'text-main' => '#c9d1d9', 'text-muted' => '#8b949e', 'border-color' => '#30363d',
            'brand-primary' => '#1f6feb', 'brand-secondary' => '#388bfd',
        ),
        'xlsx' => array('headerBg' => '#164E82', 'headerGradient' => 'linear-gradient(to top, #2a66a2, #164e82, #0d3a62)', 'headerFont' => '#C9D1D9', 'oddBg' => '#0D1117', 'evenBg' => '#161B22', 'dataFont' => '#C9D1D9', 'borderColor' => '#30363d', 'groupHeaderBg' => '#21262d', 'groupHeaderFont' => '#C9D1D9', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#161b22', 'blockBorder' => '#30363d', 'titleColor' => '#3777b8', 'titleExtra' => '', 'tsColor' => '#8b949e', 'pillBg' => '#0d1117', 'pillBorder' => '#30363d', 'pillLabel' => '#8b949e', 'pillValue' => '#58a6ff'),
        'print' => array('headerBg' => '#164e82', 'footerBg' => '#161b22'),
        'emailGroup' => array('border' => '#30363d', 'headerBg' => '#161b22', 'nameColor' => '#c9d1d9', 'countBg' => '#164e82', 'countColor' => '#c9d1d9', 'aggLabel' => '#858585', 'aggValue' => '#c9d1d9'),
        'nestedHeader' => array('bg' => '#1c2128', 'text' => '#c9d1d9', 'border' => '#30363d', 'border_top' => '#30363d', 'header_bg' => '#21262d', 'header_text' => '#c9d1d9'),
    );

    // ---- Charcoal & Gold ----------------------------------------------------
    $themes['theme-charcoal-gold'] = array(
        'id' => 'theme-charcoal-gold', 'label' => 'Charcoal & Gold', 'isDark' => true,
        'aliases' => array('charcoal'),
        'vars' => array(
            'bg-body' => '#1a1a1a', 'bg-surface' => '#2c2c2c', 'bg-surface-alt' => '#222222',
            'text-main' => '#e0e0e0', 'text-muted' => '#aaaaaa', 'border-color' => '#444444',
            'brand-primary' => '#cda434', 'brand-secondary' => '#ddc05a', 'pivot-header-font' => '#1a1a1a',
        ),
        'xlsx' => array('headerBg' => '#CDA434', 'headerGradient' => 'linear-gradient(to top, #ddc05a, #cda434, #bd9424)', 'headerFont' => '#1A1A1A', 'oddBg' => '#1A1A1A', 'evenBg' => '#2C2C2C', 'dataFont' => '#E0E0E0', 'borderColor' => '#444444', 'groupHeaderBg' => '#333333', 'groupHeaderFont' => '#E0E0E0', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#2c2c2c', 'blockBorder' => '#444', 'titleColor' => '#DAA520', 'titleExtra' => 'letter-spacing: 0.5px;', 'tsColor' => '#999', 'pillBg' => '#1a1a1a', 'pillBorder' => '#444', 'pillLabel' => '#888', 'pillValue' => '#cda434'),
        'print' => array('headerBg' => '#cda434', 'footerBg' => '#2c2c2c'),
        'emailGroup' => array('border' => '#444', 'headerBg' => '#2c2c2c', 'nameColor' => '#e0e0e0', 'countBg' => '#cda434', 'countColor' => '#1a1a1a', 'aggLabel' => '#959595', 'aggValue' => '#e0e0e0'),
        'nestedHeader' => array('bg' => '#2c2c2c', 'text' => '#e0e0e0', 'border' => '#444444', 'border_top' => '#cda434', 'header_bg' => '#3a3a3a', 'header_text' => '#e0e0e0'),
    );

    // ---- Light Sepia --------------------------------------------------------
    $themes['theme-light-sepia'] = array(
        'id' => 'theme-light-sepia', 'label' => 'Light Sepia', 'isDark' => false,
        'aliases' => array('sepia'),
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
        'cssVars' => array('accent-danger' => '#fb7185', 'on-brand' => '#000000', 'table-header-bg' => 'linear-gradient(to top, #5b5eee, #4f46e5, #3730a3)','table-header-text' => '#ffffff', 'table-footer-bg' => '#0c0c16', 'table-footer-border' => '#6366f1', 'table-footer-text' => '#e9e9f5', 'zebra-light' => '#000000', 'zebra-dark' => '#0c0c18', 'table-link-color' => '#a5b4fc', 'header-card-bg' => 'linear-gradient(135deg, #000000, #0c0c1c)', 'header-card-border' => '#2a2a4a', 'header-card-accent' => '#818cf8', 'title-color' => '#a5b4fc', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#1c1a3a'),
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
        'cssVars' => array('accent-danger' => '#8b1a1a', 'brand-text' => '#2b2b2b', 'table-header-bg' => 'linear-gradient(to top, #5a5a5a, #3a3a3a, #232323)','table-header-text' => '#ffffff', 'table-footer-bg' => '#e8e8e8', 'table-footer-border' => '#2b2b2b', 'table-footer-text' => '#1a1a1a', 'zebra-light' => '#ffffff', 'zebra-dark' => '#efefef', 'table-link-color' => '#2b2b2b', 'header-card-bg' => 'linear-gradient(145deg, #ffffff, #e9e9e9)', 'header-card-border' => '#c8c8c8', 'header-card-accent' => '#2b2b2b', 'title-color' => '#1a1a1a', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#e3e3e3'),
    );

    // ---- Solarized Light (light) --------------------------------------------
    $themes['theme-solarized-light'] = array(
        'id' => 'theme-solarized-light', 'label' => 'Solarized Light', 'isDark' => false,
        'aliases' => array(),
        'vars' => array(
            'bg-body' => '#fdf6e3', 'bg-surface' => '#fffbf0', 'bg-surface-alt' => '#eee8d5',
            'text-main' => '#073642', 'text-muted' => '#576a71', 'border-color' => '#e0dcc8',
            'brand-primary' => '#268bd2', 'brand-secondary' => '#2aa198',
        ),
        'xlsx' => array('headerBg' => '#20719F', 'headerGradient' => 'linear-gradient(to top, #2379b3, #20719f, #1c6690)', 'headerFont' => '#FFFFFF', 'oddBg' => '#FDF6E3', 'evenBg' => '#EEE8D5', 'dataFont' => '#073642', 'borderColor' => '#e0dcc8', 'groupHeaderBg' => '#eee8d5', 'groupHeaderFont' => '#586e75', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#fffbf0', 'blockBorder' => '#e0dcc8', 'titleColor' => '#268bd2', 'titleExtra' => '', 'tsColor' => '#93a1a1', 'pillBg' => '#fdf6e3', 'pillBorder' => '#e0dcc8', 'pillLabel' => '#657b83', 'pillValue' => '#268bd2'),
        'print' => array('headerBg' => '#20719f', 'footerBg' => '#eee8d5'),
        'emailGroup' => array('border' => '#e0dcc8', 'headerBg' => '#f5efdc', 'nameColor' => '#073642', 'countBg' => '#1f72ac', 'countColor' => '#fdf6e3', 'aggLabel' => '#646d6d', 'aggValue' => '#586e75'),
        'nestedHeader' => array('bg' => '#eee8d5', 'text' => '#073642', 'border' => '#d9d2bd', 'border_top' => '#268bd2', 'header_bg' => '#e3dcc6', 'header_text' => '#073642'),
        'cssVars' => array('accent-danger' => '#cb2c2a', 'on-brand' => '#000000', 'brand-text' => '#1d6ca2', 'table-header-bg' => 'linear-gradient(to top, #2379b3, #20719f, #1c6690)','table-header-text' => '#ffffff', 'table-footer-bg' => '#eee8d5', 'table-footer-border' => '#268bd2', 'table-footer-text' => '#073642', 'zebra-light' => '#fdf6e3', 'zebra-dark' => '#eee8d5', 'table-link-color' => '#1e6fa8', 'header-card-bg' => 'linear-gradient(145deg, #fffbf0, #eee8d5)', 'header-card-border' => '#e0dcc8', 'header-card-accent' => '#268bd2', 'title-color' => '#1e6fa8', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#e6dfc8'),
    );

    // ---- Solarized Dark (dark) ----------------------------------------------
    $themes['theme-solarized-dark'] = array(
        'id' => 'theme-solarized-dark', 'label' => 'Solarized Dark', 'isDark' => true,
        'aliases' => array('solarized'),
        'vars' => array(
            'bg-body' => '#002b36', 'bg-surface' => '#073642', 'bg-surface-alt' => '#00252e',
            'text-main' => '#a6b3b3', 'text-muted' => '#9dabb0', 'border-color' => '#0f4a57',
            'brand-primary' => '#268bd2', 'brand-secondary' => '#2aa198',
        ),
        'xlsx' => array('headerBg' => '#08404F', 'headerGradient' => 'linear-gradient(to top, #0f5a6e, #08404f, #052f3a)', 'headerFont' => '#FFFFFF', 'oddBg' => '#002B36', 'evenBg' => '#073642', 'dataFont' => '#93A1A1', 'borderColor' => '#0f4a57', 'groupHeaderBg' => '#073642', 'groupHeaderFont' => '#93A1A1', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#073642', 'blockBorder' => '#0f4a57', 'titleColor' => '#2aa198', 'titleExtra' => '', 'tsColor' => '#657b83', 'pillBg' => '#002b36', 'pillBorder' => '#0f4a57', 'pillLabel' => '#657b83', 'pillValue' => '#268bd2'),
        'print' => array('headerBg' => '#08404f', 'footerBg' => '#073642'),
        'emailGroup' => array('border' => '#0f4a57', 'headerBg' => '#073642', 'nameColor' => '#93a1a1', 'countBg' => '#268bd2', 'countColor' => '#002028', 'aggLabel' => '#919fa4', 'aggValue' => '#93a1a1'),
        'nestedHeader' => array('bg' => '#073642', 'text' => '#93a1a1', 'border' => '#0f4a57', 'border_top' => '#2aa198', 'header_bg' => '#0a4250', 'header_text' => '#93a1a1'),
        'cssVars' => array('accent-danger' => '#f58f8b', 'on-brand' => '#000000', 'brand-text' => '#3dc6b6', 'table-header-bg' => 'linear-gradient(to top, #0f5a6e, #08404f, #052f3a)','table-header-text' => '#ffffff', 'table-footer-bg' => '#073642', 'table-footer-border' => '#2aa198', 'table-footer-text' => '#93a1a1', 'zebra-light' => '#002b36', 'zebra-dark' => '#073642', 'table-link-color' => '#4ca8e8', 'header-card-bg' => 'linear-gradient(135deg, #002b36, #073642)', 'header-card-border' => '#0f4a57', 'header-card-accent' => '#2aa198', 'title-color' => '#4ca8e8', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#0a3f4d'),
    );

    // ---- Forest (green, light) ----------------------------------------------
    $themes['theme-forest'] = array(
        'id' => 'theme-forest', 'label' => 'Forest', 'isDark' => false,
        'aliases' => array(),
        'vars' => array(
            'bg-body' => '#e6f0df', 'bg-surface' => '#ffffff', 'bg-surface-alt' => '#d6e6cf',
            'text-main' => '#15251a', 'text-muted' => '#46594c', 'border-color' => '#b6cdaf',
            'brand-primary' => '#1b5e20', 'brand-secondary' => '#43a047',
        ),
        'xlsx' => array('headerBg' => '#1B5E20', 'headerGradient' => 'linear-gradient(to top, #2e7d32, #1b5e20, #103d15)', 'headerFont' => '#FFFFFF', 'oddBg' => '#FFFFFF', 'evenBg' => '#E3EFDC', 'dataFont' => '#15251A', 'borderColor' => '#b6cdaf', 'groupHeaderBg' => '#d6e6cf', 'groupHeaderFont' => '#1b5e20', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#eef5ea', 'blockBorder' => '#b6cdaf', 'titleColor' => '#1b5e20', 'titleExtra' => '', 'tsColor' => '#46594c', 'pillBg' => '#ffffff', 'pillBorder' => '#b6cdaf', 'pillLabel' => '#46594c', 'pillValue' => '#1b5e20'),
        'print' => array('headerBg' => '#1b5e20', 'footerBg' => '#d6e6cf'),
        'emailGroup' => array('border' => '#b6cdaf', 'headerBg' => '#e6f0df', 'nameColor' => '#15251a', 'countBg' => '#1b5e20', 'countColor' => '#ffffff', 'aggLabel' => '#5b6d61', 'aggValue' => '#1b5e20'),
        'nestedHeader' => array('bg' => '#d6e6cf', 'text' => '#15251a', 'border' => '#b6cdaf', 'border_top' => '#1b5e20', 'header_bg' => '#cfe1c8', 'header_text' => '#15251a'),
        'cssVars' => array('accent-danger' => '#b03a2e', 'table-header-bg' => 'linear-gradient(to top, #2e7d32, #1b5e20, #103d15)', 'table-header-text' => '#ffffff', 'table-footer-bg' => '#d6e6cf', 'table-footer-border' => '#1b5e20', 'table-footer-text' => '#15251a', 'zebra-light' => '#ffffff', 'zebra-dark' => '#e3efdc', 'table-link-color' => '#1b5e20', 'header-card-bg' => 'linear-gradient(145deg, #f2f8ee, #d4e6cc)', 'header-card-border' => '#b6cdaf', 'header-card-accent' => '#1b5e20', 'title-color' => '#1b5e20', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#cfe4c7'),
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
        'cssVars' => array('accent-danger' => '#ff5c5c', 'on-brand' => '#000000', 'table-header-bg' => 'linear-gradient(to top, #ff5ce0, #ff2bd6, #e600bf)','table-header-text' => '#000000', 'table-footer-bg' => '#150a2e', 'table-footer-border' => '#ff2bd6', 'table-footer-text' => '#ece3ff', 'zebra-light' => '#0a0118', 'zebra-dark' => '#150a2e', 'table-link-color' => '#21f3ff', 'header-card-bg' => 'linear-gradient(135deg, #0a0118, #150a2e)', 'header-card-border' => '#38215f', 'header-card-accent' => '#ff2bd6', 'title-color' => '#21f3ff', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#3d0d40'),
    );

    // ---- Tangerine (orange, light) ------------------------------------------
    $themes['theme-tangerine'] = array(
        'id' => 'theme-tangerine', 'label' => 'Tangerine', 'isDark' => false,
        'aliases' => array('orange', 'sunset'),
        'vars' => array(
            'bg-body' => '#fff7ed', 'bg-surface' => '#ffffff', 'bg-surface-alt' => '#ffedd5',
            'text-main' => '#4a2410', 'text-muted' => '#8e6240', 'border-color' => '#fed7aa',
            'brand-primary' => '#ea580c', 'brand-secondary' => '#fb923c',
        ),
        'xlsx' => array('headerBg' => '#9A3412', 'headerGradient' => 'linear-gradient(to top, #c2410c, #9a3412, #7c2d12)', 'headerFont' => '#FFFFFF', 'oddBg' => '#FFF7ED', 'evenBg' => '#FFEDD5', 'dataFont' => '#4A2410', 'borderColor' => '#fed7aa', 'groupHeaderBg' => '#ffe4c4', 'groupHeaderFont' => '#7c2d12', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#fffaf3', 'blockBorder' => '#fed7aa', 'titleColor' => '#c2410c', 'titleExtra' => '', 'tsColor' => '#9a6a45', 'pillBg' => '#ffffff', 'pillBorder' => '#fed7aa', 'pillLabel' => '#9a6a45', 'pillValue' => '#ea580c'),
        'print' => array('headerBg' => '#9a3412', 'footerBg' => '#ffe4c4'),
        'emailGroup' => array('border' => '#fed7aa', 'headerBg' => '#fff3e6', 'nameColor' => '#4a2410', 'countBg' => '#c94c0a', 'countColor' => '#ffffff', 'aggLabel' => '#86664e', 'aggValue' => '#7c2d12'),
        'nestedHeader' => array('bg' => '#ffedd5', 'text' => '#4a2410', 'border' => '#fdba74', 'border_top' => '#ea580c', 'header_bg' => '#ffe0b8', 'header_text' => '#4a2410'),
        'cssVars' => array('accent-danger' => '#b91c1c', 'on-brand' => '#000000', 'brand-text' => '#b9460a', 'table-header-bg' => 'linear-gradient(to top, #c2410c, #9a3412, #7c2d12)','table-header-text' => '#ffffff', 'table-footer-bg' => '#ffe4c4', 'table-footer-border' => '#ea580c', 'table-footer-text' => '#4a2410', 'zebra-light' => '#fff7ed', 'zebra-dark' => '#ffedd5', 'table-link-color' => '#c2410c', 'header-card-bg' => 'linear-gradient(145deg, #ffffff, #ffedd5)', 'header-card-border' => '#fed7aa', 'header-card-accent' => '#ea580c', 'title-color' => '#c2410c', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#ffe6d0'),
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
        'cssVars' => array('accent-danger' => '#fb7185', 'on-brand' => '#000000', 'brand-text' => '#aa5af7', 'table-header-bg' => 'linear-gradient(to top, #9a3ff0, #7e22ce, #6b21a8)','table-header-text' => '#ffffff', 'table-footer-bg' => '#1f1133', 'table-footer-border' => '#a855f7', 'table-footer-text' => '#ece3f7', 'zebra-light' => '#140a22', 'zebra-dark' => '#1f1133', 'table-link-color' => '#c084fc', 'header-card-bg' => 'linear-gradient(135deg, #140a22, #1f1133)', 'header-card-border' => '#3a2458', 'header-card-accent' => '#a855f7', 'title-color' => '#c084fc', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#3a2466'),
    );

    // ---- Gruvbox (dark, warm retro) -----------------------------------------
    // Warm retro palette: brown-grey surfaces + cream text, with a vibrant
    // orange brand, yellow links, and a green title (the classic Gruvbox combo).
    // Header/badge use DARK text on the bright orange, so no table-header/
    // badge overrides are needed. Like every dark theme with a
    // dark 'on-brand', it IS listed in the css/main.css .sp-btn-primary
    // fill+text force (".is-dark button" clobbers both halves of that pairing).
    $themes['theme-gruvbox'] = array(
        'id' => 'theme-gruvbox', 'label' => 'Gruvbox', 'isDark' => true,
        'aliases' => array('retro', 'warm'),
        'vars' => array(
            'bg-body' => '#282828', 'bg-surface' => '#3c3836', 'bg-surface-alt' => '#32302f',
            'text-main' => '#ebdbb2', 'text-muted' => '#b7a995', 'border-color' => '#504945',
            'brand-primary' => '#fe8019', 'brand-secondary' => '#fabd2f',
        ),
        'xlsx' => array('headerBg' => '#FE8019', 'headerGradient' => 'linear-gradient(to top, #fe8019, #f47517, #e8700f)', 'headerFont' => '#282828', 'oddBg' => '#282828', 'evenBg' => '#32302F', 'dataFont' => '#EBDBB2', 'borderColor' => '#504945', 'groupHeaderBg' => '#32302f', 'groupHeaderFont' => '#fabd2f', 'fontName' => 'Verdana', 'fontSize' => 9),
        'emailHeader' => array('blockBg' => '#282828', 'blockBorder' => '#504945', 'titleColor' => '#b8bb26', 'titleExtra' => '', 'tsColor' => '#a89984', 'pillBg' => '#3c3836', 'pillBorder' => '#504945', 'pillLabel' => '#a89984', 'pillValue' => '#fabd2f'),
        'print' => array('headerBg' => '#fe8019', 'footerBg' => '#3c3836'),
        'emailGroup' => array('border' => '#504945', 'headerBg' => '#3c3836', 'nameColor' => '#ebdbb2', 'countBg' => '#fe8019', 'countColor' => '#282828', 'aggLabel' => '#b1a390', 'aggValue' => '#fabd2f'),
        'nestedHeader' => array('bg' => '#3c3836', 'text' => '#ebdbb2', 'border' => '#504945', 'border_top' => '#fe8019', 'header_bg' => '#32302f', 'header_text' => '#ebdbb2'),
        'cssVars' => array('accent-danger' => '#fc9080', 'on-brand' => '#282828', 'table-header-bg' => 'linear-gradient(to top, #fe8019, #f47517, #e8700f)','table-header-text' => '#282828', 'table-footer-bg' => '#3c3836', 'table-footer-border' => '#fe8019', 'table-footer-text' => '#ebdbb2', 'zebra-light' => '#282828', 'zebra-dark' => '#32302f', 'table-link-color' => '#fabd2f', 'header-card-bg' => 'linear-gradient(135deg, #282828, #3c3836)', 'header-card-border' => '#504945', 'header-card-accent' => '#fe8019', 'title-color' => '#b8bb26', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#45403b'),
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
        'cssVars' => array('accent-danger' => '#ff6b57', 'on-brand' => '#1c1611', 'table-header-bg' => 'linear-gradient(to top, #3a2a1a, #2b2013)','table-header-text' => '#ffb84d', 'table-footer-bg' => '#271f17', 'table-footer-border' => '#ff9e1b', 'table-footer-text' => '#e8c88a', 'zebra-light' => '#1c1611', 'zebra-dark' => '#241c14', 'table-link-color' => '#ffc24d', 'header-card-bg' => 'linear-gradient(135deg, #1c1611, #271f17)', 'header-card-border' => '#4a3a28', 'header-card-accent' => '#ff9e1b', 'title-color' => '#ffc24d', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#332715'),
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
        'cssVars' => array('accent-danger' => '#ff5c5c', 'on-brand' => '#061206', 'table-header-bg' => 'linear-gradient(to top, #14401c, #0d2b12)','table-header-text' => '#00ff41', 'table-footer-bg' => '#0b1f0c', 'table-footer-border' => '#00ff41', 'table-footer-text' => '#58f570', 'zebra-light' => '#061206', 'zebra-dark' => '#0a1c0b', 'table-link-color' => '#8affab', 'header-card-bg' => 'linear-gradient(135deg, #061206, #0b1f0c)', 'header-card-border' => '#1e4a20', 'header-card-accent' => '#00ff41', 'title-color' => '#00ff41', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#113417'),
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
        'cssVars' => array('accent-danger' => '#c62828', 'on-brand' => '#000000', 'brand-text' => '#cf0057', 'table-header-bg' => 'linear-gradient(to top, #c2185b, #ad1457, #880e4f)','table-header-text' => '#ffffff', 'table-footer-bg' => '#ffd6e6', 'table-footer-border' => '#ff5fa2', 'table-footer-text' => '#6b3a4b', 'zebra-light' => '#fff5f8', 'zebra-dark' => '#ffe6ef', 'table-link-color' => '#1e6fa8', 'header-card-bg' => 'linear-gradient(145deg, #ffffff, #ffe6ef)', 'header-card-border' => '#ffc9dd', 'header-card-accent' => '#ff5fa2', 'title-color' => '#e63e87', 'fab-bg' => 'var(--brand-primary)', 'fab-hover' => 'var(--brand-secondary)', 'bg-main' => 'var(--bg-surface)', 'panel-bg' => 'var(--bg-surface)', 'panel-border' => 'var(--border-color)', 'panel-header-bg' => 'var(--bg-surface-alt)', 'selector-group-bg' => 'var(--bg-surface-alt)', 'selector-highlight-bg' => 'var(--bg-surface-alt)', 'selector-hover-bg' => 'var(--bg-surface-alt)', 'toolbar-bg' => 'var(--bg-surface-alt)', 'row-hover' => '#ffe2ee'),
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
}
}

if (!function_exists('penumbra_render_theme_options')) {
function penumbra_render_theme_options($selectedId, $includeReportDefault) {
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
