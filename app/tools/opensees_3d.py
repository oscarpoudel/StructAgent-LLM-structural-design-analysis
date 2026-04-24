from __future__ import annotations

from app.models import Structure3DInputs

def analyze_3d_structure_opensees(inputs: Structure3DInputs) -> dict:
    """OpenSeesPy 3D structural analysis (ndm=3, ndf=6)."""
    try:
        import openseespy.opensees as ops
    except ImportError as e:
        return {
            "solver": "openseespy_3d_import_failed",
            "solver_warning": str(e),
            "status": "error"
        }

    ops.wipe()
    try:
        ops.model("basic", "-ndm", 3, "-ndf", 6)

        # Create nodes
        for node in inputs.nodes:
            ops.node(node.id, node.x, node.y, node.z)
            if node.support is not None:
                ops.fix(node.id, 
                        int(node.support.ux), int(node.support.uy), int(node.support.uz),
                        int(node.support.rx), int(node.support.ry), int(node.support.rz))

        # We will use Linear transformation for 3D
        # For a general 3D frame, we need a local z-axis direction (vecxz). We'll assume a default (0, 1, 0)
        # unless the member is perfectly vertical, then we might use (1, 0, 0).
        ops.geomTransf("Linear", 1, 0.0, 1.0, 0.0) # Horizontal/general members
        ops.geomTransf("Linear", 2, 1.0, 0.0, 0.0) # Vertical members

        # Create elements
        for member in inputs.members:
            e_pa = member.elastic_modulus_gpa * 1e9
            g_pa = member.shear_modulus_gpa * 1e9
            
            # Determine which geomTransf to use (simplistic check for vertical columns)
            start_n = next((n for n in inputs.nodes if n.id == member.start_node), None)
            end_n = next((n for n in inputs.nodes if n.id == member.end_node), None)
            
            transf_tag = 1
            if start_n and end_n:
                dx = abs(start_n.x - end_n.x)
                dz = abs(start_n.z - end_n.z)
                if dx < 1e-6 and dz < 1e-6:
                    transf_tag = 2 # Vertical column
            
            ops.element("elasticBeamColumn", member.id, member.start_node, member.end_node,
                        member.area_m2, e_pa, g_pa, member.j_m4, member.iy_m4, member.iz_m4, transf_tag)

        # Loads
        ops.timeSeries("Linear", 1)
        ops.pattern("Plain", 1, 1)

        # Nodal Loads
        for load in inputs.nodal_loads:
            ops.load(load.node_id, 
                     load.fx_kn * 1000.0, load.fy_kn * 1000.0, load.fz_kn * 1000.0,
                     load.mx_kn_m * 1000.0, load.my_kn_m * 1000.0, load.mz_kn_m * 1000.0)

        # Member Loads (simplified to local y and z uniform loads)
        for m_load in inputs.member_loads:
            wy_n_per_m = m_load.wy_kn_per_m * 1000.0
            wz_n_per_m = m_load.wz_kn_per_m * 1000.0
            ops.eleLoad("-ele", m_load.member_id, "-type", "-beamUniform", wy_n_per_m, wz_n_per_m)

        # Analysis options
        ops.system("BandGeneral")
        ops.numberer("RCM")
        ops.constraints("Plain")
        ops.integrator("LoadControl", 1.0)
        ops.algorithm("Linear")
        ops.analysis("Static")
        
        status = ops.analyze(1)
        ops.reactions()

        # Extract Results
        nodal_displacements = {}
        nodal_reactions = {}
        for node in inputs.nodes:
            nid = node.id
            disp = ops.nodeDisp(nid)
            nodal_displacements[nid] = [d * 1000.0 for d in disp[:3]] + disp[3:] # translations in mm, rotations in rad
            
            if node.support is not None:
                react = ops.nodeReaction(nid)
                nodal_reactions[nid] = {
                    "Fx_kn": react[0] / 1000.0,
                    "Fy_kn": react[1] / 1000.0,
                    "Fz_kn": react[2] / 1000.0,
                    "Mx_kn_m": react[3] / 1000.0,
                    "My_kn_m": react[4] / 1000.0,
                    "Mz_kn_m": react[5] / 1000.0,
                }

        member_forces = {}
        for member in inputs.members:
            mid = member.id
            forces = ops.eleForce(mid)
            # forces: 12 elements (P, Vy, Vz, T, My, Mz at Node I and Node J)
            member_forces[mid] = [f / 1000.0 for f in forces]

        return {
            "solver": "openseespy_3d_frame",
            "opensees_status": status,
            "displacements": nodal_displacements,
            "reactions": nodal_reactions,
            "member_forces": member_forces,
            "geometry": {
                "nodes": [{"id": n.id, "x": n.x, "y": n.y, "z": n.z} for n in inputs.nodes],
                "members": [{"id": m.id, "start_node": m.start_node, "end_node": m.end_node} for m in inputs.members]
            },
            "is_finite": status == 0
        }

    finally:
        ops.wipe()
