const canvas = document.querySelector("#viewport");
const statusEl = document.querySelector("#status");
const componentsEl = document.querySelector("#components");
const bomEl = document.querySelector("#bom");
const validationEl = document.querySelector("#validation");
const resetButton = document.querySelector("#reset-camera");

let camera = { x: 9, y: -118, z: 42, yaw: 0, pitch: -0.28 };

resetButton.addEventListener("click", () => {
  camera = { x: 9, y: -118, z: 42, yaw: 0, pitch: -0.28 };
});

function flattenModel(model) {
  const vertices = [];
  const colors = [];
  for (const component of model.components) {
    for (const tri of component.triangles) {
      for (const v of tri) {
        vertices.push(v[0], v[1], v[2]);
        colors.push(component.color[0], component.color[1], component.color[2]);
      }
    }
  }
  return {
    vertices: new Float32Array(vertices),
    colors: new Float32Array(colors),
    count: vertices.length / 3,
  };
}

function renderPanels(model) {
  componentsEl.innerHTML = model.components.map((component) => `
    <div class="item">
      <strong>${component.name}</strong>
      <div class="muted">${component.category} · ${component.material}</div>
      <div class="muted">${component.source}</div>
    </div>
  `).join("");

  const byMaterial = new Map();
  for (const component of model.components) {
    const row = byMaterial.get(component.material) ?? { count: 0, cost: 0 };
    row.count += 1;
    row.cost += component.estimatedCostUsd ?? 0;
    byMaterial.set(component.material, row);
  }
  bomEl.innerHTML = [...byMaterial.entries()].map(([material, row]) => `
    <div class="item">
      <strong>${material}</strong>
      <div class="muted">${row.count} components · $${Math.round(row.cost).toLocaleString()}</div>
    </div>
  `).join("");

  validationEl.innerHTML = model.validation.map((message) => `
    <div class="item">
      <strong>${message.severity}: ${message.code}</strong>
      <div>${message.message}</div>
      <div class="muted">${message.source}</div>
    </div>
  `).join("");
}

function mat4Perspective(fovy, aspect, near, far) {
  const f = 1.0 / Math.tan(fovy / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, (2 * far * near) * nf, 0,
  ]);
}

function mat4View() {
  const cy = Math.cos(camera.yaw);
  const sy = Math.sin(camera.yaw);
  const cp = Math.cos(camera.pitch);
  const sp = Math.sin(camera.pitch);
  return new Float32Array([
    cy, -sp * sy, cp * sy, 0,
    0, cp, sp, 0,
    -sy, -sp * cy, cp * cy, 0,
    -(cy * camera.x - sy * camera.z),
    -(-sp * sy * camera.x + cp * camera.y - sp * cy * camera.z),
    -(cp * sy * camera.x + sp * camera.y + cp * cy * camera.z),
    1,
  ]);
}

function multiply4(a, b) {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      for (let i = 0; i < 4; i += 1) {
        out[row * 4 + col] += a[row * 4 + i] * b[i * 4 + col];
      }
    }
  }
  return out;
}

async function initWebGpu(model) {
  if (!navigator.gpu) {
    throw new Error("WebGPU is not available in this browser.");
  }

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
    throw new Error("No WebGPU adapter available.");
  }
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: "opaque" });

  const flat = flattenModel(model);
  const vertexBuffer = device.createBuffer({
    size: flat.vertices.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, flat.vertices);

  const colorBuffer = device.createBuffer({
    size: flat.colors.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(colorBuffer, 0, flat.colors);

  const uniformBuffer = device.createBuffer({
    size: 64,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const shader = device.createShaderModule({
    code: `
      struct Uniforms { mvp: mat4x4<f32> };
      @group(0) @binding(0) var<uniform> uniforms: Uniforms;

      struct VertexOut {
        @builtin(position) position: vec4<f32>,
        @location(0) color: vec3<f32>,
      };

      @vertex
      fn vs(@location(0) position: vec3<f32>, @location(1) color: vec3<f32>) -> VertexOut {
        var out: VertexOut;
        out.position = uniforms.mvp * vec4<f32>(position.x - 9.0, position.z, -position.y, 1.0);
        out.color = color;
        return out;
      }

      @fragment
      fn fs(in: VertexOut) -> @location(0) vec4<f32> {
        return vec4<f32>(in.color, 1.0);
      }
    `,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }],
  });
  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: shader,
      entryPoint: "vs",
      buffers: [
        { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: "float32x3" }] },
        { arrayStride: 12, attributes: [{ shaderLocation: 1, offset: 0, format: "float32x3" }] },
      ],
    },
    fragment: {
      module: shader,
      entryPoint: "fs",
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list", cullMode: "back" },
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
  });

  function frame() {
    const width = Math.max(1, canvas.clientWidth * devicePixelRatio);
    const height = Math.max(1, canvas.clientHeight * devicePixelRatio);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    const projection = mat4Perspective(55 * Math.PI / 180, width / height, 0.1, 500);
    const view = mat4View();
    device.queue.writeBuffer(uniformBuffer, 0, multiply4(projection, view));

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.08, g: 0.10, b: 0.12, a: 1 },
        loadOp: "clear",
        storeOp: "store",
      }],
    });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setVertexBuffer(1, colorBuffer);
    pass.draw(flat.count);
    pass.end();
    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  frame();
  statusEl.textContent = `${model.components.length} components · ${flat.count / 3} triangles`;
}

window.addEventListener("keydown", (event) => {
  const step = event.shiftKey ? 6 : 2;
  if (event.key === "w") camera.y += step;
  if (event.key === "s") camera.y -= step;
  if (event.key === "a") camera.x -= step;
  if (event.key === "d") camera.x += step;
  if (event.key === "q") camera.z -= step;
  if (event.key === "e") camera.z += step;
  if (event.key === "ArrowLeft") camera.yaw -= 0.05;
  if (event.key === "ArrowRight") camera.yaw += 0.05;
  if (event.key === "ArrowUp") camera.pitch += 0.03;
  if (event.key === "ArrowDown") camera.pitch -= 0.03;
});

async function main() {
  const response = await fetch("sample-model.json");
  const model = await response.json();
  renderPanels(model);
  await initWebGpu(model);
}

main().catch((error) => {
  statusEl.textContent = error.message;
  console.error(error);
});

