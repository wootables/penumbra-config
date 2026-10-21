# palette (round 12): adm.html = a stand-in for an admin tool page: body.pnb-adm, the shared header's shape,
# and the REAL status bar the chrome under test renders (render_chrome.php --what bar, as an admin): the
# profile card with its footer twin (Quick actions button, Admin tools pill + menu + the tools JSON), the
# family settings panel (theme + density), the admin flag and the quick actions stub tag. No page-own
# toolbar. The rendered bar's stub tag points at js/ and css/ copies in the stage; its data-fn at the JSON.
import os
HERE = os.path.dirname(os.path.abspath(__file__))

HEAD = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>palette admin</title>
<link rel="stylesheet" href="main.css">
<link rel="stylesheet" href="density.css">
<script>window.__SCN = new URLSearchParams(location.search).get('scn') || 'padmin';</script>
</head>
<body class="pnb-adm pnb-adm-dz">
<div class="pnb-adm-stick"><header class="pnb-adm-bar">
  <nav class="pnb-crumb" aria-label="Breadcrumb"><a class="pnb-crumb-home" href="#">PENUMBRA</a><span class="pnb-crumb-step"><span class="pnb-crumb-sep">&rsaquo;</span><span class="pnb-crumb-item">Admin</span></span></nav>
  <div class="pnb-adm-titles"><h1>Manage Grants</h1><p>Per-user SQL, report, tag and scheduler scopes</p></div>
</header></div>
<main class="pnb-adm-main"><p>A fixture admin page: no report table here.</p></main>
'''
TAIL = '''<script src="driver.js"></script>
</body></html>
'''


def build(bar_html):
    bar = bar_html.replace('help_functions.php?v=', 'help_functions.json?v=')
    return HEAD + bar + TAIL


if __name__ == '__main__':
    print('build(bar_html) - the runner renders the bar')
