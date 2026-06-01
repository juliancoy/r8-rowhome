#include "generators/rowhome_generator.hpp"

#include <algorithm>
#include <string>

namespace r8 {
namespace {

constexpr const char* kR8Source = "sources/code-article-32-section-9-204-r8-rowhouse-residential.html";
constexpr const char* kResidentialCodeSource = "sources/code-building-codes-part-x-international-residential-code-full.html";
constexpr const char* kElectricalSource = "sources/code-building-codes-part-iii-national-electrical-code-full.html";
constexpr const char* kNaturalResourcesSource = "sources/code-article-7-natural-resources-full.html";

Component component(std::string id,
                    std::string name,
                    std::string category,
                    std::string material,
                    std::string source,
                    Color color,
                    Mesh mesh,
                    double estimated_cost_usd) {
  return {{std::move(id),
           std::move(name),
           std::move(category),
           std::move(material),
           std::move(source),
           color,
           estimated_cost_usd},
          std::move(mesh)};
}

Mesh box(double x0, double y0, double z0, double x1, double y1, double z1) {
  return make_box({{x0, y0, z0}, {x1, y1, z1}});
}

void add_validation(Model& model, ValidationMessage::Severity severity, std::string code,
                    std::string message, std::string source) {
  model.validation_messages.push_back(
      {severity, std::move(code), std::move(message), std::move(source)});
}

}  // namespace

Model generate_rowhome(const RowhomeConfig& config) {
  Model model;
  model.name = "Baltimore R-8 Rowhome Concept Model";

  if (config.building_width_ft > config.lot_width_ft) {
    add_validation(model,
                   ValidationMessage::Severity::Error,
                   "building_width_exceeds_lot",
                   "Building width exceeds configured lot width.",
                   kR8Source);
  }

  if (config.building_depth_ft > config.lot_depth_ft) {
    add_validation(model,
                   ValidationMessage::Severity::Error,
                   "building_depth_exceeds_lot",
                   "Building depth exceeds configured lot depth.",
                   kR8Source);
  }

  add_validation(model,
                 ValidationMessage::Severity::Warning,
                 "professional_review_required",
                 "Generated geometry is a design and visualization model, not sealed construction documents.",
                 "plan.md");

  const double width = config.building_width_ft;
  const double depth = config.building_depth_ft;
  const double height = config.stories * config.story_height_ft;
  const double rear_yard_start = depth;

  model.components.push_back(component("lot",
                                       "R-8 lot plane",
                                       "site",
                                       "site surface",
                                       kR8Source,
                                       {0.36, 0.44, 0.34},
                                       box(-1.0, -6.0, -0.15, config.lot_width_ft + 1.0,
                                           config.lot_depth_ft + 1.0, 0.0),
                                       0.0));

  model.components.push_back(component("party-wall-left",
                                       "Left party wall",
                                       "structure",
                                       "masonry",
                                       kResidentialCodeSource,
                                       {0.64, 0.25, 0.18},
                                       box(0.0, 0.0, 0.0, 0.45, depth, height),
                                       8800.0));

  model.components.push_back(component("party-wall-right",
                                       "Right party wall",
                                       "structure",
                                       "masonry",
                                       kResidentialCodeSource,
                                       {0.64, 0.25, 0.18},
                                       box(width - 0.45, 0.0, 0.0, width, depth, height),
                                       8800.0));

  model.components.push_back(component("front-facade",
                                       "Brick front facade",
                                       "facade",
                                       "brick veneer and masonry",
                                       kR8Source,
                                       {0.58, 0.18, 0.12},
                                       box(0.0, -0.35, 0.0, width, 0.0, height),
                                       14500.0));

  model.components.push_back(component("rear-wall",
                                       "Rear wall",
                                       "structure",
                                       "masonry",
                                       kResidentialCodeSource,
                                       {0.50, 0.22, 0.17},
                                       box(0.0, depth, 0.0, width, depth + 0.35, height),
                                       9600.0));

  for (int floor = 0; floor <= static_cast<int>(config.stories); ++floor) {
    const double z = floor * config.story_height_ft;
    model.components.push_back(component("floor-plate-" + std::to_string(floor),
                                         "Floor or roof plate " + std::to_string(floor),
                                         floor == static_cast<int>(config.stories) ? "roof" : "structure",
                                         "engineered wood framing",
                                         kResidentialCodeSource,
                                         {0.73, 0.60, 0.42},
                                         box(0.45, 0.0, z, width - 0.45, depth, z + 0.32),
                                         floor == static_cast<int>(config.stories) ? 7800.0 : 9200.0));
  }

  model.components.push_back(component("parapet-front",
                                       "Front parapet",
                                       "roof",
                                       "masonry coping",
                                       kResidentialCodeSource,
                                       {0.42, 0.18, 0.14},
                                       box(0.0, -0.45, height, width, 0.15, height + 2.2),
                                       2200.0));

  model.components.push_back(component("stoop",
                                       "Front stoop",
                                       "facade",
                                       "concrete",
                                       kR8Source,
                                       {0.56, 0.56, 0.54},
                                       box(5.7, -5.0, 0.0, 12.3, -0.35, 1.4),
                                       4200.0));

  model.components.push_back(component("front-door",
                                       "Front entry door",
                                       "facade",
                                       "insulated exterior door",
                                       kResidentialCodeSource,
                                       {0.08, 0.12, 0.16},
                                       box(7.1, -0.55, 0.2, 10.2, -0.25, 7.4),
                                       1800.0));

  for (int story = 0; story < static_cast<int>(config.stories); ++story) {
    const double z0 = story * config.story_height_ft + 3.0;
    const double z1 = z0 + 4.5;
    model.components.push_back(component("front-window-left-" + std::to_string(story + 1),
                                         "Front left window story " + std::to_string(story + 1),
                                         "facade",
                                         "window assembly",
                                         kResidentialCodeSource,
                                         {0.55, 0.78, 0.92},
                                         box(2.0, -0.60, z0, 5.2, -0.20, z1),
                                         1100.0));
    model.components.push_back(component("front-window-right-" + std::to_string(story + 1),
                                         "Front right window story " + std::to_string(story + 1),
                                         "facade",
                                         "window assembly",
                                         kResidentialCodeSource,
                                         {0.55, 0.78, 0.92},
                                         box(12.6, -0.60, z0, 15.8, -0.20, z1),
                                         1100.0));
  }

  for (int run = 0; run < 3; ++run) {
    const double z = run * config.story_height_ft;
    model.components.push_back(component("stair-run-" + std::to_string(run + 1),
                                         "Interior stair run " + std::to_string(run + 1),
                                         "circulation",
                                         "wood stair framing",
                                         kResidentialCodeSource,
                                         {0.68, 0.48, 0.30},
                                         box(1.2, 18.0, z, 4.4, 31.0, z + config.story_height_ft),
                                         5200.0));
  }

  model.components.push_back(component("kitchen-casework",
                                       "Kitchen casework and electric range",
                                       "interior",
                                       "cabinetry and electric appliance",
                                       kElectricalSource,
                                       {0.86, 0.82, 0.68},
                                       box(10.2, 5.0, 0.0, 17.2, 10.5, 3.2),
                                       12500.0));

  model.components.push_back(component("electrical-panel",
                                       "Electrical panel",
                                       "electrical",
                                       "panelboard",
                                       kElectricalSource,
                                       {0.10, 0.10, 0.12},
                                       box(0.55, 3.0, 3.0, 0.85, 5.2, 6.2),
                                       2600.0));

  model.components.push_back(component("kitchen-240v-outlet",
                                       "Accessible 240 volt range outlet",
                                       "electrical",
                                       "240 V receptacle",
                                       kElectricalSource,
                                       {0.85, 0.15, 0.10},
                                       box(10.0, 4.75, 1.4, 10.35, 4.95, 1.8),
                                       450.0));

  for (int i = 0; i < 8; ++i) {
    const double y = 8.0 + i * 4.0;
    model.components.push_back(component("receptacle-120v-" + std::to_string(i + 1),
                                         "120 volt receptacle " + std::to_string(i + 1),
                                         "electrical",
                                         "120 V receptacle",
                                         kElectricalSource,
                                         {0.95, 0.95, 0.78},
                                         box(width - 0.80, y, 1.2, width - 0.50, y + 0.18, 1.5),
                                         95.0));
  }

  model.components.push_back(component("rear-yard",
                                       "Rear yard service area",
                                       "site",
                                       "pervious yard surface",
                                       kNaturalResourcesSource,
                                       {0.26, 0.50, 0.26},
                                       box(0.0, rear_yard_start + 0.35, -0.10, config.lot_width_ft,
                                           config.lot_depth_ft, 0.02),
                                       0.0));

  if (config.include_tree) {
    model.components.push_back(component("street-tree-trunk",
                                         "Street tree trunk",
                                         "landscape",
                                         "urban tree",
                                         kNaturalResourcesSource,
                                         {0.42, 0.25, 0.12},
                                         box(1.2, -8.0, 0.0, 1.8, -7.4, 8.0),
                                         650.0));
    model.components.push_back(component("street-tree-canopy",
                                         "Street tree canopy",
                                         "landscape",
                                         "urban tree canopy",
                                         kNaturalResourcesSource,
                                         {0.12, 0.42, 0.16},
                                         box(-1.4, -10.4, 7.0, 4.4, -4.6, 13.0),
                                         0.0));
  }

  const auto has_error = std::any_of(model.validation_messages.begin(),
                                     model.validation_messages.end(),
                                     [](const ValidationMessage& message) {
                                       return message.severity == ValidationMessage::Severity::Error;
                                     });
  if (config.strict_validation && has_error) {
    add_validation(model,
                   ValidationMessage::Severity::Error,
                   "strict_validation_failed",
                   "Strict validation was requested and at least one error is present.",
                   "data/constraints/r8-rowhome.json");
  }

  return model;
}

}  // namespace r8

