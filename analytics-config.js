/* Add your Google Analytics 4 Measurement ID here after creating a GA4 web stream.
   Example: window.QUICKPLAY_GA_ID = 'G-ABC1234567';
   Leave empty until you own and configure the property. */
window.QUICKPLAY_GA_ID = '';
if (window.QUICKPLAY_GA_ID && /^G-[A-Z0-9]+$/.test(window.QUICKPLAY_GA_ID)) {
  const id = window.QUICKPLAY_GA_ID;
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function(){dataLayer.push(arguments);};
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true });
}