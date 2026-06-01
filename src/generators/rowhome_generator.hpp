#pragma once

#include "core/geometry.hpp"

namespace r8 {

struct RowhomeConfig {
  double lot_width_ft = 18.0;
  double lot_depth_ft = 90.0;
  double building_width_ft = 18.0;
  double building_depth_ft = 48.0;
  double stories = 3.0;
  double story_height_ft = 10.0;
  bool include_tree = true;
  bool strict_validation = false;
};

Model generate_rowhome(const RowhomeConfig& config);

}  // namespace r8

