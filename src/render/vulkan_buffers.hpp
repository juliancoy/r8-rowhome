#pragma once

#include <cstdint>
#include <vector>

#include "core/geometry.hpp"

namespace r8 {

struct PackedVertex {
  float x = 0.0f;
  float y = 0.0f;
  float z = 0.0f;
  float nx = 0.0f;
  float ny = 0.0f;
  float nz = 0.0f;
  float r = 1.0f;
  float g = 1.0f;
  float b = 1.0f;
};

struct PackedMesh {
  std::vector<PackedVertex> vertices;
  std::vector<std::uint32_t> indices;
};

PackedMesh pack_for_render(const Model& model);

}  // namespace r8

