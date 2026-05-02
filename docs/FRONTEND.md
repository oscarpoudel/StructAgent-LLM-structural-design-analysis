# Frontend Documentation

## app/static/index.html - Application Shell

Single-page application entry point. Loads all CSS and JavaScript modules:

- **Libraries**: Three.js (r128), Plotly.js (2.35.0), KaTeX (0.16.9), marked (9.1.6), Font Awesome (6.5.1)
- **Styles**: css/styles.css (main), css/animations.css (transitions), css/print.css (print layout), css/dark-theme.css (dark mode), css/light-theme.css (light mode)
- **Scripts**: js/state.js, js/theme.js, js/canvas3d.js, js/canvas2d.js, js/modals.js, js/results.js, js/diagrams.js, js/app.js

### Layout Structure

- **Header** (#app-header): Logo, title, theme toggle, help/about buttons, 3D view toggle
- **Main content** (#main-content): Two-panel layout
  - **Left panel** (#left-panel): Chat interface with message history, input area, and send button
  - **Right panel** (#right-panel): 3D canvas, 2D canvas, results panel, and tabs for switching views
- **Modals**: Help modal, about modal, results modal, section search modal, history modal, export modal
- **Toast notifications**: #toast-container for success/error/info messages

## app/static/css/styles.css - Main Stylesheet

Complete design system with CSS custom properties for theming:

### Color Variables

- **Primary palette**: --primary-50 through --primary-900 (blue tones)
- **Secondary palette**: --secondary-50 through --secondary-900 (indigo tones)
- **Accent palette**: --accent-50 through --accent-900 (teal tones)
- **Status colors**: --success-*, --warning-*, --danger-*, --info-*
- **Neutral colors**: --neutral-50 through --neutral-950

### Layout

- **Header**: Fixed 64px height, flexbox layout with responsive breakpoints
- **Main content**: Flexbox two-panel layout, 50/50 split by default, resizable via CSS grid
- **Chat panel**: Scrollable message list, fixed input bar at bottom
- **Results panel**: Tabbed interface for 3D view, 2D canvas, and results data
- **Responsive**: Breakpoints at 1280px, 1024px, 768px, 480px

### Components

- **Message bubbles**: AI messages (left-aligned, gradient border), user messages (right-aligned, primary color)
- **Buttons**: Primary, secondary, ghost variants with hover/active states
- **Input fields**: Styled textareas with focus rings and character counters
- **Tabs**: Horizontal tab bar with active indicator
- **Cards**: Elevated cards with shadows and rounded corners
- **Badges**: Small status indicators for analysis type, warnings
- **Loading states**: Spinners, skeleton loaders, progress bars
- **Toast notifications**: Slide-in notifications with auto-dismiss

## app/static/css/animations.css - Animation Definitions

CSS keyframe animations for UI transitions:

- adeIn: Opacity transition for message appearance
- slideUp: Vertical slide for panel transitions
- slideInRight: Horizontal slide for toast notifications
- pulse: Pulsing animation for loading states
- ounce: Bounce effect for button interactions
- shake: Shake animation for error states
- loat: Subtle floating animation for decorative elements
- glow: Glow effect for active elements
- scaleIn: Scale transition for modal appearance
- progressBar: Animated progress bar fill

## app/static/css/dark-theme.css - Dark Mode Overrides

Dark theme CSS custom property overrides:

- Background: #1a1a2e (deep navy)
- Surface: #16213e (dark blue)
- Text: #e0e0e0 (light gray)
- Primary accent: #4fc3f7 (light blue)
- Border: #2d3748 (dark gray)

## app/static/css/light-theme.css - Light Mode Overrides

Light theme CSS custom property overrides:

- Background: #ffffff (white)
- Surface: #f7fafc (light gray)
- Text: #2d3748 (dark gray)
- Primary accent: #3182ce (blue)
- Border: #e2e8f0 (light gray)

## app/static/css/print.css - Print Styles

Print-specific styles for report export:

- Removes all interactive elements (buttons, inputs, chat interface)
- Forces light theme colors for print readability
- Shows only results panel content
- Adds page break controls for multi-page reports
- Hides canvas elements, shows only diagram images

## app/static/js/state.js - Application State Management

Central state store for the frontend application:

### State Object

`javascript
const AppState = {
  // Analysis state
  currentAnalysis: null,
  analysisHistory: [],
  selectedResults: null,
  
  // Canvas state
  canvas2D: { nodes: [], members: [], loads: [] },
  canvas3D: { nodes: [], members: [], loads: [] },
  
  // UI state
  activeTab: 'results',
  theme: 'dark',
  isDrawing: false,
  selectedNode: null,
  selectedMember: null,
  
  // Chat state
  conversationHistory: [],
  isTyping: false,
  
  // Modal state
  activeModal: null,
  modalData: null
};
`

### Methods

- setState(key, value): Update state with change notification
- getState(): Get current state snapshot
- esetState(): Clear all state to initial values
- subscribe(callback): Register listener for state changes
- exportState(): Serialize state for export/debugging

## app/static/js/theme.js - Theme Management

Handles theme switching between dark and light modes:

- initTheme(): Load saved theme preference from localStorage
- 	oggleTheme(): Switch between dark/light themes
- pplyTheme(theme): Apply CSS classes and update all components
- saveTheme(theme): Persist theme preference to localStorage

## app/static/js/canvas3d.js - Three.js 3D Canvas

3D structure visualization using Three.js:

### Scene Setup

- Perspective camera with orbit controls
- Grid helper and axis helper
- Ambient + directional lighting
- Antialiased WebGL renderer

### Drawing Functions

- drawNode(node): Creates sphere geometry at node position
- drawMember(member): Creates cylinder geometry between nodes
- drawLoad(load): Creates arrow helper for load vectors
- drawSupport(support): Creates cone/box geometry for support types
- drawResults(results): Renders deflected shape with color coding

### Interaction

- Orbit, zoom, pan via mouse controls
- Click selection for nodes/members
- Hover tooltips with element properties
- Grid snapping for node placement (configurable)

### Export

- exportScene(): Export current view as PNG
- exportGLTF(): Export scene as GLTF model

## app/static/js/canvas2d.js - 2D Drawing Canvas

HTML5 Canvas-based 2D structure drawing:

### Canvas Setup

- Responsive canvas with device pixel ratio scaling
- Grid overlay with configurable snap
- Ruler display along edges

### Drawing Tools

- drawNode(node): Circle with node ID label
- drawMember(member): Line with member properties tooltip
- drawLoad(load): Arrow with magnitude label
- drawSupport(support): Triangle (pin), circle (roller), box (fixed)
- drawSFD(shearData): Shear force diagram below structure
- drawBMD(momentData): Bending moment diagram below structure
- drawDeflection(deflData): Deflected shape overlay

### Interaction

- Click to add nodes with grid snap
- Shift+click to add members between nodes
- Right-click for context menu (delete, properties)
- Drag to move nodes
- Scroll to zoom, middle-click to pan

### Analysis Integration

- sendToAnalysis(): Package canvas state and POST to /api/analyze/structure
- enderResults(results): Draw SFD, BMD, and deflection from analysis response

## app/static/js/modals.js - Modal Management

Handles all modal dialogs:

### Modals

- **Help Modal**: Usage instructions, keyboard shortcuts, examples
- **About Modal**: Version info, safety disclaimer, license
- **Results Modal**: Full analysis results with export options
- **Section Search Modal**: Searchable steel section database
- **History Modal**: Analysis history with load/delete options
- **Export Modal**: CSV/Markdown report export options

### Methods

- openModal(type, data): Open specified modal with data
- closeModal(): Close active modal
- updateModal(type, data): Update modal content without closing

## app/static/js/results.js - Results Rendering

Formats and displays analysis results:

### Display Functions

- enderResultsPanel(results): Populate results panel with formatted data
- ormatValue(value, unit): Format numbers with proper units and significant figures
- enderWarnings(warnings): Display warning badges with severity colors
- enderAssumptions(assumptions): List analysis assumptions
- enderAgentTraces(traces): Show agent pipeline execution trace

### Export Functions

- exportCSV(results): Generate CSV from results data
- exportMarkdown(results): Generate markdown report
- copyToClipboard(text): Copy results to clipboard

## app/static/js/diagrams.js - Plotly Diagram Rendering

Creates interactive 2D diagrams using Plotly.js:

### Diagram Types

- createSFD(shearData): Shear force diagram with area fill
- createBMD(momentData): Bending moment diagram with area fill
- createDeflectionDiagram(deflData): Deflection curve with scale indicator
- createInteractionDiagram(results): P-M interaction diagram for columns
- createStressDiagram(results): Stress distribution visualization

### Configuration

- Plotly dark theme matching application theme
- Responsive sizing with auto-layout
- Hover tooltips with exact values
- Zoom and pan enabled
- Export to PNG built-in

## app/static/js/app.js - Main Application Controller

Central controller that wires all components together:

### Initialization

- init(): Boot sequence - load theme, init canvases, setup event listeners
- setupEventListeners(): Register all DOM event handlers
- loadSavedState(): Restore session from localStorage

### API Communication

- sendChatMessage(message): POST to /api/chat, handle response
- sendAnalysisRequest(prompt): POST to /api/analyze, handle response
- sendCanvasAnalysis(canvasData): POST to /api/analyze/structure
- etchSections(query): GET from /api/sections
- etchHistory(): GET from /api/history
- exportResults(format): POST to /api/export/csv or /api/export/report

### Message Handling

- displayUserMessage(message): Add user message to chat
- displayAIMessage(response): Parse and display AI response with formatting
- handleCanvasAction(action): Execute canvas tool action from AI
- handleAnalysisResults(results): Route results to appropriate display

### Error Handling

- showError(message): Display error toast
- showSuccess(message): Display success toast
- handleAPIError(error): Parse and display API error response
- etryRequest(request): Retry failed API calls with exponential backoff