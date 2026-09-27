"""
Build the 3D flowers for the 政綱 flower field and export them as assets/flowers.glb
(+ js/flowers-model.js, base64, so the site also works from file://).

Run:
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" -b -P blender/build_flowers.py -- [--render preview.png]

Every species is ONE mesh with vertex colours (no textures), origin at the ground,
+Z up in Blender (+Y up after glTF export). Units: metres.
Species: moonweed (蒼月草, blue), daisy, cosmos, bell (lavender), grass.
"""
import bpy, bmesh, math, sys, os, random, base64
from mathutils import Vector, Matrix

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "flowers.glb")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER = argv[argv.index("--render") + 1] if "--render" in argv else None
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


class Builder:
    """Collects triangles/quads with per-corner colours into one bmesh."""

    def __init__(self):
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.color.new("Color")

    def grid(self, pts, cols):
        """pts/cols: 2-D lists [row][col] of Vector / rgb."""
        rows, cn = len(pts), len(pts[0])
        vs = [[self.bm.verts.new(p) for p in row] for row in pts]
        for r in range(rows - 1):
            for c in range(cn - 1):
                quad = (vs[r][c], vs[r][c + 1], vs[r + 1][c + 1], vs[r + 1][c])
                try:
                    f = self.bm.faces.new(quad)
                except ValueError:
                    continue
                cc = (cols[r][c], cols[r][c + 1], cols[r + 1][c + 1], cols[r + 1][c])
                for loop, rgb in zip(f.loops, cc):
                    loop[self.col] = (*rgb, 1.0)

    def finish(self, name, mat):
        self.bm.normal_update()
        me = bpy.data.meshes.new(name)
        self.bm.to_mesh(me)
        self.bm.free()
        for p in me.polygons:
            p.use_smooth = True
        ob = bpy.data.objects.new(name, me)
        ob.data.materials.append(mat)
        scene.collection.objects.link(ob)
        try:
            me.color_attributes.active_color_name = "Color"
        except Exception:
            pass
        return ob


def petal(b, M, length, width, colors, tilt=0.35, bend=0.25, cup=0.35, su=4, sv=5,
          notch=False, rib=True, droop=0.0):
    """One petal along +X from the origin, then transformed by matrix M.
    colors = (base, mid, tip) rgb."""
    base, mid, tip = colors
    pts, cols = [], []
    for j in range(sv + 1):
        v = j / sv
        # width profile: narrow base, widest ~60 %, rounded tip
        w = width * (math.sin(math.pi * min(1, v * 0.92 + 0.04)) ** 0.75) * (1 - 0.15 * v)
        if notch and v > 0.85:
            w *= 1.0 + (v - 0.85) * 1.2
        ang = tilt + bend * v - droop * v * v          # elevation along the petal
        d = length * v
        x = d * math.cos(ang)
        z = d * math.sin(ang)
        row_p, row_c = [], []
        for i in range(su + 1):
            u = i / su * 2 - 1                          # -1 … 1 across
            y = u * w
            zc = z + cup * (u * u) * w                  # cupped (edges up)
            if notch and v >= 0.999:
                zc -= 0.0
                x_n = x - (0.25 * width * (1 - abs(u)) if abs(u) < 0.5 else 0)
            else:
                x_n = x
            row_p.append(M @ Vector((x_n, y, zc)))
            t = v ** 0.9
            c = mix(base, mid, min(1, t * 1.6)) if t < 0.62 else mix(mid, tip, (t - 0.62) / 0.38)
            edge = abs(u)
            c = mix(c, tuple(min(1, ch * 1.08 + 0.03) for ch in c), 0.35 * (1 - edge) if rib else 0)  # soft midrib highlight
            c = tuple(ch * (1 - 0.12 * edge * edge) for ch in c)                                        # darker edges
            row_c.append(c)
        pts.append(row_p)
        cols.append(row_c)
    b.grid(pts, cols)


def dome(b, M, radius, height, c1, c2, seg=10, rings=4):
    """Flower centre: shallow dome (disc)."""
    pts, cols = [], []
    for r in range(rings + 1):
        t = r / rings
        rad = radius * math.sin(t * math.pi / 2)
        z = height * math.cos(t * math.pi / 2)
        row_p, row_c = [], []
        for i in range(seg + 1):
            a = i / seg * math.tau
            row_p.append(M @ Vector((rad * math.cos(a), rad * math.sin(a), z)))
            row_c.append(mix(c1, c2, t))
        pts.append(row_p)
        cols.append(row_c)
    b.grid(pts, cols)


