# Tools Documentation

## app/tools/__init__.py - Tools Package

Exports all tool functions and section database:

- BeamTool, TrussTool, FrameTool, ColumnTool, Structure3DTool
- SectionDatabase, Section
- ReportFormatter

## app/tools/beam.py - Beam Analysis Tool

Closed-form beam analysis with 4 support types and superposition-based calculations.

### BeamTool Class

**Supported Support Types**:
- simply_supported: Simply supported beam
- cantilever: Cantilever beam (fixed-free)
- ixed_fixed: Fixed-fixed beam
- propped_cantilever: Propped cantilever (fixed-simple)

**Methods**:

- calculate(inputs: BeamInputs) -> dict: Main entry point for beam analysis
- _calculate_reactions(inputs): Compute support reactions for each support type
- _calculate_shear_moment(inputs): Calculate shear force and bending moment at each position
- _calculate_deflection(inputs): Calculate deflection using closed-form equations
- _calculate_stress(inputs): Calculate bending and shear stress
- _check_deflection_limit(inputs, max_deflection): Verify deflection against L/360 limit
- _generate_warnings(inputs, results): Generate engineering warnings

**Closed-Form Equations**:

Each support type has specific equations for:
- Reactions at supports
- Shear force V(x) along the beam
- Bending moment M(x) along the beam
- Deflection y(x) along the beam
- Maximum values and their positions

**Output**:

Returns dict with:
- eactions: Support reactions (RA, RB, MA, MB)
- shear_force: Array of (x, V) values
- ending_moment: Array of (x, M) values
- deflection: Array of (x, y) values
- max_shear: Maximum shear force and position
- max_moment: Maximum bending moment and position
- max_deflection: Maximum deflection and position
- max_bending_stress: Maximum bending stress
- max_shear_stress: Maximum shear stress
- warnings: List of engineering warnings

## app/tools/opensees_beam.py - OpenSeesPy Beam Solver

Finite element beam analysis using OpenSeesPy for complex loading and support conditions.

### OpenSeesBeamSolver Class

**Methods**:

- solve(inputs: BeamInputs) -> dict: Main solver entry point
- _build_model(inputs): Create OpenSees model with nodes, elements, and constraints
- _apply_loads(inputs): Apply distributed and point loads
- _run_analysis(): Execute static analysis
- _extract_results(): Extract node displacements and element forces

**Model Setup**:

- Uses ElasticBeam2d elements with specified E and I
- Linear elastic material
- Static plain analysis with PARDISO solver
- Load patterns with point and distributed loads

**Output**:

Returns dict with:
- 
ode_displacements: Node displacement vectors
- element_forces: Element end forces
- shear_force: Shear force diagram data
- ending_moment: Bending moment diagram data
- deflection: Deflection diagram data
- eactions: Support reactions

## app/tools/truss.py - Truss Analysis Tool

Matrix stiffness method for planar truss analysis.

### TrussTool Class

**Methods**:

- calculate(inputs: TrussInputs) -> dict: Main entry point
- _build_stiffness_matrix(inputs): Assemble global stiffness matrix
- _apply_boundary_conditions(inputs, K, F): Apply support constraints
- _solve_displacements(K_reduced, F_reduced): Solve for unknown displacements
- _calculate_member_forces(inputs, displacements): Compute axial forces in each member
- _calculate_reactions(inputs, displacements): Compute support reactions
- _check_stability(inputs): Verify truss determinacy (m + r = 2j)

**Algorithm**:

1. Build element stiffness matrices in global coordinates
2. Assemble global stiffness matrix K
3. Apply boundary conditions (remove constrained DOFs)
4. Solve K_reduced * u = F_reduced for displacements
5. Back-substitute to get full displacement vector
6. Calculate member forces: F = EA/L * [-1 1] * u_member
7. Calculate support reactions

**Output**:

Returns dict with:
- 
ode_displacements: Node displacement vectors (ux, uy)
- member_forces: Axial force in each member (positive = tension)
- member_stresses: Axial stress in each member
- support_reactions: Reaction forces at supports
- stability_check: Determinacy status (statically determinate, indeterminate, unstable)
- warnings: List of engineering warnings

## app/tools/frame.py - Frame Analysis Tool

2D frame analysis using OpenSeesPy for rigid-jointed frames.

### FrameTool Class

**Methods**:

- calculate(inputs: FrameInputs) -> dict: Main entry point
- _build_opensees_model(inputs): Create OpenSees model
- _apply_loads(inputs): Apply nodal and member loads
- _run_analysis(): Execute static analysis
- _extract_results(): Extract node displacements and element forces

**Model Setup**:

- Uses ElasticBeamColumn2d elements
- 3 DOF per node (ux, uy, theta)
- Linear elastic material with specified E, A, I
- Static plain analysis with PARDISO solver

