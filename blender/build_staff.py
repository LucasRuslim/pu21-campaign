"""
Build the campaign staff (權杖) and export it as assets/staff.glb.

Run:
  "C:/Program Files/Blender Foundation/Blender 5.0/blender.exe" -b -P blender/build_staff.py -- [--render preview.png]

Z is up in Blender; the glTF exporter converts to Y-up for three.js.
The staff's head (orb) points along +Z, so in three.js it points along +Y.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "staff.glb")
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
RENDER = argv[argv.index("--render") + 1] if "--render" in argv else None

# ------------------------------------------------------------------ reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ------------------------------------------------------------------ materials
def material(name, color, metallic=0.0, roughness=0.5, coat=0.0, emission=None, strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    if "Coat Weight" in b.inputs:
        b.inputs["Coat Weight"].default_value = coat
    if emission:
        b.inputs["Emission Color"].default_value = (*emission, 1)
        b.inputs["Emission Strength"].default_value = strength
    return m

GOLD = material("Gold", (1.0, 0.70, 0.30), metallic=1.0, roughness=0.22)
GOLD_DARK = material("GoldDark", (0.78, 0.50, 0.20), metallic=1.0, roughness=0.35)
LACQUER = material("Lacquer", (0.16, 0.006, 0.010), roughness=0.26, coat=1.0)
CORD = material("Cord", (0.42, 0.015, 0.02), roughness=0.62)
RIBBON = material("Ribbon", (0.50, 0.012, 0.02), roughness=0.45)
ORB = material("Orb", (0.55, 0.0, 0.008), roughness=0.04, coat=1.0, emission=(1.0, 0.02, 0.02), strength=0.5)

# ------------------------------------------------------------------ mesh helpers
def to_object(name, bm, mat, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(mat)
    scene.collection.objects.link(ob)
    return ob

def lathe(name, profile, mat, segs=48, z0=0.0):
    """Revolve [(radius, z), ...] around the Z axis."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        ring = []
        for i in range(segs):
            a = 2 * math.pi * i / segs
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z + z0)))
        rings.append(ring)
    for j in range(len(rings) - 1):
        for i in range(segs):
            a, b = rings[j][i], rings[j][(i + 1) % segs]
            c, d = rings[j + 1][(i + 1) % segs], rings[j + 1][i]
            bm.faces.new((a, b, c, d))
    # caps
    if profile[0][0] > 0:
        bm.faces.new(list(reversed(rings[0])))
    if profile[-1][0] > 0:
        bm.faces.new(rings[-1])
    bm.normal_update()
    return to_object(name, bm, mat)

def tube(name, pts, radii, mat, segs=20, flat=1.0, caps=True, up=Vector((0, 1, 0))):
    """Sweep an (optionally flattened) circle along a polyline with per-point radius.
    `flat` scales the cross-section along the binormal (the 'up'-ish axis)."""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    tangents = []
    for i in range(n):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]).normalized()
        tangents.append(t)
    # parallel transport frames
    normal = up.cross(tangents[0])
    if normal.length < 1e-4:
        normal = Vector((1, 0, 0)).cross(tangents[0])
    normal.normalize()
    frames = []
    for i in range(n):
        if i > 0:
            axis = tangents[i - 1].cross(tangents[i])
            if axis.length > 1e-6:
                ang = tangents[i - 1].angle(tangents[i])
                from mathutils import Matrix
                normal = (Matrix.Rotation(ang, 3, axis.normalized()) @ normal).normalized()
        binormal = tangents[i].cross(normal).normalized()
        frames.append((normal, binormal))
    bm = bmesh.new()
    rings = []
    for i in range(n):
        nrm, bin_ = frames[i]
        r = radii[i] if isinstance(radii, (list, tuple)) else radii
        ring = []
        for k in range(segs):
            a = 2 * math.pi * k / segs
            off = nrm * (math.cos(a) * r) + bin_ * (math.sin(a) * r * flat)
            ring.append(bm.verts.new(pts[i] + off))
        rings.append(ring)
    for j in range(n - 1):
        for k in range(segs):
            a, b = rings[j][k], rings[j][(k + 1) % segs]
            c, d = rings[j + 1][(k + 1) % segs], rings[j + 1][k]
            bm.faces.new((a, b, c, d))
    if caps:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bm.normal_update()
    return to_object(name, bm, mat)