def stem(b, h, r, c1, c2, lean=(0.0, 0.0), sides=5, segs=5):
    """Stem from the ground to (lean, h). Returns the top point + direction."""
    pts, cols = [], []
    top = Vector((lean[0], lean[1], h))
    for j in range(segs + 1):
        t = j / segs
        cx, cy = lean[0] * t * t, lean[1] * t * t
        z = h * t
        rr = r * (1.15 - 0.3 * t)
        row_p, row_c = [], []
        for i in range(sides + 1):
            a = i / sides * math.tau
            row_p.append(Vector((cx + rr * math.cos(a), cy + rr * math.sin(a), z)))
            row_c.append(mix(c1, c2, t))
        pts.append(row_p)
        cols.append(row_c)
    b.grid(pts, cols)
    d = Vector((2 * lean[0], 2 * lean[1], h)).normalized()
    return top, d


def head_matrix(top, direction, spin=0.0):
    """Matrix placing a flower head at `top`, facing along `direction` (+Z of the head)."""
    z = direction.normalized()
    x = Vector((1, 0, 0)) if abs(z.x) < 0.9 else Vector((0, 1, 0))
    y = z.cross(x).normalized()
    x = y.cross(z).normalized()
    R = Matrix(((x.x, y.x, z.x), (x.y, y.y, z.y), (x.z, y.z, z.z))).to_4x4()
    return Matrix.Translation(top) @ R @ Matrix.Rotation(spin, 4, "Z")


def leaves(b, h, count, c):
    for k in range(count):
        a = random.uniform(0, math.tau)
        zz = h * random.uniform(0.12, 0.4)
        M = Matrix.Translation((0, 0, zz)) @ Matrix.Rotation(a, 4, "Z")
        petal(b, M, h * random.uniform(0.32, 0.45), h * 0.055, (mix(c, (0, 0, 0), .35), c, mix(c, (1, 1, 1), .15)),
              tilt=0.9, bend=-0.9, cup=0.25, su=2, sv=4, rib=True)


def flower(name, mat, spec):
    b = Builder()
    h = spec["h"]
    lean = (random.uniform(-.06, .06), random.uniform(-.06, .06))
    green_lo, green_hi = hexc("#1f4a2a"), hexc("#4f8a4a")
    top, d = stem(b, h, spec.get("stem_r", 0.007), green_lo, green_hi, lean)
    leaves(b, h, spec.get("leaves", 2), hexc("#3c7a44"))
    face = (d + Vector((0.35, 0, 0.9))).normalized()       # heads tilt a little sideways
    M = head_matrix(top, face)
    n = spec["n"]
    for layer in spec.get("layers", [dict()]):
        for i in range(n if "n" not in layer else layer["n"]):
            nn = layer.get("n", n)
            a = i / nn * math.tau + layer.get("rot", 0) + random.uniform(-.05, .05)
            PM = M @ Matrix.Rotation(a, 4, "Z")
            petal(b, PM, spec["len"] * layer.get("scale", 1) * random.uniform(.93, 1.05), spec["w"] * layer.get("scale", 1),
                  spec["colors"], tilt=layer.get("tilt", spec.get("tilt", .3)), bend=spec.get("bend", .2),
                  cup=spec.get("cup", .3), su=spec.get("su", 4), sv=spec.get("sv", 5), notch=spec.get("notch", False),
                  droop=spec.get("droop", 0))
    if "center" in spec:
        c = spec["center"]
        dome(b, M, c["r"], c["h"], hexc(c["c1"]), hexc(c["c2"]))
    return b.finish(name, mat)


def grass(name, mat, blades=8):
    b = Builder()
    for k in range(blades):
        a = random.uniform(0, math.tau)
        h = random.uniform(.28, .6)
        lean = random.uniform(.1, .35)
        w = random.uniform(.012, .02)
        pts, cols = [], []
        for j in range(5):
            t = j / 4
            ww = w * (1 - t) + 0.001
            x = math.cos(a) * lean * h * t * t
            y = math.sin(a) * lean * h * t * t
            z = h * t
            px, py = -math.sin(a) * ww, math.cos(a) * ww
            pts.append([Vector((x - px, y - py, z)), Vector((x + px, y + py, z))])
            c = mix(hexc("#14331f"), hexc("#5d9a55"), t ** .8)
            cols.append([c, c])
        b.grid(pts, cols)
    return b.finish(name, mat)


# ------------------------------------------------------------------ material (vertex colours)
mat = bpy.data.materials.new("FlowerVC")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
vc = nt.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "Color"
nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.6

