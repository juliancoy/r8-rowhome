#include "render/vulkan_buffers.hpp"

namespace r8 {

PackedMesh pack_for_render(const Model& model) {
  PackedMesh packed;
  for (const auto& component : model.components) {
    for (const auto& triangle : component.mesh.triangles) {
      const Vec3 n = normal(triangle);
      for (const Vec3& vertex : triangle.vertices) {
        packed.indices.push_back(static_cast<std::uint32_t>(packed.vertices.size()));
        packed.vertices.push_back({static_cast<float>(vertex.x),
                                   static_cast<float>(vertex.y),
                                   static_cast<float>(vertex.z),
                                   static_cast<float>(n.x),
                                   static_cast<float>(n.y),
                                   static_cast<float>(n.z),
                                   static_cast<float>(component.metadata.color.r),
                                   static_cast<float>(component.metadata.color.g),
                                   static_cast<float>(component.metadata.color.b)});
      }
    }
  }
  return packed;
}

}  // namespace r8

