import type { RowhomeModel } from "../core/types";
import { buildBom, totalEstimatedCost } from "../export/bom";
import type { RowhomeConfig, ViewOptions } from "../core/types";
import { estimateFacadeMaterialCost, facadeMaterialOptions } from "../core/facadeMaterials";
import { facadeStyleOptions, selectedFacadeStyle } from "../core/facadeStyles";
import { constructionSystemOptions, selectedConstructionSystem } from "../core/constructionSystems";
import { buildInvestorDashboard, type InvestorDashboardReport } from "../reports/investorDashboard";
import { sourceDocuments, type SourceDocumentEntry } from "../generated/documentIndex";
import { viewLayerOptions } from "../viewer/layers";

export type PanelTab = "options" | "view" | "bom" | "components" | "systems" | "structure" | "invest" | "documents" | "validation";

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

const pieColors = ["#5b9bd5", "#ed7d31", "#70ad47", "#ffc000", "#9e6cc3", "#4bbfbf", "#d65a5a", "#8a8f3c", "#c47ba0", "#6f7d8c", "#b08d57", "#4f6d44"];

// The dashboard generates its own normalized per-home model, which is expensive;
// cache it per config so panel re-renders (light sliders, tab switches) reuse it.
let cachedDashboard: { key: string; report: InvestorDashboardReport } | null = null;

function investorDashboardForConfig(config: RowhomeConfig): InvestorDashboardReport {
  const key = JSON.stringify({ ...config, rowhomeCount: 1, urbanScale: "single" });
  if (cachedDashboard?.key !== key) {
    cachedDashboard = { key, report: buildInvestorDashboard(config) };
  }
  return cachedDashboard.report;
}