**Output**:

Returns dict with:
- 
ode_displacements: Node displacement vectors (ux, uy, theta)
- member_end_forces: Element end forces (axial, shear, moment)
- support_reactions: Reaction forces and moments at supports
- diagram_data: Shear, moment, and axial force diagram data
- warnings: List of engineering warnings

## app/tools/column.py - Column Analysis Tool

Euler buckling and AISC column design checks.

### ColumnTool Class

**Methods**:

- calculate(inputs: ColumnInputs) -> dict: Main entry point
- _calculate_euler_buckling(inputs): Compute Euler critical load
- _calculate_slenderness_ratio(inputs): Compute slenderness ratio
- _check_aisc_column(inputs, euler_load): AISC column design check
- _calculate_stress(inputs, axial_load): Compute axial stress

**Calculations**:

- **Euler critical load**: P_cr = pi^2 * E * I / (K*L)^2
  - K = effective length factor based on end conditions
  - End conditions: pinned-pinned (1.0), fixed-fixed (0.5), fixed-free (2.0), fixed-pinned (0.7)
- **Slenderness ratio**: lambda = K*L / r, where r = sqrt(I/A)
- **AISC check**: Compare actual stress to allowable stress per AISC 360
- **Safety factor**: FS = P_cr / P_actual

**Output**:

Returns dict with:
- euler_critical_load_kn: Euler buckling load
- slenderness_ratio: Slenderness ratio
- adius_of_gyration_m: Radius of gyration
- safety_factor: Factor of safety against buckling
- xial_stress_mpa: Actual axial stress
- isc_check: Pass/fail status per AISC
- warnings: List of engineering warnings

## app/tools/opensees_3d.py - 3D Structure Analysis Tool

3D frame analysis using OpenSeesPy for spatial structures.

### Structure3DTool Class

**Methods**:

- calculate(inputs: Structure3DInputs) -> dict: Main entry point
- _build_model(inputs): Create 3D OpenSees model
- _apply_boundary_conditions(inputs): Apply support constraints
- _apply_loads(inputs): Apply nodal and member loads
- _run_analysis(): Execute static analysis
- _extract_results(): Extract node displacements and element forces

**Model Setup**:

- Uses ElasticBeam3d elements
- 6 DOF per node (ux, uy, uz, rx, ry, rz)
- Linear elastic material with E and G
- Static plain analysis with PARDISO solver

**Output**:

Returns dict with:
- 
ode_displacements: Node displacement vectors (6 DOF)
- member_end_forces: Element end forces (axial, shear, torsion, moment)
- support_reactions: Reaction forces and moments at supports
- max_displacement: Maximum displacement magnitude and location
- warnings: List of engineering warnings

## app/tools/report.py - Report Formatter

Generates markdown engineering reports from analysis results.

### ReportFormatter Class

**Methods**:

- ormat_report(analysis_type, results, inputs) -> str: Generate full markdown report
- _format_beam_report(results, inputs): Format beam analysis report
- _format_truss_report(results, inputs): Format truss analysis report
- _format_frame_report(results, inputs): Format frame analysis report
- _format_column_report(results, inputs): Format column analysis report
- _format_3d_report(results, inputs): Format 3D analysis report

**Report Sections**:

1. **Header**: Analysis type, timestamp, tool version
2. **Input Summary**: Structure geometry, material properties, loading
3. **Results**: Key results with units and significant figures
4. **Diagrams Reference**: References to generated diagrams
5. **Warnings**: Engineering warnings and assumptions
6. **Disclaimer**: Safety notice and scope limitations

## app/tools/sections.py - Steel Section Database

AISC W-shape section properties database.

### Section Class

**Properties**:

- 
ame: Section designation (e.g., "W10x33")
- depth_in: Overall depth
- lange_width_in: Flange width
- lange_thickness_in: Flange thickness
- web_thickness_in: Web thickness
- rea_in2: Cross-sectional area
- ix_in4: Moment of inertia about x-axis
- ix_in3: Section modulus about x-axis
- iy_in4: Moment of inertia about y-axis
- iy_in3: Section modulus about y-axis
- weight_lb_per_ft: Unit weight

### SectionDatabase Class

**Methods**:

- search(query: str) -> list[Section]: Search sections by name or properties
- get_by_name(name: str) -> Section: Get section by exact name
- list_all() -> list[Section]: Return all sections
- ilter_by_weight(min_wt, max_wt) -> list[Section]: Filter by weight range
- ilter_by_depth(min_depth, max_depth) -> list[Section]: Filter by depth range

**Database**:

Contains ~100+ AISC W-shape sections (W4 through W44) with properties from AISC Steel Construction Manual.