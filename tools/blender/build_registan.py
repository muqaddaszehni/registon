"""
Registan (Samarkand) parametric builder for Blender 4.2.

Builds the three madrasahs (Ulugh Beg, Sher-Dor, Tilya-Kori) from the
parameters below and exports public/models/registan.glb.

Run either way:
    python3 tools/blender/build_registan.py            # bpy pip module
    blender -b -P tools/blender/build_registan.py      # Blender app, background

World frame matches the three.js app (Y-up, metres == app world units):
    Ulugh Beg  at x=-13.5, facing +X      Sher-Dor at x=+13.0, facing -X
    Tilya-Kori at z=-12.5, facing +Z      ground = y 0
Geometry is authored in each madrasah's local three.js frame
(x lateral, y up, +z = toward the square) and converted to Blender Z-up
(x, -z, y); the glTF exporter (export_yup=True) converts back, so the GLB
drops into the scene at the origin with no extra transform.
"""
import math, os, sys, time
import bpy

# ────────────────────────── PARAMETERS ──────────────────────────
# Colours: docs/research/registan-accuracy-spec.md §2 (golden-hour column)
COLORS = {
    "Buff":       "#D8C39A",   # sandstone / buff brick field
    "BuffShadow": "#B49A6E",   # recessed niche backs
    "Cobalt":     "#1B4C8C",   # deep tile field, calligraphy ground
    "Lapis":      "#16306B",   # darkest blue (drum bands)
    "Turquoise":  "#2BB6B6",   # wall tile accent
    "GlazeSD":    "#37BDB0",   # Sher-Dor dome glaze (greener)
    "GlazeTK":    "#34C6CC",   # Tilya-Kori dome glaze (purest cyan)
    "Gold":       "#C9A227",
    "Marble":     "#E3DBC8",   # plinth / dado
}

# Per-madrasah parameters (§1 of the spec; world numbers from src/buildings/*.ts)
MADRASAHS = [
    dict(name="UlughBeg", facadeLen=18, portal=dict(w=8, h=15, d=5), wingH=7,
         bays=4, minarets=[dict(offset=-10.8, h=19), dict(offset=10.8, h=19)],
         domes=[], turrets=[], glaze="GlazeSD", goldTrim=False,
         world=dict(x=-13.5, z=0.0, rotY=math.pi / 2)),
    dict(name="SherDor", facadeLen=18, portal=dict(w=8, h=15, d=5), wingH=7,
         bays=4, minarets=[dict(offset=-10.8, h=19), dict(offset=10.8, h=19)],
         # 2 ribbed turquoise domes on tall drums behind the portal corners (spec §1.2, §5.1)
         domes=[dict(offset=-6.6, r=2.6, z=-4.5, drumTop=4.5, ribs=24),
                dict(offset=6.6, r=2.6, z=-4.5, drumTop=4.5, ribs=24)],
         turrets=[], glaze="GlazeSD", goldTrim=False,
         world=dict(x=13.0, z=0.0, rotY=-math.pi / 2)),
    dict(name="TilyaKori", facadeLen=26, portal=dict(w=8, h=10.5, d=5), wingH=6,  # 10.5/6 = 1.75 (spec §1.3)
         bays=8, minarets=[],
         # one big dome, viewer's LEFT, high cylindrical drum (spec §1.3)
         domes=[dict(offset=-9, r=3.8, z=-4.0, drumTop=6.0, ribs=32)],
         turrets=[dict(offset=-14.1, h=7, r=0.9), dict(offset=14.1, h=7, r=0.9)],
         glaze="GlazeTK", goldTrim=True,
         world=dict(x=0.0, z=-12.5, rotY=0.0)),
]
TOTAL_DEPTH = 9.0     # front face to back face (madrasah.ts totalDepth)
WING_T = 2.0          # side / back wing thickness
NICHE_DEPTH = 0.35    # recess of the 2-storey hujra niches
IWAN_DEPTH = 3.0      # pishtaq iwan recess
DRUM_R_FACTOR = 0.86  # drum radius / dome radius (primitives.ts)
SEG = 24              # cylinder segments

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "..", "..", "public", "models", "registan.glb"))
if "--" in sys.argv and len(sys.argv) > sys.argv.index("--") + 1:
    OUT = sys.argv[sys.argv.index("--") + 1]

