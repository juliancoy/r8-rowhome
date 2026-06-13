import { Box3, Group, Object3D, Vector3 } from "three";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { ModelComponent } from "../core/types";
import { componentMatchesViewMode, type ViewMode } from "./layers";

const loadedProductModels = new Map<string, Object3D>();
const loadingProductModels = new Map<string, Promise<Object3D>>();
const dracoLoader = new DRACOLoader();
const appBaseUrl = import.meta.env.BASE_URL || "/";
const normalizedAppBaseUrl = appBaseUrl.endsWith("/") ? appBaseUrl : `${appBaseUrl}/`;

function runtimeAssetUrl(url: string): string {
  if (/^(https?:|data:|blob:)/.test(url)) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${normalizedAppBaseUrl}${url.slice(1)}`;
  }
  return url;
}

dracoLoader.setDecoderPath(runtimeAssetUrl("/draco/"));
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

type ProductLoadSpec = {
  cacheKey: string;
  url: string;
};

function cloneLoadedModel(model: Object3D): Object3D {
  const clone = model.clone(true);
  clone.traverse((child) => {
    child.castShadow = true;
    child.receiveShadow = true;
  });
  return clone;
}

function loadProductModel(spec: ProductLoadSpec): Promise<Object3D> {
  const cached = loadedProductModels.get(spec.cacheKey);
  if (cached) {
    return Promise.resolve(cloneLoadedModel(cached));
  }

  const loading = loadingProductModels.get(spec.cacheKey) ?? new Promise<Object3D>((resolve, reject) => {
    gltfLoader.load(
      spec.url,
      (gltf) => {
        loadedProductModels.set(spec.cacheKey, gltf.scene);
        resolve(cloneLoadedModel(gltf.scene));
      },
      undefined,
      reject
    );
  });
  loadingProductModels.set(spec.cacheKey, loading);
  return loading.then(cloneLoadedModel);
}

function fitToPlaceholder(model: Object3D, placeholder: Object3D, alignToGround = false): void {
  placeholder.updateMatrixWorld(true);
  const targetBounds = new Box3().setFromObject(placeholder);
  const targetSize = targetBounds.getSize(new Vector3());
  const targetCenter = targetBounds.getCenter(new Vector3());
  const targetBottom = targetBounds.min.y;

  model.updateMatrixWorld(true);
  const sourceBounds = new Box3().setFromObject(model);
  const sourceSize = sourceBounds.getSize(new Vector3());
  const scale = Math.min(
    targetSize.x / Math.max(sourceSize.x, 0.001),
    targetSize.y / Math.max(sourceSize.y, 0.001),
    targetSize.z / Math.max(sourceSize.z, 0.001)
  );
  model.scale.multiplyScalar(scale);
  model.updateMatrixWorld(true);

  const scaledBounds = new Box3().setFromObject(model);
  const scaledCenter = scaledBounds.getCenter(new Vector3());
  const centeredOffset = targetCenter.clone().sub(scaledCenter);
  model.position.add(centeredOffset);
  if (alignToGround) {
    model.updateMatrixWorld(true);
    const groundedBounds = new Box3().setFromObject(model);
    model.position.y += targetBottom - groundedBounds.min.y;
  }
}

function loadSpecsForComponent(component: ModelComponent): ProductLoadSpec[] {
  const product = component.metadata.realProductModel;
  if (!product) {
    return [];
  }
  const url = runtimeAssetUrl(product.url);
  return [{
    cacheKey: url,
    url
  }];
}

function intendedProductVisibility(
  component: ModelComponent,
  activeViewMode: ViewMode,
  isolatedComponentId: string | null
): boolean {
  if (component.object.userData.forceHiddenInUrbanScale === true) {
    return false;
  }
  const storedTarget = component.object.userData.realProductTargetVisible;
  if (typeof storedTarget === "boolean") {
    return storedTarget;
  }
  return component.object.visible
    && componentMatchesViewMode(component, activeViewMode)
    && (!isolatedComponentId || component.metadata.id === isolatedComponentId);
}

export function attachRealProductModels(
  group: Group,
  components: ModelComponent[],
  enabled = true,
  activeViewMode: ViewMode = "all",
  isolatedComponentId: string | null = null
): void {
  if (!enabled) {
    return;
  }

  for (const component of components) {
    const product = component.metadata.realProductModel;
    if (!product || component.object.userData.forceHiddenInUrbanScale === true) {
      continue;
    }

    const loadChain = loadSpecsForComponent(component).reduce<Promise<Object3D>>(
      (promise, spec) => promise.catch(() => loadProductModel(spec)),
      Promise.reject(new Error(`No product specs for ${component.metadata.id}`))
    );

    loadChain
      .then((model) => {
        if (!group.parent && component.object.parent !== group) {
          return;
        }
        model.name = `${component.metadata.name} real product model`;
        const modelMetadata = {
          ...component.metadata,
          productModelFor: component.metadata.id,
          realProductModel: product
        };
        model.traverse((object) => {
          object.userData = modelMetadata;
        });
        fitToPlaceholder(model, component.object, component.metadata.id.endsWith("street-tree-real-model-bounds"));
        if (product.replacePlaceholder) {
          component.object.userData.realProductTargetVisible = intendedProductVisibility(component, activeViewMode, isolatedComponentId);
          component.object.userData.realProductReplaced = true;
          component.object.visible = false;
        }
        for (const componentId of product.hideComponentIds ?? []) {
          const hiddenComponent = components.find((item) => item.metadata.id === componentId);
          if (hiddenComponent) {
            hiddenComponent.object.userData.realProductTargetVisible = intendedProductVisibility(hiddenComponent, activeViewMode, isolatedComponentId);
            hiddenComponent.object.userData.realProductReplaced = true;
            hiddenComponent.object.visible = false;
          }
        }
        group.add(model);
        syncRealProductModelVisibility(group, components, activeViewMode, isolatedComponentId);
      })
      .catch((error) => {
        console.warn(`Unable to load product model ${component.metadata.id} from ${product.url}`, error);
      });
  }
}

export function syncRealProductModelVisibility(
  group: Group,
  components: ModelComponent[],
  activeViewMode: ViewMode,
  isolatedComponentId: string | null
): void {
  const visibleById = new Map(
    components.map((component) => [
      component.metadata.id,
      intendedProductVisibility(component, activeViewMode, isolatedComponentId)
    ])
  );

  for (const component of components) {
    if (component.object.userData.realProductReplaced) {
      component.object.visible = false;
    }
  }

  group.traverse((object) => {
    const productModelFor = object.userData.productModelFor as string | undefined;
    if (productModelFor) {
      object.visible = visibleById.get(productModelFor) ?? true;
    }
  });
}
