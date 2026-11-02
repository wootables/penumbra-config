// wsmenu: Quick actions' module stood in for (the boot stub, js/penumbra_palette_boot.js, is the real one): every
// open is recorded, whether the stub handed its empty box over or the page menu called PenumbraPalette.open.
(function () {
    var P = window.PenumbraPalette = window.PenumbraPalette || {};
    window.__palOpens = window.__palOpens || [];
    P.open = function (text, opener, from) { window.__palOpens.push({ via: 'open', opener: (opener && opener.id) || '', from: from || '' }); };
    P.toggle = function () { window.__palOpens.push({ via: 'toggle' }); };
    P.close = function () { };
    P.takeOver = function (shell) {
        if (shell && shell.el && shell.el.parentNode) { shell.el.parentNode.removeChild(shell.el); }
        window.__palOpens.push({ via: 'shell', opener: (shell && shell.opener && shell.opener.id) || '', from: (shell && shell.from) || '' });
    };
    P.ready = true;
})();