# ────────────────────────── helpers ──────────────────────────
def hex2rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)) + (1.0,)

def srgb_to_linear(c):
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) if i < 3 else v
                 for i, v in enumerate(c))

# ────────────────────────── procedural tile textures ──────────────────────────
TEX_SIZE = 256        # px per tile; 1 tile == 1.0 world unit on the wall (see Bucket.add)
TEXTURED = {          # material key -> (pattern fn, roughness)
    "BuffTile":   ("bannai",  0.8),   # banna'i glazed-brick lattice on buff (wing facades, piers, drums)
    "GirihFrame": ("girih",   0.45),  # 8-point star strip (portal frames / friezes)
    "DrumBand":   ("kufic",   0.45),  # lapis band with white kufic strokes (drum & minaret bands)
    "Chevron":    ("chevron", 0.75),  # diagonal cobalt/turquoise chevrons (minaret & turret shafts)
}

def _frac(x):
    return x - math.floor(x)

def _pattern(kind, u, v):
    """Tileable pattern colour (sRGB 0..1) at tile coords u,v in [0,1)."""
    buff, cobalt, turq = hex2rgb(COLORS["Buff"])[:3], hex2rgb(COLORS["Cobalt"])[:3], hex2rgb(COLORS["Turquoise"])[:3]
    lapis, gold, white = hex2rgb(COLORS["Lapis"])[:3], hex2rgb(COLORS["Gold"])[:3], (0.94, 0.93, 0.88)
    if kind == "bannai":
        a, b = _frac(u + v), _frac(u - v)
        if abs(a - 0.5) < 0.035 or abs(b - 0.5) < 0.035:
            return cobalt
        du, dv = abs(u - 0.5), abs(v - 0.5)
        if du + dv < 0.13:
            return turq
        if min(du + dv, 1 - du - dv if du + dv > 0.5 else 1) > 0.37 and (du + dv) > 0.37:
            return cobalt
        if _frac(v * 8) < 0.07 or _frac(u * 4 + (0.5 if int(v * 8) % 2 else 0)) < 0.035:
            return tuple(c * 0.9 for c in buff)
        return buff
    if kind == "girih":
        if v < 0.05 or v > 0.95:
            return white
        du, dv = abs(_frac(u * 2) - 0.5), abs(v - 0.5)
        sq, dia = max(du, dv), (du + dv) / 1.4142
        R, w = 0.3, 0.045
        inside = sq < R or dia < R
        inner = sq < R - w or dia < R - w
        if inside and not inner:
            return white
        if inner:
            if math.hypot(du, dv) < 0.07:
                return gold
            return turq if max(du, dv) < R - w - 0.1 else cobalt
        return cobalt
    if kind == "kufic":
        if v < 0.06 or v > 0.94:
            return white
        cell, t = int(u * 6), _frac(u * 6)
        if 0.18 < v < 0.82 and 0.3 < t < 0.5:
            return white
        if cell % 2 == 0 and 0.42 < v < 0.58 and 0.3 < t < 0.85:
            return white
        if cell % 2 == 1 and 0.66 < v < 0.82 and 0.05 < t < 0.5:
            return white
        if cell % 3 == 0 and 0.18 < v < 0.34 and 0.5 < t < 0.9:
            return turq
        return lapis
    if kind == "chevron":
        zig = abs(_frac(u * 2) * 2 - 1)          # triangle wave, period 0.5
        t = _frac(v * 3 + zig * 0.5)
        if t < 0.22:
            return cobalt
        if t < 0.32:
            return turq
        if t < 0.36:
            return white
        return buff
    return buff

