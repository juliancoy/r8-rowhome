#include "export/model_export.hpp"

#include <fstream>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace r8 {
namespace {

std::string json_escape(const std::string& input) {
  std::ostringstream out;
  for (const char ch : input) {
    switch (ch) {
      case '\\':
        out << "\\\\";
        break;
      case '"':
        out << "\\\"";
        break;
      case '\n':
        out << "\\n";
        break;
      default:
        out << ch;
        break;
    }
  }
  return out.str();
}

std::string safe_filename(std::string value) {
  for (char& ch : value) {
    const bool ok = (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
                    (ch >= '0' && ch <= '9') || ch == '-' || ch == '_';
    if (!ok) {
      ch = '_';
    }
  }
  return value;
}

}  // namespace

void write_ascii_stl(const Component& component, const std::filesystem::path& path) {
  std::ofstream out(path);
  if (!out) {
    throw std::runtime_error("failed to open STL for writing: " + path.string());
  }

  out << std::setprecision(9);
  out << "solid " << safe_filename(component.metadata.id) << "\n";
  for (const auto& triangle : component.mesh.triangles) {
    const Vec3 n = normal(triangle);
    out << "  facet normal " << n.x << ' ' << n.y << ' ' << n.z << "\n";
    out << "    outer loop\n";
    for (const Vec3& v : triangle.vertices) {
      out << "      vertex " << v.x << ' ' << v.y << ' ' << v.z << "\n";
    }
    out << "    endloop\n";
    out << "  endfacet\n";
  }
  out << "endsolid " << safe_filename(component.metadata.id) << "\n";
}

void write_component_stls(const Model& model, const std::filesystem::path& directory) {
  std::filesystem::create_directories(directory);
  for (const auto& component : model.components) {
    write_ascii_stl(component, directory / (safe_filename(component.metadata.id) + ".stl"));
  }
}

void write_model_json(const Model& model, const std::filesystem::path& path) {
  if (path.has_parent_path()) {
    std::filesystem::create_directories(path.parent_path());
  }

  std::ofstream out(path);
  if (!out) {
    throw std::runtime_error("failed to open model JSON for writing: " + path.string());
  }

  out << std::setprecision(9);
  out << "{\n";
  out << "  \"name\": \"" << json_escape(model.name) << "\",\n";
  out << "  \"units\": \"feet\",\n";
  out << "  \"components\": [\n";
  for (std::size_t i = 0; i < model.components.size(); ++i) {
    const auto& component = model.components[i];
    const auto& m = component.metadata;
    out << "    {\n";
    out << "      \"id\": \"" << json_escape(m.id) << "\",\n";
    out << "      \"name\": \"" << json_escape(m.name) << "\",\n";
    out << "      \"category\": \"" << json_escape(m.category) << "\",\n";
    out << "      \"material\": \"" << json_escape(m.material) << "\",\n";
    out << "      \"source\": \"" << json_escape(m.source) << "\",\n";
    out << "      \"estimatedCostUsd\": " << m.estimated_cost_usd << ",\n";
    out << "      \"color\": [" << m.color.r << ", " << m.color.g << ", " << m.color.b << "],\n";
    out << "      \"triangles\": [\n";
    for (std::size_t t = 0; t < component.mesh.triangles.size(); ++t) {
      const auto& triangle = component.mesh.triangles[t];
      out << "        [";
      for (std::size_t v = 0; v < triangle.vertices.size(); ++v) {
        const Vec3& p = triangle.vertices[v];
        out << '[' << p.x << ", " << p.y << ", " << p.z << ']';
        if (v + 1 != triangle.vertices.size()) {
          out << ", ";
        }
      }
      out << ']';
      if (t + 1 != component.mesh.triangles.size()) {
        out << ',';
      }
      out << "\n";
    }
    out << "      ]\n";
    out << "    }";
    if (i + 1 != model.components.size()) {
      out << ',';
    }
    out << "\n";
  }
  out << "  ],\n";
  out << "  \"validation\": [\n";
  for (std::size_t i = 0; i < model.validation_messages.size(); ++i) {
    const auto& message = model.validation_messages[i];
    out << "    {\"severity\": \""
        << (message.severity == ValidationMessage::Severity::Error ? "error" : "warning")
        << "\", \"code\": \"" << json_escape(message.code)
        << "\", \"message\": \"" << json_escape(message.message)
        << "\", \"source\": \"" << json_escape(message.source) << "\"}";
    if (i + 1 != model.validation_messages.size()) {
      out << ',';
    }
    out << "\n";
  }
  out << "  ]\n";
  out << "}\n";
}

}  // namespace r8

