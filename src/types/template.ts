export interface TemplateSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TemplateConfig {
  id: string;
  name: string;
  width: 1080;
  height: 1920;
  background: string;
  // Order: [A1, B1, A2, B2, A3, B3, A4, B4] (§13)
  slots: [TemplateSlot, TemplateSlot, TemplateSlot, TemplateSlot, TemplateSlot, TemplateSlot, TemplateSlot, TemplateSlot];
  text: { title: string; showNames: boolean; showDate: boolean };
}

// MVP: 2 hardcoded JSON templates in frontend (§29). DB table is Post-MVP.
export const TEMPLATES: [TemplateConfig, TemplateConfig] = [
  {
    id: "strip",
    name: "Strip Potret",
    width: 1080,
    height: 1920,
    background: "#ffffff",
    slots: [
      { x: 60, y: 180, width: 470, height: 380 },
      { x: 550, y: 180, width: 470, height: 380 },
      { x: 60, y: 580, width: 470, height: 380 },
      { x: 550, y: 580, width: 470, height: 380 },
      { x: 60, y: 980, width: 470, height: 380 },
      { x: 550, y: 980, width: 470, height: 380 },
      { x: 60, y: 1380, width: 470, height: 380 },
      { x: 550, y: 1380, width: 470, height: 380 },
    ],
    text: { title: "OUR LDR MOMENT", showNames: true, showDate: true },
  },
  {
    id: "grid",
    name: "Grid 2×4",
    width: 1080,
    height: 1920,
    background: "#111111",
    slots: [
      { x: 40, y: 260, width: 480, height: 360 },
      { x: 560, y: 260, width: 480, height: 360 },
      { x: 40, y: 640, width: 480, height: 360 },
      { x: 560, y: 640, width: 480, height: 360 },
      { x: 40, y: 1020, width: 480, height: 360 },
      { x: 560, y: 1020, width: 480, height: 360 },
      { x: 40, y: 1400, width: 480, height: 360 },
      { x: 560, y: 1400, width: 480, height: 360 },
    ],
    text: { title: "OUR LDR MOMENT", showNames: true, showDate: true },
  },
];
