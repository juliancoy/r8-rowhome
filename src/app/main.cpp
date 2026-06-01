#include <exception>
#include <filesystem>
#include <iostream>
#include <string>

#include "core/geometry.hpp"
#include "export/model_export.hpp"
#include "generators/rowhome_generator.hpp"
#include "render/vulkan_buffers.hpp"

namespace {

struct CliOptions {
  std::filesystem::path json_path = "build/r8-rowhome.json";
  std::filesystem::path stl_dir = "build/stl";
  bool strict = false;
};

CliOptions parse_args(int argc, char** argv) {
  CliOptions options;
  for (int i = 1; i < argc; ++i) {
    const std::string arg = argv[i];
    if (arg == "--json" && i + 1 < argc) {
      options.json_path = argv[++i];
    } else if (arg == "--stl-dir" && i + 1 < argc) {
      options.stl_dir = argv[++i];
    } else if (arg == "--strict") {
      options.strict = true;
    } else if (arg == "--help") {
      std::cout << "Usage: r8-rowhome [--json PATH] [--stl-dir DIR] [--strict]\n";
      std::exit(0);
    } else {
      throw std::runtime_error("unknown or incomplete argument: " + arg);
    }
  }
  return options;
}

}  // namespace

int main(int argc, char** argv) {
  try {
    const CliOptions options = parse_args(argc, argv);

    r8::RowhomeConfig config;
    config.strict_validation = options.strict;
    const r8::Model model = r8::generate_rowhome(config);

    r8::write_model_json(model, options.json_path);
    r8::write_component_stls(model, options.stl_dir);

    const r8::PackedMesh packed = r8::pack_for_render(model);
    std::cout << "Generated " << model.components.size() << " components, "
              << r8::triangle_count(model) << " triangles, " << packed.vertices.size()
              << " render vertices.\n";
    std::cout << "JSON: " << options.json_path << "\n";
    std::cout << "STL directory: " << options.stl_dir << "\n";

    bool has_error = false;
    for (const auto& message : model.validation_messages) {
      const bool is_error = message.severity == r8::ValidationMessage::Severity::Error;
      has_error = has_error || is_error;
      std::cerr << (is_error ? "error" : "warning") << " [" << message.code
                << "]: " << message.message << " (" << message.source << ")\n";
    }

    return has_error && options.strict ? 2 : 0;
  } catch (const std::exception& error) {
    std::cerr << "r8-rowhome: " << error.what() << "\n";
    return 1;
  }
}

