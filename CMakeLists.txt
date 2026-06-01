cmake_minimum_required(VERSION 3.20)

project(r8_rowhome LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(r8rowhome_core
  src/core/geometry.cpp
  src/export/model_export.cpp
  src/generators/rowhome_generator.cpp
  src/render/vulkan_buffers.cpp
)

target_include_directories(r8rowhome_core PUBLIC src)

target_compile_options(r8rowhome_core PRIVATE
  $<$<CXX_COMPILER_ID:GNU,Clang>:-Wall -Wextra -Wpedantic>
)

add_executable(r8-rowhome src/app/main.cpp)
target_link_libraries(r8-rowhome PRIVATE r8rowhome_core)

enable_testing()

add_executable(r8-rowhome-tests tests/test_geometry.cpp)
target_link_libraries(r8-rowhome-tests PRIVATE r8rowhome_core)
add_test(NAME r8-rowhome-tests COMMAND r8-rowhome-tests)

