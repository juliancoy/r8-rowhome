import type { RowhomeModel } from "../core/types";
import { buildBom, totalEstimatedCost } from "../export/bom";
import type { RowhomeConfig, ViewOptions } from "../core/types";
import { estimateFacadeMaterialCost, facadeMaterialOptions } from "../core/facadeMaterials";
import { facadeStyleOptions, selectedFacadeStyle } from "../core/facadeStyles";
import { sourceDocuments, type SourceDocumentEntry } from "../generated/documentIndex";
import { viewLayerOptions } from "../viewer/layers";

export type PanelTab = "options" | "view" | "bom" | "components" | "systems" | "documents" | "validation";

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

interface DocumentTreeNode {
  name: string;
  path: string;
  children: Map<string, DocumentTreeNode>;
  document?: SourceDocumentEntry;
}

function currency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
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
        <button class="tab-button ${activeClass("documents", activeTab)}" data-panel-tab="documents" type="button" role="tab" aria-selected="${activeTab === "documents"}">Docs</button>
        <button class="tab-button ${activeClass("validation", activeTab)}" data-panel-tab="validation" type="button" role="tab" aria-selected="${activeTab === "validation"}">Checks</button>
      </div>

      <section class="tab-panel ${activeClass("options", activeTab)}" data-tab-panel="options" role="tabpanel">
        <h2>Implementation Options</h2>
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
        <div class="data-row">
          <strong>${stairImplementationOptions.find((option) => option.id === config.stairImplementation)?.label ?? "Alternating run"}</strong>
          <span>${stairImplementationOptions.find((option) => option.id === config.stairImplementation)?.notes ?? stairImplementationOptions[0].notes}</span>
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
        <div class="data-row">
          <strong>Camera drag</strong>
          <span>Left-click drag rotates the camera in place. WASD moves relative to the current camera orientation. E and Q move absolute up and down.</span>
        </div>
      </section>

      <section class="tab-panel ${activeClass("bom", activeTab)}" data-tab-panel="bom" role="tabpanel">
        <h2>Bill of Materials</h2>
        ${bom.map((line) => `
          <div class="data-row">
            <strong>${line.material}</strong>
            <span>${line.category} · ${line.components} components · ${currency(line.estimatedCostUsd)}</span>
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
              <span>${component.metadata.category} · ${component.metadata.material}</span>
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