_imgs = {}
def tile_image(kind, size=TEX_SIZE):
    if kind in _imgs:
        return _imgs[kind]
    px = [0.0] * (size * size * 4)
    for y in range(size):
        v = (y + 0.5) / size
        row = 4 * y * size
        for x in range(size):
            r, g, b = _pattern(kind, (x + 0.5) / size, v)
            i = row + 4 * x
            px[i], px[i + 1], px[i + 2], px[i + 3] = r, g, b, 1.0
    img = bpy.data.images.new(f"tile_{kind}", size, size, alpha=False)
    img.pixels = px
    try:
        img.pack()
    except Exception:
        path = os.path.join(os.path.dirname(OUT), f"tile_{kind}.png")
        img.filepath_raw = path
        img.file_format = "PNG"
        img.save()
    _imgs[kind] = img
    return img

_mats = {}
def material(key):
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    if key in TEXTURED:
        kind, rough = TEXTURED[key]
        tex = m.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = tile_image(kind)
        tex.interpolation = "Closest"
        m.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        bsdf.inputs["Roughness"].default_value = rough
        _mats[key] = m
        return m
    bsdf.inputs["Base Color"].default_value = srgb_to_linear(hex2rgb(COLORS[key]))
    if key == "Gold":
        bsdf.inputs["Metallic"].default_value = 0.85
        bsdf.inputs["Roughness"].default_value = 0.35
    elif key.startswith("Glaze"):
        bsdf.inputs["Roughness"].default_value = 0.3
        bsdf.inputs["Emission Color"].default_value = srgb_to_linear(hex2rgb(COLORS[key]))
        bsdf.inputs["Emission Strength"].default_value = 0.14
    elif key in ("Cobalt", "Lapis", "Turquoise"):
        bsdf.inputs["Roughness"].default_value = 0.45
    else:
        bsdf.inputs["Roughness"].default_value = 0.85
    _mats[key] = m
    return m


class Bucket:
    """Accumulates verts/faces (+ per-loop UVs) for one (madrasah, material) mesh."""
    def __init__(self):
        self.verts, self.faces, self.uvs = [], [], []

    def add(self, verts, faces, uvs=None):
        base = len(self.verts)
        # local three.js (x, y, z) -> Blender local (x, -z, y)
        self.verts.extend((x, -z, y) for (x, y, z) in verts)
        self.faces.extend(tuple(i + base for i in f) for f in faces)
        if uvs is None:
            uvs = [_box_uv(verts, f) for f in faces]
        for fu in uvs:
            self.uvs.extend(fu)


def _box_uv(verts, f):
    """Planar box projection in three.js local units (1 texture tile == 1 world unit)."""
    if len(f) < 3:
        return [(0.0, 0.0)] * len(f)
    (ax, ay, az), (bx, by, bz), (cx, cy, cz) = verts[f[0]], verts[f[1]], verts[f[2]]
    nx = (by - ay) * (cz - az) - (bz - az) * (cy - ay)
    ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az)
    nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    n = max(abs(nx), abs(ny), abs(nz))
    if n == 0:
        return [(0.0, 0.0)] * len(f)
    if abs(nx) == n:
        return [(verts[i][2], verts[i][1]) for i in f]
    if abs(ny) == n:
        return [(verts[i][0], verts[i][2]) for i in f]
    return [(verts[i][0], verts[i][1]) for i in f]


def box(b, cx, cy, cz, w, h, d):
    """Axis-aligned box centred at (cx, cy, cz)."""
    x0, x1 = cx - w / 2, cx + w / 2
    y0, y1 = cy - h / 2, cy + h / 2
    z0, z1 = cz - d / 2, cz + d / 2
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    b.add(v, f)


