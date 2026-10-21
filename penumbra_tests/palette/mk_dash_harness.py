# palette (round 6): dash.html = a stand-in for dashboard.php - the page's const penumbra_dash_vars
# (isAdmin from the query string: ?scn=pdasha is the admin), the header band with the buttons
# penumbra_dashboard.js draws (#dashHeadActions: Refresh, Edit, Help) and the filter box, the
# palette stub tag as dashboard.php emits it, the driver. No tiles, no penumbra_dashboard.js: the
# box reads the header as it stands. Each header button counts its clicks in window.__clicks.
import os
HERE = os.path.dirname(os.path.abspath(__file__))

PAGE = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>palette dash</title>
<link rel="stylesheet" href="main.css">
<script>
window.__SCN = new URLSearchParams(location.search).get('scn') || 'pdash';
// a top-level const, as dashboard.php declares it (a bare identifier, not a window property)
const penumbra_dash_vars = { isAdmin: /^pdasha/.test(window.__SCN), canCreate: true, shortId: 'zzdash', found: true, canEdit: true, noadm: false, meta: { short_id: 'zzdash', title: 'Fixture dashboard' } };
</script>
<script src="jquery-3.7.1.min.js"></script>
</head>
<body class="theme-default">
<div id="dashApp">
    <header class="dash-head" id="dashHead">
        <nav class="pnb-crumb" aria-label="Breadcrumb"><a class="pnb-crumb-home" href="#">PENUMBRA</a><span class="pnb-crumb-step"><span class="pnb-crumb-sep">&rsaquo;</span><a class="pnb-crumb-item" href="#">Dashboards</a></span></nav>
        <div class="dash-head-title" id="dashHeadTitle"><h1>Fixture dashboard</h1></div>
        <div class="dash-head-actions" id="dashHeadActions"><button type="button" class="dash-btn" id="dashRefreshBtn" title="Re-fetch every tile (R)">&#8635; Refresh</button><button type="button" class="dash-btn" id="dashEditBtn" title="Edit this dashboard (E)">&#9998;&#xFE0E; Edit</button><button type="button" class="dash-btn dash-help-link" id="dashHelpBtn" title="Help for dashboards: tiles, address parameters, title tokens, keyboard, kiosk (H)">? Help</button></div>
    </header>
    <main id="dashMain">
        <div class="dash-controls"><input id="dashSearchInput" type="search" placeholder="Filter the tiles" aria-label="Filter"></div>
        <div id="dashGrid"><div class="dash-tile">a tile</div></div>
    </main>
</div>
<script>
window.__clicks = {};
['dashRefreshBtn', 'dashEditBtn', 'dashHelpBtn'].forEach(function (id) { document.getElementById(id).addEventListener('click', function () { window.__clicks[id] = (window.__clicks[id] || 0) + 1; }); });
</script>
<script src="penumbra_palette_boot.js" data-js="penumbra_palette.js?v=1" data-css="penumbra_palette.css?v=1" data-fn="help_functions.json?v=1"></script>
<script src="driver.js"></script>
</body></html>
'''


def build():
    return PAGE


if __name__ == '__main__':
    open(os.path.join(HERE, 'dash.html'), 'w', encoding='utf-8', newline='\n').write(build())
    print('dash harness written')
