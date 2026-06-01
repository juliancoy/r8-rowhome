#include "core/geometry.hpp"

#include <cmath>
#include <stdexcept>

namespace r8 {
namespace {

Vec3 subtract(Vec3 a, Vec3 b) {
  return {a.x - b.x, a.y - b.y, a.z - b.z};
}

Vec3 cross(Vec3 a, Vec3 b) {
  return {
      a.y * b.z - a.z * b.y,
      a.z * b.x - a.x * b.z,
      a.x * b.y - a.y * b.x,
  };
}

double length(Vec3 v) {
  return std::sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

void add_quad(Mesh& mesh, Vec3 a, Vec3 b, Vec3 c, Vec3 d) {
  mesh.triangles.push_back({{a, b, c}});
  mesh.triangles.push_back({{a, c, d}});
}

}  // namespace

Mesh make_box(Box box) {
  if (box.max.x <= box.min.x || box.max.y <= box.min.y || box.max.z <= box.min.z) {
    throw std::invalid_argument("box dimensions must be positive");
  }

  const Vec3 p000{box.min.x, box.min.y, box.min.z};
  const Vec3 p001{box.min.x, box.min.y, box.max.z};
  const Vec3 p010{box.min.x, box.max.y, box.min.z};
  const Vec3 p011{box.min.x, box.max.y, box.max.z};
  const Vec3 p100{box.max.x, box.min.y, box.min.z};
  const Vec3 p101{box.max.x, box.min.y, box.max.z};
  const Vec3 p110{box.max.x, box.max.y, box.min.z};
  const Vec3 p111{box.max.x, box.max.y, box.max.z};

  Mesh mesh;
  mesh.triangles.reserve(12);

  add_quad(mesh, p000, p100, p110, p010);  // bottom
  add_quad(mesh, p001, p011, p111, p101);  // top
  add_quad(mesh, p000, p001, p101, p100);  // front
  add_quad(mesh, p010, p110, p111, p011);  // rear
  add_quad(mesh, p000, p010, p011, p001);  // left
  add_quad(mesh, p100, p101, p111, p110);  // right

  return mesh;
}

Mesh make_rect_xy(double x0, double y0, double x1, double y1, double z) {
  if (x1 <= x0 || y1 <= y0) {
    throw std::invalid_argument("rectangle dimensions must be positive");
  }

  Mesh mesh;
  add_quad(mesh, {x0, y0, z}, {x1, y0, z}, {x1, y1, z}, {x0, y1, z});
  return mesh;
}

void append_mesh(Mesh& target, const Mesh& source) {
  target.triangles.insert(target.triangles.end(), source.triangles.begin(), source.triangles.end());
}

std::size_t triangle_count(const Model& model) {
  std::size_t total = 0;
  for (const auto& component : model.components) {
    total += component.mesh.triangles.size();
  }
  return total;
}

double surface_area(const Mesh& mesh) {
  double total = 0.0;
  for (const auto& triangle : mesh.triangles) {
    const Vec3 ab = subtract(triangle.vertices[1], triangle.vertices[0]);
    const Vec3 ac = subtract(triangle.vertices[2], triangle.vertices[0]);
    total += 0.5 * length(cross(ab, ac));
  }
  return total;
}

Vec3 normal(const Triangle& triangle) {
  const Vec3 ab = subtract(triangle.vertices[1], triangle.vertices[0]);
  const Vec3 ac = subtract(triangle.vertices[2], triangle.vertices[0]);
  const Vec3 n = cross(ab, ac);
  const double n_length = length(n);
  if (n_length == 0.0) {
    return {};
  }
  return {n.x / n_length, n.y / n_length, n.z / n_length};
}

}  // namespace r8