# ------------------------------------------------------------------ geometry
POLE_BOTTOM, POLE_TOP = -1.45, 1.02
HEAD = Vector((0, 0, 1.56))   # orb centre
R = 0.33                      # crescent radius

# pole: gently tapered lacquered shaft
pole_pts = [(0, 0, POLE_BOTTOM + (POLE_TOP - POLE_BOTTOM) * t / 40) for t in range(41)]
pole_r = [0.030 - 0.004 * (t / 40) for t in range(41)]
tube("Pole", pole_pts, pole_r, LACQUER, segs=32)

# bottom ferrule + foot
lathe("Ferrule", [(0.0, -0.02), (0.022, -0.015), (0.034, 0.0), (0.036, 0.03), (0.031, 0.05), (0.031, 0.09),
                  (0.040, 0.10), (0.040, 0.13), (0.032, 0.14), (0.032, 0.20), (0.038, 0.21), (0.038, 0.23), (0.029, 0.24)],
      GOLD, z0=POLE_BOTTOM - 0.02)
# thin gold bands along the shaft
for z in (-0.55, 0.25):
    lathe(f"Band{z}", [(0.029, -0.012), (0.034, -0.008), (0.034, 0.008), (0.029, 0.012)], GOLD_DARK, z0=z)

# top collar where the head sits
lathe("Collar", [(0.027, 0.0), (0.040, 0.012), (0.044, 0.035), (0.036, 0.05), (0.036, 0.08), (0.046, 0.095),
                 (0.046, 0.12), (0.032, 0.135)], GOLD, z0=POLE_TOP - 0.02)
# neck between collar and crescent
lathe("Neck", [(0.030, 0.0), (0.030, HEAD.z - R - POLE_TOP - 0.05)], GOLD_DARK, z0=POLE_TOP + 0.1)

# red cord wrapped around the neck
helix = []
turns, h0, h1 = 6.5, POLE_TOP + 0.13, HEAD.z - R + 0.02
steps = 260
for i in range(steps + 1):
    t = i / steps
    a = 2 * math.pi * turns * t
    helix.append((0.038 * math.cos(a), 0.038 * math.sin(a), h0 + (h1 - h0) * t))
tube("Cord", helix, 0.011, CORD, segs=10)

# crescent: arc in the XZ plane, thick at the bottom, tapering to sharp horns.
a0, a1 = math.radians(112), math.radians(402)   # opening at the upper right
N = 120
cres_pts, cres_r = [], []
for i in range(N + 1):
    t = i / N
    a = a0 + (a1 - a0) * t
    rad = R + 0.035 * math.sin(math.pi * t)          # slightly fuller in the middle
    cres_pts.append((rad * math.cos(a), 0, HEAD.z + rad * math.sin(a)))
    cres_r.append(max(0.004, 0.062 * math.sin(math.pi * t) ** 0.75))
tube("Crescent", cres_pts, cres_r, GOLD, segs=24, flat=0.55)
# the upper-left horn curls up into a spike
spike = []
for i in range(25):
    t = i / 24
    a = a0 - math.radians(26) * t
    rad = R + 0.02 * t
    spike.append((rad * math.cos(a) - 0.01 * t, 0, HEAD.z + rad * math.sin(a) + 0.06 * t * t))
tube("Spike", spike, [0.012 * (1 - t / 24) + 0.0015 for t in range(25)], GOLD, segs=16, flat=0.7)

# orb + bezel ring + prongs
bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=32, radius=0.135, location=HEAD)
orb = bpy.context.active_object
orb.name = "Orb"
orb.data.materials.append(ORB)
bpy.ops.object.shade_smooth()

ring_pts = []
for i in range(97):
    a = 2 * math.pi * i / 96
    ring_pts.append((0.148 * math.cos(a), 0, HEAD.z + 0.148 * math.sin(a)))
