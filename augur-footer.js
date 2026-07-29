/* AUGUR — shared site footer, injected on every page for consistency. */
(function(){
  "use strict";
  var YEAR=new Date().getFullYear();
  var f=document.createElement("footer");
  f.className="site-footer";
  f.innerHTML=[
    '<div class="sf-inner">',
      '<div class="sf-main">',
        '<div class="sf-brand">AUGUR</div>',
        '<p class="sf-tag">A registry for dreams and the rare moments they seem to arrive early. An instrument, not an oracle: it takes no position on whether dreams foresee anything, and simply keeps an honest, timestamped record.</p>',
        '<nav class="sf-links" aria-label="Footer">',
          '<a href="index.html">Home</a>',
          '<a href="about.html">About</a>',
          '<a href="augur-vault.html">The Vault</a>',
          '<a href="augur-registry.html">The Registry</a>',
          '<a href="augur-commons.html">The Commons</a>',
          '<a href="augur-verifier.html">Verify</a>',
        '</nav>',
      '</div>',
      '<div class="sf-col">',
        '<h4>Contact</h4>',
        '<a href="mailto:contact@augur.app">contact@augur.app</a>',
        '<h4 style="margin-top:18px">Legal</h4>',
        '<a href="terms.html">Terms &amp; Conditions</a>',
        '<a href="terms.html#research">Research &amp; scholarly use</a>',
        '<a href="terms.html#copyright">Copyright</a>',
      '</div>',
    '</div>',
    '<div class="sf-legal">',
      '<span>&copy; '+YEAR+' AUGUR. All rights reserved.</span>',
      '<span class="spacer"></span>',
      '<span>Anonymised public submissions may be used in research and cited in scholarly journals. See <a href="terms.html#research">research use</a>.</span>',
    '</div>',
    '<div class="sf-note">Working prototype. Cryptographic seals are real; the timestamp anchor is currently simulated.</div>'
  ].join("");

  function inject(){
    var existing=document.querySelector("footer");
    if(existing && !/\bnotes\b/.test(existing.className||"")){ existing.replaceWith(f); }
    else if(existing){ existing.parentNode.insertBefore(f, existing.nextSibling); }
    else { document.body.appendChild(f); }
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", inject);
  else inject();
})();
