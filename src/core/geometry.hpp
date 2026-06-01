#pragma once

#include <array>
#include <cstddef>
#include <string>
#include <vector>

namespace r8 {

struct Vec3 {
  double x = 0.0;
  double y = 0.0;
  double z = 0.0;
};

struct Color {
  double r = 1.0;
  double g = 1.0;
  double b = 1.0;
};

struct Triangle {
  std::array<Vec3, 3> vertices;
};

struct Mesh {
  std::vector<Triangle> triangles;
};

struct ComponentMetadata {
  std::string id;
  std::string name;
  std::string category;
  std::string material;
  std::string source;
  Color color;
  double estimated_cost_usd = 0.0;
};

struct Component {
  ComponentMetadata metadata;
  Mesh mesh;
};

struct ValidationMessage {
  enum class Severity { Warning, Error };

  Severity severity = Severity::Warning;
  std::string code;
  std::string message;
  std::string source;
};

struct Model {
  std::string name;
  std::vector<Component> components;
  std::vector<ValidationMessage> validation_messages;
};

struct Box {
  Vec3 min;
  Vec3 max;
};

Mesh make_box(Box box);
Mesh make_rect_xy(double x0, double y0, double x1, double y1, double z);
void append_mesh(Mesh& target, const Mesh& source);
std::size_t triangle_count(const Model& model);
double surface_area(const Mesh& mesh);
Vec3 normal(const Triangle& triangle);

}  // namespace r8