tube("Bezel", ring_pts, 0.017, GOLD, segs=16, caps=False, flat=1.6)
for deg in (180, 270):
    a = math.radians(deg)
    p0 = Vector((0.16 * math.cos(a), 0, HEAD.z + 0.16 * math.sin(a)))
    p1 = Vector(((R - 0.03) * math.cos(a), 0, HEAD.z + (R - 0.03) * math.sin(a)))
    if deg == 90:   # top prong only reaches into the gap a little
        p1 = Vector((0.2 * math.cos(a), 0, HEAD.z + 0.2 * math.sin(a)))
    tube(f"Prong{deg}", [p0, (p0 + p1) / 2, p1], [0.016, 0.012, 0.009], GOLD_DARK, segs=12)

# ribbon hanging from the lower-left of the crescent, with a small tassel
ra = math.radians(208)
anchor = Vector(((R + 0.02) * math.cos(ra), 0, HEAD.z + (R + 0.02) * math.sin(ra)))
rib_pts = []
for i in range(60):
    t = i / 59
    rib_pts.append(anchor + Vector((-0.03 * t + 0.05 * math.sin(t * 6.0), 0.03 * math.sin(t * 3.4), -0.62 * t)))
tube("Ribbon", rib_pts, [0.042 - 0.012 * (i / 59) for i in range(60)], RIBBON, segs=14, flat=0.1)
tip = rib_pts[-1]
lathe("Tassel", [(0.0, 0.0), (0.012, 0.01), (0.016, 0.04), (0.008, 0.07), (0.0, 0.075)], RIBBON, segs=16, z0=0)
bpy.data.objects["Tassel"].location = (tip.x, tip.y, tip.z - 0.075)
bpy.data.objects["Tassel"].rotation_euler = (0, 0, 0)
lathe("Knot", [(0.0, -0.012), (0.014, -0.006), (0.014, 0.006), (0.0, 0.012)], GOLD, segs=16, z0=0)
bpy.data.objects["Knot"].location = anchor

# ------------------------------------------------------------------ recentre: origin at the staff's middle
objs = [o for o in scene.objects if o.type == "MESH"]
zs = [ (o.matrix_world @ Vector(c)).z for o in objs for c in o.bound_box ]
mid = (min(zs) + max(zs)) / 2
root = bpy.data.objects.new("Staff", None)
scene.collection.objects.link(root)
for o in objs:
    o.location.z -= mid
    o.parent = root
print("staff height:", max(zs) - min(zs))

# ------------------------------------------------------------------ export
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", export_apply=True, export_yup=True)
print("exported", OUT, os.path.getsize(OUT), "bytes")

# embed as base64 so the site also works when opened straight from disk (file://)
import base64
with open(OUT, "rb") as f:
    b64 = base64.b64encode(f.read()).decode()
with open(os.path.join(ROOT, "js", "staff-model.js"), "w", encoding="utf-8") as f:
    f.write("/* 自動產生：blender/build_staff.py —— 權杖 3D 模型 (GLB, base64)。請勿手動修改。 */\n")
    f.write('window.STAFF_GLB = "' + b64 + '";\n')
print("wrote js/staff-model.js")

# ------------------------------------------------------------------ optional preview render
if RENDER:
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.device = "CPU"
    scene.render.resolution_x, scene.render.resolution_y = 600, 1000
    scene.render.film_transparent = "--transparent" in argv
    scene.view_settings.view_transform = "Standard"
    world = bpy.data.worlds.new("W")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.02, 0.025, 0.05, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
    for loc, e in (((2, -3, 2), 900), ((-3, -2, 0.5), 450), ((0, 3, 3), 600)):
        ld = bpy.data.lights.new("L", "AREA"); ld.energy = e; ld.size = 2
        lo = bpy.data.objects.new("L", ld); lo.location = loc; scene.collection.objects.link(lo)
        lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    cd = bpy.data.cameras.new("C"); cd.lens = 85
    cam = bpy.data.objects.new("C", cd); cam.location = (0, -11, 0.2); scene.collection.objects.link(cam)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam
    root.rotation_euler = (0, 0, math.radians(-12))
    scene.render.filepath = RENDER
    bpy.ops.render.render(write_still=True)
    print("rendered", RENDER)
