#include <cassert>
#include <filesystem>

#include "core/geometry.hpp"
#include "export/model_export.hpp"
#include "generators/rowhome_generator.hpp"
#include "render/vulkan_buffers.hpp"

int main() {
  const r8::Mesh cube = r8::make_box({{0.0, 0.0, 0.0}, {1.0, 1.0, 1.0}});
  assert(cube.triangles.size() == 12);
  assert(r8::surface_area(cube) == 6.0);

  r8::RowhomeConfig config;
  const r8::Model model = r8::generate_rowhome(config);
  assert(!model.components.empty());
  assert(r8::triangle_count(model) > 100);

  const r8::PackedMesh packed = r8::pack_for_render(model);
  assert(packed.vertices.size() == packed.indices.size());
  assert(!packed.vertices.empty());

  const std::filesystem::path out = std::filesystem::temp_directory_path() / "r8-rowhome-test.stl";
  r8::write_ascii_stl(model.components.front(), out);
  assert(std::filesystem::exists(out));
  assert(std::filesystem::file_size(out) > 0);

  return 0;
}