def box_yz(b, cx, y0, y1, z0, z1, w):
    box(b, cx, (y0 + y1) / 2, (z0 + z1) / 2, w, y1 - y0, z1 - z0)


def prism(b, profile, z0, z1):
    """Extrude a CCW 2D (x, y) polygon from z0 to z1 (front cap at z1)."""
    n = len(profile)
    v = [(x, y, z1) for x, y in profile] + [(x, y, z0) for x, y in profile]
    f = [tuple(range(n)), tuple(reversed(range(n, 2 * n)))]
    for i in range(n):
        j = (i + 1) % n
        f.append((i + n, j + n, j, i))
    b.add(v, f)


def cylinder(b, cx, y0, cz, rb, rt, h, n=SEG, cap_bottom=True, cap_top=True):
    v = [(cx + rb * math.cos(2 * math.pi * i / n), y0, cz + rb * math.sin(2 * math.pi * i / n)) for i in range(n)]
    v += [(cx + rt * math.cos(2 * math.pi * i / n), y0 + h, cz + rt * math.sin(2 * math.pi * i / n)) for i in range(n)]
    f = [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    circ = max(1, round(math.pi * (rb + rt)))      # whole tiles around the circumference
    uvs = [[(i / n * circ, y0), ((i + 1) / n * circ, y0), ((i + 1) / n * circ, y0 + h), (i / n * circ, y0 + h)]
           for i in range(n)]
    if cap_bottom:
        f.append(tuple(reversed(range(n))))
        uvs.append([(v[i][0], v[i][2]) for i in reversed(range(n))])
    if cap_top:
        f.append(tuple(range(n, 2 * n)))
        uvs.append([(v[i][0], v[i][2]) for i in range(n, 2 * n)])
    b.add(v, f, uvs)


def dome(b, cx, y0, cz, r, ribs=24, rib_amp=0.09, n_lon=48, n_lat=14, under=math.radians(36)):
    """Onion-profile ribbed dome: sphere of radius r whose centre is lifted so the
    base ring (latitude -under) sits at y0 and is narrower than the max bulge."""
    cy = y0 + r * math.sin(under)
    v, f = [], []
    for j in range(n_lat):
        lat = -under + (math.pi / 2 + under) * j / n_lat
        for i in range(n_lon):
            th = 2 * math.pi * i / n_lon
            s = 1 + rib_amp * math.cos(ribs * th) * math.cos(lat) * min(1.0, (lat + under) / 0.35 + 0.15)
            rr = r * math.cos(lat) * s
            v.append((cx + rr * math.cos(th), cy + r * math.sin(lat), cz + rr * math.sin(th)))
    apex = len(v)
    v.append((cx, cy + r, cz))
    for j in range(n_lat - 1):
        for i in range(n_lon):
            a, bb = j * n_lon + i, j * n_lon + (i + 1) % n_lon
            f.append((a, bb, bb + n_lon, a + n_lon))
    top = (n_lat - 1) * n_lon
    for i in range(n_lon):
        f.append((top + i, top + (i + 1) % n_lon, apex))
    b.add(v, f)


def pointed_arch(hw, ys, n=10):
    """Points of a two-centred pointed arch from (-hw, ys) over the apex to (hw, ys)."""
    R = hw * 1.25
    c = R - hw                      # left arc centre at (+c, ys)
    a_end = math.acos(-c / R)       # angle where the left arc reaches x = 0
    pts = []
    for k in range(n + 1):
        a = math.pi - (math.pi - a_end) * k / n
        pts.append((c + R * math.cos(a), ys + R * math.sin(a)))
    apex_y = pts[-1][1]
    right = [(-x, y) for x, y in reversed(pts[:-1])]
    return pts + right, apex_y


def spandrel(b, cx, hw, ys, yt, z0, z1):
    """Wall panel from ys..yt with a pointed-arch opening (concave n-gon)."""
    arc, apex_y = pointed_arch(hw, ys)
    if apex_y > yt - 0.05:
        apex_y = yt - 0.05
        arc = [(x, min(y, apex_y)) for x, y in arc]
    prof = [(cx + x, y) for x, y in arc] + [(cx + hw, yt), (cx - hw, yt)]
    prism(b, prof, z0, z1)
    return apex_y


def arch_band(b, cx, hw, ys, t, z0, z1):
    """Thin ring following the pointed arch (inner radius hw, width t)."""
    inner, _ = pointed_arch(hw, ys)
    outer, _ = pointed_arch(hw + t, ys)
    prof = [(cx + x, y) for x, y in inner] + [(cx + x, y) for x, y in reversed(outer)]
    prism(b, prof, z0, z1)


# ────────────────────────── madrasah ──────────────────────────
def build_madrasah(p, buckets):
    B = lambda key: buckets.setdefault(key, Bucket())
    buff, shadow, cobalt = B("Buff"), B("BuffShadow"), B("Cobalt")
    gold, marble, lapis, glaze = B("Gold"), B("Marble"), B("Lapis"), B(p["glaze"])
    tile, girih, band, chevron = B("BuffTile"), B("GirihFrame"), B("DrumBand"), B("Chevron")
    trim = gold if p["goldTrim"] else cobalt

    L, wingH, pw, ph, pd = p["facadeLen"], p["wingH"], p["portal"]["w"], p["portal"]["h"], p["portal"]["d"]
    frontD = pd
    zFront = frontD / 2                      # front face
    sideH = wingH * 0.87
    sideLen = TOTAL_DEPTH - frontD - WING_T
    sideZ = -(frontD / 2 + sideLen / 2)
    backZ = -(frontD / 2 + sideLen + WING_T / 2)
    zBack = -(TOTAL_DEPTH - frontD / 2)

    # plinth (marble dado)
    box(marble, 0, 0.15, (zFront + zBack) / 2, L + 1.0, 0.3, TOTAL_DEPTH + 1.0)

    # ── front wing segments with 2-storey pointed-arch niches ──
    segW = (L - pw) / 2
    nb = p["bays"]
    pil, baseH, bandH, topH = 0.35, 0.6, 0.35, 0.7
    storeyH = (wingH - baseH - bandH - topH) / 2
    bayW = (segW - (nb + 1) * pil) / nb
    hw = bayW / 2
    zWall = zFront - NICHE_DEPTH
    for sgn in (-1, 1):
        cx = sgn * (pw / 2 + segW / 2)
        x0 = cx - segW / 2
        # solid body, front face recessed by NICHE_DEPTH
        box(buff, cx, wingH / 2, (zWall + (-frontD / 2)) / 2, segW, wingH, zWall + frontD / 2)
        # frame bands at the full front plane
        box_yz(marble, cx, 0, baseH, zWall, zFront, segW)
        box_yz(trim, cx, baseH + storeyH, baseH + storeyH + bandH, zWall, zFront, segW)
        box_yz(tile, cx, wingH - topH, wingH, zWall, zFront, segW)
        box_yz(cobalt, cx, wingH - topH + 0.15, wingH - 0.15, zFront - 0.02, zFront + 0.02, segW)  # frieze
        for k in range(nb + 1):
            px = x0 + pil / 2 + k * (pil + bayW)
            box_yz(tile, px, baseH, wingH - topH, zWall, zFront, pil)
        for s in range(2):
            ys0 = baseH + s * (storeyH + bandH)
            for k in range(nb):
                bx = x0 + pil + hw + k * (pil + bayW)
                spandrel(tile, bx, hw, ys0 + storeyH * 0.58, ys0 + storeyH, zWall, zFront)
                # shadowed niche back + small turquoise tympanum panel
                box_yz(shadow, bx, ys0, ys0 + storeyH, zWall - 0.01, zWall + 0.02, bayW)
                box_yz(B("Turquoise"), bx, ys0 + storeyH * 0.58, ys0 + storeyH * 0.9, zWall + 0.02, zWall + 0.05, bayW * 0.9)

    # ── side + back wings (courtyard is hollow) ──
    for sgn in (-1, 1):
        box(tile, sgn * (L / 2 - WING_T / 2), sideH / 2, sideZ, WING_T, sideH, sideLen)
    box(tile, 0, sideH / 2, backZ, L, sideH, WING_T)

    # ── pishtaq portal with pointed-arch iwan recess ──
    iw = pw * 0.62
    ihw = iw / 2
    ys = ph * 0.42
    zIwan = zFront - IWAN_DEPTH
    box(buff, 0, ph / 2, (zIwan + (-pd / 2)) / 2, pw, ph, zIwan + pd / 2)          # body
    for sgn in (-1, 1):                                                          # piers
        px = sgn * (ihw + (pw / 2 - ihw) / 2)
        box_yz(tile, px, 0, ph, zIwan, zFront, pw / 2 - ihw)
        box_yz(girih, px, 0.6, ph - 0.6, zFront - 0.02, zFront + 0.03, (pw / 2 - ihw) * 0.55)  # girih tile strip
    apex_y = spandrel(girih, 0, ihw, ys, ph - 1.2, zIwan, zFront)               # girih spandrel (distinct from back wall)
    arch_band(marble, 0, ihw, ys, 0.28, zFront - 0.01, zFront + 0.04)           # white border band following the arch
    box_yz(girih, 0, ph - 1.2, ph, zIwan, zFront, iw)                            # girih frieze
    box_yz(marble, 0, 0, 0.6, zIwan, zFront + 0.02, iw)                          # threshold / dado
    box_yz(shadow, 0, 0.6, apex_y, zIwan - 0.02, zIwan + 0.02, iw)               # iwan back wall (shadowed buff)
    box_yz(buff, 0, ph - 0.1, ph + 0.25, -pd / 2, zFront, pw + 0.3)              # cornice cap

    # ── minarets: tapered shaft, corbelled gallery, flat lantern ──
    for m in p["minarets"]:
        x, h = m["offset"], m["h"]
        shaftH = h * 0.85
        cylinder(chevron, x, 0, zFront - 1.2, 1.0, 0.72, shaftH)                # chevron shaft
        cylinder(band, x, shaftH * 0.33, zFront - 1.2, 0.93, 0.92, 0.35)         # kufic band
        cylinder(band, x, shaftH * 0.66, zFront - 1.2, 0.85, 0.84, 0.35)
        # stepped corbelled gallery (muqarnas): 3 rings flaring 0.72 -> ~0.94 (1.3x shaft top)
        cylinder(buff, x, shaftH - 0.9, zFront - 1.2, 0.72, 0.80, 0.3)
        cylinder(band, x, shaftH - 0.6, zFront - 1.2, 0.80, 0.87, 0.3)
        cylinder(buff, x, shaftH - 0.3, zFront - 1.2, 0.87, 0.94, 0.3)
        cylinder(lapis, x, shaftH, zFront - 1.2, 0.95, 0.95, 0.5)                # gallery parapet ring
        cylinder(gold, x, shaftH + 0.5, zFront - 1.2, 0.95, 0.95, 0.08)          # gold lip
        cylinder(buff, x, shaftH + 0.58, zFront - 1.2, 0.66, 0.60, h - shaftH - 0.58)  # short lantern
        cylinder(gold, x, h, zFront - 1.2, 0.7, 0.7, 0.12)                       # flat top

    # ── domes: chamber block, tall drum with lapis band, ribbed onion dome, gold finial ──
    for d in p["domes"]:
        x, r, z = d["offset"], d["r"], d["z"]
        drumR = r * DRUM_R_FACTOR
        drumTopY = wingH + d["drumTop"]
        box(buff, x, sideH / 2, z, 2 * drumR + 0.8, sideH, 2 * drumR + 0.8)      # darskhana block
        cylinder(tile, x, sideH - 0.05, z, drumR * 1.04, drumR, drumTopY - sideH + 0.05)   # banna'i drum
        cylinder(band, x, drumTopY - 1.2, z, drumR * 1.02, drumR * 1.02, 0.7)    # kufic inscription band
        cylinder(B("Turquoise"), x, drumTopY - 0.45, z, drumR * 1.03, drumR * 1.03, 0.35)
        dome(glaze, x, drumTopY, z, r, ribs=d["ribs"])
        cylinder(gold, x, drumTopY + r * 1.36, z, 0.18, 0.12, r * 0.25)
        dome(gold, x, drumTopY + r * 1.36 + r * 0.25, z, 0.22, ribs=1, rib_amp=0, n_lon=12, n_lat=5)

    # ── Tilya-Kori corner guldasta turrets ──
    for t in p["turrets"]:
        x, h, r = t["offset"], t["h"], t["r"]
        cylinder(chevron, x, 0, zFront - 1.0, r, r * 0.85, h)
        cylinder(band, x, h * 0.55, zFront - 1.0, r * 0.9, r * 0.9, 0.3)
        cylinder(buff, x, h, zFront - 1.0, r * 0.85, r * 1.05, 0.35)
        dome(glaze, x, h + 0.35, zFront - 1.0, r * 0.95, ribs=12, n_lon=24, n_lat=8)


# ────────────────────────── scene / export ──────────────────────────
def main():
    t0 = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    try:
        bpy.ops.preferences.addon_enable(module="io_scene_gltf2")
    except Exception:
        pass

    for p in MADRASAHS:
        root = bpy.data.objects.new(p["name"], None)
        root.empty_display_size = 2
        scene.collection.objects.link(root)
        w = p["world"]
        root.location = (w["x"], -w["z"], 0.0)        # three (x,y,z) -> Blender (x,-z,y)
        root.rotation_euler = (0.0, 0.0, w["rotY"])    # three rotation.y == Blender rotation Z

        buckets = {}
        build_madrasah(p, buckets)
        for key, bk in buckets.items():
            if not bk.faces:
                continue
            me = bpy.data.meshes.new(f"{p['name']}_{key}")
            me.from_pydata(bk.verts, [], bk.faces)
            me.validate(clean_customdata=False)
            me.update()
            uv = me.uv_layers.new(name="UVMap")
            if len(uv.data) == len(bk.uvs):
                uv.data.foreach_set("uv", [c for xy in bk.uvs for c in xy])
            else:
                print(f"[registan] warn: loop/uv mismatch on {p['name']}_{key}: {len(uv.data)} vs {len(bk.uvs)}")
            me.materials.append(material(key))
            ob = bpy.data.objects.new(f"{p['name']}_{key}", me)
            ob.parent = root
            scene.collection.objects.link(ob)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True,
                              export_materials="EXPORT", export_normals=True, export_texcoords=True, export_image_format="AUTO",
                              export_animations=False, export_skins=False, export_cameras=False, export_lights=False)

    meshes = [o for o in scene.objects if o.type == "MESH"]
    nv = sum(len(o.data.vertices) for o in meshes)
    nf = sum(len(o.data.polygons) for o in meshes)
    nt = sum(sum(len(pg.vertices) - 2 for pg in o.data.polygons) for o in meshes)
    print(f"[registan] objects: {len(scene.objects)} ({len(meshes)} meshes, {len(scene.objects) - len(meshes)} empties)")
    print(f"[registan] vertices: {nv}  faces: {nf}  (triangles: {nt})")
    print(f"[registan] wrote {OUT}  {os.path.getsize(OUT) / 1024:.1f} KB  in {time.time() - t0:.1f}s")


if __name__ == "__main__" or bpy.app.background:
    main()
