const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const Fi = require('react-icons/fi');
const fs = require('fs');
const names = ['FiMapPin','FiTrendingUp','FiUsers','FiLayers','FiMessageCircle','FiDatabase','FiGrid','FiCpu','FiCheckCircle','FiTarget','FiEye','FiHome','FiCompass','FiSearch','FiBarChart2','FiShield','FiGlobe','FiSmartphone','FiCamera','FiArrowRight','FiAlertCircle','FiEyeOff','FiTag','FiNavigation','FiClipboard','FiZap','FiHeart','FiArrowUpRight','FiFlag','FiBookOpen','FiMap','FiPercent','FiDollarSign','FiActivity'];
const colours = { blue: '#0071e3', ink: '#0b0c0e', white: '#ffffff', deep: '#143f7c' };
for (const n of names) {
  const C = Fi[n]; if (!C) { console.log('missing', n); continue; }
  for (const [cn, hex] of Object.entries(colours)) {
    let svg = renderToStaticMarkup(React.createElement(C, { size: 64, color: hex, strokeWidth: 1.75 }));
    svg = svg.replace(/currentColor/g, hex);
    if (!/xmlns=/.test(svg)) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    fs.writeFileSync(`icons/${n}-${cn}.svg`, svg);
  }
}
console.log('svg icons written');