function compactUsd(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(value >= 1e13 ? 0 : 1)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${Math.round(value / 1e3)}k`;
  return `$${Math.round(value)}`;
}

function pieSlicePath(cx: number, cy: number, r: number, startFraction: number, endFraction: number): string {
  const startAngle = startFraction * 2 * Math.PI - Math.PI / 2;
  const endAngle = endFraction * 2 * Math.PI - Math.PI / 2;
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const largeArc = endFraction - startFraction > 0.5 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

function pieChartSvg(title: string, slices: Array<{ label: string; value: number }>): string {
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  if (total <= 0) {
    return "";
  }
  let cursor = 0;
  const paths = slices.map((slice, index) => {
    const fraction = Math.max(0, slice.value) / total;
    const path = fraction >= 0.999
      ? `<circle cx="70" cy="70" r="62" fill="${pieColors[index % pieColors.length]}" />`
      : `<path d="${pieSlicePath(70, 70, 62, cursor, cursor + fraction)}" fill="${pieColors[index % pieColors.length]}" />`;
    cursor += fraction;
    return path;
  });
  const legend = slices.map((slice, index) => `
    <div class="invest-legend-row">
      <span class="invest-swatch" style="background:${pieColors[index % pieColors.length]}"></span>
      <span>${slice.label}</span>
      <strong>${compactUsd(slice.value)} (${Math.round((slice.value / total) * 100)}%)</strong>
    </div>
  `).join("");
  return `
    <div class="invest-chart">
      <h3>${title}</h3>
      <div class="invest-chart-body">
        <svg viewBox="0 0 140 140" class="invest-pie" role="img" aria-label="${title}">${paths.join("")}</svg>
        <div class="invest-legend">${legend}</div>
      </div>
    </div>
  `;
}

function marketCirclesSvg(report: InvestorDashboardReport): string {
  const radii = report.marketCircles.map((circle) => 6 * Math.log10(Math.max(10, circle.valueUsd)) - 4);
  const maxRadius = Math.max(...radii);
  let x = 0;
  const centers = radii.map((radius) => {
    const cx = x + radius;
    x += radius * 2 + 26;
    return cx;
  });
  const width = x - 26;
  const height = maxRadius * 2 + 56;
  const circleColors = ["#3f6ea6", "#5b9bd5", "#ffc000"];
  const figures = report.marketCircles.map((circle, index) => `
    <circle cx="${centers[index].toFixed(1)}" cy="${maxRadius.toFixed(1)}" r="${radii[index].toFixed(1)}" fill="${circleColors[index]}" fill-opacity="0.85" />
    <text x="${centers[index].toFixed(1)}" y="${(maxRadius * 2 + 18).toFixed(1)}" text-anchor="middle" class="invest-circle-value">${compactUsd(circle.valueUsd)}</text>
    <text x="${centers[index].toFixed(1)}" y="${(maxRadius * 2 + 34).toFixed(1)}" text-anchor="middle" class="invest-circle-label">${index === 0 ? "World real estate" : index === 1 ? "US residential" : "This block (32 homes)"}</text>
  `).join("");
  return `
    <div class="invest-chart">
      <h3>Market: world → US → this block</h3>
      <svg viewBox="0 0 ${width.toFixed(0)} ${height.toFixed(0)}" class="invest-circles" role="img" aria-label="Market size circles">${figures}</svg>
      <small>Circle radii are log-scaled; values are public estimates plus the model-derived block assessment. Verify before investor use.</small>
    </div>
  `;
}

function renderInvestPanel(report: InvestorDashboardReport): string {
  const perHome = report.perHome;
  const profitSlices = [
    { label: "Materials", value: perHome.materialCostUsd },
    { label: "Labor", value: perHome.laborCostUsd },
    { label: "Soft costs", value: perHome.softCostUsd },
    { label: "Land", value: perHome.landCostUsd },
    { label: "Contingency", value: perHome.contingencyUsd },
    { label: "Projected profit", value: Math.max(0, perHome.projectedProfitUsd) }
  ];
  return `
    <div id="investor-dashboard">
      <div class="data-row">
        <strong>${report.constructionSystem.label}</strong>
        <span>Per home: ${compactUsd(perHome.totalDevelopmentCostUsd)} development cost vs ${compactUsd(perHome.salePriceAssumptionUsd)} sale assumption (${perHome.salePricePerSf}/sf x ${perHome.finishedFloorAreaSf} sf) = ${compactUsd(perHome.projectedProfitUsd)} projected profit (${perHome.projectedMarginPct}% margin).</span>
      </div>
      ${marketCirclesSvg(report)}
      ${pieChartSvg("Where the money you can make goes (per home)", profitSlices)}
      ${pieChartSvg("Labor by crew (per home)", report.laborByRole.map((slice) => ({ label: slice.title, value: slice.laborCostUsd })))}
      ${pieChartSvg("Material cost by category (per home)", report.costByCategory.map((slice) => ({ label: slice.category, value: slice.costUsd })))}
      <div class="data-row">
        <strong>Block parcel (32 homes)</strong>
        <span>${compactUsd(report.block.parcelValueUsd)} assessed; ${compactUsd(report.block.projectedProfitUsd)} projected profit over ${compactUsd(report.block.developmentCostUsd)} development cost.</span>
      </div>
      <div class="data-row">
        <strong>District parcel (128 homes)</strong>
        <span>${compactUsd(report.district.parcelValueUsd)} assessed; ${compactUsd(report.district.projectedProfitUsd)} projected profit. Select the urban scale in Options to see the block instanced in 3D.</span>
      </div>
      <div class="data-row">
        <strong>Green block program</strong>
        <span>Solar on every roof; ${report.greenProgram.roofGardens} ${report.greenProgram.composters} ${report.greenProgram.blockchainParcelRegistry}</span>
      </div>
      <div class="data-row warning">
        <strong>Disclaimer</strong>
        <span>${report.disclaimer}</span>
      </div>
    </div>
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
        <button class="tab-button ${activeClass("options", activeTab)}" data-panel-tab="options" id="tab-options" aria-controls="tabpanel-options" type="button" role="tab" aria-selected="${activeTab === "options"}">Options</button>
        <button class="tab-button ${activeClass("view", activeTab)}" data-panel-tab="view" id="tab-view" aria-controls="tabpanel-view" type="button" role="tab" aria-selected="${activeTab === "view"}">View</button>
        <button class="tab-button ${activeClass("bom", activeTab)}" data-panel-tab="bom" id="tab-bom" aria-controls="tabpanel-bom" type="button" role="tab" aria-selected="${activeTab === "bom"}">Bill</button>
        <button class="tab-button ${activeClass("components", activeTab)}" data-panel-tab="components" id="tab-components" aria-controls="tabpanel-components" type="button" role="tab" aria-selected="${activeTab === "components"}">Parts</button>
        <button class="tab-button ${activeClass("systems", activeTab)}" data-panel-tab="systems" id="tab-systems" aria-controls="tabpanel-systems" type="button" role="tab" aria-selected="${activeTab === "systems"}">Systems</button>
        <button class="tab-button ${activeClass("structure", activeTab)}" data-panel-tab="structure" id="tab-structure" aria-controls="tabpanel-structure" type="button" role="tab" aria-selected="${activeTab === "structure"}">Loads</button>
        <button class="tab-button ${activeClass("invest", activeTab)}" data-panel-tab="invest" id="tab-invest" aria-controls="tabpanel-invest" type="button" role="tab" aria-selected="${activeTab === "invest"}">Invest</button>
        <button class="tab-button ${activeClass("documents", activeTab)}" data-panel-tab="documents" id="tab-documents" aria-controls="tabpanel-documents" type="button" role="tab" aria-selected="${activeTab === "documents"}">Docs</button>
        <button class="tab-button ${activeClass("validation", activeTab)}" data-panel-tab="validation" id="tab-validation" aria-controls="tabpanel-validation" type="button" role="tab" aria-selected="${activeTab === "validation"}">Checks</button>
      </div>

      <section class="tab-panel ${activeClass("options", activeTab)}" data-tab-panel="options" id="tabpanel-options" aria-labelledby="tab-options" role="tabpanel">
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
          <span>Urban scale</span>
          <select id="urban-scale-select">
            <option value="single" ${config.urbanScale === "single" ? "selected" : ""}>Single rowhome / row</option>
            <option value="block-32" ${config.urbanScale === "block-32" ? "selected" : ""}>City block (32 homes)</option>
            <option value="district-128" ${config.urbanScale === "district-128" ? "selected" : ""}>District (4 blocks, 128 homes)</option>
          </select>
        </label>
        <label class="field">
          <span>Construction system</span>
          <select id="construction-system-select">
            ${constructionSystemOptions.map((option) => `
              <option value="${option.id}" ${option.id === config.constructionSystem ? "selected" : ""}>
                ${option.label}
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
          <strong>${selectedConstructionSystem(config).label}</strong>
          <span>${selectedConstructionSystem(config).notes}</span>
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

      <section class="tab-panel ${activeClass("view", activeTab)}" data-tab-panel="view" id="tabpanel-view" aria-labelledby="tab-view" role="tabpanel">
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

      <section class="tab-panel ${activeClass("bom", activeTab)}" data-tab-panel="bom" id="tabpanel-bom" aria-labelledby="tab-bom" role="tabpanel">
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

      <section class="tab-panel ${activeClass("components", activeTab)}" data-tab-panel="components" id="tabpanel-components" aria-labelledby="tab-components" role="tabpanel">
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

      <section class="tab-panel ${activeClass("systems", activeTab)}" data-tab-panel="systems" id="tabpanel-systems" aria-labelledby="tab-systems" role="tabpanel">
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

      <section class="tab-panel ${activeClass("structure", activeTab)}" data-tab-panel="structure" id="tabpanel-structure" aria-labelledby="tab-structure" role="tabpanel">
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

      <section class="tab-panel ${activeClass("invest", activeTab)}" data-tab-panel="invest" id="tabpanel-invest" aria-labelledby="tab-invest" role="tabpanel">
        <h2>Investor Dashboard</h2>
        ${renderInvestPanel(investorDashboardForConfig(config))}
      </section>

      <section class="tab-panel ${activeClass("documents", activeTab)}" data-tab-panel="documents" id="tabpanel-documents" aria-labelledby="tab-documents" role="tabpanel">
        <h2>Documents</h2>
        <div class="data-row">
          <strong>Source Library</strong>
          <span>${sourceDocuments.length} local documents indexed from the filesystem under sources/.</span>
        </div>
        <ul class="document-tree">
          ${renderDocumentTree(documentTree)}
        </ul>
      </section>

      <section class="tab-panel ${activeClass("validation", activeTab)}" data-tab-panel="validation" id="tabpanel-validation" aria-labelledby="tab-validation" role="tabpanel">
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
