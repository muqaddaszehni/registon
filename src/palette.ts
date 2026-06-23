export const C = {
  // Stone — warm tan buff (the dominant brick colour in the Wikipedia photos)
  sand: 0xe6d4ac, sandLight: 0xf1e6cc, sandDark: 0xccba90,
  // Marble (pale grey-cream for plinths and steps — warm not stark white)
  marble: 0xe8e3d6,
  // Plaza
  plaza: 0xeee4d5, plazaPath: 0xd8cebb,
  // Blues (lightened a touch so the dark-blue tilework reads bluer, less black)
  cobalt: 0x2a6cb8, lapis: 0x214a82,
  // Greens
  turquoise: 0x42c8c8, teal: 0x2fa8a8,
  // Dome glazes — brighter/more cyan than the wall turquoise so the domes read as
  // glazed, glowing focal points (accuracy spec §2). SD leans greener; TK is purest/brightest.
  domeGlazeSD: 0x37c2bc, domeGlazeTK: 0x46d0cc,
  // Accents
  cream: 0xfff6e3, gold: 0xd9b545,
  // Ambience
  terracotta: 0xc94f4f, leaf: 0x7fae6a, trunk: 0x9a6b4f,
  dove: 0xf2ece0,
  // Sky
  skyTop: 0x9b8bb0, skyBottom: 0xf5c9a0, sun: 0xffd9b0,
} as const;
