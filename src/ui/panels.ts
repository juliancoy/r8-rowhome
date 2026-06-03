import type { RowhomeModel } from "../core/types";
import { buildBom, totalEstimatedCost } from "../export/bom";
import type { RowhomeConfig, ViewOptions } from "../core/types";
import { estimateFacadeMaterialCost, facadeMaterialOptions } from "../core/facadeMaterials";
import { facadeStyleOptions, selectedFacadeStyle } from "../core/facadeStyles";
import { sourceDocuments, type SourceDocumentEntry } from "../generated/documentIndex";
import { viewLayerOptions } from "../viewer/layers";

export type PanelTab = "options" | "view" | "bom" | "components" | "systems" | "structure" | "documents" | "validation";

const stairImplementationOptions = [
  {
    id: "alternating-run",
    label: "Alternating run",
    notes: "Straight stair flights reverse direction floor by floor for a compact rowhouse stair hall."
  },
  {
    id: "spiral",
    label: "Spiral",
    notes: "Compact spiral stair option for schematic comparison and STL export."
  }
] as const;

const structuralSupportOptions = [
  {
    id: "masonry-bearing",
    label: "Masonry bearing",
    notes: "Current bearing-wall and wood-diaphragm layout."
  },
  {
    id: "steel-post-beam",
    label: "Steel post and beam",
    notes: "Adds schematic interior steel columns, beams, and girders for support-layout comparison."
  }
] as const;

const brickDetailModeOptions = [
  {
    id: "solid-textured",
    label: "Solid textured walls",
    notes: "Default: solid wall geometry with brick-module-scaled textures and a computed brick takeoff."
  },
  {
    id: "individual-bricks",
    label: "Individual instanced bricks",
    notes: "Optional inspection mode: generates instanced standard bricks around openings for visual verification."
  }
] as const;

const rowhomeCountOptions = [1, 2, 3, 4, 5, 6] as const;

interface DocumentTreeNode {
  name: string;
  path: string;
  children: Map<string, DocumentTreeNode>;
  document?: SourceDocumentEntry;
}

function currency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

function kips(value: number): string {
  return `${value.toFixed(1)} kips`;
}

function psf(value: number): string {
  return `${value.toFixed(1)} psf`;
}

function standardBrickTakeoff(model: RowhomeModel) {
  const brickComponents = model.components.filter((component) =>
    component.metadata.quantity?.kind === "standard-brick" && component.metadata.id !== "brick-takeoff-summary"
  );
  const summary = model.components.find((component) => component.metadata.id === "brick-takeoff-summary");
  const componentTotal = brickComponents.reduce((sum, component) => sum + (component.metadata.quantity?.count ?? 0), 0);
  const total = summary?.metadata.quantity?.count ?? componentTotal;
  return { brickComponents, total };
}

function activeClass(tab: PanelTab, activeTab: PanelTab): string {
  return tab === activeTab ? "is-active" : "";
}

function fileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${bytes} B`;
}

function buildDocumentTree(documents: SourceDocumentEntry[]): DocumentTreeNode {
  const root: DocumentTreeNode = { name: "sources", path: "", children: new Map() };
  for (const document of documents) {
    const parts = document.path.split("/");
    let current = root;
    for (const [index, part] of parts.entries()) {
      const path = parts.slice(0, index + 1).join("/");
      let child = current.children.get(part);
      if (!child) {
        child = { name: part, path, children: new Map() };
        current.children.set(part, child);
      }
      current = child;
    }
    current.document = document;
  }
  return root;
}

function renderDocumentTree(node: DocumentTreeNode): string {
  const children = [...node.children.values()].sort((a, b) => {
    if (a.document && !b.document) return 1;
    if (!a.document && b.document) return -1;
    return a.name.localeCompare(b.name);
  });

  if (node.document) {
    const href = `/sources/${node.document.path}`;
    return `
      <li class="document-file">
        <a href="${href}" target="_blank" rel="noreferrer">${node.name}</a>
        <span>${fileSize(node.document.sizeBytes)}</span>
      </li>
    `;
  }

  return `
    <li class="document-folder">
      <details ${node.path === "" ? "open" : ""}>
        <summary>${node.name}</summary>
        <ul>
          ${children.map(renderDocumentTree).join("")}
        </ul>
      </details>
    </li>
  `;
}

export function renderPanels(model: RowhomeModel, root: HTMLElement, config: RowhomeConfig, activeTab: PanelTab, viewOptions: ViewOptions): void {
  const bom = buildBom(model);
  const selectedStyle = selectedFacadeStyle(config.facadeStyleId);
  const documentTree = buildDocumentTree(sourceDocuments);
  const brickTakeoff = standardBrickTakeoff(model);
  root.innerHTML = `
    <section class="panel-section">
      <h2>Model</h2>
      <div class="summary">
        <strong>${model.name}</strong>
        <span>${model.components.length} components</span>
        <span>${currency(totalEstimatedCost(model))} rough estimate</span>
      </div>
    </section>

    <section class="panel-tabs" aria-label="Model panels">
      <div class="tab-list" role="tablist">
        <button class="tab-button ${activeClass("options", activeTab)}" data-panel-tab="options" type="button" role="tab" aria-selected="${activeTab === "options"}">Options</button>
        <button class="tab-button ${activeClass("view", activeTab)}" data-panel-tab="view" type="button" role="tab" aria-selected="${activeTab === "view"}">View</button>
        <button class="tab-button ${activeClass("bom", activeTab)}" data-panel-tab="bom" type="button" role="tab" aria-selected="${activeTab === "bom"}">Bill</button>
        <button class="tab-button ${activeClass("components", activeTab)}" data-panel-tab="components" type="button" role="tab" aria-selected="${activeTab === "components"}">Parts</button>
        <button class="tab-button ${activeClass("systems", activeTab)}" data-panel-tab="systems" type="button" role="tab" aria-selected="${activeTab === "systems"}">Systems</button>
        <button class="tab-button ${activeClass("structure", activeTab)}" data-panel-tab="structure" type="button" role="tab" aria-selected="${activeTab === "structure"}">Loads</button>
        <button class="tab-button ${activeClass("documents", activeTab)}" data-panel-tab="documents" type="button" role="tab" aria-selected="${activeTab === "documents"}">Docs</button>
        <button class="tab-button ${activeClass("validation", activeTab)}" data-panel-tab="validation" type="button" role="tab" aria-selected="${activeTab === "validation"}">Checks</button>
      </div>

      <section class="tab-panel ${activeClass("options", activeTab)}" data-tab-panel="options" role="tabpanel">
        <h2>Implementation Options</h2>
        <label class="field">
          <span>Homes in row</span>
          <select id="rowhome-count-select">
            ${rowhomeCountOptions.map((count) => `
              <option value="${count}" ${count === config.rowhomeCount ? "selected" : ""}>
                ${count}
              </option>
            `).join("")}
          </select>
        </label>
        <label class="field">
          <span>Facade type</span>
          <select id="facade-material-select">
            ${facadeMaterialOptions.map((option) => `
              <option value="${option.id}" ${option.id === config.facadeMaterialId ? "selected" : ""}>
                ${option.label}
              </option>
            `).join("")}
          </select>
        </label>
        <label class="field">
          <span>Facade form</span>
          <select id="facade-style-select">
            ${facadeStyleOptions.map((option) => `
              <option value="${option.id}" ${option.id === config.facadeStyleId ? "selected" : ""}>
                ${option.label}
              </option>
            `).join("")}
          </select>
        </label>
        <label class="field">
          <span>Stair implementation</span>
          <select id="stair-implementation-select">
            ${stairImplementationOptions.map((option) => `
              <option value="${option.id}" ${option.id === config.stairImplementation ? "selected" : ""}>
                ${option.label}
              </option>
            `).join("")}
          </select>
        </label>
        <label class="field">
          <span>Structural support</span>
          <select id="structural-support-select">
            ${structuralSupportOptions.map((option) => `
              <option value="${option.id}" ${option.id === config.structuralSupportScheme ? "selected" : ""}>
                ${option.label}
              </option>
            `).join("")}
          </select>
        </label>
        <label class="field">
          <span>Brick detail</span>
          <select id="brick-detail-mode-select">
            ${brickDetailModeOptions.map((option) => `
              <option value="${option.id}" ${option.id === config.brickDetailMode ? "selected" : ""}>
                ${option.label}
              </option>
            `).join("")}
          </select>
        </label>
        <div class="data-row">
          <strong>${config.rowhomeCount} ${config.rowhomeCount === 1 ? "rowhome" : "rowhomes"}</strong>
          <span>${config.rowhomeCount === 1 ? "Single dwelling with left and right party-wall cores." : `${config.rowhomeCount + 1} party-wall cores total; adjacent rowhomes share one wall at each common boundary instead of duplicating side walls.`}</span>
        </div>
        <div class="data-row">
          <strong>${stairImplementationOptions.find((option) => option.id === config.stairImplementation)?.label ?? "Alternating run"}</strong>
          <span>${stairImplementationOptions.find((option) => option.id === config.stairImplementation)?.notes ?? stairImplementationOptions[0].notes}</span>
        </div>
        <div class="data-row">
          <strong>${structuralSupportOptions.find((option) => option.id === config.structuralSupportScheme)?.label ?? structuralSupportOptions[0].label}</strong>
          <span>${structuralSupportOptions.find((option) => option.id === config.structuralSupportScheme)?.notes ?? structuralSupportOptions[0].notes}</span>
        </div>
        <div class="data-row">
          <strong>${brickDetailModeOptions.find((option) => option.id === config.brickDetailMode)?.label ?? brickDetailModeOptions[0].label}</strong>
          <span>${brickDetailModeOptions.find((option) => option.id === config.brickDetailMode)?.notes ?? brickDetailModeOptions[0].notes}</span>
        </div>
        <div class="data-row">
          <strong>${selectedStyle.label}</strong>
          <span>${selectedStyle.notes}</span>
        </div>
        <div class="option-costs">
          ${facadeMaterialOptions.map((option) => `
            <div class="cost-row ${option.id === config.facadeMaterialId ? "selected" : ""}">
              <strong>${option.label}</strong>
              <span>${currency(estimateFacadeMaterialCost(config, option, selectedStyle))} · ${currency(option.unitCostUsdPerSf)}/sf · ${selectedStyle.label}</span>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="tab-panel ${activeClass("view", activeTab)}" data-tab-panel="view" role="tabpanel">
        <h2>View Options</h2>
        <label class="field">
          <span>Drag rotate left/right</span>
          <select id="invert-drag-horizontal">
            <option value="normal" ${viewOptions.invertDragHorizontal ? "" : "selected"}>Normal</option>
            <option value="inverted" ${viewOptions.invertDragHorizontal ? "selected" : ""}>Inverted</option>
          </select>
        </label>
        <label class="field">
          <span>Drag rotate up/down</span>
          <select id="invert-drag-vertical">
            <option value="normal" ${viewOptions.invertDragVertical ? "" : "selected"}>Normal</option>
            <option value="inverted" ${viewOptions.invertDragVertical ? "selected" : ""}>Inverted</option>
          </select>
        </label>
        <label class="field">
          <span>Drag sensitivity</span>
          <select id="drag-sensitivity">
            <option value="0.0018" ${viewOptions.dragSensitivity === 0.0018 ? "selected" : ""}>Low</option>
            <option value="0.003" ${viewOptions.dragSensitivity === 0.003 ? "selected" : ""}>Normal</option>
            <option value="0.005" ${viewOptions.dragSensitivity === 0.005 ? "selected" : ""}>High</option>
          </select>
        </label>
        <label class="field">
          <span>Ambient light</span>
          <input id="ambient-light-intensity" type="range" min="0.2" max="3" step="0.05" value="${viewOptions.ambientLightIntensity}">
          <small>${viewOptions.ambientLightIntensity.toFixed(2)}x sky and ground fill</small>
        </label>
        <label class="field">
          <span>Room lights</span>
          <input id="room-light-intensity" type="range" min="0" max="4" step="0.05" value="${viewOptions.roomLightIntensity}">
          <small>${viewOptions.roomLightIntensity.toFixed(2)}x overhead and lamp intensity</small>
        </label>
        <label class="field">
          <span>Visual detail</span>
          <select id="render-detail">
            <option value="fast" ${viewOptions.renderDetail === "fast" ? "selected" : ""}>Fast schematic</option>
            <option value="balanced" ${viewOptions.renderDetail === "balanced" ? "selected" : ""}>Product models</option>
            <option value="detailed" ${viewOptions.renderDetail === "detailed" ? "selected" : ""}>Full brick detail</option>
          </select>
          <small>Fast keeps counts but hides brick instances and skips GLB products. Full brick detail is for inspection/takeoff views.</small>
        </label>
        <button class="show-all-row" id="reset-saved-options" type="button">Reset saved options</button>
        <div class="data-row">
          <strong>Camera drag</strong>
          <span>Left-click drag rotates the camera in place. WASD moves relative to the current camera orientation. E and Q move absolute up and down.</span>
        </div>
      </section>

      <section class="tab-panel ${activeClass("bom", activeTab)}" data-tab-panel="bom" role="tabpanel">
        <h2>Bill of Materials</h2>
        ${brickTakeoff.total > 0 ? `
          <div class="data-row">
            <strong>Standard modular bricks</strong>
            <span>${brickTakeoff.total.toLocaleString()} each · ${brickTakeoff.brickComponents.length} instanced wall segments · 7 5/8 in x 3 5/8 in x 2 1/4 in actual brick</span>
            <small>Count is generated from placed brick instances, with front/rear veneer and two-wythe party wall brickwork. Add waste/cuts/returns during final takeoff.</small>
          </div>
        ` : ""}
        ${bom.map((line) => `
          <div class="data-row">
            <strong>${line.material}</strong>
            <span>${line.category} · ${line.components} components${line.quantity ? ` · ${line.quantity.count.toLocaleString()} ${line.quantity.unit}` : ""} · ${currency(line.estimatedCostUsd)}</span>
          </div>
        `).join("")}
      </section>

      <section class="tab-panel ${activeClass("components", activeTab)}" data-tab-panel="components" role="tabpanel">
        <h2>Parts</h2>
        <button class="show-all-row" data-show-all-components type="button">Show full model</button>
        ${model.components.map((component) => `
          <article class="component-card" data-component-id="${component.metadata.id}" tabindex="0" role="button" aria-label="Show ${component.metadata.name} in isolation">
            <div>
              <strong>${component.metadata.name}</strong>
              <span>${component.metadata.category} · ${component.metadata.material}${component.metadata.quantity ? ` · ${component.metadata.quantity.count.toLocaleString()} ${component.metadata.quantity.unit}` : ""}</span>
            </div>
            <button class="download-stl" data-download-stl="${component.metadata.id}" type="button" ${component.metadata.printable ? "" : "disabled"}>
              STL
            </button>
          </article>
        `).join("")}
      </section>

      <section class="tab-panel ${activeClass("systems", activeTab)}" data-tab-panel="systems" role="tabpanel">
        <h2>Layer Views</h2>
        <div class="layer-grid">
          ${viewLayerOptions.map((layer) => `
            <button class="layer-button" data-view-mode="${layer.id}" type="button">
              <strong>${layer.label}</strong>
              <span>${layer.notes}</span>
            </button>
          `).join("")}
        </div>
        <div class="data-row">
          <strong>Material and system layers</strong>
          <span>Layer filters use component category, material, name, and source-traced notes, so wall assemblies, structure, services, fireproofing, insulation, and site work can be inspected separately.</span>
        </div>
      </section>

      <section class="tab-panel ${activeClass("structure", activeTab)}" data-tab-panel="structure" role="tabpanel">
        <h2>Structural Gravity Model</h2>
        ${model.structural ? `
          <div class="data-row warning">
            <strong>${model.structural.status}</strong>
            <span>Conceptual gravity-load takeoff only. No stiffness matrix, member capacity, foundation bearing, or load combinations are solved yet.</span>
          </div>
          <div class="data-row">
            <strong>Total gravity load</strong>
            <span>${kips(model.structural.gravityReport.totalGravityLoadKips)} · ${kips(model.structural.gravityReport.totalDeadLoadKips)} dead · ${kips(model.structural.gravityReport.totalLiveLoadKips)} live · ${kips(model.structural.gravityReport.steelSupportDeadLoadKips)} steel allowance</span>
          </div>
          <div class="data-row">
            <strong>Modeled areas</strong>
            <span>${model.structural.gravityReport.floorAreaSqFt.toLocaleString()} sf floor diaphragm · ${model.structural.gravityReport.roofAreaSqFt.toLocaleString()} sf roof · ${kips(model.structural.gravityReport.wallDeadLoadKips)} wall dead load</span>
          </div>
          <div class="data-row">
            <strong>Structural graph</strong>
            <span>${model.structural.nodes.length} nodes · ${model.structural.members.length} members · ${model.structural.supports.length} fixed schematic supports · ${model.structural.areaLoads.length} area loads · ${model.structural.loadCombinations.length} load combinations · ${model.structural.designChecks.length} required checks</span>
          </div>
          <div class="data-row warning">
            <strong>Solver readiness</strong>
            <span>${model.structural.solverStatus.readyForSolver ? "Ready for solver export" : model.structural.solverStatus.requiredNextStep}</span>
            <small>Missing: ${model.structural.solverStatus.missingInputs.join("; ")}</small>
          </div>
          <div class="data-row">
            <strong>Browser heat map</strong>
            <span>Use the Gravity Demand toolbar button or the Gravity demand layer view. Blue indicates the lower end of this model's conceptual gravity-demand range and red indicates the upper end.</span>
          </div>
          ${model.structural.loadCombinations.map((combination) => `
            <div class="data-row ${combination.status === "computed-gravity-only" ? "" : "warning"}">
              <strong>${combination.name}</strong>
              <span>${combination.expression} · ${combination.totalKips > 0 ? kips(combination.totalKips) : "not computed"} · ${combination.status}</span>
              <small>${combination.notes.join(" ")}</small>
            </div>
          `).join("")}
          ${model.structural.designChecks.map((check) => `
            <div class="data-row warning">
              <strong>${check.label}</strong>
              <span>${check.category} · ${check.status} · ${check.targetIds.length} targets</span>
              <small>${check.requirement} Missing: ${check.missingInputs.join("; ")}.</small>
            </div>
          `).join("")}
          ${model.structural.demandSurfaces.map((surface) => `
            <div class="data-row">
              <strong>${surface.label}</strong>
              <span>${kips(surface.demandKips)} · ${surface.areaSqFt.toLocaleString()} sf · ${psf(surface.demandPsf)} · ${(surface.intensity * 100).toFixed(0)}% relative color intensity</span>
              <small>${surface.note}</small>
            </div>
          `).join("")}
          ${model.structural.assumptions.map((assumption) => `
            <div class="data-row">
              <strong>Assumption</strong>
              <span>${assumption}</span>
            </div>
          `).join("")}
          ${model.structural.warnings.map((warning) => `
            <div class="data-row warning">
              <strong>Structural warning</strong>
              <span>${warning}</span>
            </div>
          `).join("")}
        ` : `
          <div class="data-row error">
            <strong>No structural model</strong>
            <span>The rowhome model has no structural load schema attached.</span>
          </div>
        `}
      </section>

      <section class="tab-panel ${activeClass("documents", activeTab)}" data-tab-panel="documents" role="tabpanel">
        <h2>Documents</h2>
        <div class="data-row">
          <strong>Source Library</strong>
          <span>${sourceDocuments.length} local documents indexed from the filesystem under sources/.</span>
        </div>
        <ul class="document-tree">
          ${renderDocumentTree(documentTree)}
        </ul>
      </section>

      <section class="tab-panel ${activeClass("validation", activeTab)}" data-tab-panel="validation" role="tabpanel">
        <h2>Validation</h2>
        ${model.validation.map((message) => `
          <div class="data-row ${message.severity}">
            <strong>${message.severity}: ${message.code}</strong>
            <span>${message.message}</span>
            <small>${message.source}</small>
          </div>
        `).join("")}
      </section>
    </section>
  `;
}
