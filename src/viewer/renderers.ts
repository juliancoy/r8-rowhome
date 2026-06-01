import { WebGLRenderer, type Camera, type Scene, type WebGLRendererParameters } from "three";

export type PreferredRenderer = {
  domElement: HTMLCanvasElement;
  init?: () => Promise<unknown>;
  render: (scene: Scene, camera: Camera) => void | Promise<void>;
  setPixelRatio: (value: number) => void;
  setSize: (width: number, height: number, updateStyle?: boolean) => void;
  shadowMap?: {
    enabled: boolean;
    type: number;
  };
};

export async function createPreferredRenderer(parameters: WebGLRendererParameters): Promise<{ renderer: PreferredRenderer; mode: "WebGPU" | "WebGL" }> {
  if ("gpu" in navigator) {
    try {
      const module = await import("three/webgpu");
      const RendererClass = module.WebGPURenderer as new (params: WebGLRendererParameters) => PreferredRenderer;
      const renderer = new RendererClass(parameters);
      if (renderer.init) {
        await renderer.init();
      }
      return { renderer, mode: "WebGPU" };
    } catch (error) {
      console.warn("WebGPU renderer unavailable; falling back to WebGL.", error);
    }
  }

  return { renderer: new WebGLRenderer(parameters), mode: "WebGL" };
}
