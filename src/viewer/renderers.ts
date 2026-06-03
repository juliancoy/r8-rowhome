import { WebGLRenderer, type Camera, type Scene, type WebGLRendererParameters } from "three";

export type PreferredRenderer = {
  domElement: HTMLCanvasElement;
  init?: () => Promise<unknown>;
  render: (scene: Scene, camera: Camera) => void | Promise<void>;
  setPixelRatio: (value: number) => void;
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
  setViewport?: (x: number, y: number, width: number, height: number) => void;
  setScissor?: (x: number, y: number, width: number, height: number) => void;
  setScissorTest?: (enabled: boolean) => void;
  shadowMap?: {
    enabled: boolean;
    type: number;
  };
  dispose?: () => void;
};

export type RendererMode = "WebGPU" | "WebGL2";

/**
 * Create a renderer for the given mode.
 * WebGL2 is the default; WebGPU is used only when explicitly requested.
 */
async function createRendererForMode(
  parameters: WebGLRendererParameters,
  mode: RendererMode
): Promise<{ renderer: PreferredRenderer; mode: RendererMode }> {
  if (mode === "WebGPU" && "gpu" in navigator) {
    try {
      const module = await import("three/webgpu");
      const RendererClass = module.WebGPURenderer as new (params: WebGLRendererParameters) => PreferredRenderer;
      const renderer = new RendererClass(parameters);
      if (renderer.init) {
        await renderer.init();
      }
      return { renderer, mode: "WebGPU" };
    } catch (error) {
      console.warn("WebGPU renderer unavailable; falling back to WebGL2.", error);
    }
  }

  return { renderer: new WebGLRenderer(parameters), mode: "WebGL2" };
}

/**
 * Create the default renderer (WebGL2).
 */
export async function createPreferredRenderer(parameters: WebGLRendererParameters): Promise<{ renderer: PreferredRenderer; mode: RendererMode }> {
  return createRendererForMode(parameters, "WebGL2");
}

/**
 * Toggle between WebGPU and WebGL2.
 * Disposes the current renderer and creates a new one for the opposite mode.
 */
export async function toggleRenderer(
  currentMode: RendererMode,
  currentRenderer: PreferredRenderer,
  parameters: WebGLRendererParameters
): Promise<{ renderer: PreferredRenderer; mode: RendererMode }> {
  const nextMode: RendererMode = currentMode === "WebGPU" ? "WebGL2" : "WebGPU";
  currentRenderer.dispose?.();
  return createRendererForMode(parameters, nextMode);
}
