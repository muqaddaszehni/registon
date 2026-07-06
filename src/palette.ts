export const C = {
  // Stone — warm tan buff (the dominant brick colour in the Wikipedia photos)
  sand: 0xdec79a, sandLight: 0xeedcb8, sandDark: 0xbfa775,
  // Marble (pale grey-cream for plinths and steps — warm not stark white)
  marble: 0xe6dcc6,
  // Plaza
  plaza: 0xeaddc4, plazaPath: 0xcfbf9f,
  // Blues (lightened a touch so the dark-blue tilework reads bluer, less black;
  // deepened toward the ref's dense lapis to anchor the palette)
  cobalt: 0x2864ad, lapis: 0x1b3f73,
  // Greens
  turquoise: 0x3cc0c6, teal: 0x2ba4ac,
  // Dome glazes — deep, slightly desaturated turquoise that leans BLUE (B>G), like
  // aged glazed tile, not minty plastic. Still reads as the glowing focal point but
  // the new value range lets the raking key model the bulb instead of self-glow.
  domeGlazeSD: 0x1f9ca8, domeGlazeTK: 0x23a6b4,
  // Accents
  cream: 0xfff6e3, gold: 0xd9b545,
  // Ambience
  terracotta: 0xc94f4f, leaf: 0x7fae6a, trunk: 0x9a6b4f,
  dove: 0xf2ece0,
  // Sky
  skyTop: 0x9b8bb0, skyBottom: 0xf5c9a0, sun: 0xffd9b0,
} as const;
