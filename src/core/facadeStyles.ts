export interface FacadeStyleOption {
  id: string;
  label: string;
  costMultiplier: number;
  notes: string;
}

export const facadeStyleOptions: FacadeStyleOption[] = [
  {
    id: "flat-front",
    label: "Flat front",
    costMultiplier: 1,
    notes: "Traditional planar rowhouse front with applied trim."
  },
  {
    id: "bowed-front",
    label: "Curved bowed front",
    costMultiplier: 1.18,
    notes: "Segmented bowed front facade that projects at the center for a richer street wall."
  },
  {
    id: "bay-front",
    label: "Box bay front",
    costMultiplier: 1.12,
    notes: "Planar facade with a projecting upper-story bay."
  }
];

export function selectedFacadeStyle(styleId: string): FacadeStyleOption {
  return facadeStyleOptions.find((option) => option.id === styleId) ?? facadeStyleOptions[0];
}

