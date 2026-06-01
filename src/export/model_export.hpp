#pragma once

#include <filesystem>

#include "core/geometry.hpp"

namespace r8 {

void write_ascii_stl(const Component& component, const std::filesystem::path& path);
void write_component_stls(const Model& model, const std::filesystem::path& directory);
void write_model_json(const Model& model, const std::filesystem::path& path);

}  // namespace r8