SPECS = {
    # 蒼月草：芙莉蓮最喜歡的藍色花
    "moonweed": dict(h=.4, n=5, len=.19, w=.1, stem_r=.009, tilt=.35, bend=.35, cup=.45, droop=.1,
                     colors=(hexc("#163f94"), hexc("#3f7fd6"), hexc("#cfe6ff")),
                     center=dict(r=.04, h=.026, c1="#fff6cf", c2="#e3b24a")),
    "daisy": dict(h=.33, n=16, len=.16, w=.03, stem_r=.008, tilt=.12, bend=.05, cup=.2, su=2, sv=4,
                  colors=(hexc("#d9d3f0"), hexc("#f6f4ff"), hexc("#ffffff")),
                  center=dict(r=.046, h=.032, c1="#ffe07a", c2="#d98f1c")),
    "cosmos": dict(h=.52, n=8, len=.2, w=.066, stem_r=.009, tilt=.18, bend=.1, cup=.18, notch=True,
                   colors=(hexc("#a8306e"), hexc("#e27fb0"), hexc("#ffe0ee")),
                   center=dict(r=.028, h=.02, c1="#ffe08a", c2="#c98a18")),
    "bell": dict(h=.36, n=5, len=.14, w=.07, stem_r=.009, tilt=1.05, bend=-.35, cup=.55, leaves=3,
                 colors=(hexc("#4a3aa6"), hexc("#8a7ae0"), hexc("#e2dcff")),
                 center=dict(r=.015, h=.01, c1="#fff8e0", c2="#e8d27a")),
}

objs = [flower(name, mat, spec) for name, spec in SPECS.items()]
objs.append(grass("grass", mat))
for o in objs:
    print(o.name, len(o.data.polygons), "faces")

# ------------------------------------------------------------------ export (only the models)
kw = dict(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True, use_selection=False)
props = bpy.ops.export_scene.gltf.get_rna_type().properties.keys()
if "export_vertex_color" in props:
    kw["export_vertex_color"] = "ACTIVE"
if "export_all_vertex_colors" in props:
    kw["export_all_vertex_colors"] = True
if "export_colors" in props:
    kw["export_colors"] = True
bpy.ops.export_scene.gltf(**kw)
print("exported", OUT, os.path.getsize(OUT), "bytes")
with open(OUT, "rb") as f:
    b64 = base64.b64encode(f.read()).decode()
with open(os.path.join(ROOT, "js", "flowers-model.js"), "w", encoding="utf-8") as f:
    f.write("/* 自動產生：blender/build_flowers.py —— 花田的 3D 花 (GLB, base64)。請勿手動修改。 */\n")
    f.write('window.FLOWERS_GLB = "' + b64 + '";\n')
print("wrote js/flowers-model.js")

# ------------------------------------------------------------------ optional preview render
if RENDER:
    # a little meadow of copies for the preview
    for ob in objs:
        ob.location = (-10, 0, 0)
    for k in range(260):
        src = random.choice(objs[:4]) if k % 3 else objs[4]
        cp = src.copy()
        scene.collection.objects.link(cp)
        cp.location = (random.uniform(-1.3, 1.3), random.uniform(-.2, 2.4), 0)
        cp.rotation_euler = (0, 0, random.uniform(0, math.tau))
        s = random.uniform(.85, 1.15)
        cp.scale = (s, s, s)
    for i, src in enumerate(objs):
        cp = src.copy(); scene.collection.objects.link(cp)
        cp.location = (-1.1 + i * .55, -1.2, 0); cp.scale = (1.8, 1.8, 1.8)
    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0))
    gp = bpy.context.active_object
    gm = bpy.data.materials.new("G"); gm.use_nodes = True
    gm.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.02, 0.05, 0.03, 1)
    gp.data.materials.append(gm)
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.device = "CPU"
    scene.render.resolution_x, scene.render.resolution_y = 1200, 700
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("W"); scene.world = world; world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.16, 0.25, 0.45, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.8
    ld = bpy.data.lights.new("Sun", "SUN"); ld.energy = 3.0
    lo = bpy.data.objects.new("Sun", ld); scene.collection.objects.link(lo)
    lo.rotation_euler = (math.radians(50), 0, math.radians(35))
    cd = bpy.data.cameras.new("C"); cd.lens = 40
    cam = bpy.data.objects.new("C", cd); scene.collection.objects.link(cam)
    cam.location = (0, -3.1, 1.0)
    cam.rotation_euler = (math.radians(74), 0, 0)
    scene.camera = cam
    scene.render.filepath = RENDER
    bpy.ops.render.render(write_still=True)
    print("rendered", RENDER)
