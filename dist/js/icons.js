const shapes = {
 grid:'<rect x="3" y="3" width="7" height="7" rx="1.6"/><rect x="14" y="3" width="7" height="7" rx="1.6"/><rect x="3" y="14" width="7" height="7" rx="1.6"/><rect x="14" y="14" width="7" height="7" rx="1.6"/>',
 book:'<path d="M3 4.5c3.6-.9 6.6-.4 9 1.4 2.4-1.8 5.4-2.3 9-1.4V19c-3.6-.9-6.6-.4-9 1.4C9.6 18.6 6.6 18.1 3 19Z"/><path d="M12 5.9v14.4"/>',
 lab:'<path d="M8.5 3h7m-6 0v6l-5.8 9.1A1.8 1.8 0 0 0 5.2 21h13.6a1.8 1.8 0 0 0 1.5-2.9L14.5 9V3M7.6 15h8.8"/>',
 folder:'<path d="M3 7V5a2 2 0 0 1 2-2h4l2.5 3H19a2 2 0 0 1 2 2v2M3 7h15.5a1.8 1.8 0 0 1 1.8 2.1l-1.2 10a2 2 0 0 1-2 1.8H5.2a2 2 0 0 1-2-1.8L2 9a1.7 1.7 0 0 1 1-2Z"/>',
 chart:'<path d="M3 4v16h18M7 15l4-5 3 2 6-7"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.4 2"/>',
 check:'<path d="m5 12 4.7 4.7L19 7"/>', circleCheck:'<circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>', sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
 moon:'<path d="M20.5 15.5A9 9 0 0 1 8.5 3.3a9 9 0 1 0 12 12.2Z"/>', play:'<path d="m8 4 12 8-12 8V4Z"/>', code:'<path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18"/>',
 layers:'<path d="m3 7 9-4.7L21 7l-9 4.7L3 7Zm0 5 9 4.7 9-4.7M3 17l9 4.7 9-4.7"/>',
 flag:'<path d="M5 21V4m0 1c5-5 9 4 15-1v10c-6 5-10-4-15 1"/>', spark:'<path d="m12 2 2.3 7.7L22 12l-7.7 2.3L12 22l-2.3-7.7L2 12l7.7-2.3L12 2Z"/>',
 menu:'<path d="M3 6h18M3 12h18M3 18h18"/>', close:'<path d="m5 5 14 14M19 5 5 19"/>', chev:'<path d="m9 5 7 7-7 7"/>', down:'<path d="m5 9 7 7 7-7"/>',
 back:'<path d="m15 5-7 7 7 7"/>', terminal:'<rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="m6.5 8 4 4-4 4m6-1h5"/>',
 file:'<path d="M5 2h9l5 5v15H5Z"/><path d="M14 2v5h5M8 12h8M8 16h6"/>',
 sliders:'<path d="M3 6h7m5 0h6M3 12h13m5 0h0M3 18h4m5 0h9"/><circle cx="12.5" cy="6" r="2.5"/><circle cx="18.5" cy="12" r="2.5"/><circle cx="9.5" cy="18" r="2.5"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
 download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-9v.1"/>',
 refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M19.5 11A7.5 7.5 0 0 0 6 6.5M4.5 13A7.5 7.5 0 0 0 18 17.5"/>',
 bulb:'<path d="M8 15a7 7 0 1 1 8 0c-1.2.8-1.5 1.8-1.5 3h-5c0-1.2-.3-2.2-1.5-3ZM10 21h4"/>',
 save:'<path d="M4 3h13l4 4v14H3V3Zm3 0v6h10V3M7 21v-7h10v7"/>',
 brain:'<path d="M10 4C7 1 4 4 5 7c-3 1-3 5-1 7-1 4 2 7 6 5m4-15c3-3 6 0 5 3 3 1 3 5 1 7 1 4-2 7-6 5M12 3v18"/>',
 cube:'<path d="m3 7 9-5 9 5v10l-9 5-9-5V7Zm0 0 9 5 9-5m-9 5v10"/>',
 chip:'<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M8 1v4m8-4v4M8 19v4m8-4v4M1 8h4m-4 8h4m14-8h4m-4 8h4"/>',
 wave:'<path d="M2 14h3l3-9 4 15 4-12 2 6h4"/>', mark:'<path d="m4 11 3-3 3 3 6-6 4 3M4 17l5-5 3 3 7-6"/>',
 pause:'<path d="M8 4v16M16 4v16"/>', stop:'<rect x="5" y="5" width="14" height="14" rx="1"/>',
 copy:'<rect x="8" y="8" width="12" height="13" rx="2"/><path d="M15 8V3H3v13h5"/>',
 leaf:'<path d="M3 19C4 9 9 3 21 3c-1 13-7 17-14 15M4 21 16 9"/>'
};
export function icon(name,size=20){
  return '<svg width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(shapes[name]||'')+'</svg>';
}
